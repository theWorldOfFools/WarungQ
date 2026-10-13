const express = require('express');
const pool = require('../config/db');
const { authRequired, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

// GET /api/reports/harian?tanggal=YYYY-MM-DD — OWNER ONLY.
// Kasir & gudang DILARANG lihat laba (dipotong di backend, bukan cuma disembunyikan).
router.get('/harian', requireRole('owner'), async (req, res) => {
  const tanggal = req.query.tanggal || new Date().toISOString().slice(0, 10);
  const { rows: ringkas } = await pool.query(
    `SELECT COALESCE(SUM(total_masuk),0)::int AS uang_masuk,
            COALESCE(SUM(total_modal),0)::int AS total_modal,
            COALESCE(SUM(perkiraan_untung),0)::int AS perkiraan_untung_bersih,
            COUNT(*)::int AS jumlah_struk
     FROM sales WHERE created_at::date = $1`,
    [tanggal]
  );
  const { rows: laris } = await pool.query(
    `SELECT si.nama_snapshot AS nama, SUM(si.qty)::int AS terjual,
            SUM(si.subtotal)::int AS uang_masuk
     FROM sale_items si JOIN sales s ON s.id = si.sale_id
     WHERE s.created_at::date = $1
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
  res.json({
    tanggal,
    uang_masuk: ringkas[0].uang_masuk,
    perkiraan_untung_bersih: ringkas[0].perkiraan_untung_bersih,
    jumlah_struk: ringkas[0].jumlah_struk,
    produk_terlaris: laris,
    utang_tetangga_aktif: kasbon[0].total_utang_aktif,
    utang_jatuh_tempo: { jumlah: tempo[0].jumlah, total_sisa: tempo[0].total_sisa },
  });
});

module.exports = router;
