const express = require('express');
const pool = require('../config/db');
const { authRequired, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);
router.use(requireRole('owner'));

const isTanggal = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));

function periode(q) {
  const sampai = isTanggal(q.sampai) ? q.sampai : new Date().toISOString().slice(0, 10);
  let dari = isTanggal(q.dari) ? q.dari : '';
  if (!dari) {
    const d = new Date(sampai + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() - 29);
    dari = d.toISOString().slice(0, 10);
  }
  return { dari, sampai };
}

function amanExcel(v) {
  if (v === null || v === undefined) return '';
  if (typeof v !== 'string') return v;
  return /^[=+\-@]/.test(v) ? `'${v}` : v;
}

function keCsv(rows, kolom) {
  const sel = (v) => {
    const s = String(amanExcel(v) ?? '');
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const baris = [kolom.map((k) => sel(k.label)).join(',')];
  for (const r of rows) baris.push(kolom.map((k) => sel(r[k.key])).join(','));
  return '\uFEFF' + baris.join('\r\n');
}

function kirimCsv(res, nama, isi) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${nama}"`);
  res.send(isi);
}

router.get('/laporan.csv', async (req, res) => {
  const { dari, sampai } = periode(req.query);
  if (dari > sampai) return res.status(400).json({ pesan: 'Tanggal awal tidak boleh melebihi tanggal akhir.' });
  const { rows } = await pool.query(
    `SELECT to_char(d::date, 'YYYY-MM-DD') AS tanggal,
            COALESCE(SUM(s.total_masuk) FILTER (WHERE s.dibayar_via='tunai'),0)::int AS tunai,
            COALESCE(SUM(s.total_masuk) FILTER (WHERE s.dibayar_via IN ('qris','transfer','ewallet')),0)::int AS non_tunai,
            COALESCE(SUM(s.total_masuk) FILTER (WHERE s.dibayar_via='kasbon'),0)::int AS kasbon,
            COALESCE(SUM(s.total_modal),0)::int AS modal,
            COALESCE(SUM(s.perkiraan_untung),0)::int AS untung_kotor,
            COALESCE((SELECT SUM(e.jumlah) FROM expenses e WHERE e.tanggal = d::date),0)::int AS pengeluaran,
            COALESCE((SELECT SUM(r.total_nilai) FROM sale_returns r WHERE r.tipe='retur_jual' AND r.created_at::date = d::date),0)::int AS retur,
            COALESCE((SELECT SUM(r.total_nilai) FROM sale_returns r WHERE r.tipe='writeoff' AND r.created_at::date = d::date),0)::int AS kerugian_stok
     FROM generate_series($1::date, $2::date, '1 day') d
     LEFT JOIN sales s ON s.created_at::date = d AND s.voided_at IS NULL
     GROUP BY d ORDER BY d ASC`,
    [dari, sampai]
  );
  const isi = keCsv(rows, [
    { key: 'tanggal', label: 'Tanggal' },
    { key: 'tunai', label: 'Tunai' },
    { key: 'non_tunai', label: 'Non-tunai' },
    { key: 'kasbon', label: 'Kasbon' },
    { key: 'modal', label: 'Modal' },
    { key: 'untung_kotor', label: 'Untung Kotor' },
    { key: 'pengeluaran', label: 'Pengeluaran' },
    { key: 'retur', label: 'Retur' },
    { key: 'kerugian_stok', label: 'Rusak/Expired' },
  ]);
  kirimCsv(res, `laporan-${dari}-${sampai}.csv`, isi);
});

router.get('/penjualan.csv', async (req, res) => {
  const { dari, sampai } = periode(req.query);
  if (dari > sampai) return res.status(400).json({ pesan: 'Tanggal awal tidak boleh melebihi tanggal akhir.' });
  const { rows } = await pool.query(
    `SELECT s.kode_struk,
            to_char(s.created_at, 'YYYY-MM-DD HH24:MI') AS waktu,
            COALESCE(u.nama_pengguna, '(pegawai dihapus)') AS kasir,
            s.dibayar_via AS metode,
            s.referensi_bayar,
            s.total_masuk, s.total_modal, s.perkiraan_untung,
            s.uang_diterima, s.kembalian,
            CASE WHEN s.voided_at IS NULL THEN 'aktif' ELSE 'void' END AS status
     FROM sales s LEFT JOIN users u ON u.id = s.kasir_id
     WHERE s.created_at::date BETWEEN $1 AND $2
     ORDER BY s.created_at ASC`,
    [dari, sampai]
  );
  const isi = keCsv(rows, [
    { key: 'kode_struk', label: 'Kode Struk' },
    { key: 'waktu', label: 'Waktu' },
    { key: 'kasir', label: 'Kasir' },
    { key: 'metode', label: 'Metode' },
    { key: 'referensi_bayar', label: 'Referensi' },
    { key: 'total_masuk', label: 'Total Masuk' },
    { key: 'total_modal', label: 'Modal' },
    { key: 'perkiraan_untung', label: 'Untung' },
    { key: 'uang_diterima', label: 'Uang Diterima' },
    { key: 'kembalian', label: 'Kembalian' },
    { key: 'status', label: 'Status' },
  ]);
  kirimCsv(res, `penjualan-${dari}-${sampai}.csv`, isi);
});

router.get('/barang.csv', async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT barcode, nama, kategori, harga_jual, modal_beli, stok, batas_menipis,
            CASE WHEN stok <= 0 THEN 'habis'
                 WHEN stok <= batas_menipis THEN 'menipis'
                 ELSE 'aman' END AS status
     FROM products ORDER BY nama ASC`
  );
  const isi = keCsv(rows, [
    { key: 'barcode', label: 'Barcode' },
    { key: 'nama', label: 'Nama' },
    { key: 'kategori', label: 'Kategori' },
    { key: 'harga_jual', label: 'Harga Jual' },
    { key: 'modal_beli', label: 'Modal Beli' },
    { key: 'stok', label: 'Stok' },
    { key: 'batas_menipis', label: 'Batas Menipis' },
    { key: 'status', label: 'Status' },
  ]);
  kirimCsv(res, `barang-${new Date().toISOString().slice(0, 10)}.csv`, isi);
});

module.exports = router;
