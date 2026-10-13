const express = require('express');
const pool = require('../config/db');
const { authRequired, requireRole } = require('../middleware/auth');
const { kodeStruk, sensorProduk } = require('../utils/warung');

const router = express.Router();
router.use(authRequired);

// POST /api/sales — kasir & owner saja. Gudang DILARANG.
// Body: { items: [{id|barcode, qty}], uang_diterima, dibayar_via }
// Kembalian dihitung server. Stok dipotong transaksional.
router.post('/', requireRole('owner', 'kasir'), async (req, res) => {
  const { items = [], uang_diterima = 0, dibayar_via = 'tunai' } = req.body;
  if (!Array.isArray(items) || items.length === 0)
    return res.status(400).json({ pesan: 'Keranjang masih kosong.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let total_masuk = 0;
    let total_modal = 0;
    const baris = [];

    for (const it of items) {
      const qty = Number(it.qty || 0);
      if (!Number.isInteger(qty) || qty <= 0) throw new Error('Jumlah barang harus > 0.');
      const key = it.id ? 'id' : 'barcode';
      const val = it.id || it.barcode;
      if (!val) throw new Error('Setiap barang wajib ada id atau barcode.');
      const { rows } = await client.query(
        `SELECT * FROM products WHERE ${key}=$1 FOR UPDATE`,
        [val]
      );
      const p = rows[0];
      if (!p) throw new Error(`Barang ${val} tidak ketemu.`);
      if (p.stok < qty) throw new Error(`Stok "${p.nama}" kurang (sisa ${p.stok}).`);
      total_masuk += p.harga_jual * qty;
      total_modal += p.modal_beli * qty;
      baris.push({ p, qty });
    }

    const diterima = Number(uang_diterima || 0);
    if (dibayar_via === 'tunai' && diterima < total_masuk)
      throw new Error(`Uang kurang. Total ${total_masuk}, diterima ${diterima}.`);
    const kembalian = dibayar_via === 'tunai' ? diterima - total_masuk : 0;

    const kode = kodeStruk();
    const { rows: srows } = await client.query(
      `INSERT INTO sales (kode_struk, total_masuk, total_modal, uang_diterima, kembalian, dibayar_via, kasir_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [kode, total_masuk, total_modal, diterima, kembalian, dibayar_via, req.user.id]
    );
    const sale = srows[0];

    for (const { p, qty } of baris) {
      await client.query(
        `INSERT INTO sale_items (sale_id, product_id, nama_snapshot, harga_snapshot, modal_snapshot, qty, subtotal)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [sale.id, p.id, p.nama, p.harga_jual, p.modal_beli, qty, p.harga_jual * qty]
      );
      const sisa = p.stok - qty;
      await client.query('UPDATE products SET stok=$1, updated_at=NOW() WHERE id=$2', [sisa, p.id]);
      await client.query(
        `INSERT INTO stock_movements (product_id, tipe, jumlah, sisa, catatan, oleh)
         VALUES ($1,'jual',$2,$3,$4,$5)`,
        [p.id, -qty, sisa, kode, req.user.id]
      );
    }

    await client.query('COMMIT');
    // Sensor modal untuk kasir: jangan kirim total_modal/untung.
    if (req.user.role !== 'owner') {
      const { total_modal: _m, perkiraan_untung: _u, ...aman } = sale;
      return res.status(201).json({ ...aman, pesan: `Jualan tersimpan. Kembalian: Rp${kembalian.toLocaleString('id-ID')}` });
    }
    res.status(201).json({ ...sale, pesan: `Jualan tersimpan. Kembalian: Rp${kembalian.toLocaleString('id-ID')}` });
  } catch (e) {
    await client.query('ROLLBACK');
    return res.status(400).json({ pesan: e.message });
  } finally {
    client.release();
  }
});

// GET /api/sales?hari=YYYY-MM-DD — riwayat struk. Gudang dilarang.
router.get('/', requireRole('owner', 'kasir'), async (req, res) => {
  const hari = req.query.hari;
  let q = 'SELECT * FROM sales';
  const params = [];
  if (hari) {
    q += ' WHERE created_at::date = $1';
    params.push(hari);
  }
  q += ' ORDER BY created_at DESC LIMIT 100';
  const { rows } = await pool.query(q, params);
  if (req.user.role !== 'owner') {
    return res.json(rows.map(({ total_modal, perkiraan_untung, ...r }) => r));
  }
  res.json(rows);
});

module.exports = router;
