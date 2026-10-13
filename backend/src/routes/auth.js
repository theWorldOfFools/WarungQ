const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const pool = require('../config/db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

function tanganiValidasi(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ pesan: errors.array()[0].msg });
    return false;
  }
  return true;
}

router.post(
  '/login',
  [body('email').isEmail().withMessage('Email tidak valid.'), body('password').notEmpty().withMessage('Kata sandi wajib diisi.')],
  async (req, res) => {
    if (!tanganiValidasi(req, res)) return;
    const { email, password } = req.body;
    const { rows } = await pool.query('SELECT * FROM users WHERE email=$1 AND aktif=TRUE', [email]);
    const user = rows[0];
    if (!user) return res.status(401).json({ pesan: 'Email atau kata sandi salah.' });
    const cocok = await bcrypt.compare(password, user.password_hash);
    if (!cocok) return res.status(401).json({ pesan: 'Email atau kata sandi salah.' });
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, nama_pengguna: user.nama_pengguna },
      process.env.JWT_SECRET || 'dev-secret',
      { expiresIn: process.env.JWT_EXPIRES_IN || '12h' }
    );
    res.json({
      token,
      pengguna: { id: user.id, nama: user.nama_pengguna, toko: user.nama_toko, email: user.email, peran: user.role },
    });
  }
);

router.get('/me', authRequired, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, nama_pengguna, nama_toko, email, role, aktif FROM users WHERE id=$1',
    [req.user.id]
  );
  if (!rows[0]) return res.status(404).json({ pesan: 'Akun tidak ditemukan.' });
  const u = rows[0];
  res.json({ id: u.id, nama: u.nama_pengguna, toko: u.nama_toko, email: u.email, peran: u.role });
});

module.exports = router;
