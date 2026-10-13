-- 007_supplier_harga_riwayat.sql
-- Riwayat perubahan harga beli per suplier per produk (untuk laporan & statistik).
-- Dicatat backend setiap POST /api/suppliers/oleh-produk/:productId.

CREATE TABLE IF NOT EXISTS product_supplier_harga_riwayat (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  harga_beli INTEGER NOT NULL CHECK (harga_beli >= 0),
  dicatat_oleh UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_riwayatharga_produk ON product_supplier_harga_riwayat(product_id);
CREATE INDEX IF NOT EXISTS idx_riwayatharga_supplier ON product_supplier_harga_riwayat(supplier_id);
CREATE INDEX IF NOT EXISTS idx_riwayatharga_created ON product_supplier_harga_riwayat(created_at DESC);
