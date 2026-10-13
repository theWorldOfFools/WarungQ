/* Seed idempotent: 1 akun Owner + contoh barang warung. */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('./config/db');

async function seed() {
  const email = process.env.SEED_OWNER_EMAIL || 'owner@warung.test';
  const password = process.env.SEED_OWNER_PASSWORD || 'warung123';

  const { rows: existing } = await pool.query('SELECT id FROM users WHERE email=$1', [email]);
  let ownerId;
  if (existing.length === 0) {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO users (nama_pengguna, nama_toko, email, password_hash, role)
       VALUES ('Bu Owner', 'Warung Maju Jaya', $1, $2, 'owner') RETURNING id`,
      [email, hash]
    );
    ownerId = rows[0].id;
    console.log('[seed] owner dibuat:', email);
  } else {
    ownerId = existing[0].id;
    console.log('[seed] owner sudah ada:', email);
  }

  const demo = [
    // barcode, nama, jual, modal, stok, batas, kategori
    ['8991001000011', 'Indomie Goreng', 3500, 2800, 48, 10, 'Makanan'],
    ['8991001000028', 'Beras 1kg', 13500, 11500, 20, 5, 'Sembako'],
    ['8991001000035', 'Minyak Goreng 1L', 22500, 19500, 4, 5, 'Sembako'],
    ['8991001000042', 'Gula Pasir 1kg', 17500, 15000, 0, 5, 'Sembako'],
    ['8991001000059', 'Kopi Sachet', 2000, 1400, 100, 20, 'Minuman'],
    ['8991001000066', 'Teh Botol 450ml', 5000, 3800, 36, 12, 'Minuman'],
    ['8991001000073', 'Sabun Mandi', 4500, 3200, 24, 8, 'Kebersihan'],
  ];
  for (const [barcode, nama, jual, modal, stok, batas, kategori] of demo) {
    await pool.query(
      `INSERT INTO products (barcode, nama, harga_jual, modal_beli, stok, batas_menipis, kategori, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (barcode) DO UPDATE SET nama=EXCLUDED.nama, harga_jual=EXCLUDED.harga_jual,
       kategori=EXCLUDED.kategori`,
      [barcode, nama, jual, modal, stok, batas, kategori, ownerId]
    );
  }
  console.log('[seed] produk demo siap');
  await pool.end();
}

if (require.main === module) {
  seed().catch((e) => {
    console.error('[seed]', e.message);
    process.exit(1);
  });
}

module.exports = seed;
