const pool = require('../config/db');
const { normalisasiWA, rupiah } = require('../utils/warung');

function driver() {
  return String(process.env.WA_DRIVER || 'manual').toLowerCase();
}

function siap() {
  const d = driver();
  if (d === 'waha') return !!process.env.WAHA_URL;
  if (d === 'cloudapi') return !!process.env.WA_CLOUD_TOKEN && !!process.env.WA_PHONE_ID;
  return false;
}

async function getSetting(kunci, bawaan = '') {
  const { rows } = await pool.query('SELECT nilai FROM app_settings WHERE kunci = $1', [kunci]);
  return rows[0]?.nilai ?? bawaan;
}

async function setSetting(kunci, nilai) {
  await pool.query(
    `INSERT INTO app_settings (kunci, nilai, updated_at) VALUES ($1, $2, NOW())
     ON CONFLICT (kunci) DO UPDATE SET nilai = EXCLUDED.nilai, updated_at = NOW()`,
    [kunci, String(nilai)]
  );
}

async function kirimSekarang(tujuan, pesan) {
  const d = driver();
  if (!siap()) return { ok: false, alasan: `Driver WhatsApp "${d}" belum siap.` };
  const nomor = normalisasiWA(tujuan);
  try {
    if (d === 'waha') {
      const base = String(process.env.WAHA_URL).replace(/\/+$/, '');
      const headers = { 'Content-Type': 'application/json' };
      if (process.env.WAHA_API_KEY) headers['X-Api-Key'] = process.env.WAHA_API_KEY;
      const res = await fetch(`${base}/api/sendText`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          session: process.env.WAHA_SESSION || 'default',
          chatId: `${nomor}@c.us`,
          text: pesan,
        }),
      });
      const teks = await res.text();
      if (!res.ok) return { ok: false, alasan: `WAHA ${res.status}: ${teks.slice(0, 200)}` };
      return { ok: true };
    }
    if (d === 'cloudapi') {
      const url = `https://graph.facebook.com/v20.0/${process.env.WA_PHONE_ID}/messages`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.WA_CLOUD_TOKEN}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: nomor,
          type: 'text',
          text: { body: pesan },
        }),
      });
      const teks = await res.text();
      if (!res.ok) return { ok: false, alasan: `Cloud API ${res.status}: ${teks.slice(0, 200)}` };
      return { ok: true };
    }
  } catch (e) {
    return { ok: false, alasan: String(e.message || e).slice(0, 300) };
  }
  return { ok: false, alasan: `Driver "${d}" tidak dikenal.` };
}

async function antre({ tipe = 'manual', tujuan, pesan, refId = null, jadwalAt = null }) {
  const { rows } = await pool.query(
    `INSERT INTO wa_outbox (tipe, tujuan, pesan, ref_id, jadwal_at)
     VALUES ($1, $2, $3, $4, COALESCE($5::timestamptz, NOW())) RETURNING *`,
    [tipe, normalisasiWA(tujuan), pesan, refId, jadwalAt]
  );
  return rows[0];
}

async function prosesOutbox(limit = 10) {
  if (!siap()) return { diproses: 0, terkirim: 0, tertunda: 0, alasan: 'Driver belum siap.' };
  const { rows } = await pool.query(
    `SELECT * FROM wa_outbox
     WHERE status = 'antri' AND jadwal_at <= NOW()
     ORDER BY created_at ASC LIMIT $1`,
    [Math.min(Math.max(Number(limit) || 10, 1), 50)]
  );
  let terkirim = 0;
  let tertunda = 0;
  const maks = Number(process.env.WA_MAX_PERCOBAAN) || 5;
  for (const o of rows) {
    const hasil = await kirimSekarang(o.tujuan, o.pesan);
    if (hasil.ok) {
      terkirim += 1;
      await pool.query(
        `UPDATE wa_outbox SET status = 'terkirim', percobaan = percobaan + 1,
           terkirim_at = NOW(), error = '', updated_at = NOW() WHERE id = $1`,
        [o.id]
      );
    } else {
      tertunda += 1;
      const coba = Number(o.percobaan) + 1;
      const gagal = coba >= maks;
      await pool.query(
        `UPDATE wa_outbox SET status = $1, percobaan = $2, error = $3,
           jadwal_at = NOW() + INTERVAL '2 minutes', updated_at = NOW() WHERE id = $4`,
        [gagal ? 'gagal' : 'antri', coba, String(hasil.alasan || '').slice(0, 300), o.id]
      );
    }
  }
  return { diproses: rows.length, terkirim, tertunda };
}

// Rekap harian ringkas — angka diambil server, bukan dari klien.
async function rekapHarian(tanggal) {
  const { rows: jual } = await pool.query(
    `SELECT COALESCE(SUM(total_masuk) FILTER (WHERE dibayar_via = 'tunai'), 0)::int AS tunai,
            COALESCE(SUM(total_masuk) FILTER (WHERE dibayar_via IN ('qris','transfer','ewallet')), 0)::int AS non_tunai,
            COALESCE(SUM(total_masuk) FILTER (WHERE dibayar_via = 'kasbon'), 0)::int AS kasbon,
            COALESCE(SUM(perkiraan_untung), 0)::int AS untung_kotor,
            COUNT(*)::int AS jumlah_struk
     FROM sales WHERE voided_at IS NULL AND created_at::date = $1`,
    [tanggal]
  );
  const { rows: beban } = await pool.query(
    `SELECT COALESCE((SELECT SUM(jumlah) FROM expenses WHERE tanggal = $1), 0)::int AS pengeluaran,
            COALESCE((SELECT SUM(total_nilai) FROM sale_returns WHERE tipe = 'retur_jual' AND created_at::date = $1), 0)::int AS retur,
            COALESCE((SELECT SUM(total_nilai) FROM sale_returns WHERE tipe = 'writeoff' AND created_at::date = $1), 0)::int AS kerugian`,
    [tanggal]
  );
  const j = jual[0];
  const b = beban[0];
  const bersih = j.untung_kotor - b.pengeluaran - b.retur - b.kerugian;
  return [
    `Rekap Warung ${tanggal}`,
    `Struk: ${j.jumlah_struk}`,
    `Tunai: ${rupiah(j.tunai)}`,
    `Non-tunai: ${rupiah(j.non_tunai)}`,
    `Kasbon: ${rupiah(j.kasbon)}`,
    `Pengeluaran: ${rupiah(b.pengeluaran)}`,
    `Retur: ${rupiah(b.retur)}`,
    `Barang rusak/expired: ${rupiah(b.kerugian)}`,
    `Perkiraan untung bersih: ${rupiah(bersih)}`,
    '',
    'Semangat, jangan lupa tutup kasir ya.',
  ].join('\n');
}

async function antreRekapHarian(tanggal) {
  if (!siap()) return null;
  const { rows: ada } = await pool.query(
    `SELECT id FROM wa_outbox WHERE tipe = 'rekap_harian' AND ref_id = $1 LIMIT 1`,
    [tanggal]
  );
  if (ada[0]) return null;
  if ((await getSetting('wa_rekap_aktif', '1')) === '0') return null;
  const tujuan = (await getSetting('wa_no_pemilik', '')) || process.env.WA_OWNER_NUMBER || '';
  if (!tujuan) return null;
  const pesan = await rekapHarian(tanggal);
  return antre({ tipe: 'rekap_harian', tujuan, pesan, refId: tanggal });
}

module.exports = { driver, siap, getSetting, setSetting, kirimSekarang, antre, prosesOutbox, rekapHarian, antreRekapHarian };
