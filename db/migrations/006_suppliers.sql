-- 006_suppliers.sql
-- Modul Suplier Pintar: multi-suplier per produk + harga beli per suplier.
-- Rekomendasi otomatis = harga_beli termurah per produk (dihitung di query).

CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama VARCHAR(120) NOT NULL,
  kontak_wa VARCHAR(20) NOT NULL DEFAULT '',
  alamat TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_suppliers_nama ON suppliers(LOWER(nama));
CREATE INDEX IF NOT EXISTS idx_suppliers_nama ON suppliers(nama);

CREATE TABLE IF NOT EXISTS product_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  harga_beli INTEGER NOT NULL CHECK (harga_beli >= 0),
  catatan TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, supplier_id)
);

CREATE INDEX IF NOT EXISTS idx_psup_product ON product_suppliers(product_id);
CREATE INDEX IF NOT EXISTS idx_psup_supplier ON product_suppliers(supplier_id);
CREATE INDEX IF NOT EXISTS idx_psup_harga ON product_suppliers(product_id, harga_beli);
