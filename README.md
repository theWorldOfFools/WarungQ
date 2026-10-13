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
| Suplier + harga kulakan | ✅ | ❌ disensor | ✅ kelola |
| Rekomendasi kulakan menipis | ✅ | ❌ | ✅ |
| Struk thermal 58mm terpisah | ✅ | ✅ | ❌ |
| Ubah stok / tambah barang | ✅ | ❌ | ✅ |
| Kelola orang | ✅ | ❌ | ❌ |

Tier-1 Solo Fighter = 1 akun Owner yang login (sesuai keputusan produk).
Tambah kasir/gudang di menu **Orang** (khusus Owner).

## Fitur V1

1. **Stok + warna**: 🟢 Aman / 🟡 Menipis (≤ batas) / 🔴 Habis. Form tambah/ubah + tombol Barang Masuk + rekomendasi kulakan.
2. **Kasir cepat**: kamera HP (`html5-qrcode`) + ketik manual/USB scanner, filter kategori cepat, keranjang + konfirmasi void, uang diterima → kembalian otomatis, potong stok transaksional, struk thermal 58mm di halaman terpisah `/struk/:id` (print-only, tanpa sidebar).
3. **Suplier Pintar**: multi-suplier per barang + harga beli, badge **Termurah** otomatis, daftar belanja kulakan saat stok menipis, chat WA suplier. Harga disensor untuk kasir.
4. **Dompet Harian**: kartu Uang Masuk, Perkiraan Untung Bersih, indikator kesehatan, grafik + produk terlaris, badge merah jatuh tempo, kirim rekap via WA pemilik.
5. **Kasbon Tetangga**: catat utang + cicilan + tombol **Ingatkan via WA** → buka `wa.me/62xxx?text=draf` otomatis. Nomor `08xx` dinormalisasi ke `62xx`.

## Struktur

```
docker-compose.yml  # db + backend + frontend (nginx)
db/migrations/*.sql # 001 users, 002 products, 003 sales, 004 kasbon, 005 kategori, 006 suppliers
backend/src/        # Express: auth, products, sales, reports, debts, users, suppliers
frontend/src/       # React Vite + Tailwind: Kasir, Stok, Suplier, Dompet, Kasbon, Orang, Struk
```

## API ringkas

```
POST /api/auth/login {email,password} → {token, pengguna}
GET  /api/products?q=          (modal disensor untuk non-owner)
POST /api/products             (owner, gudang)
POST /api/sales {items:[{id|barcode,qty}], uang_diterima} (owner, kasir)
GET  /api/sales/:id (detail struk + items untuk halaman /struk/:id)
GET/POST /api/suppliers + PUT/DELETE (owner, gudang; kasir lihat tersensor)
GET  /api/suppliers/oleh-produk/:productId (perbandingan harga + flag termurah)
POST /api/suppliers/oleh-produk/:productId {supplier_id, harga_beli} (owner, gudang)
GET  /api/suppliers/daftar-kulakan (stok menipis + suplier termurah)
GET  /api/reports/harian?tanggal=YYYY-MM-DD  (owner only)
GET/POST /api/debts  +  POST /api/debts/:id/bayar  +  GET /api/debts/:id/wa-link (owner only)
GET/POST /api/users            (owner only)
```

## Verifikasi yang sudah lolos

- `docker compose config` valid; `db` healthy (`pg_isready`).
- Migrasi 001–006 + seed owner + produk + suplier demo: OK.
- Login owner + kasir, sensor `modal_beli`/`harga_beli` untuk kasir, 403 dompet untuk kasir: OK.
- Login owner + kasir, sensor `modal_beli` untuk kasir, 403 dompet untuk kasir: OK.
- Jualan 1× Beras Rp13.500 dibayar Rp20.000 → kembalian Rp6.500, untung Rp2.000: OK.
- Kasbon normalisasi `0812…` → `62812…` + draf WA: OK.
- `npm run build` frontend (Vite) sukses.

## Batasan V1 → V2

- Bundle frontend ~800KB (html5-qrcode); V2: code-split + lazy load kamera (kamera sudah lazy-load).
- Kasbon WA masih link `wa.me` manual (tanpa API otomatis) — sesuai keputusan.
- Belum ada retur, multi-toko, dan laporan bulanan.
