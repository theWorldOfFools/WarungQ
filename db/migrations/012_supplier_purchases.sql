-- 012_supplier_purchases.sql
-- Pembelian kulakan ke suplier + pencatatan hutang (bayar bertahap).
-- Total & sisa dalam Rupiah integer. Stok bertambah saat kulakan dicatat.

CREATE TABLE IF NOT EXISTS supplier_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kode_pembelian VARCHAR(40) UNIQUE NOT NULL,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
  jatuh_tempo DATE,
  total_beli INTEGER NOT NULL CHECK (total_beli >= 0),
  total_dibayar INTEGER NOT NULL DEFAULT 0 CHECK (total_dibayar >= 0),
  sisa_hutang INTEGER NOT NULL CHECK (sisa_hutang >= 0),
  status VARCHAR(10) NOT NULL DEFAULT 'belum' CHECK (status IN ('belum', 'sebagian', 'lunas')),
  catatan VARCHAR(200) NOT NULL DEFAULT '',
  dicatat_oleh UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_spurchases_supplier ON supplier_purchases(supplier_id);
CREATE INDEX IF NOT EXISTS idx_spurchases_tanggal ON supplier_purchases(tanggal);
CREATE INDEX IF NOT EXISTS idx_spurchases_status ON supplier_purchases(status);

CREATE TABLE IF NOT EXISTS supplier_purchase_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID NOT NULL REFERENCES supplier_purchases(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  nama_snapshot VARCHAR(150) NOT NULL,
  qty INTEGER NOT NULL CHECK (qty > 0),
  harga_beli INTEGER NOT NULL CHECK (harga_beli >= 0),
  subtotal INTEGER NOT NULL CHECK (subtotal >= 0)
);

CREATE INDEX IF NOT EXISTS idx_spurchase_items_purchase ON supplier_purchase_items(purchase_id);

CREATE TABLE IF NOT EXISTS supplier_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID NOT NULL REFERENCES supplier_purchases(id) ON DELETE CASCADE,
  jumlah_bayar INTEGER NOT NULL CHECK (jumlah_bayar > 0),
  diterima_oleh UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_spayments_purchase ON supplier_payments(purchase_id);
