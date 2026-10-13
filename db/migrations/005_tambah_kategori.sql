-- 005: kolom kategori untuk filter cepat kasir/stok (Sembako, Minuman, Rokok, ...).
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS kategori VARCHAR(50) NOT NULL DEFAULT 'Lainnya';

CREATE INDEX IF NOT EXISTS idx_products_kategori ON products(kategori);
