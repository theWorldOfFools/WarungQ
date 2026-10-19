-- 009: pengeluaran warung (listrik, sewa, gaji, transport, ...).
-- Dipakai untuk memperbaiki Perkiraan Untung Bersih: untung = uang masuk - modal - pengeluaran.
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
  kategori VARCHAR(50) NOT NULL DEFAULT 'Lainnya',
  keterangan VARCHAR(200) NOT NULL DEFAULT '',
  jumlah INTEGER NOT NULL CHECK (jumlah > 0),
  dicatat_oleh UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_tanggal ON expenses(tanggal);
