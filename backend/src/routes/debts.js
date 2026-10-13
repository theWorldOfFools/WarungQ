const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../config/db');
const { authRequired, requireRole } = require('../middleware/auth');
const { normalisasiWA, linkWA, drafTagihan } = require('../utils/warung');

const router = express.Router();
router.use(authRequired);

// Semua endpoint kasbon: OWNER ONLY di V1 (kasir/gudang 403).
router.use(requireRole('owner'));

router.get('/', async (req, res) => {
  const { status = '', q = '' } = req.query;
  const params = [];
  let where = 'WHERE nama_tetangga ILIKE $1';
  params.push(`%${q}%`);
  if (status) {
    where += ' AND status = $2';
    params.push(status);
  }
  const { rows } = await pool.query(
    `SELECT * FROM debts ${where} ORDER BY created_at DESC LIMIT 200`,
    params
  );
  res.json(rows);
});

router.post(
  '/',
  [
    body('nama_tetangga').notEmpty().withMessage('Nama tetangga wajib diisi.'),
    body('no_wa').notEmpty().withMessage('Nomor WA wajib diisi.'),
    body('total_utang').isInt({ min: 1 }).withMessage('Nominal utang harus > 0.'),
  ],
  async (req, res) => {
    if (!validationResult(req).isEmpty())
      return res.status(400).json({ pesan: validationResult(req).array()[0].msg });
    const { nama_tetangga, no_wa, total_utang, jatuh_tempo = null } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO debts (nama_tetangga, no_wa, total_utang, sisa_utang, jatuh_tempo, dicatat_oleh)
       VALUES ($1,$2,$3,$3,$4,$5) RETURNING *`,
      [nama_tetangga, normalisasiWA(no_wa), total_utang, jatuh_tempo || null, req.user.id]
    );
    res.status(201).json(rows[0]);
  }
);

// Bayar cicilan / lunasi — transaksional atomik (satu koneksi + kunci baris).
router.post('/:id/bayar', async (req, res) => {
  const jumlah = Number(req.body.jumlah_bayar || 0);
  if (!Number.isInteger(jumlah) || jumlah <= 0)
    return res.status(400).json({ pesan: 'Nominal bayar harus > 0.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT * FROM debts WHERE id=$1 FOR UPDATE', [req.params.id]);
    const d = rows[0];
    if (!d) {
      await client.query('ROLLBACK');
      return res.status(404).json({ pesan: 'Catatan utang tidak ketemu.' });
    }
    if (jumlah > d.sisa_utang) {
      await client.query('ROLLBACK');
      return res.status(400).json({ pesan: `Kelebihan. Sisa tinggal Rp${d.sisa_utang.toLocaleString('id-ID')}.` });
    }
    const sisa = d.sisa_utang - jumlah;
    const status = sisa === 0 ? 'lunas' : d.status;
    await client.query(`INSERT INTO debt_payments (debt_id, jumlah_bayar, diterima_oleh) VALUES ($1,$2,$3)`, [
      d.id,
      jumlah,
      req.user.id,
    ]);
    const { rows: upd } = await client.query(
      `UPDATE debts SET sisa_utang=$1, status=$2, updated_at=NOW() WHERE id=$3 RETURNING *`,
      [sisa, status, d.id]
    );
    await client.query('COMMIT');
    res.json(upd[0]);
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch {}
    throw e;
  } finally {
    client.release();
  }
});

// Riwayat cicilan satu catatan utang (transparan: tanggal + nominal + penerima).
router.get('/:id/payments', async (req, res) => {
  const { rows: ada } = await pool.query('SELECT id FROM debts WHERE id=$1', [req.params.id]);
  if (!ada[0]) return res.status(404).json({ pesan: 'Catatan utang tidak ketemu.' });
  const { rows } = await pool.query(
    `SELECT p.id, p.jumlah_bayar, p.created_at AS dibayar_pada, u.nama_pengguna AS diterima_oleh
     FROM debt_payments p LEFT JOIN users u ON u.id = p.diterima_oleh
     WHERE p.debt_id=$1 ORDER BY p.created_at ASC`,
    [req.params.id]
  );
  res.json(rows);
});

// Tandai sudah diingatkan (tanpa API WA, hanya status)
router.post('/:id/ingatkan', async (req, res) => {
  const { rows } = await pool.query(
    `UPDATE debts SET status=CASE WHEN status='lunas' THEN 'lunas' ELSE 'diingatkan' END,
     updated_at=NOW() WHERE id=$1 RETURNING *`,
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ pesan: 'Catatan utang tidak ketemu.' });
  res.json(rows[0]);
});

// GET link wa.me + draf otomatis (frontend tinggal window.open)
router.get('/:id/wa-link', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM debts WHERE id=$1', [req.params.id]);
  const d = rows[0];
  if (!d) return res.status(404).json({ pesan: 'Catatan utang tidak ketemu.' });
  const { rows: pemilik } = await pool.query('SELECT nama_toko FROM users WHERE id=$1', [d.dicatat_oleh]);
  const pesan = drafTagihan({
    nama: d.nama_tetangga,
    sisa: d.sisa_utang,
    total: d.total_utang,
    dibayar: Number(d.total_utang || 0) - Number(d.sisa_utang || 0),
    jatuhTempo: d.jatuh_tempo ? new Date(d.jatuh_tempo).toLocaleDateString('id-ID') : null,
    toko: pemilik[0]?.nama_toko || 'warung kami',
  });
  res.json({ link: linkWA(d.no_wa, pesan), draf: pesan, nomor: normalisasiWA(d.no_wa) });
});

module.exports = router;
