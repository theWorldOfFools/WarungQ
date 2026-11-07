-- 014_returns.sql
-- Retur parsial per item + barang rusak/expired.
-- retur_jual: uang kembali ke pembeli, stok bisa kembali (bila masih layak jual).
-- writeoff: barang rusak/expired dibuang dari stok, dicatat sebagai kerugian modal.
-- Refund tunai menempel ke shift agar kas laci saat tutup tetap akurat.

CREATE TABLE IF NOT EXISTS sale_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kode_retur VARCHAR(40) UNIQUE NOT NULL,
  tipe VARCHAR(12) NOT NULL CHECK (tipe IN ('retur_jual', 'writeoff')),
  alasan VARCHAR(20) NOT NULL DEFAULT 'lainnya'
    CHECK (alasan IN ('rusak', 'expired', 'salah_input', 'lainnya')),
  sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  nama_snapshot VARCHAR(150) NOT NULL,
  qty INTEGER NOT NULL CHECK (qty > 0),
  harga_satuan INTEGER NOT NULL DEFAULT 0 CHECK (harga_satuan >= 0),
  total_nilai INTEGER NOT NULL DEFAULT 0 CHECK (total_nilai >= 0),
  kembali_ke_stok BOOLEAN NOT NULL DEFAULT TRUE,
  keterangan VARCHAR(200) NOT NULL DEFAULT '',
  shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL,
  dicatat_oleh UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_returns_tipe ON sale_returns(tipe);
CREATE INDEX IF NOT EXISTS idx_returns_sale ON sale_returns(sale_id);
CREATE INDEX IF NOT EXISTS idx_returns_product ON sale_returns(product_id);
CREATE INDEX IF NOT EXISTS idx_returns_created ON sale_returns(created_at);
CREATE INDEX IF NOT EXISTS idx_returns_shift ON sale_returns(shift_id);

ALTER TABLE shifts
  ADD COLUMN IF NOT EXISTS total_refund INTEGER NOT NULL DEFAULT 0;
