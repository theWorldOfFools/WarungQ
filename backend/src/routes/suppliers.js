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
// GET /api/suppliers/laporan — report & statistik suplier + integrasi stok.
// Owner & gudang. Harga nominal disensor untuk non-owner (lihat sensorBaris).
// Bahasa warung: kebutuhan = batas_menipis - stok + 1 (stok pengaman 1 pcs).
router.get('/laporan', requireRole('owner', 'gudang'), async (req, res) => {
  const sensor = req.user.role !== 'owner';
  const tanpaHarga = (r) => {
    if (!sensor) return r;
    const { harga_beli, harga_termurah, harga_termahal, estimasi_nilai, estimasi_nilai_kulakan, potensi_hemat_per_pcs, ...rest } = r;
    return rest;
  };

  const { rows: rSup } = await pool.query(
    `SELECT COUNT(*)::int AS total_suplier FROM suppliers`
  );
  const { rows: rProd } = await pool.query(
    `SELECT COUNT(*)::int AS total_produk,
       COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM product_suppliers ps WHERE ps.product_id = p.id))::int AS produk_terhubung,
       COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM product_suppliers ps WHERE ps.product_id = p.id))::int AS produk_tanpa_suplier,
       COUNT(*) FILTER (WHERE p.stok <= p.batas_menipis)::int AS barang_menipis
     FROM products p`
  );

  // Per suplier: jumlah produk, menang termurah, estimasi nilai kulakan.
  const { rows: perSuplier } = await pool.query(
    `WITH murah AS (
       SELECT DISTINCT ON (ps.product_id) ps.product_id, ps.supplier_id, ps.harga_beli
       FROM product_suppliers ps ORDER BY ps.product_id, ps.harga_beli ASC
     ),
     butuh AS (
       SELECT p.id AS product_id,
         GREATEST(p.batas_menipis - p.stok + 1, 1)::int AS kebutuhan
       FROM products p WHERE p.stok <= p.batas_menipis
     )
     SELECT s.id, s.nama, s.kontak_wa,
       (SELECT COUNT(*)::int FROM product_suppliers ps WHERE ps.supplier_id = s.id) AS jumlah_produk,
       (SELECT COUNT(*)::int FROM murah m WHERE m.supplier_id = s.id) AS menang_termurah,
       COALESCE((
         SELECT SUM(b.kebutuhan * m.harga_beli)::int
         FROM murah m JOIN butuh b ON b.product_id = m.product_id
         WHERE m.supplier_id = s.id
       ), 0) AS estimasi_nilai_kulakan
     FROM suppliers s ORDER BY menang_termurah DESC, jumlah_produk DESC, s.nama ASC`
  );

  // Per kategori: barang menipis + estimasi nilai kulakan.
  const { rows: perKategori } = await pool.query(
    `WITH murah AS (
       SELECT DISTINCT ON (ps.product_id) ps.product_id, ps.harga_beli
       FROM product_suppliers ps ORDER BY ps.product_id, ps.harga_beli ASC
     )
     SELECT COALESCE(p.kategori, 'Lainnya') AS kategori,
       COUNT(*)::int AS barang_menipis,
       COALESCE(SUM(GREATEST(p.batas_menipis - p.stok + 1, 1) * m.harga_beli), 0)::int AS estimasi_nilai
     FROM products p LEFT JOIN murah m ON m.product_id = p.id
     WHERE p.stok <= p.batas_menipis
     GROUP BY COALESCE(p.kategori, 'Lainnya') ORDER BY barang_menipis DESC`
  );

  // Potensi hemat: selisih termahal-termurah per pcs (produk dgn >=2 suplier).
  const { rows: rHemat } = await pool.query(
    `SELECT COALESCE(SUM(mx - mn), 0)::int AS potensi_hemat_per_pcs,
       COUNT(*)::int AS produk_bisa_dibandingkan
     FROM (
       SELECT product_id, MIN(harga_beli)::int AS mn, MAX(harga_beli)::int AS mx, COUNT(*)::int AS n
       FROM product_suppliers GROUP BY product_id
     ) t WHERE n >= 2`
  );

  // Estimasi total nilai kulakan menipis (pakai harga termurah).
  const { rows: rEst } = await pool.query(
    `WITH murah AS (
       SELECT DISTINCT ON (ps.product_id) ps.product_id, ps.harga_beli
       FROM product_suppliers ps ORDER BY ps.product_id, ps.harga_beli ASC
     )
     SELECT COALESCE(SUM(GREATEST(p.batas_menipis - p.stok + 1, 1) * m.harga_beli), 0)::int AS estimasi_total,
       COUNT(*) FILTER (WHERE m.product_id IS NULL)::int AS menipis_tanpa_suplier
     FROM products p LEFT JOIN murah m ON m.product_id = p.id
     WHERE p.stok <= p.batas_menipis`
  );

  // Riwayat perubahan harga terakhir (7).
  let riwayat = [];
  try {
    const { rows } = await pool.query(
      `SELECT r.harga_beli, r.created_at, p.nama AS nama_produk, s.nama AS nama_suplier,
         u.nama_pengguna AS dicatat_oleh
       FROM product_supplier_harga_riwayat r
       JOIN products p ON p.id = r.product_id
       JOIN suppliers s ON s.id = r.supplier_id
       LEFT JOIN users u ON u.id = r.dicatat_oleh
       ORDER BY r.created_at DESC LIMIT 7`
    );
    riwayat = sensor ? rows.map(({ harga_beli, ...rest }) => rest) : rows;
  } catch {
    riwayat = [];
  }

  // Integrasi stok: barang masuk 30 hari terakhir (top 5) + total unit.
  const { rows: masuk } = await pool.query(
    `SELECT p.nama, SUM(-m.jumlah)::int AS unit_masuk
     FROM stock_movements m JOIN products p ON p.id = m.product_id
     WHERE m.tipe = 'masuk' AND m.created_at >= NOW() - INTERVAL '30 days' AND m.jumlah > 0
     GROUP BY p.nama ORDER BY unit_masuk DESC LIMIT 5`
  );
  const { rows: rMasukTotal } = await pool.query(
    `SELECT COALESCE(SUM(jumlah),0)::int AS total_unit_masuk
     FROM stock_movements WHERE tipe='masuk' AND created_at >= NOW() - INTERVAL '30 days' AND jumlah > 0`
  );

  res.json({
    ringkasan: {
      total_suplier: rSup[0].total_suplier,
      ...rProd[0],
      produk_bisa_dibandingkan: rHemat[0].produk_bisa_dibandingkan,
      ...(sensor ? {} : {
        potensi_hemat_per_pcs: rHemat[0].potensi_hemat_per_pcs,
        estimasi_nilai_kulakan: rEst[0].estimasi_total,
      }),
      menipis_tanpa_suplier: rEst[0].menipis_tanpa_suplier,
      unit_masuk_30hari: rMasukTotal[0].total_unit_masuk,
    },
    per_suplier: perSuplier.map(tanpaHarga),
    per_kategori: sensor
      ? perKategori.map(({ estimasi_nilai, ...rest }) => rest)
      : perKategori,
    riwayat_harga: riwayat,
    barang_masuk_30hari: masuk,
  });
});

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
    // Riwayat harga untuk laporan (abaikan bila tabel 007 belum dimigrasi).
    try {
      await pool.query(
        `INSERT INTO product_supplier_harga_riwayat (product_id, supplier_id, harga_beli, dicatat_oleh)
         VALUES ($1,$2,$3,$4)`,
        [req.params.productId, supplier_id, harga_beli, req.user.id]
      );
    } catch {}
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
