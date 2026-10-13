-- 003_create_sales.sql
-- POS: satu struk = satu baris sales + N baris sale_items.
-- Snapshot harga/modal per item agar rekap tetap benar walau harga berubah.

CREATE TABLE IF NOT EXISTS sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kode_struk VARCHAR(30) UNIQUE NOT NULL,
  total_masuk INTEGER NOT NULL CHECK (total_masuk >= 0),
  total_modal INTEGER NOT NULL DEFAULT 0 CHECK (total_modal >= 0),
  perkiraan_untung INTEGER GENERATED ALWAYS AS (total_masuk - total_modal) STORED,
  uang_diterima INTEGER NOT NULL CHECK (uang_diterima >= 0),
  kembalian INTEGER NOT NULL DEFAULT 0,
  dibayar_via VARCHAR(10) NOT NULL DEFAULT 'tunai' CHECK (dibayar_via IN ('tunai','kasbon')),
  kasir_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_kasir ON sales(kasir_id);

CREATE TABLE IF NOT EXISTS sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  nama_snapshot VARCHAR(150) NOT NULL,
  harga_snapshot INTEGER NOT NULL,
  modal_snapshot INTEGER NOT NULL DEFAULT 0,
  qty INTEGER NOT NULL CHECK (qty > 0),
  subtotal INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
