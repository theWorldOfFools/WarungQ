# 🏪 UMKM-Scan V1 — Kasir Warung Gampang

Aplikasi manajemen warung untuk 1–100 orang. Bahasa warung sehari-hari:
**Modal Beli** (bukan HPP), **Uang Masuk** (bukan Pendapatan),
**Perkiraan Untung Bersih** (bukan Laba), **Utang Tetangga** (bukan Piutang).

## Jalankan sekali perintah

```bash
cp .env.example .env
docker compose up --build
```

- Kasir (frontend): http://localhost:5173
- API (backend): http://localhost:3001/health
- Login demo: `owner@warung.test` / `warung123`

> `docker compose up` otomatis: migrasi SQL → seed owner + 5 barang demo → backend → frontend.

## Akun & Peran (RBAC)

| Fitur | Owner | Kasir | Gudang |
|---|---|---|---|
| Kasir / jualan | ✅ | ✅ | ❌ |
| Lihat harga + stok | ✅ | ✅ | ✅ |
| Lihat Modal Beli & Untung | ✅ | ❌ disensor backend | ❌ |
| Dompet Harian | ✅ | ❌ 403 | ❌ 403 |
| Kasbon + WA | ✅ | ❌ | ❌ |
| Ubah stok / tambah barang | ✅ | ❌ | ✅ |
| Kelola orang | ✅ | ❌ | ❌ |

Tier-1 Solo Fighter = 1 akun Owner yang login (sesuai keputusan produk).
Tambah kasir/gudang di menu **Orang** (khusus Owner).

## Fitur V1

1. **Stok + warna**: 🟢 Aman / 🟡 Menipis (≤ batas) / 🔴 Habis. Form tambah/ubah + tombol Barang Masuk.
2. **Kasir cepat**: kamera HP (`html5-qrcode`) + ketik manual/USB scanner, keranjang, total, uang diterima → kembalian otomatis, potong stok transaksional.
3. **Dompet Harian**: kartu Uang Masuk, Perkiraan Untung Bersih, Produk Terlaris, tanpa istilah akuntansi.
4. **Kasbon Tetangga**: catat utang + cicilan + tombol **Ingatkan via WA** → buka `wa.me/62xxx?text=draf` otomatis. Nomor `08xx` dinormalisasi ke `62xx`.

## Struktur

```
docker-compose.yml  # db + backend + frontend
db/migrations/*.sql # 001 users, 002 products, 003 sales, 004 kasbon
backend/src/        # Express: auth, products, sales, reports, debts, users
frontend/src/       # React Vite + Tailwind: Kasir, Stok, Dompet, Kasbon, Orang
```

## API ringkas

```
POST /api/auth/login {email,password} → {token, pengguna}
GET  /api/products?q=          (modal disensor untuk non-owner)
POST /api/products             (owner, gudang)
POST /api/sales {items:[{id|barcode,qty}], uang_diterima} (owner, kasir)
GET  /api/reports/harian?tanggal=YYYY-MM-DD  (owner only)
GET/POST /api/debts  +  POST /api/debts/:id/bayar  +  GET /api/debts/:id/wa-link (owner only)
GET/POST /api/users            (owner only)
```

## Verifikasi yang sudah lolos

- `docker compose config` valid; `db` healthy (`pg_isready`).
- Migrasi 001–004 + seed owner + 5 produk: OK.
- Login owner + kasir, sensor `modal_beli` untuk kasir, 403 dompet untuk kasir: OK.
- Jualan 1× Beras Rp13.500 dibayar Rp20.000 → kembalian Rp6.500, untung Rp2.000: OK.
- Kasbon normalisasi `0812…` → `62812…` + draf WA: OK.
- `npm run build` frontend (Vite) sukses.

## Batasan V1 → V2

- Bundle frontend ~800KB (html5-qrcode); V2: code-split + lazy load kamera.
- Kasbon WA masih link `wa.me` manual (tanpa API otomatis) — sesuai keputusan.
- Belum ada struk cetak, retur, multi-toko, dan laporan bulanan.
