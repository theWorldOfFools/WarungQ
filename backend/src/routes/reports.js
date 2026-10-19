const express = require('express');
const pool = require('../config/db');
const { authRequired, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

const isTanggal = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));

// GET /api/reports/harian?tanggal=YYYY-MM-DD — OWNER ONLY.
// Kasir & gudang DILARANG lihat laba (dipotong di backend, bukan cuma disembunyikan).
// uang_masuk = struk TUNAI saja; jual kasbon tampil terpisah (uang fisik belum masuk).
router.get('/harian', requireRole('owner'), async (req, res) => {
  const tanggal = isTanggal(req.query.tanggal) ? req.query.tanggal : new Date().toISOString().slice(0, 10);
  const { rows: ringkas } = await pool.query(
    `SELECT COALESCE(SUM(total_masuk) FILTER (WHERE dibayar_via='tunai'),0)::int AS uang_masuk,
            COALESCE(SUM(total_masuk) FILTER (WHERE dibayar_via='kasbon'),0)::int AS penjualan_kasbon,
            COUNT(*) FILTER (WHERE dibayar_via='kasbon')::int AS jumlah_struk_kasbon,
            COALESCE(SUM(total_modal),0)::int AS total_modal,
            COALESCE(SUM(perkiraan_untung),0)::int AS perkiraan_untung_bersih,
            COUNT(*)::int AS jumlah_struk
     FROM sales WHERE voided_at IS NULL AND created_at::date = $1`,
    [tanggal]
  );
  const { rows: pengeluaran } = await pool.query(
    `SELECT COALESCE(SUM(jumlah),0)::int AS pengeluaran FROM expenses WHERE tanggal = $1`,
    [tanggal]
  );
  const { rows: laris } = await pool.query(
    `SELECT si.nama_snapshot AS nama, SUM(si.qty)::int AS terjual,
            SUM(si.subtotal)::int AS uang_masuk
     FROM sale_items si JOIN sales s ON s.id = si.sale_id
     WHERE s.voided_at IS NULL AND s.created_at::date = $1
     GROUP BY si.nama_snapshot ORDER BY terjual DESC LIMIT 5`,
    [tanggal]
  );
  const { rows: kasbon } = await pool.query(
    `SELECT COALESCE(SUM(sisa_utang),0)::int AS total_utang_aktif FROM debts WHERE status != 'lunas'`
  );
  // Utang yang sudah lewat tanggal janji bayar (global, bukan per tanggal).
  const { rows: tempo } = await pool.query(
    `SELECT COUNT(*)::int AS jumlah, COALESCE(SUM(sisa_utang),0)::int AS total_sisa
     FROM debts WHERE status != 'lunas' AND jatuh_tempo IS NOT NULL AND jatuh_tempo < CURRENT_DATE`
  );
  const pengeluaranHarian = pengeluaran[0].pengeluaran;
  res.json({
    tanggal,
    uang_masuk: ringkas[0].uang_masuk,
    penjualan_kasbon: ringkas[0].penjualan_kasbon,
    jumlah_struk_kasbon: ringkas[0].jumlah_struk_kasbon,
    total_modal: ringkas[0].total_modal,
    perkiraan_untung_bersih: ringkas[0].perkiraan_untung_bersih,
    pengeluaran_harian: pengeluaranHarian,
    untung_setelah_pengeluaran: ringkas[0].perkiraan_untung_bersih - pengeluaranHarian,
    jumlah_struk: ringkas[0].jumlah_struk,
    produk_terlaris: laris,
    utang_tetangga_aktif: kasbon[0].total_utang_aktif,
    utang_jatuh_tempo: { jumlah: tempo[0].jumlah, total_sisa: tempo[0].total_sisa },
  });
});

// GET /api/reports/rentang?dari=YYYY-MM-DD&sampai=YYYY-MM-DD — laporan periode. OWNER ONLY.
// Default: 30 hari terakhir sampai hari ini.
router.get('/rentang', requireRole('owner'), async (req, res) => {
  const sampai = isTanggal(req.query.sampai) ? req.query.sampai : new Date().toISOString().slice(0, 10);
  let dari = isTanggal(req.query.dari) ? req.query.dari : null;
  if (!dari) {
    const d = new Date(sampai + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() - 29);
    dari = d.toISOString().slice(0, 10);
  }
  if (dari > sampai) return res.status(400).json({ pesan: 'Tanggal awal tidak boleh melebihi tanggal akhir.' });

  const { rows: ringkas } = await pool.query(
    `SELECT COALESCE(SUM(total_masuk) FILTER (WHERE dibayar_via='tunai'),0)::int AS uang_masuk_tunai,
            COALESCE(SUM(total_masuk) FILTER (WHERE dibayar_via='kasbon'),0)::int AS penjualan_kasbon,
            COALESCE(SUM(total_modal),0)::int AS total_modal,
            COALESCE(SUM(perkiraan_untung),0)::int AS untung_kotor,
            COUNT(*) FILTER (WHERE dibayar_via='kasbon')::int AS jumlah_struk_kasbon,
            COUNT(*)::int AS jumlah_struk
     FROM sales WHERE voided_at IS NULL AND created_at::date BETWEEN $1 AND $2`,
    [dari, sampai]
  );
  const { rows: pengeluaran } = await pool.query(
    `SELECT COALESCE(SUM(jumlah),0)::int AS total FROM expenses WHERE tanggal BETWEEN $1 AND $2`,
    [dari, sampai]
  );
  const { rows: seri } = await pool.query(
    `SELECT to_char(d::date, 'YYYY-MM-DD') AS tanggal,
            COALESCE(SUM(s.total_masuk) FILTER (WHERE s.dibayar_via='tunai'),0)::int AS uang_masuk,
            COALESCE(SUM(s.perkiraan_untung),0)::int AS untung
     FROM generate_series($1::date, $2::date, '1 day') d
     LEFT JOIN sales s ON s.created_at::date = d AND s.voided_at IS NULL
     GROUP BY d ORDER BY d ASC`,
    [dari, sampai]
  );
  const { rows: laris } = await pool.query(
    `SELECT si.nama_snapshot AS nama, SUM(si.qty)::int AS terjual,
            SUM(si.subtotal)::int AS uang_masuk
     FROM sale_items si JOIN sales s ON s.id = si.sale_id
     WHERE s.voided_at IS NULL AND s.created_at::date BETWEEN $1 AND $2
     GROUP BY si.nama_snapshot ORDER BY terjual DESC LIMIT 10`,
    [dari, sampai]
  );
  const { rows: kategoriPengeluaran } = await pool.query(
    `SELECT kategori, COALESCE(SUM(jumlah),0)::int AS total
     FROM expenses WHERE tanggal BETWEEN $1 AND $2
     GROUP BY kategori ORDER BY total DESC`,
    [dari, sampai]
  );
  const { rows: perKasir } = await pool.query(
    `SELECT COALESCE(u.nama_pengguna, '(pegawai dihapus)') AS kasir,
            COUNT(s.id)::int AS jumlah_struk,
            COALESCE(SUM(s.total_masuk),0)::int AS uang_masuk
     FROM sales s LEFT JOIN users u ON u.id = s.kasir_id
     WHERE s.voided_at IS NULL AND s.created_at::date BETWEEN $1 AND $2
     GROUP BY u.nama_pengguna ORDER BY uang_masuk DESC`,
    [dari, sampai]
  );
  const { rows: strukVoid } = await pool.query(
    `SELECT COUNT(*)::int AS jumlah FROM sales
     WHERE voided_at IS NOT NULL AND created_at::date BETWEEN $1 AND $2`,
    [dari, sampai]
  );

  const totalPengeluaran = pengeluaran[0].total;
  res.json({
    dari,
    sampai,
    uang_masuk_tunai: ringkas[0].uang_masuk_tunai,
    penjualan_kasbon: ringkas[0].penjualan_kasbon,
    jumlah_struk_kasbon: ringkas[0].jumlah_struk_kasbon,
    total_modal: ringkas[0].total_modal,
    untung_kotor: ringkas[0].untung_kotor,
    pengeluaran: totalPengeluaran,
    untung_bersih: ringkas[0].untung_kotor - totalPengeluaran,
    jumlah_struk: ringkas[0].jumlah_struk,
    jumlah_void: strukVoid[0].jumlah,
    seri_harian: seri,
    produk_terlaris: laris,
    pengeluaran_per_kategori: kategoriPengeluaran,
    per_kasir: perKasir,
  });
});

module.exports = router;
