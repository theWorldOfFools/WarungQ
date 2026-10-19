const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../config/db');
const { authRequired, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

// Semua endpoint pengeluaran: OWNER ONLY (mempengaruhi Untung Bersih).
router.use(requireRole('owner'));

const isTanggal = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));

// GET /api/expenses?dari=&sampai=&kategori= — daftar + total sesuai filter.
router.get('/', async (req, res) => {
  const { dari = '', sampai = '', kategori = '' } = req.query;
  const params = [];
  const where = [];
  if (isTanggal(dari)) {
    params.push(dari);
    where.push(`e.tanggal >= $${params.length}`);
  }
  if (isTanggal(sampai)) {
    params.push(sampai);
    where.push(`e.tanggal <= $${params.length}`);
  }
  if (kategori) {
    params.push(kategori);
    where.push(`e.kategori = $${params.length}`);
  }
  const { rows } = await pool.query(
    `SELECT e.*, u.nama_pengguna AS dicatat_oleh_nama
     FROM expenses e LEFT JOIN users u ON u.id = e.dicatat_oleh
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY e.tanggal DESC, e.created_at DESC LIMIT 500`,
    params
  );
  const total = rows.reduce((s, r) => s + Number(r.jumlah || 0), 0);
  res.json({ total, pengeluaran: rows });
});

router.post(
  '/',
  [
    body('jumlah').isInt({ min: 1 }).withMessage('Nominal pengeluaran harus lebih dari 0.'),
    body('tanggal')
      .optional({ values: 'falsy' })
      .matches(/^\d{4}-\d{2}-\d{2}$/)
      .withMessage('Format tanggal tidak valid (YYYY-MM-DD).'),
  ],
  async (req, res) => {
    if (!validationResult(req).isEmpty())
      return res.status(400).json({ pesan: validationResult(req).array()[0].msg });
    const { tanggal = null, jumlah } = req.body;
    const kategori = String(req.body.kategori || 'Lainnya').trim().slice(0, 50) || 'Lainnya';
    const keterangan = String(req.body.keterangan || '').trim().slice(0, 200);
    const { rows } = await pool.query(
      `INSERT INTO expenses (tanggal, kategori, keterangan, jumlah, dicatat_oleh)
       VALUES (COALESCE($1::date, CURRENT_DATE), $2, $3, $4, $5) RETURNING *`,
      [tanggal, kategori, keterangan, jumlah, req.user.id]
    );
    res.status(201).json(rows[0]);
  }
);

// Hapus catatan pengeluaran (koreksi salah input).
router.delete('/:id', async (req, res) => {
  const { rows } = await pool.query('DELETE FROM expenses WHERE id=$1 RETURNING id', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ pesan: 'Catatan pengeluaran tidak ketemu.' });
  res.json({ pesan: 'Pengeluaran dihapus.' });
});

module.exports = router;
