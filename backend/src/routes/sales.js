const express = require('express');
const pool = require('../config/db');
const { authRequired, requireRole } = require('../middleware/auth');
const { kodeStruk, normalisasiWA } = require('../utils/warung');

const router = express.Router();
router.use(authRequired);

// POST /api/sales — kasir & owner saja. Gudang DILARANG.
// Body: { items: [{id|barcode, qty}], uang_diterima, dibayar_via, kasbon? }
// - dibayar_via='tunai'  : uang diterima wajib >= total, kembalian dihitung server.
// - dibayar_via='kasbon' : sekaligus membuat catatan utang (atomik, satu transaksi).
// Stok dipotong transaksional.
router.post('/', requireRole('owner', 'kasir'), async (req, res) => {
  const { items = [], uang_diterima = 0, dibayar_via = 'tunai', kasbon = null } = req.body;
  if (!Array.isArray(items) || items.length === 0)
    return res.status(400).json({ pesan: 'Keranjang masih kosong.' });
  if (!['tunai', 'kasbon'].includes(dibayar_via))
    return res.status(400).json({ pesan: "Pembayaran harus 'tunai' atau 'kasbon'." });

  // Siapkan data kasbon sebelum transaksi agar gagal cepat bila tidak lengkap.
  let kasbonNama = null;
  let kasbonWa = null;
  if (dibayar_via === 'kasbon') {
    kasbonNama = String(kasbon?.nama_tetangga || '').trim().slice(0, 120);
    kasbonWa = normalisasiWA(kasbon?.no_wa || '');
    if (!kasbonNama) return res.status(400).json({ pesan: 'Nama tetangga wajib diisi untuk kasbon.' });
    if (!kasbonWa || kasbonWa.length < 10)
      return res.status(400).json({ pesan: 'Nomor WA wajib diisi untuk kasbon (mis. 0812...).' });
  }

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

    const diterima = dibayar_via === 'tunai' ? Number(uang_diterima || 0) : 0;
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

    // Jual kasbon: catat utang tetangga dalam transaksi yang sama — tidak bisa setengah jadi.
    let utang = null;
    if (dibayar_via === 'kasbon') {
      const { rows: drows } = await client.query(
        `INSERT INTO debts (nama_tetangga, no_wa, total_utang, sisa_utang, jatuh_tempo, dicatat_oleh, sale_id)
         VALUES ($1,$2,$3,$3,$4,$5,$6) RETURNING id`,
        [kasbonNama, kasbonWa, total_masuk, kasbon?.jatuh_tempo || null, req.user.id, sale.id]
      );
      utang = drows[0];
    }

    await client.query('COMMIT');
    const pesanSukses =
      dibayar_via === 'kasbon'
        ? `Jualan kasbon tersimpan atas nama ${kasbonNama}.`
        : `Jualan tersimpan. Kembalian: Rp${kembalian.toLocaleString('id-ID')}`;
    // Sensor modal untuk kasir: jangan kirim total_modal/untung.
    if (req.user.role !== 'owner') {
      const { total_modal: _m, perkiraan_untung: _u, ...aman } = sale;
      return res.status(201).json({ ...aman, kasbon_id: utang?.id || null, pesan: pesanSukses });
    }
    res.status(201).json({ ...sale, kasbon_id: utang?.id || null, pesan: pesanSukses });
  } catch (e) {
    await client.query('ROLLBACK');
    return res.status(400).json({ pesan: e.message });
  } finally {
    client.release();
  }
});

// GET /api/sales — riwayat struk. Gudang dilarang.
// Param: hari=YYYY-MM-DD (kompat lama), dari & sampai (rentang, inklusif),
// q (cari kode struk), dibayar_via (tunai|kasbon), tampilkan_void=1 (mode audit),
// limit (default 50, maks 200), offset.
router.get('/', requireRole('owner', 'kasir'), async (req, res) => {
  const { hari, dari, sampai, q = '', dibayar_via = '', tampilkan_void = '' } = req.query;
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  let dariFinal = dari;
  let sampaiFinal = sampai;
  if (hari) {
    dariFinal = hari;
    sampaiFinal = hari;
  }

  const params = [];
  const where = [];
  if (dariFinal) {
    params.push(dariFinal);
    where.push(`s.created_at::date >= $${params.length}`);
  }
  if (sampaiFinal) {
    params.push(sampaiFinal);
    where.push(`s.created_at::date <= $${params.length}`);
  }
  if (q) {
    params.push(`%${q}%`);
    where.push(`s.kode_struk ILIKE $${params.length}`);
  }
  if (['tunai', 'kasbon'].includes(dibayar_via)) {
    params.push(dibayar_via);
    where.push(`s.dibayar_via = $${params.length}`);
  }
  // Default: sembunyikan struk yang sudah dibatalkan.
  if (tampilkan_void !== '1') where.push('s.voided_at IS NULL');

  params.push(limit);
  const limIdx = params.length;
  params.push(offset);
  const offIdx = params.length;

  const { rows } = await pool.query(
    `SELECT s.*, u.nama_pengguna AS kasir_nama,
       (SELECT COALESCE(SUM(si.qty),0)::int FROM sale_items si WHERE si.sale_id = s.id) AS jumlah_item,
       d.nama_tetangga AS kasbon_nama
     FROM sales s
     LEFT JOIN users u ON u.id = s.kasir_id
     LEFT JOIN debts d ON d.sale_id = s.id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY s.created_at DESC
     LIMIT $${limIdx} OFFSET $${offIdx}`,
    params
  );
  if (req.user.role !== 'owner') {
    return res.json(rows.map(({ total_modal, perkiraan_untung, ...r }) => r));
  }
  res.json(rows);
});

// GET /api/sales/:id — detail struk + items untuk halaman cetak terpisah.
// Gudang dilarang. Kasir: modal disensor.
router.get('/:id', requireRole('owner', 'kasir'), async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM sales WHERE id=$1', [req.params.id]);
  const sale = rows[0];
  if (!sale) return res.status(404).json({ pesan: 'Struk tidak ketemu.' });
  const { rows: items } = await pool.query(
    `SELECT product_id, nama_snapshot AS nama, harga_snapshot AS harga_jual, qty,
       subtotal AS subtotal, (harga_snapshot * qty) AS total_baris
     FROM sale_items WHERE sale_id=$1 ORDER BY nama_snapshot ASC`,
    [req.params.id]
  );
  const { rows: kasir } = await pool.query(
    'SELECT nama_pengguna, nama_toko FROM users WHERE id=$1',
    [sale.kasir_id]
  );
  // Nama tetangga bila struk ini dari jual kasbon.
  const { rows: utang } = await pool.query(
    'SELECT nama_tetangga, sisa_utang FROM debts WHERE sale_id=$1',
    [req.params.id]
  );
  const data = {
    ...sale,
    nama_toko: kasir[0]?.nama_toko || 'Warung Saya',
    kasir: kasir[0]?.nama_pengguna || '-',
    kasbon_nama: utang[0]?.nama_tetangga || null,
    items,
  };
  if (req.user.role !== 'owner') {
    const { total_modal, perkiraan_untung, ...aman } = data;
    return res.json(aman);
  }
  res.json(data);
});

// POST /api/sales/:id/void — batalkan struk penuh (OWNER ONLY).
// Stok dikembalikan, catatan utang (bila struk kasbon tanpa cicilan) ikut dihapus.
// Struk tetap tersimpan sebagai audit dengan voided_at + alasan.
router.post('/:id/void', requireRole('owner'), async (req, res) => {
  const alasan = String(req.body.alasan || '').trim().slice(0, 200);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT * FROM sales WHERE id=$1 FOR UPDATE', [req.params.id]);
    const sale = rows[0];
    if (!sale) {
      await client.query('ROLLBACK');
      return res.status(404).json({ pesan: 'Struk tidak ketemu.' });
    }
    if (sale.voided_at) {
      await client.query('ROLLBACK');
      return res.status(400).json({ pesan: 'Struk ini sudah dibatalkan.' });
    }

    // Bila dari jual kasbon: tolak bila utangnya sudah ada cicilan.
    const { rows: utang } = await client.query(
      `SELECT d.*, COALESCE((SELECT SUM(p.jumlah_bayar) FROM debt_payments p WHERE p.debt_id=d.id),0)::int AS sudah_bayar
       FROM debts d WHERE d.sale_id=$1`,
      [sale.id]
    );
    if (utang[0] && utang[0].sudah_bayar > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        pesan: `Kasbon "${utang[0].nama_tetangga}" sudah ada cicilan. Selesaikan lewat menu Kasbon dulu ya.`,
      });
    }

    // Kembalikan stok barang yang masih ada (product_id NULL = barang sudah dihapus, dilewati).
    const { rows: items } = await client.query(
      'SELECT product_id, qty FROM sale_items WHERE sale_id=$1',
      [sale.id]
    );
    for (const it of items) {
      if (!it.product_id) continue;
      const { rows: prods } = await client.query(
        'UPDATE products SET stok = stok + $1, updated_at=NOW() WHERE id=$2 RETURNING stok',
        [it.qty, it.product_id]
      );
      if (!prods[0]) continue;
      await client.query(
        `INSERT INTO stock_movements (product_id, tipe, jumlah, sisa, catatan, oleh)
         VALUES ($1,'masuk',$2,$3,$4,$5)`,
        [it.product_id, it.qty, prods[0].stok, `Void ${sale.kode_struk}`, req.user.id]
      );
    }

    if (utang[0]) await client.query('DELETE FROM debts WHERE id=$1', [utang[0].id]);

    const { rows: upd } = await client.query(
      'UPDATE sales SET voided_at=NOW(), voided_by=$1, alasan_void=$2 WHERE id=$3 RETURNING *',
      [req.user.id, alasan, sale.id]
    );
    await client.query('COMMIT');
    res.json({ ...upd[0], pesan: `Struk ${sale.kode_struk} dibatalkan. Stok dikembalikan.` });
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch {}
    return res.status(400).json({ pesan: e.message });
  } finally {
    client.release();
  }
});

module.exports = router;
