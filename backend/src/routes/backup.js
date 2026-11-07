const express = require('express');
const pool = require('../config/db');
const { authRequired, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);
router.use(requireRole('owner'));

// Urutan aman untuk restore (induk dulu, anak kemudian).
const TABEL = [
  'users',
  'app_settings',
  'suppliers',
  'products',
  'shifts',
  'sales',
  'stock_movements',
  'sale_items',
  'debts',
  'debt_payments',
  'expenses',
  'product_suppliers',
  'product_supplier_harga_riwayat',
  'supplier_purchases',
  'supplier_purchase_items',
  'supplier_payments',
  'sale_returns',
  'wa_outbox',
];

const q = (nama) => `"${String(nama).replace(/"/g, '""')}"`;

router.get('/', async (_req, res) => {
  const tabel = {};
  for (const nama of TABEL) {
    const { rows } = await pool.query(
      `SELECT COALESCE(json_agg(t), '[]'::json) AS data FROM (SELECT * FROM ${q(nama)}) t`
    );
    tabel[nama] = rows[0].data;
  }
  const backup = {
    aplikasi: 'WarungQ',
    versi: 1,
    dibuat_pada: new Date().toISOString(),
    tabel,
  };
  const namaFile = `warungq-backup-${new Date().toISOString().slice(0, 10)}.json`;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${namaFile}"`);
  res.send(JSON.stringify(backup));
});

router.post('/restore', async (req, res) => {
  if (req.body?.konfirmasi !== 'PULIHKAN') {
    return res.status(400).json({ pesan: 'Ketik PULIHKAN untuk mengonfirmasi pemulihan data.' });
  }
  const backup = req.body?.data;
  if (!backup || backup.aplikasi !== 'WarungQ' || !backup.tabel || typeof backup.tabel !== 'object') {
    return res.status(400).json({ pesan: 'Berkas backup tidak dikenali.' });
  }
  for (const nama of TABEL) {
    const isi = backup.tabel[nama];
    if (isi !== undefined && !Array.isArray(isi)) {
      return res.status(400).json({ pesan: `Data tabel "${nama}" pada backup tidak valid.` });
    }
  }
  const asing = Object.keys(backup.tabel).filter((nama) => !TABEL.includes(nama));
  if (asing.length) {
    return res.status(400).json({ pesan: `Backup memuat tabel tidak dikenal: ${asing.join(', ')}.` });
  }
  const jumlah = {};
  for (const nama of TABEL) jumlah[nama] = (backup.tabel[nama] || []).length;
  if (Object.values(jumlah).every((n) => n === 0)) {
    return res.status(400).json({ pesan: 'Backup kosong — pemulihan dibatalkan agar data tidak hilang.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const kolom = {};
    for (const nama of TABEL) {
      const { rows } = await client.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1
           AND is_generated = 'NEVER'
         ORDER BY ordinal_position`,
        [nama]
      );
      kolom[nama] = rows.map((r) => r.column_name);
      if (!kolom[nama].length) throw new Error(`Tabel ${nama} tidak punya kolom yang bisa dipulihkan.`);
    }
    await client.query(`TRUNCATE TABLE ${TABEL.map(q).join(', ')} CASCADE`);
    for (const nama of TABEL) {
      const isi = backup.tabel[nama] || [];
      if (!isi.length) continue;
      const daftar = kolom[nama].map(q).join(', ');
      await client.query(
        `INSERT INTO ${q(nama)} (${daftar})
         SELECT ${daftar} FROM json_populate_recordset(NULL::${q(nama)}, $1::json)`,
        [JSON.stringify(isi)]
      );
    }
    await client.query('COMMIT');
    res.json({ pesan: 'Data berhasil dipulihkan. Silakan login ulang.', jumlah });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[backup] restore gagal:', e.message);
    res.status(400).json({ pesan: `Pemulihan gagal, data lama tidak diubah: ${e.message}` });
  } finally {
    client.release();
  }
});

module.exports = router;
