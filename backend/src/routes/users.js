const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const pool = require('../config/db');
const { authRequired, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired, requireRole('owner'));

// GET /api/users — daftar kasir & gudang (tanpa password_hash)
router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, nama_pengguna, email, role, aktif, created_at FROM users ORDER BY created_at ASC'
  );
  res.json(rows);
});

router.post(
  '/',
  [
    body('nama_pengguna').notEmpty().withMessage('Nama wajib diisi.'),
    body('email').isEmail().withMessage('Email tidak valid.'),
    body('password').isLength({ min: 6 }).withMessage('Kata sandi minimal 6 huruf.'),
    body('role').isIn(['owner', 'kasir', 'gudang']).withMessage('Peran harus owner/kasir/gudang.'),
  ],
  async (req, res) => {
    if (!validationResult(req).isEmpty())
      return res.status(400).json({ pesan: validationResult(req).array()[0].msg });
    const { nama_pengguna, email, password, role, nama_toko = 'Warung Saya' } = req.body;
    try {
      const hash = await bcrypt.hash(password, 10);
      const { rows } = await pool.query(
        `INSERT INTO users (nama_pengguna, email, password_hash, role, nama_toko)
         VALUES ($1,$2,$3,$4,$5)
         RETURNING id, nama_pengguna, email, role, aktif`,
        [nama_pengguna, email, hash, role, nama_toko]
      );
      res.status(201).json(rows[0]);
    } catch (e) {
      if (e.code === '23505') return res.status(409).json({ pesan: 'Email sudah dipakai.' });
      throw e;
    }
  }
);

router.put('/:id/aktif', async (req, res) => {
  const { aktif } = req.body;
  const { rows } = await pool.query('UPDATE users SET aktif=$1 WHERE id=$2 RETURNING id, aktif', [
    !!aktif,
    req.params.id,
  ]);
  if (!rows[0]) return res.status(404).json({ pesan: 'Pengguna tidak ketemu.' });
  res.json(rows[0]);
});

router.delete('/:id', async (req, res) => {
  if (req.params.id === req.user.id)
    return res.status(400).json({ pesan: 'Tidak bisa menghapus akun sendiri.' });
  await pool.query('DELETE FROM users WHERE id=$1', [req.params.id]);
  res.json({ pesan: 'Pengguna dihapus.' });
});

module.exports = router;
