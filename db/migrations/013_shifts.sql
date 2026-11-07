-- 013_shifts.sql
-- Tutup kasir / shift: kas awal, uang tunai masuk, pelunasan kasbon,
-- kas fisik saat tutup, dan selisih kas. Non-tunai tidak masuk laci.
-- Satu kasir hanya boleh punya satu shift berstatus 'buka'.

CREATE TABLE IF NOT EXISTS shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kasir_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  mulai TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  selesai TIMESTAMPTZ,
  kas_awal INTEGER NOT NULL DEFAULT 0 CHECK (kas_awal >= 0),
  status VARCHAR(10) NOT NULL DEFAULT 'buka' CHECK (status IN ('buka', 'tutup')),
  kas_fisik INTEGER CHECK (kas_fisik IS NULL OR kas_fisik >= 0),
  total_tunai INTEGER NOT NULL DEFAULT 0,
  total_non_tunai INTEGER NOT NULL DEFAULT 0,
  total_kasbon INTEGER NOT NULL DEFAULT 0,
  total_pelunasan INTEGER NOT NULL DEFAULT 0,
  jumlah_transaksi INTEGER NOT NULL DEFAULT 0,
  uang_seharusnya INTEGER,
  selisih INTEGER,
  catatan VARCHAR(300) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_shifts_buka_per_kasir
  ON shifts(kasir_id) WHERE status = 'buka';
CREATE INDEX IF NOT EXISTS idx_shifts_kasir ON shifts(kasir_id);
CREATE INDEX IF NOT EXISTS idx_shifts_mulai ON shifts(mulai);

ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_sales_shift ON sales(shift_id);

ALTER TABLE debt_payments
  ADD COLUMN IF NOT EXISTS shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_debt_payments_shift ON debt_payments(shift_id);
