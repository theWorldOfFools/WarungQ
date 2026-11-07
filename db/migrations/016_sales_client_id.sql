-- 016_sales_client_id.sql
-- Idempotensi transaksi offline: kasir menyimpan client_id unik per keranjang,
-- sehingga kirim ulang saat koneksi pulih tidak membuat struk ganda.

ALTER TABLE sales ADD COLUMN IF NOT EXISTS client_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_client_id
  ON sales(client_id) WHERE client_id IS NOT NULL;
