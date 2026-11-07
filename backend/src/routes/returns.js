const express = require('express');
const pool = require('../config/db');
const { authRequired, requireRole } = require('../middleware/auth');
const { kodeRetur } = require('../utils/warung');

const router = express.Router();
router.use(authRequired);
router.use(requireRole('owner', 'kasir', 'gudang'));

const isTanggal = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const ALASAN = ['rusak', 'expired', 'salah_input', 'lainnya'];

async function shiftTerbuka(q, userId) {
  const { rows } = await q.query(
    `SELECT id FROM shifts WHERE kasir_id = $1 AND status = 'buka' ORDER BY mulai DESC LIMIT 1`,
    [userId]
  );
  return rows[0]?.id || null;
}

// GET /api/returns?tipe=&dari=&sampai=&sale_id=&product_id=
// Nilai kerugian writeoff hanya terlihat owner (modal itu rahasia).
router.get('/', async (req, res) => {
  const { tipe = '', dari = '', sampai = '', sale_id = '', product_id = '' } = req.query;
  const params = [];
  const where = [];
  if (['retur_jual', 'writeoff'].includes(tipe)) {
    params.push(tipe);
    where.push(`r.tipe = $${params.length}`);
  }
  if (isTanggal(dari)) {
    params.push(dari);
    where.push(`r.created_at::date >= $${params.length}`);
  }
  if (isTanggal(sampai)) {
    params.push(sampai);
    where.push(`r.created_at::date <= $${params.length}`);
  }
  if (sale_id) {
    params.push(sale_id);
    where.push(`r.sale_id = $${params.length}`);
  }
  if (product_id) {
    params.push(product_id);
    where.push(`r.product_id = $${params.length}`);
  }
  const { rows } = await pool.query(
    `SELECT r.*, u.nama_pengguna AS oleh_nama, s.kode_struk
     FROM sale_returns r
     LEFT JOIN users u ON u.id = r.dicatat_oleh
     LEFT JOIN sales s ON s.id = r.sale_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY r.created_at DESC LIMIT 300`,
    params
  );
  const aman = rows.map((r) => {
    if (req.user.role !== 'owner' && r.tipe === 'writeoff') {
      const { total_nilai, ...rest } = r;
      return rest;
    }
    return r;
  });
  res.json(aman);
});

// POST /api/returns — retur jual (owner/kasir) atau writeoff rusak/expired (owner/gudang).
router.post('/', async (req, res) => {
  const tipe = String(req.body?.tipe || '');
  const qty = Number(req.body?.qty || 0);
  const productId = req.body?.product_id || null;
  const alasan = ALASAN.includes(req.body?.alasan) ? req.body.alasan : 'lainnya';
  const keterangan = String(req.body?.keterangan || '').trim().slice(0, 200);

  if (!['retur_jual', 'writeoff'].includes(tipe)) {
    return res.status(400).json({ pesan: 'Tipe retur tidak dikenal.' });
  }
  if (tipe === 'retur_jual' && !['owner', 'kasir'].includes(req.user.role)) {
    return res.status(403).json({ pesan: 'Retur jual hanya untuk owner atau kasir.' });
  }
  if (tipe === 'writeoff' && !['owner', 'gudang'].includes(req.user.role)) {
    return res.status(403).json({ pesan: 'Barang rusak/expired hanya untuk owner atau gudang.' });
  }
  if (!Number.isInteger(qty) || qty <= 0) {
    return res.status(400).json({ pesan: 'Jumlah barang harus bilangan bulat lebih dari 0.' });
  }
  if (!productId) return res.status(400).json({ pesan: 'Pilih barang dulu.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (tipe === 'retur_jual') {
      const saleId = req.body?.sale_id || null;
      if (!saleId) {
        await client.query('ROLLBACK');
        return res.status(400).json({ pesan: 'Pilih struk asal retur.' });
      }
      const { rows: sale } = await client.query(
        'SELECT id, kode_struk FROM sales WHERE id = $1 AND voided_at IS NULL',
        [saleId]
      );
      if (!sale[0]) {
        await client.query('ROLLBACK');
        return res.status(400).json({ pesan: 'Struk tidak ketemu atau sudah dibatalkan.' });
      }
      const { rows: item } = await client.query(
        `SELECT SUM(qty)::int AS qty, MAX(harga_snapshot)::int AS harga,
                MAX(nama_snapshot) AS nama
         FROM sale_items WHERE sale_id = $1 AND product_id = $2`,
        [saleId, productId]
      );
      if (!item[0] || !item[0].qty) {
        await client.query('ROLLBACK');
        return res.status(400).json({ pesan: 'Barang ini tidak ada di struk tersebut.' });
      }
      const { rows: sudah } = await client.query(
        `SELECT COALESCE(SUM(qty), 0)::int AS qty FROM sale_returns
         WHERE sale_id = $1 AND product_id = $2 AND tipe = 'retur_jual'`,
        [saleId, productId]
      );
      const sisaBisaRetur = item[0].qty - sudah[0].qty;
      if (qty > sisaBisaRetur) {
        await client.query('ROLLBACK');
        return res.status(400).json({ pesan: `Kelebihan. Sisa yang bisa diretur ${sisaBisaRetur} pcs.` });
      }

      const harga = Number(item[0].harga || 0);
      const kembaliKeStok = req.body?.kembali_ke_stok !== false;
      const shiftId = await shiftTerbuka(client, req.user.id);
      const kode = kodeRetur();
      const total = harga * qty;

      const { rows: simpan } = await client.query(
        `INSERT INTO sale_returns
           (kode_retur, tipe, alasan, sale_id, product_id, nama_snapshot, qty,
            harga_satuan, total_nilai, kembali_ke_stok, keterangan, shift_id, dicatat_oleh)
         VALUES ($1, 'retur_jual', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING *`,
        [kode, alasan, saleId, productId, item[0].nama, qty, harga, total, kembaliKeStok, keterangan, shiftId, req.user.id]
      );

      if (kembaliKeStok) {
        const { rows: upd } = await client.query(
          'UPDATE products SET stok = stok + $1, updated_at = NOW() WHERE id = $2 RETURNING stok',
          [qty, productId]
        );
        if (upd[0]) {
          await client.query(
            `INSERT INTO stock_movements (product_id, tipe, jumlah, sisa, catatan, oleh)
             VALUES ($1, 'masuk', $2, $3, $4, $5)`,
            [productId, qty, upd[0].stok, `Retur ${kode}`, req.user.id]
          );
        }
      }

      await client.query('COMMIT');
      return res.status(201).json({ ...simpan[0], pesan: `Retur ${kode} tersimpan.` });
    }

    // writeoff: barang rusak/expired keluar dari stok.
    const { rows: pr } = await client.query(
      'SELECT id, nama, stok, modal_beli FROM products WHERE id = $1',
      [productId]
    );
    const produk = pr[0];
    if (!produk) {
      await client.query('ROLLBACK');
      return res.status(400).json({ pesan: 'Barang tidak ketemu.' });
    }
    if (qty > Number(produk.stok)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ pesan: `Stok tinggal ${produk.stok} pcs.` });
    }

    const harga = Number(produk.modal_beli || 0);
    const total = harga * qty;
    const kode = kodeRetur();
    const { rows: simpan } = await client.query(
      `INSERT INTO sale_returns
         (kode_retur, tipe, alasan, product_id, nama_snapshot, qty,
          harga_satuan, total_nilai, kembali_ke_stok, keterangan, dicatat_oleh)
       VALUES ($1, 'writeoff', $2, $3, $4, $5, $6, $7, FALSE, $8, $9)
       RETURNING *`,
      [kode, alasan, productId, produk.nama, qty, harga, total, keterangan, req.user.id]
    );
    const sisa = Number(produk.stok) - qty;
    await client.query('UPDATE products SET stok = $1, updated_at = NOW() WHERE id = $2', [sisa, productId]);
    await client.query(
      `INSERT INTO stock_movements (product_id, tipe, jumlah, sisa, catatan, oleh)
       VALUES ($1, 'keluar', $2, $3, $4, $5)`,
      [productId, -qty, sisa, `Rusak/expired ${kode}`, req.user.id]
    );

    await client.query('COMMIT');
    return res.status(201).json({ ...simpan[0], pesan: `Barang keluar dari stok (${kode}).` });
  } catch {
    await client.query('ROLLBACK').catch(() => {});
    return res.status(500).json({ pesan: 'Gagal menyimpan retur.' });
  } finally {
    client.release();
  }
});

module.exports = router;
