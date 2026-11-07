# 🏪 UMKM-Scan — Kasir Warung Gampang

Aplikasi manajemen warung untuk 1–100 orang. Bahasa warung sehari-hari:
**Modal Beli** (bukan HPP), **Uang Masuk** (bukan Pendapatan),
**Perkiraan Untung Bersih** (bukan Laba), **Utang Tetangga** (bukan Piutang).

Kasir scan barcode → catat jualan tunai/kasbon → stok & untung otomatis rapi.
Semua perhitungan uang (kembalian, untung, sisa utang) dihitung di backend,
bukan di browser — jadi angka tidak bisa "diakali" dari sisi klien.

---

## Daftar Isi

1. [Setup](#1-setup)
2. [Fitur](#2-fitur)
3. [Teknologi](#3-teknologi)
4. [Arsitektur](#4-arsitektur)
5. [API Ringkas](#5-api-ringkas)
6. [Metode Testing](#6-metode-testing)
7. [Laporan E2E + Screenshot](#7-laporan-e2e--screenshot)
8. [Rencana V2.0 & Batasan](#8-rencana-v20--batasan)

---

## 1. Setup

### Prasyarat

| Kebutuhan | Versi |
|---|---|
| Docker + Docker Compose | Docker 24+ / Compose v2+ |
| Node.js (opsional, untuk dev tanpa Docker) | 20+ |
| Browser | Chrome/Edge/Firefox/Safari modern |

### Cara tercepat (Docker)

```bash
cp .env.example .env
docker compose up --build
```

Sekali perintah, otomatis berjalan berurutan:
migrasi SQL (`db/migrations/001–010`) → seed owner + 7 barang demo + 2 suplier demo
→ backend → frontend (nginx).

| Layanan | URL |
|---|---|
| Kasir (frontend) | http://localhost:5175 |
| API (backend) | http://localhost:3011/health |
| PostgreSQL (host) | `localhost:5433` |

**Login demo:** `owner@warung.test` / `warung123`

Tambahkan kasir/gudang lewat menu **Orang** (khusus Owner).

### Konfigurasi `.env`

Semua nilai punya default, jadi `.env` boleh dikosongkan saat awal.

| Variabel | Default | Keterangan |
|---|---|---|
| `DB_USER` / `DB_PASSWORD` / `DB_NAME` | `warung` / `warung123` / `umkmscan` | kredensial PostgreSQL |
| `DB_PORT` | `5433` | port Postgres di host |
| `API_PORT` / `WEB_PORT` | `3011` / `5175` | port host backend & frontend |
| `JWT_SECRET` | `ganti-rahasia-ini-di-production` | **wajib diganti** di production |
| `JWT_EXPIRES_IN` | `12h` | masa berlaku token |
| `PORT` (container backend) | `3001` | port internal backend (tidak diubah) |
| `SEED_OWNER_EMAIL` / `SEED_OWNER_PASSWORD` | `owner@warung.test` / `warung123` | akun owner awal |
| `VITE_API_URL` | `http://localhost:3011` | origin API yang dipanggil browser |
| `WA_DRIVER` | `manual` | driver WhatsApp: `manual`, `waha`, `cloudapi` |
| `WAHA_URL` | — | base URL WAHA, mis. `http://waha:3000` (wajib untuk driver `waha`) |
| `WAHA_SESSION` | `default` | nama sesi WAHA |
| `WAHA_API_KEY` | — | API key WAHA bila diaktifkan |
| `WA_OWNER_NUMBER` | — | nomor pemilik cadangan penerima rekap (`62...`) |
| `WA_POLL_MS` / `WA_MAX_PERCOBAAN` | `30000` / `5` | jeda worker & batas percobaan kirim ulang |

> Untuk akses dari HP lewat tunnel (ngrok/cloudflared), isi `VITE_API_URL`
> dengan URL publik tunnel lalu `docker compose up --build` ulang — nginx juga
> sudah mem-proxy `/api/` ke backend di origin yang sama agar bebas mixed-content.

> **WhatsApp otomatis:** gunakan WAHA self-hosted (driver `waha`) agar rekap
> harian & tagihan kasbon terkirim tanpa membuka `wa.me`. Detail setup ada di
> [bagian 8.2](#82-keputusan-whatsapp-waha-self-hosted).

### Dev tanpa Docker

```bash
docker compose up -d db              # jalankan PostgreSQL saja (port 5433)

cd backend
cp .env.example .env                 # sesuaikan DATABASE_URL ke :5433
npm install
npm run migrate                      # jalankan db/migrations/*.sql
npm run seed                         # owner + produk + suplier demo
npm run dev                          # http://localhost:3001

cd ../frontend
npm install
npm run dev                          # http://localhost:5173
```

`backend/package.json` menyediakan `npm run migrate` dan `npm run seed`
(idempotent — aman dijalankan berulang). Build produksi frontend: `npm run build`.

### Perintah bantu

```bash
docker compose logs -f backend       # pantau migrasi/seed/API
docker compose down                  # hentikan container (data Postgres tetap)
docker compose down -v               # hentikan + hapus volume DB (reset total)
docker compose up -d --build frontend backend   # rebuild setelah ubah kode
```

### Troubleshooting singkat

| Gejala | Penyebab & solusi |
|---|---|
| Halaman putih / API gagal | Frontend di-build dengan `VITE_API_URL` lama → `docker compose up -d --build frontend` |
| Port host bentrok | Ubah `WEB_PORT`/`API_PORT`/`DB_PORT` di `.env`, lalu `docker compose up -d` |
| Login gagal setelah reset | Tunggu backend selesai `migrate && seed` (`docker compose logs -f backend`) |
| Data ingin mulai dari nol | `docker compose down -v && docker compose up --build` |

---

## 2. Fitur

> Penomoran: fitur yang sudah berjalan saat ini adalah **rilis 1.x**. Rencana
> rilis besar berikutnya ada di [bagian 8](#8-rencana-v20--batasan).

### Rilis 1.0 — fondasi warung

1. **Stok + warna**: 🟢 Aman / 🟡 Menipis (≤ batas) / 🔴 Habis. Form tambah/ubah,
   tombol Barang Masuk (+1), opname lewat ubah stok, dan rekomendasi kulakan.
2. **Kasir cepat**: kamera HP (`html5-qrcode`) + ketik manual/USB scanner,
   filter kategori, keranjang + konfirmasi void, uang diterima → kembalian instan,
   potong stok transaksional, struk thermal 58mm di halaman terpisah `/struk/:id`
   (print-only, tanpa sidebar).
3. **Suplier Pintar**: multi-suplier per barang + harga beli, badge **Termurah**
   otomatis, daftar belanja kulakan saat stok menipis, chat WA suplier.
   Laporan: estimasi nilai belanja, potensi hemat, menang-termurah per suplier,
   menipis per kategori, barang masuk 30 hari, riwayat harga. Harga disensor untuk kasir.
4. **Dompet Harian**: kartu Uang Masuk Tunai, Penjualan Kasbon, Pengeluaran,
   Perkiraan Untung Bersih, indikator kesehatan warung, grafik produk terlaris,
   badge merah jatuh tempo, kirim rekap via WA pemilik.
5. **Kasbon Tetangga**: catat utang + cicilan + tombol **Ingatkan via WA** →
   draf sopan otomatis ke `wa.me/62xxx`. Nomor `08xx` dinormalisasi ke `62xx`.

### Rilis 1.1 — koreksi & rekap

6. **Riwayat Transaksi**: filter rentang tanggal, cari kode struk, filter
   tunai/kasbon, cetak ulang ke `/struk/:id`, halaman `/riwayat`.
7. **Jual Kasbon dari Kasir**: toggle Tunai/Kasbon — utang tetangga tercatat
   **atomik** satu transaksi DB (nama + no WA + janji bayar), struk menampilkan
   "KASBON", utang tertaut kode struk di menu Kasbon.
8. **Riwayat Stok**: modal per barang menampilkan semua pergerakan
   (masuk/jual/opname) + sisa + pelaku + catatan — audit gudang.
9. **Catat Pengeluaran**: listrik, sewa, gaji, transport, dll. Otomatis mengurangi
   **Untung Bersih** di Dompet, Laporan, dan rekap WA. Halaman `/pengeluaran`.
10. **Laporan Periode**: harian / 7 hari / bulanan / kustom (`/laporan`) — uang
    masuk tunai, penjualan kasbon, untung kotor/bersih, grafik harian, produk
    terlaris, pengeluaran per kategori, jualan per pegawai, rekap periode via WA.
11. **Void Struk Penuh**: batalkan salah input (owner) — stok dikembalikan,
    utang kasbon ikut dihapus (bila belum ada cicilan), struk tersimpan sebagai
    audit dengan alasan, otomatis keluar dari semua laporan.
12. **PWA + responsif**: layout mobile (bottom-nav + drawer), desktop (sidebar
    lipat), pengaturan struk (58/80mm/A4), pasang ke layar utama HP.

### Fitur V2.0 yang sudah aktif

1. **Pembayaran non-tunai** — QRIS, transfer, e-wallet; referensi bayar,
   rekap per metode, dan rekonsiliasi di Dompet/Laporan/struk.
2. **Kulakan & hutang suplier** — pembelian menambah stok otomatis, cicilan
   bayar, status belum/sebagian/lunas, jatuh tempo.
3. **Shift / tutup kasir** — kas awal, rekap tunai/non-tunai/kasbon, refund
   retur, hitung uang seharusnya & selisih kas fisik.
4. **Retur parsial + rusak/expired** — retur per item dengan opsi kembali ke
   stok, writeoff mengurangi stok dan mencatat kerugian modal.
5. **WhatsApp otomatis + rekap terjadwal** — adapter `manual`/`waha`/`cloudapi`,
   tabel `wa_outbox` dengan retry, rekap harian otomatis, kirim tagihan kasbon
   otomatis dengan fallback `wa.me`.
6. **Ekspor & backup** — rekap harian/detail penjualan/daftar barang ke CSV
   (Excel), laporan siap cetak PDF lewat browser, backup JSON seluruh data, dan
   pemulihan atomik dengan konfirmasi `PULIHKAN`.
7. **Kasir offline-first** — katalog terakhir tersimpan di perangkat, transaksi
   saat koneksi putus masuk antrean lokal, lalu disinkronkan otomatis dengan
   `client_id` idempoten agar tidak ada struk ganda.

### Akun & Peran (RBAC)

| Fitur | Owner | Kasir | Gudang |
|---|---|---|---|
| Kasir / jualan (tunai & kasbon) | ✅ | ✅ | ❌ |
| Riwayat transaksi + cetak ulang struk | ✅ | ✅ | ❌ |
| Lihat harga + stok | ✅ | ✅ | ✅ |
| Riwayat stok (masuk/jual/opname) | ✅ | ❌ | ✅ |
| Lihat Modal Beli & Untung | ✅ | ❌ disensor backend | ❌ |
| Dompet Harian & Laporan periode | ✅ | ❌ 403 | ❌ 403 |
| Catat pengeluaran (listrik, sewa, dll) | ✅ | ❌ | ❌ |
| Batalkan struk (void) | ✅ | ❌ | ❌ |
| Kasbon + WA | ✅ | ❌ (buat dari Kasir ✅) | ❌ |
| WhatsApp otomatis & rekap terjadwal | ✅ | ❌ | ❌ |
| Ekspor CSV/PDF + backup & restore | ✅ | ❌ | ❌ |
| Kasir saat offline (antrean lokal) | ✅ | ✅ | ❌ |
| Suplier + harga kulakan | ✅ | ❌ disensor | ✅ kelola |
| Rekomendasi kulakan menipis | ✅ | ❌ | ✅ |
| Struk thermal 58mm terpisah | ✅ | ✅ | ❌ |
| Ubah stok / tambah barang | ✅ | ❌ | ✅ |
| Kelola orang | ✅ | ❌ | ❌ |

Tier-1 Solo Fighter = 1 akun Owner yang login. Tambah kasir/gudang di menu **Orang**.

---

## 3. Teknologi

| Lapisan | Teknologi | Alasan singkat |
|---|---|---|
| Frontend | React 18 + Vite 5 | HMR cepat, build kecil, lazy-load kamera |
| Styling | Tailwind CSS 3 + PostCSS | konsisten, responsif mobile-first |
| UI tambahan | Framer Motion, lucide-react | animasi & ikon ringan |
| Barcode/QR | html5-qrcode (lazy), jsbarcode, qrcode.react | kamera HP + label QR/barcode |
| State & HTTP | React Context (auth, pengaturan) + axios | sederhana, tanpa state library |
| Routing | react-router-dom 6 | SPA + halaman print-only terpisah |
| Backend | Node.js 20 + Express 4 | ringan, mudah diaudit |
| Validasi | express-validator | validasi input di server |
| Auth | JWT (`jsonwebtoken`) + bcryptjs | login stateless, password hash |
| Database | PostgreSQL 16 | transaksi atomik, generated column untung |
| Akses DB | `pg` (raw SQL) | query eksplisit, mudah ditelusuri |
| Migrasi | runner SQL sendiri (`backend/src/config/migrate.js`) + `db/migrations/*.sql` | tanpa ORM, urutan & riwayat tercatat di tabel `_migrations` |
| Infra | Docker Compose + nginx | satu perintah jalan, proxy `/api` satu origin |
| PWA | manifest + service worker (`frontend/src/pwa.js`) | pasang di HP, cache aset |
| WhatsApp | WAHA self-hosted + adapter driver `manual`/`waha`/`cloudapi` | gratis & tanpa limit pesan, REST + webhook, mudah dikustom; opsi resmi disiapkan menyusul |
| Testing | Node fetch (`docs/uji-api.mjs`) + Playwright (`docs/e2e-ui.mjs`) | tanpa framework berat, reproducible |

---

## 4. Arsitektur

### Topologi runtime

```
┌────────────────────────────┐
│         Browser            │
│  React SPA (5175)          │
│  ├─ halaman owner/kasir/…  │
│  └─ /struk/:id (print-only)│
└────────────┬───────────────┘
             │ HTTP (JSON, JWT Bearer)
             ▼
┌────────────────────────────┐
│  nginx (container frontend)│
│  ├─ /        → SPA statis   │
│  └─ /api/    → proxy        │
└────────────┬───────────────┘
             ▼
┌────────────────────────────┐
│  Express API (3011→3001)   │
│  ├─ middleware JWT + RBAC  │
│  ├─ routes: auth, products,│
│  │  sales, reports, debts, │
│  │  expenses, suppliers,   │
│  │  users                   │
│  └─ sensor modal & laba    │
└────────────┬───────────────┘
             ▼
┌────────────────────────────┐
│  PostgreSQL 16 (5433→5432) │
│  15 migrasi + seed demo    │
└────────────────────────────┘
```

### Struktur folder

```
docker-compose.yml           # db + backend + frontend (nginx)
db/migrations/*.sql          # 001–010: users, products, sales, kasbon, kategori,
                             #   suppliers, riwayat harga, tautan utang↔struk,
                             #   pengeluaran, void struk
db/seeds/001_demo.sql        # placeholder; seed asli di backend/src/seed.js
backend/src/
  index.js                   # bootstrap Express + /health
  config/db.js               # pool pg
  config/migrate.js          # runner migrasi SQL
  seed.js                    # owner + 7 produk + 2 suplier demo (idempotent)
  middleware/auth.js         # authRequired + requireRole
  routes/*.js                # 14 modul API
  utils/warung.js            # kode struk, normalisasi WA, draf tagihan, sensor modal
  services/wa.js             # adapter kirim WhatsApp: manual/waha/cloudapi + outbox
  services/waWorker.js       # worker antrean + rekap harian terjadwal
  utils/offline.js (frontend) # cache katalog + antrean transaksi localStorage
frontend/src/
  App.jsx                    # routing + kerangka layout
  api/client.js              # axios instance + helper rupiah
  context/*.jsx              # AuthContext, PengaturanContext (localStorage)
  components/*.jsx           # Sidebar, BottomNav, ProductCard, StrukPrint, dll
  pages/*.jsx                # Dompet, Kasir, Riwayat, Stok, Suplier, Kasbon,
                             #   WhatsApp, Ekspor, LaporanCetak, Pengeluaran, Laporan,
                             #   Orang, Pengaturan, Struk, Login
docs/
  uji-api.mjs                # uji API & RBAC otomatis (67 skenario)
  e2e-ui.mjs                 # uji E2E UI + screenshot otomatis (Playwright)
  screenshots/*.png          # bukti visual (dipakai di laporan bawah)
```

### Model data (ringkas)

| Tabel | Isi penting |
|---|---|
| `users` | akun + `role` (`owner`/`kasir`/`gudang`) + `aktif` |
| `products` | barcode unik, `harga_jual`, `modal_beli`, `stok`, `batas_menipis`, `kategori` |
| `stock_movements` | audit stok: `masuk`/`jual`/`opname`/`keluar` + sisa + pelaku |
| `sales` | 1 struk: total masuk/modal, `perkiraan_untung` (generated), kembalian, `dibayar_via`, `voided_at`, `client_id` unik untuk retry offline |
| `sale_items` | snapshot nama/harga/modal per item — rekap tetap benar walau harga berubah |
| `debts` + `debt_payments` | utang tetangga + cicilan, `sale_id` menautkan ke struk asal |
| `expenses` | pengeluaran warung per kategori/tanggal |
| `suppliers` + `product_suppliers` + riwayat | multi-suplier per barang + harga beli |
| `supplier_purchases` + `supplier_purchase_items` | kulakan per suplier: total, dibayar, sisa, jatuh tempo, snapshot barang |
| `supplier_payments` | cicilan bayar hutang kulakan + pelaku |
| `shifts` | shift kasir: kas awal, tunai/non-tunai/kasbon, pelunasan, refund retur, kas fisik, selisih |
| `sales.shift_id` + `debt_payments.shift_id` | menautkan transaksi & pelunasan ke shift berjalan |
| `sale_returns` | retur jual per item + writeoff rusak/expired: qty, nilai, alasan, stok kembali/tidak |
| `app_settings` | setelan aplikasi di server |
| `wa_outbox` | antrean pesan WhatsApp: tipe, tujuan, status, percobaan, jadwal retry, error |

### Keputusan desain yang dijaga

- **Sensor di backend**: `modal_beli`, `total_modal`, `perkiraan_untung`, harga
  beli suplier dihapus dari response untuk non-owner — bukan sekadar disembunyikan UI.
- **Semua uang dihitung server**: kembalian, untung, sisa utang; klien hanya menampilkan.
- **Atomik**: jual kasbon = insert sales + items + potong stok + catat utang dalam
  satu transaksi (`BEGIN`/`COMMIT`), dengan `SELECT … FOR UPDATE` saat potong stok.
- **Void = audit, bukan hapus**: struk void tersimpan + `alasan_void`, dikecualikan
  dari laporan; utang kasbon ber-cicilan menolak di-void.
- **Snapshot harga** di `sale_items` supaya laporan lama tidak berubah saat harga diubah.
- **Satu origin untuk API**: nginx mem-proxy `/api/` ke backend — aman untuk tunnel HTTPS.

---

## 5. API Ringkas

Semua endpoint butuh header `Authorization: Bearer <token>` kecuali `POST /api/auth/login`
dan `GET /health`.

```
POST /api/auth/login {email,password} → {token, pengguna}
GET  /api/auth/me

GET  /api/products?q=&status=&kategori=   (modal disensor untuk non-owner)
POST /api/products                        (owner, gudang)
PUT  /api/products/:id                    (owner, gudang; harga/modal hanya owner)
GET  /api/products/:id/movements?tipe=&from=&to=&limit=   (owner, gudang)
POST /api/products/:id/masuk {jumlah}     (owner, gudang)

POST /api/sales {items, uang_diterima|dibayar_via:"kasbon", kasbon:{...}, client_id?}  (owner, kasir; client_id = retry idempoten)
GET  /api/sales?hari=|dari=&sampai=&q=&dibayar_via=&tampilkan_void=&limit=&offset=
GET  /api/sales/:id                       (detail struk; kasir tanpa modal)
POST /api/sales/:id/void {alasan}         (owner only)

GET  /api/reports/harian?tanggal=YYYY-MM-DD      (owner only)
GET  /api/reports/rentang?dari=&sampai=          (owner only)

GET/POST/DELETE /api/expenses?dari=&sampai=&kategori=   (owner only)

GET  /api/purchases?dari=&sampai=&supplier_id=&status=&q=   (owner, gudang)
GET  /api/purchases/ringkasan                (owner, gudang)
GET  /api/purchases/:id                       (detail + barang + riwayat bayar)
POST /api/purchases {supplier_id, items, jatuh_tempo}   (owner, gudang; stok bertambah)
POST /api/purchases/:id/bayar {jumlah_bayar}  (owner only; cicilan hutang)

GET  /api/shifts                             (owner: semua, kasir: sendiri)
GET  /api/shifts/aktif                       (shift terbuka milik pengguna)
GET  /api/shifts/:id                         (detail + hitungan live)
POST /api/shifts/buka {kas_awal}             (owner, kasir)
POST /api/shifts/:id/tutup {kas_fisik,catatan} (owner / pemilik shift; hitung selisih)

GET  /api/returns?tipe=&dari=&sampai=&sale_id=&product_id=
POST /api/returns {tipe:"retur_jual",sale_id,product_id,qty,...}  (owner, kasir)
POST /api/returns {tipe:"writeoff",product_id,qty,alasan}          (owner, gudang)

GET  /api/debts
POST /api/debts
POST /api/debts/:id/bayar {jumlah_bayar}
GET  /api/debts/:id/payments
POST /api/debts/:id/ingatkan
GET  /api/debts/:id/wa-link               (draf tagihan siap wa.me)

GET/POST/PUT/DELETE /api/suppliers        (owner, gudang; kasir lihat tersensor)
GET  /api/suppliers/laporan
GET  /api/suppliers/daftar-kulakan
GET  /api/suppliers/oleh-produk/:productId
POST /api/suppliers/oleh-produk/:productId {supplier_id, harga_beli}
DELETE /api/suppliers/oleh-produk/:productId/:linkId

GET/POST/PUT/DELETE /api/users            (owner only; hapus akun sendiri ditolak)

# WhatsApp otomatis (owner only)
GET  /api/wa/status                       (driver, kesiapan, setelan, hitungan outbox)
GET  /api/wa/outbox?status=&limit=         (antrean pesan)
GET  /api/wa/pengaturan
PUT  /api/wa/pengaturan {no_pemilik,jam_rekap,rekap_aktif}
POST /api/wa/kirim {tujuan,pesan}          (kirim langsung via driver aktif)
POST /api/wa/rekap {tanggal,tujuan?}       (rekap harian manual)
POST /api/wa/kasbon/:id                    (tagihan kasbon otomatis)
POST /api/wa/proses                        (proses ulang antrean)

# Ekspor & backup (owner only)
GET  /api/exports/laporan.csv?dari=&sampai=   (rekap harian, Excel-compatible)
GET  /api/exports/penjualan.csv?dari=&sampai= (detail struk)
GET  /api/exports/barang.csv                  (produk + status stok)
GET  /api/backup                              (unduh JSON seluruh data)
POST /api/backup/restore {konfirmasi:"PULIHKAN",data}  (ganti seluruh data, atomik)
```

---

## 6. Metode Testing

Pengujian dilakukan 4 lapis — dari bawah (infrastruktur) ke atas (perilaku pengguna):

| # | Lapis | Alat | Cakupan |
|---|---|---|---|
| 1 | Migrasi & seed | `docker compose logs backend`, tabel `_migrations` | 15 migrasi idempotent, seed owner + 7 produk + 2 suplier |
| 2 | Build statis | `npm run build` (Vite) | produksi frontend sukses tanpa error |
| 3 | API & RBAC otomatis | `node docs/uji-api.mjs` (tanpa framework) | health, auth, validasi 400/404, sensor modal, matriks 403 per peran, audit void |
| 4 | E2E UI + visual | `node docs/e2e-ui.mjs` (Playwright headless) | alur nyata owner lewat browser + screenshot tiap halaman |

### Cara menjalankan ulang

```bash
# 1) stack hidup
cp .env.example .env && docker compose up --build -d

# 2) uji API & RBAC (67 skenario)
node docs/uji-api.mjs

# 3) uji E2E UI + regenerate screenshot (Playwright dipasang di frontend/)
cd frontend && npm i -D playwright && npx playwright install chromium && cd ..
node docs/e2e-ui.mjs
```

Prinsip uji:

- **Uji perilaku, bukan implementasi** — memanggil HTTP/UI seperti pemakai asli.
- **RBAC diuji dari backend** — pastikan 403, bukan cuma menu disembunyikan.
- **Data demo aman** — `docs/uji-api.mjs` hanya membuat 2 akun uji sementara lalu
  menghapusnya; skenario validasi tidak menyisakan data.
- **Bukti visual** — setiap halaman penting disimpan sebagai screenshot di
  `docs/screenshots/` dan dipakai di laporan bawah.

---

## 7. Laporan E2E + Screenshot

**Tanggal eksekusi:** 19 Oktober 2026
**Lingkungan:** Docker Compose lokal (frontend `:5175`, API `:3011`, PostgreSQL 16),
Chromium 151 headless 1440×900 + 390×844, timezone `Asia/Jakarta`.
**Akun:** `owner@warung.test` (Owner). Data awal dari seed demo.

### Hasil uji otomatis

| Uji | Perintah | Hasil |
|---|---|---|
| API & RBAC | `node docs/uji-api.mjs` | **67 lolos / 0 gagal** |
| E2E UI | `node docs/e2e-ui.mjs` | **selesai, 18 screenshot** (tanpa error) |

Cakupan 67 skenario API: health + koneksi DB; login salah sandi (401), email
tidak valid (400), tanpa token (401); owner melihat `modal_beli`/`total_modal`
dan `seri_harian` format `YYYY-MM-DD`; kasir & gudang menerima 403 di
`reports`, `expenses`, `debts`, `products/:id/movements`, `POST /sales`, dan
void; sensor `modal_beli`/`total_modal` untuk non-owner; validasi
`expenses=0`, keranjang kosong, kasbon tanpa nama, debts tanpa nama, produk
tidak ada (404); audit void (`tampilkan_void=1`, void kedua 400); status &
antrean WhatsApp, validasi kirim/rekap/pengaturan, ekspor CSV, backup JSON,
validasi `client_id` idempotensi offline,
validasi restore, serta RBAC kasir (403);
akun uji dibuat lalu dihapus dan tidak bisa login lagi.

### Alur end-to-end yang diuji lewat UI

| # | Langkah | Hasil yang diverifikasi | Bukti |
|---|---|---|---|
| 1 | Buka `/masuk`, login owner | diarahkan ke `/dompet`, token tersimpan | `01-halaman-login.png` |
| 2 | Kasir: tambah **Kopi Sachet ×2** + **Indomie ×1**, uang **Rp20.000** | total Rp7.500, kembalian Rp12.500 dihitung server | `02`, `03` |
| 3 | Klik Bayar | struk tersimpan, stok terpotong, nomor `WQ-20261019-162128-412` | `04` |
| 4 | Buka halaman struk `/struk/:id` | layout print-only 58mm + tombol Cetak | `05` |
| 5 | Kasir: **Beras 1kg** mode **Kasbon** atas nama **Bu Siti** (`0812…`), janji bayar H-1 | utang Rp13.500 tercatat atomik, nomor dinormalisasi `62…`, badge **Telat 1 hari** | `06`, `11` |
| 6 | Pengeluaran: **Listrik Rp15.000** | total periode Rp15.000, mengurangi untung bersih | `12a`, `12b` |
| 7 | Dompet Harian | Uang Masuk Rp7.500 • Kasbon Rp13.500 • Pengeluaran Rp15.000 • Untung Bersih **−Rp11.100** (status "Perlu hemat modal") | `07` |
| 8 | Riwayat, Stok, Suplier, Laporan, Orang, Pengaturan | data konsisten lintas halaman; grafik harian & produk terlaris terisi | `08`–`15` |
| 9 | Tampilan HP 390×844 | bottom-nav + drawer menu berfungsi | `16`, `17` |

Catatan konsistensi angka: angka Dompet Harian cocok persis dengan API
(`GET /api/reports/harian` tanggal 19 Okt) — tunai Rp7.500 + kasbon Rp13.500,
untung kotor Rp3.900, pengeluaran Rp15.000 → untung bersih **−Rp11.100**.
Di Laporan, filter "Bulan Ini" menampilkan periode penuh (termasuk transaksi
lama) sehingga untungnya valid berbeda; ganti filter ke "Hari Ini" untuk
angka harian yang sama. Struk yang dibatalkan saat persiapan pengujian juga
tampil sebagai "3 struk dibatalkan (tidak dihitung)" di Laporan — bukti
audit void bekerja.

### Temuan bug & perbaikan selama E2E

| Bug | Dampak | Akar masalah | Perbaikan |
|---|---|---|---|
| Label grafik "Invalid Date" di Laporan | sumbu grafik harian tidak terbaca | API mengirim `tanggal` ISO timestamp, frontend menempel `T00:00:00` | `backend/src/routes/reports.js` mengirim `YYYY-MM-DD` + `GrafikHarian.jsx` menangani kedua format |
| Tanggal "Invalid Date" di daftar Pengeluaran | tanggal catatan tidak tampil | penyebab sama di `Pengeluaran.jsx` | `tanggalTeks()` menormalkan ke 10 karakter pertama sebelum `new Date` |

### Galeri screenshot

| Halaman login | Kasir — cari barang |
|---|---|
| ![Login](docs/screenshots/01-halaman-login.png) | ![Kasir cari](docs/screenshots/02-kasir-cari-barang.png) |

| Kasir — keranjang & kembalian | Kasir — struk selesai |
|---|---|
| ![Keranjang](docs/screenshots/03-kasir-keranjang.png) | ![Struk selesai](docs/screenshots/04-kasir-struk-selesai.png) |

| Halaman struk thermal 58mm | Kasir — form jual kasbon |
|---|---|
| ![Struk thermal](docs/screenshots/05-struk-thermal.png) | ![Form kasbon](docs/screenshots/06-kasir-kasbon-form.png) |

| Dompet Harian (setelah pengeluaran) | Riwayat Transaksi |
|---|---|
| ![Dompet](docs/screenshots/07-dompet-harian.png) | ![Riwayat](docs/screenshots/08-riwayat-transaksi.png) |

| Stok Barang | Suplier Pintar |
|---|---|
| ![Stok](docs/screenshots/09-stok-barang.png) | ![Suplier](docs/screenshots/10-suplier-pintar.png) |

| Kasbon Tetangga (badge telat) | Pengeluaran — form |
|---|---|
| ![Kasbon](docs/screenshots/11-kasbon-tetangga.png) | ![Form pengeluaran](docs/screenshots/12a-pengeluaran-form.png) |

| Pengeluaran — daftar | Laporan Periode |
|---|---|
| ![Pengeluaran](docs/screenshots/12b-pengeluaran.png) | ![Laporan](docs/screenshots/13-laporan-periode.png) |

| Orang Warung (RBAC) | Pengaturan |
|---|---|
| ![Orang](docs/screenshots/14-orang-warung.png) | ![Pengaturan](docs/screenshots/15-pengaturan.png) |

| HP — Kasir | HP — drawer menu |
|---|---|
| ![Mobile kasir](docs/screenshots/16-mobile-kasir.png) | ![Mobile menu](docs/screenshots/17-mobile-menu.png) |

### Kesimpulan

Alur inti warung terbukti berjalan end-to-end: login → jual tunai (kembalian
benar) → jual kasbon (utang + WA + jatuh tempo) → pengeluaran → Dompet &
Laporan konsisten → cetak struk. Kontrol akses terverifikasi di sisi backend
(403 & sensor data), dan dua bug tanggal yang ditemukan saat E2E sudah
diperbaiki serta diverifikasi ulang lewat screenshot.

---

## 8. Rencana V2.0 & Batasan

### 8.1 Rencana V2.0

Fokus rilis 2.0 adalah menutup celah operasional harian UMKM Indonesia —
terutama uang, kulakan, dan kepercayaan antar-orang di warung — bukan menambah
laporan akuntansi berat.

| # | Fitur | Kenapa relevan untuk UMKM Indonesia | Dampak teknis | Status |
|---|---|---|---|---|
| 1 | **Pembayaran non-tunai (QRIS/transfer/e-wallet)** + rekonsiliasi | QRIS sudah lazim di warung/kios; saat ini `sales.dibayar_via` hanya `tunai`/`kasbon`, jadi uang non-tunai tidak tercatat rapi | Tambah metode bayar + bukti + laporan per metode | ✅ Selesai |
| 2 | **Hutang ke suplier + pembelian (kulakan)** | Kulakan bon adalah praktik umum; menu Suplier baru menyimpan harga, belum transaksi hutang | Tabel purchases/payments, jatuh tempo, cicilan, tautan ke suplier | ✅ Selesai |
| 3 | **Tutup kasir / shift + selisih kas** | Sumber konflik pemilik–kasir paling sering; belum ada kas awal, rekap shift, atau serah terima | Tabel shift, rekap per kasir, input uang fisik | ✅ Selesai |
| 4 | **Retur parsial / barang rusak / expired** | Sekarang retur hanya void struk penuh; barang rusak/expired tidak bisa dicatat | Alur retur per item + alasan, memakai `stock_movements` | ✅ Selesai |
| 5 | **WhatsApp otomatis + rekap terjadwal** | Reminder kasbon & rekap harian via `wa.me` manual sering terlupa | Adapter WA + `wa_outbox` + scheduler (lihat 8.2) | ✅ Selesai |
| 6 | **Ekspor laporan Excel/PDF + backup/restore** | Kebutuhan pembukuan/pengajuan modal (KUR) dan rasa aman data | Endpoint ekspor + unduh backup | ✅ Selesai |
| 7 | **Mode offline-first untuk kasir** | Internet warung sering putus; transaksi tidak boleh gagal | Antrean lokal + sinkronisasi; risiko arsitektur besar | ✅ Selesai |
| 8 | **Multi-outlet + harga grosir/member** | UMKM naik kelas biasanya buka cabang atau punya pelanggan langganan | Isolasi data per outlet, peran, harga bertingkat | ⏳ Rencana |

Catatan urutan: 1–4 menyentuh uang harian dan layak dikerjakan lebih dulu;
7–8 paling berisiko sehingga tidak dijejalkan di awal rilis.

### 8.2 Keputusan WhatsApp: WAHA self-hosted

Kebutuhan: **tanpa limit pesan** dan **bisa dikustom** ke depan. Karena itu
default yang dipilih adalah **WAHA (WhatsApp HTTP API) self-hosted**, bukan
gateway kredit lokal atau Cloud API resmi.

| Opsi | Limit/biaya | Kustom | Catatan |
|---|---|---|---|
| **WAHA self-hosted** (dipilih) | Gratis & tanpa limit pesan sejak rilis 2026.6.1 | Tinggi — REST + webhook, pilihan engine (NOWEB/GOWS/WEBJS/WPP) | Tidak resmi → nomor berisiko dibatasi/ban |
| Evolution API | Gratis (mode Baileys); mode Cloud API ikut biaya Meta | Tinggi, bisa Cloud API + integrasi n8n/Chatwoot | Stack berat (Postgres+Redis), sejak 2.4.0 butuh aktivasi lisensi |
| Meta Cloud API (resmi) | Berbayar per pesan (+62: ±Rp356 utility/service, ±Rp586 marketing) | Terikat kebijakan & template Meta | Paling aman/patuh, tidak "tanpa limit" |
| Fonnte/WABLAS | Kredit/langganan + limit | Rendah | Tidak sesuai kebutuhan |

Implementasi saat ini:

- `backend/src/services/wa.js` — satu adapter untuk driver `manual`, `waha`
  (REST `/api/sendText`, `chatId` dinormalisasi ke `62...@c.us`), dan
  `cloudapi` (Graph API). Driver `manual` tidak mengirim; UI memakai `wa.me`.
- Tabel `wa_outbox` — pesan disimpan dulu, worker mengirim & retry tiap 2 menit
  sampai `WA_MAX_PERCOBAAN`, sehingga transaksi tidak memblokir dan pesan tidak
  hilang saat sesi WAHA putus.
- `backend/src/services/waWorker.js` — memproses antrean tiap `WA_POLL_MS` dan
  mengantre rekap harian setelah jam yang diatur (zona WIB, sekali per tanggal).
- Setelan `wa_no_pemilik`, `wa_jam_rekap`, `wa_rekap_aktif` disimpan di
  `app_settings` lewat halaman `/whatsapp` (owner only).
- Halaman `/whatsapp`: status driver, pengaturan rekap, kirim tes, kirim rekap
  manual, proses antrean, dan riwayat pesan.
- Kasbon: tombol kirim mencoba otomatis lebih dulu; bila driver belum aktif,
  pengguna diarahkan ke tautan `wa.me` seperti sebelumnya.
- Env: `WA_DRIVER`, `WAHA_URL`, `WAHA_API_KEY`, `WAHA_SESSION`,
  `WA_OWNER_NUMBER`, `WA_POLL_MS`, `WA_MAX_PERCOBAAN`.
- WAHA dijalankan terpisah (self-hosted) dan diarahkan lewat `WAHA_URL`;
  sesi WAHA harus sudah ter-pairing sebelum pengiriman otomatis dipakai.

Risiko & mitigasi: gunakan **nomor khusus** (bukan nomor pribadi owner), kirim
hanya pesan transaksional (rekap & tagihan), beri rate-limit/jeda, dan sediakan
kill-switch. Jika butuh kepatuhan penuh atau volume besar, aktifkan driver
Cloud API tanpa mengubah logika bisnis.

### 8.3 Batasan saat ini

- Bundle frontend ~1.11MB (html5-qrcode) — kandidat code-split/lazy load lanjutan
  (kamera sudah lazy-load).
- WhatsApp otomatis bergantung pada WAHA yang ter-pairing; status *delivered/read*
  belum dilacak lewat webhook (baru status kirim dari API).
- Void struk penuh tetap tersedia untuk koreksi; retur parsial & barang rusak/expired ada di 8.1 #4.
- Belum ada multi-toko (rencana 8.1 #8). Hutang ke suplier sudah aktif di 8.1 #2.
- Ekspor PDF memakai dialog cetak browser (“Save as PDF”), bukan generator PDF
  di server; isi mengikuti halaman laporan periode.
- Antrean offline disimpan di `localStorage` perangkat/browser, jadi tidak
  tersinkron antar perangkat. Stok dicek ulang di server saat sinkron; bila stok
  sudah berubah, transaksi ditandai gagal dan bisa dicoba/dihapus dari Kasir.
  Struk offline baru bisa dicetak dari Riwayat setelah sinkron berhasil.
- Backup JSON memuat seluruh data termasuk hash sandi — simpan berkas di tempat
  aman. Restore bersifat mengganti total (bukan merge), hanya untuk owner.
- Uji E2E UI belum terpasang sebagai CI — saat ini dijalankan manual lewat
  `docs/e2e-ui.mjs`.
