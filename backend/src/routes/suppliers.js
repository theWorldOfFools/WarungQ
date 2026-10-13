const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../config/db');
const { authRequired, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

function isKasir(role) {
  return role !== 'owner';
}

// Sensor harga beli untuk kasir: samarkan seperti modal_beli.
function sensorBaris(r, role) {
  if (role === 'owner') return r;
  const { harga_beli, ...rest } = r;
  return rest;
}

// ---------- Daftar suplier ----------
// GET /api/suppliers?q= — semua peran boleh lihat (kasir: tanpa harga detail).
router.get('/', async (req, res) => {
  const { q = '' } = req.query;
  const { rows } = await pool.query(
    `SELECT s.*,
       (SELECT COUNT(*)::int FROM product_suppliers ps WHERE ps.supplier_id = s.id) AS jumlah_produk
     FROM suppliers s
     WHERE s.nama ILIKE $1
     ORDER BY s.nama ASC LIMIT 200`,
    [`%${q}%`]
  );
  res.json(rows);
});

// POST /api/suppliers — owner & gudang (kasir dilarang).
router.post(
  '/',
  requireRole('owner', 'gudang'),
  [
    body('nama').notEmpty().withMessage('Nama suplier wajib diisi.'),
    body('kontak_wa').optional().isLength({ max: 20 }).withMessage('No. WA maksimal 20 karakter.'),
  ],
  async (req, res) => {
    if (!validationResult(req).isEmpty())
      return res.status(400).json({ pesan: validationResult(req).array()[0].msg });
    const { nama, kontak_wa = '', alamat = '' } = req.body;
    try {
      const { rows } = await pool.query(
        `INSERT INTO suppliers (nama, kontak_wa, alamat, created_by)
         VALUES ($1,$2,$3,$4) RETURNING *`,
        [String(nama).trim(), String(kontak_wa).trim(), String(alamat).trim(), req.user.id]
      );
      res.status(201).json(rows[0]);
    } catch (e) {
      if (e.code === '23505') return res.status(409).json({ pesan: 'Suplier dengan nama itu sudah ada.' });
      throw e;
    }
  }
);

router.put('/:id', requireRole('owner', 'gudang'), async (req, res) => {
  const { nama, kontak_wa, alamat } = req.body;
  const { rows } = await pool.query('SELECT * FROM suppliers WHERE id=$1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ pesan: 'Suplier tidak ketemu.' });
  const s = rows[0];
  try {
    const { rows: upd } = await pool.query(
      `UPDATE suppliers SET nama=$1, kontak_wa=$2, alamat=$3, updated_at=NOW()
       WHERE id=$4 RETURNING *`,
      [nama ?? s.nama, kontak_wa ?? s.kontak_wa, alamat ?? s.alamat, req.params.id]
    );
    res.json(upd[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ pesan: 'Suplier dengan nama itu sudah ada.' });
    throw e;
  }
});

router.delete('/:id', requireRole('owner'), async (req, res) => {
  await pool.query('DELETE FROM suppliers WHERE id=$1', [req.params.id]);
  res.json({ pesan: 'Suplier dihapus.' });
});

// ---------- Harga per produk ----------
// GET /api/suppliers/daftar-kulakan — rekomendasi kulakan:
// produk menipis/habis + suplier termurah. Owner & gudang (kasir: harga disensor).
router.get('/daftar-kulakan', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT p.id AS product_id, p.nama, p.barcode, p.kategori, p.stok, p.batas_menipis,
       murah.supplier_id, murah.nama_suplier, murah.kontak_wa, murah.harga_beli
     FROM products p
     LEFT JOIN LATERAL (
       SELECT s.id AS supplier_id, s.nama AS nama_suplier, s.kontak_wa, ps.harga_beli
       FROM product_suppliers ps JOIN suppliers s ON s.id = ps.supplier_id
       WHERE ps.product_id = p.id
       ORDER BY ps.harga_beli ASC LIMIT 1
     ) murah ON TRUE
     WHERE p.stok <= p.batas_menipis
     ORDER BY p.stok ASC, p.nama ASC
     LIMIT 100`
  );
  res.json(rows.map((r) => sensorBaris(r, req.user.role)));
});

// GET /api/suppliers/oleh-produk/:productId — perbandingan harga per produk + flag termurah.
router.get('/oleh-produk/:productId', async (req, res) => {
  const { rows: ada } = await pool.query('SELECT id FROM products WHERE id=$1', [req.params.productId]);
  if (!ada[0]) return res.status(404).json({ pesan: 'Barang tidak ketemu.' });
  const { rows } = await pool.query(
    `SELECT ps.id, ps.product_id, ps.harga_beli, ps.catatan, ps.updated_at,
       s.id AS supplier_id, s.nama AS nama_suplier, s.kontak_wa, s.alamat
     FROM product_suppliers ps JOIN suppliers s ON s.id = ps.supplier_id
     WHERE ps.product_id=$1 ORDER BY ps.harga_beli ASC`,
    [req.params.productId]
  );
  const termurah = rows.length ? rows[0].harga_beli : null;
  res.json(
    rows.map((r) => ({
      ...sensorBaris(r, req.user.role),
      termurah: termurah != null && Number(r.harga_beli) === Number(termurah),
    }))
  );
});

// POST /api/suppliers/oleh-produk/:productId — catat/ubah harga suplier untuk produk.
// Body: { supplier_id, harga_beli, catatan } — owner & gudang.
router.post(
  '/oleh-produk/:productId',
  requireRole('owner', 'gudang'),
  [
    body('supplier_id').notEmpty().withMessage('Pilih suplier dulu.'),
    body('harga_beli').isInt({ min: 0 }).withMessage('Harga beli harus angka >= 0.'),
  ],
  async (req, res) => {
    if (!validationResult(req).isEmpty())
      return res.status(400).json({ pesan: validationResult(req).array()[0].msg });
    const { supplier_id, harga_beli, catatan = '' } = req.body;
    const { rows: prod } = await pool.query('SELECT id FROM products WHERE id=$1', [req.params.productId]);
    if (!prod[0]) return res.status(404).json({ pesan: 'Barang tidak ketemu.' });
    const { rows: sup } = await pool.query('SELECT id FROM suppliers WHERE id=$1', [supplier_id]);
    if (!sup[0]) return res.status(404).json({ pesan: 'Suplier tidak ketemu.' });
    const { rows } = await pool.query(
      `INSERT INTO product_suppliers (product_id, supplier_id, harga_beli, catatan)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (product_id, supplier_id)
       DO UPDATE SET harga_beli=EXCLUDED.harga_beli, catatan=EXCLUDED.catatan, updated_at=NOW()
       RETURNING *`,
      [req.params.productId, supplier_id, harga_beli, String(catatan).slice(0, 200)]
    );
    res.status(201).json(rows[0]);
  }
);

router.delete('/oleh-produk/:productId/:linkId', requireRole('owner', 'gudang'), async (req, res) => {
  await pool.query('DELETE FROM product_suppliers WHERE id=$1 AND product_id=$2', [
    req.params.linkId,
    req.params.productId,
  ]);
  res.json({ pesan: 'Harga suplier dihapus dari barang ini.' });
});

module.exports = router;
