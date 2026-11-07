-- 011: metode pembayaran non-tunai (QRIS, transfer, e-wallet) + referensi.
-- tunai & kasbon tetap. Untuk non-tunai, uang_diterima = total & kembalian = 0.

-- Hapus CHECK lama pada dibayar_via apa pun namanya, lalu pasang aturan baru.
DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'sales'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%dibayar_via%'
  LOOP
    EXECUTE format('ALTER TABLE sales DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE sales
  ADD CONSTRAINT sales_dibayar_via_check
  CHECK (dibayar_via IN ('tunai', 'kasbon', 'qris', 'transfer', 'ewallet'));

-- Referensi pembayaran non-tunai (mis. 4 digit terakhir, no. transaksi, catatan).
ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS referensi_bayar VARCHAR(120) NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_sales_dibayar_via ON sales(dibayar_via);
