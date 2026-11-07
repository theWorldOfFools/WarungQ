-- 015_wa_outbox.sql
-- Antrean pesan WhatsApp (driver manual | waha | cloudapi).
-- Pesan disimpan dulu agar tidak hilang saat WAHA/API sedang mati,
-- lalu worker mengirim & mencoba ulang sesuai jadwal.

CREATE TABLE IF NOT EXISTS wa_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipe VARCHAR(30) NOT NULL DEFAULT 'manual',
  tujuan VARCHAR(30) NOT NULL,
  pesan TEXT NOT NULL,
  status VARCHAR(12) NOT NULL DEFAULT 'antri'
    CHECK (status IN ('antri', 'terkirim', 'gagal')),
  percobaan INTEGER NOT NULL DEFAULT 0,
  jadwal_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  terkirim_at TIMESTAMPTZ,
  error VARCHAR(300) NOT NULL DEFAULT '',
  ref_id VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wa_outbox_status ON wa_outbox(status, jadwal_at);
CREATE INDEX IF NOT EXISTS idx_wa_outbox_created ON wa_outbox(created_at DESC);
