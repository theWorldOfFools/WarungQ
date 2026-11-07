const express = require('express');
const pool = require('../config/db');
const { authRequired, requireRole } = require('../middleware/auth');
const { normalisasiWA, drafTagihan, linkWA } = require('../utils/warung');
const wa = require('../services/wa');

const router = express.Router();
router.use(authRequired);
router.use(requireRole('owner'));

const isTanggal = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const isJam = (s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s || ''));
const nomorValid = (n) => /^62\d{8,}$/.test(String(n || ''));

router.get('/status', async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT status, COUNT(*)::int AS jumlah FROM wa_outbox GROUP BY status`
  );
  const hitung = { antri: 0, terkirim: 0, gagal: 0 };
  for (const r of rows) hitung[r.status] = r.jumlah;
  const noPemilik = await wa.getSetting('wa_no_pemilik', process.env.WA_OWNER_NUMBER || '');
  const jamRekap = await wa.getSetting('wa_jam_rekap', '21:00');
  const rekapAktif = (await wa.getSetting('wa_rekap_aktif', '1')) !== '0';
  res.json({
    driver: wa.driver(),
    siap: wa.siap(),
    session: process.env.WAHA_SESSION || 'default',
    no_pemilik: noPemilik,
    jam_rekap: jamRekap,
    rekap_aktif: rekapAktif,
    outbox: hitung,
  });
});

router.get('/outbox', async (req, res) => {
  const params = [];
  const where = [];
  if (['antri', 'terkirim', 'gagal'].includes(req.query.status)) {
    params.push(req.query.status);
    where.push(`status = $${params.length}`);
  }
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
  const { rows } = await pool.query(
    `SELECT * FROM wa_outbox
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY created_at DESC LIMIT ${limit}`,
    params
  );
  res.json(rows);
});

router.get('/pengaturan', async (_req, res) => {
  res.json({
    no_pemilik: await wa.getSetting('wa_no_pemilik', ''),
    jam_rekap: await wa.getSetting('wa_jam_rekap', '21:00'),
    rekap_aktif: (await wa.getSetting('wa_rekap_aktif', '1')) !== '0',
  });
});

router.put('/pengaturan', async (req, res) => {
  const { no_pemilik, jam_rekap, rekap_aktif } = req.body || {};
  const nomor = no_pemilik ? normalisasiWA(no_pemilik) : '';
  if (no_pemilik && !nomorValid(nomor)) {
    return res.status(400).json({ pesan: 'Nomor WA pemilik tidak valid.' });
  }
  if (jam_rekap !== undefined && !isJam(jam_rekap)) {
    return res.status(400).json({ pesan: 'Jam rekap harus format HH:MM.' });
  }
  if (no_pemilik !== undefined) await wa.setSetting('wa_no_pemilik', nomor);
  if (jam_rekap !== undefined) await wa.setSetting('wa_jam_rekap', jam_rekap);
  if (rekap_aktif !== undefined) {
    await wa.setSetting('wa_rekap_aktif', rekap_aktif ? '1' : '0');
  }
  res.json({ pesan: 'Pengaturan WhatsApp tersimpan.' });
});

router.post('/kirim', async (req, res) => {
  const tujuan = normalisasiWA(req.body?.tujuan);
  const pesan = String(req.body?.pesan || '').trim();
  if (!nomorValid(tujuan)) return res.status(400).json({ pesan: 'Nomor tujuan tidak valid.' });
  if (!pesan) return res.status(400).json({ pesan: 'Pesan tidak boleh kosong.' });
  if (pesan.length > 2000) return res.status(400).json({ pesan: 'Pesan maksimal 2000 karakter.' });
  if (!wa.siap()) {
    return res.status(503).json({
      pesan: `WhatsApp otomatis belum aktif (driver: ${wa.driver()}). Atur WAHA_URL/WA_DRIVER dulu.`,
      driver: wa.driver(),
    });
  }
  const outbox = await wa.antre({ tipe: 'manual', tujuan, pesan });
  await wa.prosesOutbox(10);
  const { rows } = await pool.query('SELECT * FROM wa_outbox WHERE id = $1', [outbox.id]);
  res.status(201).json({
    terkirim: rows[0]?.status === 'terkirim',
    outbox: rows[0],
    pesan: rows[0]?.status === 'terkirim' ? 'Pesan terkirim.' : 'Pesan masuk antrean.',
  });
});

router.post('/proses', async (_req, res) => {
  if (!wa.siap()) {
    return res.status(503).json({ pesan: `WhatsApp otomatis belum aktif (driver: ${wa.driver()}).` });
  }
  const hasil = await wa.prosesOutbox(50);
  res.json({ ...hasil, pesan: `Antrean diproses: ${hasil.terkirim} terkirim.` });
});

router.post('/rekap', async (req, res) => {
  const tanggal = isTanggal(req.body?.tanggal) ? req.body.tanggal : new Date().toISOString().slice(0, 10);
  let tujuan = normalisasiWA(req.body?.tujuan);
  if (!tujuan) {
    tujuan = normalisasiWA((await wa.getSetting('wa_no_pemilik', '')) || process.env.WA_OWNER_NUMBER || '');
  }
  if (!nomorValid(tujuan)) return res.status(400).json({ pesan: 'Nomor penerima rekap belum diatur.' });
  if (!wa.siap()) {
    return res.status(503).json({
      pesan: `WhatsApp otomatis belum aktif (driver: ${wa.driver()}).`,
      driver: wa.driver(),
    });
  }
  const pesan = await wa.rekapHarian(tanggal);
  const outbox = await wa.antre({ tipe: 'rekap_harian', tujuan, pesan, refId: `manual:${tanggal}` });
  await wa.prosesOutbox(10);
  const { rows } = await pool.query('SELECT * FROM wa_outbox WHERE id = $1', [outbox.id]);
  res.status(201).json({
    terkirim: rows[0]?.status === 'terkirim',
    outbox: rows[0],
    pesan: rows[0]?.status === 'terkirim' ? 'Rekap terkirim.' : 'Rekap masuk antrean.',
  });
});

router.post('/kasbon/:id', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM debts WHERE id = $1', [req.params.id]);
  const d = rows[0];
  if (!d) return res.status(404).json({ pesan: 'Catatan utang tidak ketemu.' });
  if (d.sisa_utang <= 0) return res.status(400).json({ pesan: 'Kasbon ini sudah lunas.' });
  const { rows: pemilik } = await pool.query('SELECT nama_toko FROM users WHERE id = $1', [d.dicatat_oleh]);
  const draf = drafTagihan({
    nama: d.nama_tetangga,
    sisa: d.sisa_utang,
    total: d.total_utang,
    dibayar: Number(d.total_utang || 0) - Number(d.sisa_utang || 0),
    jatuhTempo: d.jatuh_tempo ? new Date(d.jatuh_tempo).toLocaleDateString('id-ID') : null,
    toko: pemilik[0]?.nama_toko || 'warung kami',
  });
  const link = linkWA(d.no_wa, draf);
  if (!wa.siap()) {
    return res.json({
      terkirim: false,
      alasan: `WhatsApp otomatis belum aktif (driver: ${wa.driver()}).`,
      link,
      draf,
    });
  }
  const outbox = await wa.antre({ tipe: 'tagihan_kasbon', tujuan: d.no_wa, pesan: draf, refId: d.id });
  await wa.prosesOutbox(10);
  const { rows: cek } = await pool.query('SELECT * FROM wa_outbox WHERE id = $1', [outbox.id]);
  if (cek[0]?.status === 'terkirim') {
    await pool.query(
      `UPDATE debts SET status = CASE WHEN status = 'lunas' THEN 'lunas' ELSE 'diingatkan' END,
       updated_at = NOW() WHERE id = $1`,
      [d.id]
    );
  }
  res.json({
    terkirim: cek[0]?.status === 'terkirim',
    alasan: cek[0]?.status === 'terkirim' ? '' : cek[0]?.error || 'Masuk antrean.',
    outbox: cek[0],
    link,
    draf,
  });
});

module.exports = router;
