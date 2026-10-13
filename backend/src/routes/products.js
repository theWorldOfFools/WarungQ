const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../config/db');
const { authRequired, requireRole } = require('../middleware/auth');
const { sensorProduk } = require('../utils/warung');

const router = express.Router();
router.use(authRequired);

function statusStok(stok, batas) {
  if (stok <= 0) return 'habis';
  if (stok <= batas) return 'menipis';
  return 'aman';
}

// GET /api/products?q=&status=&kategori= — semua peran boleh lihat, tapi modal disensor.
router.get('/', async (req, res) => {
  const { q = '', status = '', kategori = '' } = req.query;
  const params = [`%${q}%`];
  let where = `WHERE (nama ILIKE $1 OR barcode ILIKE $1)`;
  if (kategori && kategori !== 'Semua') {
    params.push(kategori);
    where += ` AND kategori = $${params.length}`;
  }
  const { rows } = await pool.query(
    `SELECT * FROM products ${where} ORDER BY nama ASC LIMIT 200`,
    params
  );
  let data = rows.map((r) => ({ ...sensorProduk(r, req.user.role), status_stok: statusStok(r.stok, r.batas_menipis) }));
  if (status) data = data.filter((d) => d.status_stok === status);
  res.json(data);
});

router.get('/kategori/daftar', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT DISTINCT kategori FROM products ORDER BY kategori ASC`
  );
  res.json({ baku: KATEGORI_BAKU, dipakai: rows.map((r) => r.kategori) });
});

router.get('/:id', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM products WHERE id=$1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ pesan: 'Barang tidak ketemu.' });
  const r = rows[0];
  res.json({ ...sensorProduk(r, req.user.role), status_stok: statusStok(r.stok, r.batas_menipis) });
});

const validasiBarang = [
  body('nama').notEmpty().withMessage('Nama barang wajib diisi.'),
  body('harga_jual').isInt({ min: 0 }).withMessage('Harga jual harus angka >= 0.'),
  body('modal_beli').optional().isInt({ min: 0 }).withMessage('Modal beli harus angka >= 0.'),
  body('stok').optional().isInt().withMessage('Stok harus angka.'),
  body('kategori').optional().isLength({ max: 50 }).withMessage('Kategori maksimal 50 huruf.'),
];

// Daftar kategori baku V1 untuk filter cepat kasir/stok.
const KATEGORI_BAKU = ['Sembako', 'Makanan', 'Minuman', 'Rokok', 'Kebersihan', 'Kesehatan', 'Lainnya'];

function rapikanKategori(k) {
  const s = String(k || '').trim().slice(0, 50);
  return s || 'Lainnya';
}

// POST/PUT/DELETE — hanya owner & gudang. Kasir DILARANG.
router.post('/', requireRole('owner', 'gudang'), validasiBarang, async (req, res) => {
  if (!validationResult(req).isEmpty())
    return res.status(400).json({ pesan: validationResult(req).array()[0].msg });
  const { barcode = null, nama, harga_jual, modal_beli = 0, stok = 0, batas_menipis = 5, kategori = 'Lainnya' } = req.body;
  // Gudang tidak boleh ubah harga/modal seenaknya? V1: boleh input stok, harga diset owner.
  // Longgar di V1: gudang boleh input semua kecuali nanti diketatkan. Owner bebas.
  try {
    const { rows } = await pool.query(
      `INSERT INTO products (barcode, nama, harga_jual, modal_beli, stok, batas_menipis, kategori, created_by)
       VALUES (NULLIF($1,''), $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [barcode, nama, harga_jual, modal_beli, stok, batas_menipis, rapikanKategori(kategori), req.user.id]
    );
    await pool.query(
      `INSERT INTO stock_movements (product_id, tipe, jumlah, sisa, catatan, oleh)
       VALUES ($1,'masuk',$2,$2,$3,$4)`,
      [rows[0].id, stok, 'Stok awal', req.user.id]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ pesan: 'Barcode sudah dipakai barang lain.' });
    throw e;
  }
});

router.put('/:id', requireRole('owner', 'gudang'), async (req, res) => {
  const { rows: lama } = await pool.query('SELECT * FROM products WHERE id=$1', [req.params.id]);
  if (!lama[0]) return res.status(404).json({ pesan: 'Barang tidak ketemu.' });
  const b = lama[0];
  const nama = req.body.nama ?? b.nama;
  const harga_jual = req.body.harga_jual ?? b.harga_jual;
  // Hanya owner yang boleh ubah modal_beli & harga_jual. Gudang hanya stok/batas.
  const modal_beli = req.user.role === 'owner' ? (req.body.modal_beli ?? b.modal_beli) : b.modal_beli;
  const hargaFinal = req.user.role === 'owner' ? harga_jual : b.harga_jual;
  const stok = req.body.stok ?? b.stok;
  const batas = req.body.batas_menipis ?? b.batas_menipis;
  const barcode = req.body.barcode !== undefined ? req.body.barcode || null : b.barcode;
  const kategori = req.body.kategori !== undefined ? rapikanKategori(req.body.kategori) : b.kategori || 'Lainnya';
  const { rows } = await pool.query(
    `UPDATE products SET barcode=$1, nama=$2, harga_jual=$3, modal_beli=$4, stok=$5,
     batas_menipis=$6, kategori=$7, updated_at=NOW() WHERE id=$8 RETURNING *`,
    [barcode, nama, hargaFinal, modal_beli, stok, batas, kategori, req.params.id]
  );
  if (stok !== b.stok) {
    await pool.query(
      `INSERT INTO stock_movements (product_id, tipe, jumlah, sisa, catatan, oleh)
       VALUES ($1,'opname',$2,$3,$4,$5)`,
      [req.params.id, stok - b.stok, stok, 'Penyesuaian stok', req.user.id]
    );
  }
  res.json(rows[0]);
});

router.delete('/:id', requireRole('owner'), async (req, res) => {
  await pool.query('DELETE FROM products WHERE id=$1', [req.params.id]);
  res.json({ pesan: 'Barang dihapus.' });
});

// POST /api/products/masuk — tambah stok cepat (gudang & owner)
router.post('/:id/masuk', requireRole('owner', 'gudang'), async (req, res) => {
  const jumlah = Number(req.body.jumlah || 0);
  if (!Number.isInteger(jumlah) || jumlah <= 0)
    return res.status(400).json({ pesan: 'Jumlah harus angka lebih dari 0.' });
  const { rows } = await pool.query('SELECT * FROM products WHERE id=$1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ pesan: 'Barang tidak ketemu.' });
  const sisa = rows[0].stok + jumlah;
  await pool.query('UPDATE products SET stok=$1, updated_at=NOW() WHERE id=$2', [sisa, req.params.id]);
  await pool.query(
    `INSERT INTO stock_movements (product_id, tipe, jumlah, sisa, catatan, oleh)
     VALUES ($1,'masuk',$2,$3,$4,$5)`,
    [req.params.id, jumlah, sisa, req.body.catatan || 'Barang masuk', req.user.id]
  );
  res.json({ pesan: `Stok bertambah ${jumlah}. Sisa: ${sisa}.`, sisa });
});

module.exports = router;
