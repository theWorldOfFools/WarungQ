-- 004_create_kasbon.sql
-- Killer feature "Kasbon Tetangga": utang pelanggan + cicilan bayar.
-- no_wa disimpan format 62xxx agar siap dipakai link wa.me.

DO $$ BEGIN
  CREATE TYPE debt_status AS ENUM ('lancar', 'diingatkan', 'lunas');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS debts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama_tetangga VARCHAR(120) NOT NULL,
  no_wa VARCHAR(20) NOT NULL,
  total_utang INTEGER NOT NULL CHECK (total_utang > 0),
  sisa_utang INTEGER NOT NULL CHECK (sisa_utang >= 0),
  jatuh_tempo DATE,
  status debt_status NOT NULL DEFAULT 'lancar',
  dicatat_oleh UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_debts_status ON debts(status);
CREATE INDEX IF NOT EXISTS idx_debts_nama ON debts(nama_tetangga);

CREATE TABLE IF NOT EXISTS debt_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debt_id UUID NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
  jumlah_bayar INTEGER NOT NULL CHECK (jumlah_bayar > 0),
  diterima_oleh UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_debt ON debt_payments(debt_id);
