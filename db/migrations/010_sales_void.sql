-- 010: void (batalkan) struk penuh — koreksi salah input setelah dibayar.
-- Struk void tetap tersimpan untuk audit, tapi dikecualikan dari laporan (WHERE voided_at IS NULL).
ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS voided_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS alasan_void VARCHAR(200) NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_sales_voided ON sales(voided_at) WHERE voided_at IS NOT NULL;
