const express = require('express');
const pool = require('../config/db');
const { authRequired, requireRole } = require('../middleware/auth');
const { kodeKulakan } = require('../utils/warung');

const router = express.Router();
router.use(authRequired);

const isTanggal = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));

// GET /api/purchases — riwayat kulakan + sisa hutang. Owner & gudang.
router.get('/', requireRole('owner', 'gudang'), async (req, res) => {
  const { dari = '', sampai = '', supplier_id = '', status = '', q = '' } = req.query;
  const params = [];
  const where = [];
  if (isTanggal(dari)) {
    params.push(dari);
    where.push(`p.tanggal >= $${params.length}`);
  }
  if (isTanggal(sampai)) {
    params.push(sampai);
    where.push(`p.tanggal <= $${params.length}`);
  }
  if (supplier_id) {
    params.push(supplier_id);
    where.push(`p.supplier_id = $${params.length}`);
  }
  if (['belum', 'sebagian', 'lunas'].includes(status)) {
    params.push(status);
    where.push(`p.status = $${params.length}`);
  }
  if (q) {
    params.push(`%${q}%`);
    where.push(`(p.kode_pembelian ILIKE $${params.length} OR s.nama ILIKE $${params.length})`);
  }
  const { rows } = await pool.query(
    `SELECT p.*, s.nama AS supplier_nama,
       (SELECT COUNT(*)::int FROM supplier_purchase_items i WHERE i.purchase_id = p.id) AS jumlah_item
     FROM supplier_purchases p JOIN suppliers s ON s.id = p.supplier_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY p.tanggal DESC, p.created_at DESC LIMIT 300`,
    params
  );
  res.json(rows);
});

// GET /api/purchases/ringkasan — total hutang suplier aktif.
router.get('/ringkasan', requireRole('owner', 'gudang'), async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(sisa_hutang), 0)::int AS total_hutang,
       COUNT(*) FILTER (WHERE status <> 'lunas')::int AS jumlah_belum_lunas,
       COUNT(*) FILTER (WHERE status <> 'lunas' AND jatuh_tempo IS NOT NULL AND jatuh_tempo < CURRENT_DATE)::int AS jumlah_telat
     FROM supplier_purchases`
  );
  res.json(rows[0]);
});

// GET /api/purchases/:id — detail pembelian + barang + riwayat bayar.
router.get('/:id', requireRole('owner', 'gudang'), async (req, res) => {
  const { rows } = await pool.query(
    `SELECT p.*, s.nama AS supplier_nama, u.nama_pengguna AS dicatat_oleh_nama
     FROM supplier_purchases p
     JOIN suppliers s ON s.id = p.supplier_id
     LEFT JOIN users u ON u.id = p.dicatat_oleh
     WHERE p.id = $1`,
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ pesan: 'Pembelian tidak ketemu.' });
  const { rows: items } = await pool.query(
    `SELECT i.*, pr.nama AS nama_produk
     FROM supplier_purchase_items i LEFT JOIN products pr ON pr.id = i.product_id
     WHERE i.purchase_id = $1 ORDER BY i.nama_snapshot`,
    [req.params.id]
  );
  const { rows: payments } = await pool.query(
    `SELECT sp.*, u.nama_pengguna AS oleh_nama
     FROM supplier_payments sp LEFT JOIN users u ON u.id = sp.diterima_oleh
     WHERE sp.purchase_id = $1 ORDER BY sp.created_at`,
    [req.params.id]
  );
  res.json({ ...rows[0], items, payments });
});

// POST /api/purchases — catat kulakan (stok bertambah, hutang otomatis).
router.post('/', requireRole('owner', 'gudang'), async (req, res) => {
  const { supplier_id, tanggal = null, jatuh_tempo = null, catatan = '', items = [], tambah_stok = true } = req.body || {};
  if (!supplier_id) return res.status(400).json({ pesan: 'Pilih suplier dulu.' });
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ pesan: 'Isi minimal satu barang yang dibeli.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: sup } = await client.query('SELECT id FROM suppliers WHERE id = $1', [supplier_id]);
    if (!sup[0]) {
      await client.query('ROLLBACK');
      return res.status(400).json({ pesan: 'Suplier tidak ketemu.' });
    }

    let total = 0;
    const baris = [];
    for (const it of items) {
      const qty = Number(it.qty || 0);
      const harga = Number(it.harga_beli || 0);
      if (!Number.isInteger(qty) || qty <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ pesan: 'Jumlah barang harus bilangan bulat lebih dari 0.' });
      }
      if (!Number.isInteger(harga) || harga < 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ pesan: 'Harga beli harus bilangan bulat minimal 0.' });
      }
      let produk = null;
      if (it.product_id) {
        const { rows: pr } = await client.query('SELECT id, nama FROM products WHERE id = $1', [it.product_id]);
        if (!pr[0]) {
          await client.query('ROLLBACK');
          return res.status(400).json({ pesan: 'Ada barang yang tidak ketemu di stok.' });
        }
        produk = pr[0];
      }
      const nama = String(it.nama || produk?.nama || 'Barang').trim().slice(0, 150) || 'Barang';
      const subtotal = qty * harga;
      total += subtotal;
      baris.push({ product_id: it.product_id || null, nama, qty, harga, subtotal });
    }

    const kode = kodeKulakan();
    const tgl = isTanggal(tanggal) ? tanggal : null;
    const { rows: prow } = await client.query(
      `INSERT INTO supplier_purchases
         (kode_pembelian, supplier_id, tanggal, jatuh_tempo, total_beli, total_dibayar, sisa_hutang, status, catatan, dicatat_oleh)
       VALUES ($1, $2, COALESCE($3::date, CURRENT_DATE), $4::date, $5, 0, $5, 'belum', $6, $7)
       RETURNING *`,
      [kode, supplier_id, tgl, isTanggal(jatuh_tempo) ? jatuh_tempo : null, total, String(catatan).trim().slice(0, 200), req.user.id]
    );
    const pembelian = prow[0];

    for (const b of baris) {
      await client.query(
        `INSERT INTO supplier_purchase_items (purchase_id, product_id, nama_snapshot, qty, harga_beli, subtotal)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [pembelian.id, b.product_id, b.nama, b.qty, b.harga, b.subtotal]
      );
      if (tambah_stok !== false && b.product_id) {
        const { rows: upd } = await client.query(
          'UPDATE products SET stok = stok + $1, updated_at = NOW() WHERE id = $2 RETURNING stok',
          [b.qty, b.product_id]
        );
        if (upd[0]) {
          await client.query(
            `INSERT INTO stock_movements (product_id, tipe, jumlah, sisa, catatan, oleh)
             VALUES ($1, 'masuk', $2, $3, $4, $5)`,
            [b.product_id, b.qty, upd[0].stok, `Kulakan ${kode}`, req.user.id]
          );
        }
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ ...pembelian, pesan: `Kulakan ${kode} tersimpan.` });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ pesan: 'Gagal menyimpan pembelian.' });
  } finally {
    client.release();
  }
});

// POST /api/purchases/:id/bayar — bayar hutang kulakan (boleh bertahap). Owner only.
router.post('/:id/bayar', requireRole('owner'), async (req, res) => {
  const jumlah = Number(req.body?.jumlah_bayar || 0);
  if (!Number.isInteger(jumlah) || jumlah <= 0) {
    return res.status(400).json({ pesan: 'Nominal bayar harus bilangan bulat lebih dari 0.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT * FROM supplier_purchases WHERE id = $1 FOR UPDATE', [req.params.id]);
    const p = rows[0];
    if (!p) {
      await client.query('ROLLBACK');
      return res.status(404).json({ pesan: 'Pembelian tidak ketemu.' });
    }
    if (p.status === 'lunas' || Number(p.sisa_hutang) === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ pesan: 'Hutang kulakan ini sudah lunas.' });
    }
    if (jumlah > Number(p.sisa_hutang)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ pesan: 'Nominal bayar melebihi sisa hutang.' });
    }

    const sisa = Number(p.sisa_hutang) - jumlah;
    const dibayar = Number(p.total_dibayar) + jumlah;
    const status = sisa === 0 ? 'lunas' : 'sebagian';
    await client.query(
      'INSERT INTO supplier_payments (purchase_id, jumlah_bayar, diterima_oleh) VALUES ($1, $2, $3)',
      [p.id, jumlah, req.user.id]
    );
    const { rows: upd } = await client.query(
      `UPDATE supplier_purchases
       SET total_dibayar = $1, sisa_hutang = $2, status = $3, updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [dibayar, sisa, status, p.id]
    );
    await client.query('COMMIT');
    res.json({ ...upd[0], pesan: sisa === 0 ? 'Hutang kulakan lunas.' : 'Pembayaran tersimpan.' });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ pesan: 'Gagal menyimpan pembayaran.' });
  } finally {
    client.release();
  }
});

module.exports = router;
