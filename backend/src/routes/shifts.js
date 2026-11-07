const express = require('express');
const pool = require('../config/db');
const { authRequired, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);
router.use(requireRole('owner', 'kasir'));

// Hitung ulang uang laci dari transaksi yang menempel pada shift.
// Tunai + pelunasan kasbon = uang fisik yang seharusnya ada.
async function hitungShift(q, shiftId) {
  const { rows } = await q.query(
    `SELECT
       COALESCE(SUM(s.total_masuk) FILTER (WHERE s.dibayar_via = 'tunai'), 0)::int AS total_tunai,
       COALESCE(SUM(s.total_masuk) FILTER (WHERE s.dibayar_via IN ('qris', 'transfer', 'ewallet')), 0)::int AS total_non_tunai,
       COALESCE(SUM(s.total_masuk) FILTER (WHERE s.dibayar_via = 'kasbon'), 0)::int AS total_kasbon,
       COUNT(*)::int AS jumlah_transaksi
     FROM sales s
     WHERE s.shift_id = $1 AND s.voided_at IS NULL`,
    [shiftId]
  );
  const { rows: bayar } = await q.query(
    'SELECT COALESCE(SUM(jumlah_bayar), 0)::int AS total_pelunasan FROM debt_payments WHERE shift_id = $1',
    [shiftId]
  );
  return { ...rows[0], total_pelunasan: bayar[0].total_pelunasan };
}

const bolehLihat = (req, shift) => req.user.role === 'owner' || shift.kasir_id === req.user.id;

// GET /api/shifts/aktif — shift terbuka milik pengguna saat ini (atau null).
router.get('/aktif', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT sh.*, u.nama_pengguna AS kasir_nama
     FROM shifts sh JOIN users u ON u.id = sh.kasir_id
     WHERE sh.kasir_id = $1 AND sh.status = 'buka'
     ORDER BY sh.mulai DESC LIMIT 1`,
    [req.user.id]
  );
  if (!rows[0]) return res.json(null);
  const hitungan = await hitungShift(pool, rows[0].id);
  res.json({ ...rows[0], ...hitungan, uang_seharusnya: rows[0].kas_awal + hitungan.total_tunai + hitungan.total_pelunasan });
});

// GET /api/shifts — riwayat shift (owner: semua, kasir: milik sendiri).
router.get('/', async (req, res) => {
  const params = [];
  const where = [];
  if (req.user.role !== 'owner') {
    params.push(req.user.id);
    where.push(`sh.kasir_id = $${params.length}`);
  }
  if (['buka', 'tutup'].includes(req.query.status)) {
    params.push(req.query.status);
    where.push(`sh.status = $${params.length}`);
  }
  const { rows } = await pool.query(
    `SELECT sh.*, u.nama_pengguna AS kasir_nama
     FROM shifts sh JOIN users u ON u.id = sh.kasir_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY sh.mulai DESC LIMIT 100`,
    params
  );
  res.json(rows);
});

// GET /api/shifts/:id — detail satu shift + hitungan live.
router.get('/:id', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT sh.*, u.nama_pengguna AS kasir_nama
     FROM shifts sh JOIN users u ON u.id = sh.kasir_id
     WHERE sh.id = $1`,
    [req.params.id]
  );
  const shift = rows[0];
  if (!shift) return res.status(404).json({ pesan: 'Shift tidak ketemu.' });
  if (!bolehLihat(req, shift)) return res.status(403).json({ pesan: 'Bukan shift Anda.' });
  const hitungan = await hitungShift(pool, shift.id);
  res.json({ ...shift, ...hitungan });
});

// POST /api/shifts/buka — mulai shift dengan kas awal di laci.
router.post('/buka', async (req, res) => {
  const kasAwal = Number(req.body?.kas_awal ?? 0);
  if (!Number.isInteger(kasAwal) || kasAwal < 0) {
    return res.status(400).json({ pesan: 'Kas awal harus bilangan bulat minimal 0.' });
  }
  try {
    const { rows } = await pool.query(
      'INSERT INTO shifts (kasir_id, kas_awal) VALUES ($1, $2) RETURNING *',
      [req.user.id, kasAwal]
    );
    res.status(201).json({ ...rows[0], pesan: 'Kasir dibuka. Selamat jualan!' });
  } catch (e) {
    if (e.code === '23505') {
      return res.status(400).json({ pesan: 'Masih ada shift terbuka. Tutup dulu sebelum buka lagi.' });
    }
    res.status(500).json({ pesan: 'Gagal membuka kasir.' });
  }
});

// POST /api/shifts/:id/tutup — hitung selisih kas & tutup shift.
router.post('/:id/tutup', async (req, res) => {
  const kasFisik = Number(req.body?.kas_fisik);
  if (!Number.isInteger(kasFisik) || kasFisik < 0) {
    return res.status(400).json({ pesan: 'Uang fisik di laci harus bilangan bulat minimal 0.' });
  }
  const catatan = String(req.body?.catatan || '').trim().slice(0, 300);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT * FROM shifts WHERE id = $1 FOR UPDATE', [req.params.id]);
    const shift = rows[0];
    if (!shift) {
      await client.query('ROLLBACK');
      return res.status(404).json({ pesan: 'Shift tidak ketemu.' });
    }
    if (!bolehLihat(req, shift)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ pesan: 'Bukan shift Anda.' });
    }
    if (shift.status !== 'buka') {
      await client.query('ROLLBACK');
      return res.status(400).json({ pesan: 'Shift ini sudah ditutup.' });
    }

    const h = await hitungShift(client, shift.id);
    const seharusnya = Number(shift.kas_awal) + h.total_tunai + h.total_pelunasan;
    const selisih = kasFisik - seharusnya;
    const { rows: upd } = await client.query(
      `UPDATE shifts SET
         status = 'tutup', selesai = NOW(), kas_fisik = $1,
         total_tunai = $2, total_non_tunai = $3, total_kasbon = $4,
         total_pelunasan = $5, jumlah_transaksi = $6,
         uang_seharusnya = $7, selisih = $8, catatan = $9, updated_at = NOW()
       WHERE id = $10 RETURNING *`,
      [kasFisik, h.total_tunai, h.total_non_tunai, h.total_kasbon, h.total_pelunasan, h.jumlah_transaksi, seharusnya, selisih, catatan, shift.id]
    );
    await client.query('COMMIT');

    const pesan =
      selisih === 0
        ? 'Kas pas. Shift ditutup.'
        : selisih > 0
          ? `Kas lebih Rp${selisih.toLocaleString('id-ID')}. Shift ditutup.`
          : `Kas kurang Rp${Math.abs(selisih).toLocaleString('id-ID')}. Shift ditutup.`;
    res.json({ ...upd[0], pesan });
  } catch {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ pesan: 'Gagal menutup shift.' });
  } finally {
    client.release();
  }
});

module.exports = router;
