-- 008: tautkan catatan utang ke struk asal (jual kasbon dari Kasir).
-- ON DELETE SET NULL: hapus struk tidak menghapus catatan utang.
ALTER TABLE debts
  ADD COLUMN IF NOT EXISTS sale_id UUID REFERENCES sales(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_debts_sale ON debts(sale_id);
