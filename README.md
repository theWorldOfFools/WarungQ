# 🏪 UMKM-Scan V2 — Kasir Warung Gampang

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
| Kasir / jualan (tunai & kasbon) | ✅ | ✅ | ❌ |
| Riwayat transaksi + cetak ulang struk | ✅ | ✅ | ❌ |
| Lihat harga + stok | ✅ | ✅ | ✅ |
| Riwayat stok (masuk/jual/opname) | ✅ | ❌ | ✅ |
| Lihat Modal Beli & Untung | ✅ | ❌ disensor backend | ❌ |
| Dompet Harian & Laporan periode | ✅ | ❌ 403 | ❌ 403 |
| Catat pengeluaran (listrik, sewa, dll) | ✅ | ❌ | ❌ |
| Batalkan struk (void) | ✅ | ❌ | ❌ |
| Kasbon + WA | ✅ | ❌ (buat dari Kasir ✅) | ❌ |
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
3. **Suplier Pintar**: multi-suplier per barang + harga beli, badge **Termurah** otomatis, daftar belanja kulakan saat stok menipis, chat WA suplier. Laporan & statistik: estimasi nilai belanja, potensi hemat, menang-termurah per suplier, menipis per kategori, barang masuk 30 hari, riwayat harga. Harga disensor untuk kasir.
4. **Dompet Harian**: kartu Uang Masuk Tunai, Penjualan Kasbon, Pengeluaran, Perkiraan Untung Bersih (setelah pengeluaran), indikator kesehatan, grafik + produk terlaris, badge merah jatuh tempo, kirim rekap via WA pemilik.
5. **Kasbon Tetangga**: catat utang + cicilan + tombol **Ingatkan via WA** → buka `wa.me/62xxx?text=draf` otomatis. Nomor `08xx` dinormalisasi ke `62xx`.

## Fitur V2

6. **Riwayat Transaksi**: daftar semua struk dengan filter rentang tanggal, cari kode struk, filter tunai/kasbon, cetak ulang dari `/struk/:id`, halaman terpisah `/riwayat`.
7. **Jual Kasbon dari Kasir**: toggle Tunai/Kasbon di kasir — utang tetangga otomatis tercatat **atomik** dalam satu transaksi DB (nama + no WA + janji bayar), struk menampilkan "KASBON", utang tertaut kode struk di menu Kasbon.
8. **Riwayat Stok**: modal per barang menampilkan semua pergerakan (masuk/jual/opname) + sisa + pelaku + catatan — audit gudang.
9. **Catat Pengeluaran**: listrik, sewa, gaji, transport, dll. Otomatis mengurangi **Untung Bersih** di Dompet, Laporan, dan rekap WA. Halaman `/pengeluaran` (owner).
10. **Laporan Periode**: rekap harian/7 hari/bulanan/kustom (`/laporan`) — uang masuk tunai, penjualan kasbon, untung kotor/bersih, grafik harian, produk terlaris, pengeluaran per kategori, jualan per pegawai, kirim rekap periode via WA.
11. **Void Struk Penuh**: batalkan salah input (owner) — stok dikembalikan, catatan utang kasbon ikut dihapus (bila belum ada cicilan), struk tetap tersimpan sebagai audit dengan alasan, otomatis keluar dari semua laporan.

## Struktur

```
docker-compose.yml  # db + backend + frontend (nginx)
db/migrations/*.sql # 001–010: users, products, sales, kasbon, kategori, suppliers, riwayat harga, tautan utang↔struk, pengeluaran, void struk
backend/src/        # Express: auth, products, sales, reports, debts, expenses, users, suppliers
frontend/src/       # React Vite + Tailwind: Kasir, Stok, Suplier, Dompet, Kasbon, Riwayat, Pengeluaran, Laporan, Orang, Struk
```

## API ringkas

```
POST /api/auth/login {email,password} → {token, pengguna}
GET  /api/products?q=          (modal disensor untuk non-owner)
POST /api/products             (owner, gudang)
GET  /api/products/:id/movements?tipe=&limit=  (riwayat stok; owner, gudang)
POST /api/sales {items, uang_diterima|dibayar_via:"kasbon", kasbon:{nama_tetangga,no_wa,jatuh_tempo}} (owner, kasir)
GET  /api/sales?hari=|dari=&sampai=&q=&dibayar_via=&tampilkan_void=&limit=&offset=  (riwayat; owner, kasir)
GET  /api/sales/:id (detail struk + items + kasbon untuk halaman /struk/:id)
POST /api/sales/:id/void {alasan} (batalkan struk penuh; owner only)
GET/POST /api/suppliers + PUT/DELETE (owner, gudang; kasir lihat tersensor)
GET  /api/suppliers/oleh-produk/:productId (perbandingan harga + flag termurah)
POST /api/suppliers/oleh-produk/:productId {supplier_id, harga_beli} (owner, gudang)
GET  /api/suppliers/daftar-kulakan (stok menipis + suplier termurah)
GET  /api/suppliers/laporan (ringkasan, per-suplier, per-kategori, riwayat harga, barang masuk 30 hari — owner & gudang)
GET  /api/reports/harian?tanggal=YYYY-MM-DD   (tunai/kasbon/pengeluaran terpisah; owner only)
GET  /api/reports/rentang?dari=&sampai=       (ringkasan + seri harian + per-kasir; owner only)
GET/POST/DELETE /api/expenses?dari=&sampai=&kategori= (catat pengeluaran; owner only)
GET/POST /api/debts  +  POST /api/debts/:id/bayar  +  GET /api/debts/:id/wa-link (owner only; kode_struk tertaut)
GET/POST /api/users            (owner only)
```

## Verifikasi yang sudah lolos

- Migrasi 001–010 + seed owner + produk + suplier demo: OK.
- Build frontend (Vite): sukses.
- Uji API otomatis 45 skenario (skrip curl) di DB bersih: **45 lolos / 0 gagal**, mencakup:
  - RBAC: gudang 403 di `/api/sales`; kasir 403 di void, pengeluaran, `reports/harian`, `reports/rentang`; kasir 403 `products/:id/movements`; sensor `modal_beli` untuk kasir (list & detail).
  - Tunai: kembalian otomatis, struk tersimpan, cari kode struk, `jumlah_item`.
  - Kasbon dari kasir: satu transaksi atomik, utang tertaut `kode_struk` + `sale_id`, nomor `08xx` → `62xx`, nama kosong ditolak 400, `kasbon_nama` tampil di detail struk.
  - Laporan: `uang_masuk` = tunai saja, `penjualan_kasbon` terpisah, pengeluaran mengurangi `untung_setelah_pengeluaran`, `/rentang` seri harian + per-kasir.
  - Pengeluaran: POST owner sukses, nominal 0 ditolak 400.
  - Void: kasir 403; void tunai mengembalikan stok + keluar dari laporan; void kedua 400; void kasbon ber-cicilan 400; void kasbon tanpa cicilan menghapus utang.

## Batasan V2 → V3

- Bundle frontend ~970KB (html5-qrcode) — kandidat code-split/lazy load berikutnya (kamera sudah lazy-load).
- Kasbon WA masih link `wa.me` manual (tanpa API otomatis) — sesuai keputusan.
- Retur = **void struk penuh**; belum ada retur parsial per item.
- Belum ada multi-toko & hutang ke suplier (V3).

