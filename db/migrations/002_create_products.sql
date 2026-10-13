-- 002_create_products.sql
-- Inventaris + riwayat stok. Harga dalam Rupiah integer (tanpa koma).

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barcode VARCHAR(64) UNIQUE,
  nama VARCHAR(150) NOT NULL,
  harga_jual INTEGER NOT NULL CHECK (harga_jual >= 0),
  modal_beli INTEGER NOT NULL DEFAULT 0 CHECK (modal_beli >= 0),
  stok INTEGER NOT NULL DEFAULT 0,
  batas_menipis INTEGER NOT NULL DEFAULT 5 CHECK (batas_menipis >= 0),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_nama ON products USING gin (to_tsvector('simple', nama));

DO $$ BEGIN
  CREATE TYPE stock_tipe AS ENUM ('masuk', 'keluar', 'jual', 'opname');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  tipe stock_tipe NOT NULL,
  jumlah INTEGER NOT NULL,
  sisa INTEGER NOT NULL,
  catatan TEXT DEFAULT '',
  oleh UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_movements_product ON stock_movements(product_id);
