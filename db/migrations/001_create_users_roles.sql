-- 001_create_users_roles.sql
-- Peran: owner (akses penuh), kasir (POS saja), gudang (stok saja)
-- Tier 1 Solo Fighter = 1 akun owner yang login (sesuai keputusan produk).

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS citext;

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('owner', 'kasir', 'gudang');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama_pengguna VARCHAR(100) NOT NULL,
  nama_toko VARCHAR(100) NOT NULL DEFAULT 'Warung Saya',
  email CITEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'owner',
  aktif BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Pengaturan umum warung

CREATE TABLE IF NOT EXISTS app_settings (
  kunci VARCHAR(50) PRIMARY KEY,
  nilai TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO app_settings (kunci, nilai) VALUES
  ('mode', 'tim'),
  ('nama_aplikasi', 'UMKM-Scan')
ON CONFLICT (kunci) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
