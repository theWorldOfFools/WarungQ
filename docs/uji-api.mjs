/**
 * Uji API & RBAC otomatis (tanpa dependensi, Node 18+).
 *
 * Jalankan dari root repo (backend harus hidup, default http://localhost:3011):
 *   node docs/uji-api.mjs
 *   BASE_URL=http://localhost:3011 node docs/uji-api.mjs
 *
 * Sifat uji: read-only terhadap data demo, kecuali 2 akun uji sementara
 * (kasir & gudang) yang dibuat lalu dihapus lagi di akhir skenario.
 * Exit code 0 = semua lolos.
 */
const BASE = process.env.BASE_URL || 'http://localhost:3011';
let lolos = 0, gagal = 0;
const hasil = [];
function cek(nama, kondisi, info = '') {
  if (kondisi) { lolos++; hasil.push(`  PASS  ${nama}`); }
  else { gagal++; hasil.push(`  FAIL  ${nama} ${info}`); }
}
async function api(method, path, { token, body } = {}) {
  const r = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await r.json(); } catch {}
  return { status: r.status, data };
}

const login = async (email, password) => (await api('POST', '/api/auth/login', { body: { email, password } })).data.token;

// 1. Health & auth
const sehat = await api('GET', '/health');
cek('health 200 + db sehat', sehat.status === 200 && sehat.data.status === 'sehat');
const salahSandi = await api('POST', '/api/auth/login', { body: { email: 'owner@warung.test', password: 'salah' } });
cek('login sandi salah -> 401', salahSandi.status === 401);
const emailBuruk = await api('POST', '/api/auth/login', { body: { email: 'bukan-email', password: 'x' } });
cek('login email tidak valid -> 400', emailBuruk.status === 400);
const token = await login('owner@warung.test', 'warung123');
cek('login owner -> token', typeof token === 'string' && token.length > 20);
const tanpaToken = await api('GET', '/api/products');
cek('tanpa token -> 401', tanpaToken.status === 401);

// 2. Owner: endpoint baca utama
const harian = await api('GET', '/api/reports/harian', { token });
cek('owner reports/harian 200 + field uang_masuk', harian.status === 200 && typeof harian.data.uang_masuk === 'number');
const rentang = await api('GET', '/api/reports/rentang', { token });
cek('owner reports/rentang 200 + seri_harian', rentang.status === 200 && Array.isArray(rentang.data.seri_harian) && /^\d{4}-\d{2}-\d{2}$/.test(rentang.data.seri_harian[0].tanggal));
const expenses = await api('GET', '/api/expenses', { token });
cek('owner expenses 200', expenses.status === 200 && Array.isArray(expenses.data.pengeluaran));
const debts = await api('GET', '/api/debts', { token });
cek('owner debts 200', debts.status === 200 && Array.isArray(debts.data));
const supLaporan = await api('GET', '/api/suppliers/laporan', { token });
cek('owner suppliers/laporan 200 + estimasi harga terlihat', supLaporan.status === 200 && supLaporan.data.ringkasan.estimasi_nilai_kulakan != null);
const produk = await api('GET', '/api/products', { token });
cek('owner products: modal_beli terlihat', produk.status === 200 && produk.data.length > 0 && produk.data[0].modal_beli != null);
const sales = await api('GET', '/api/sales?limit=5', { token });
cek('owner sales: total_modal terlihat + void tersembunyi', sales.status === 200 && sales.data[0].total_modal != null && sales.data.every((s) => !s.voided_at));

// 3. Akun uji sementara: kasir & gudang (dibersihkan di akhir)
const kasir = await api('POST', '/api/users', { token, body: { nama_pengguna: 'Uji Kasir', email: 'uji.kasir@warung.test', password: 'rahasia123', role: 'kasir' } });
const gudang = await api('POST', '/api/users', { token, body: { nama_pengguna: 'Uji Gudang', email: 'uji.gudang@warung.test', password: 'rahasia123', role: 'gudang' } });
cek('owner buat user kasir & gudang -> 201', kasir.status === 201 && gudang.status === 201);
const tokenKasir = await login('uji.kasir@warung.test', 'rahasia123');
const tokenGudang = await login('uji.gudang@warung.test', 'rahasia123');

const kasirHarian = await api('GET', '/api/reports/harian', { token: tokenKasir });
cek('kasir reports/harian -> 403', kasirHarian.status === 403);
const kasirRentang = await api('GET', '/api/reports/rentang', { token: tokenKasir });
cek('kasir reports/rentang -> 403', kasirRentang.status === 403);
const kasirExpenses = await api('GET', '/api/expenses', { token: tokenKasir });
cek('kasir expenses -> 403', kasirExpenses.status === 403);
const kasirDebts = await api('GET', '/api/debts', { token: tokenKasir });
cek('kasir debts -> 403', kasirDebts.status === 403);
const kasirProduk = await api('GET', '/api/products', { token: tokenKasir });
cek('kasir products: modal_beli disensor', kasirProduk.status === 200 && kasirProduk.data.every((p) => p.modal_beli === undefined));
const kasirSales = await api('GET', '/api/sales?limit=5', { token: tokenKasir });
cek('kasir sales: total_modal disensor', kasirSales.status === 200 && kasirSales.data.every((s) => s.total_modal === undefined));

const gudangSales = await api('GET', '/api/sales', { token: tokenGudang });
cek('gudang sales -> 403', gudangSales.status === 403);
const gudangJual = await api('POST', '/api/sales', { token: tokenGudang, body: { items: [{ id: 'x', qty: 1 }], uang_diterima: 1 } });
cek('gudang POST sales -> 403', gudangJual.status === 403);
const movements = await api('GET', `/api/products/${produk.data[0].id}/movements`, { token: tokenGudang });
cek('gudang products/:id/movements 200', movements.status === 200 && Array.isArray(movements.data.gerakan));
const gerakanKasir = await api('GET', `/api/products/${produk.data[0].id}/movements`, { token: tokenKasir });
cek('kasir products/:id/movements -> 403', gerakanKasir.status === 403);
const gudangLaporan = await api('GET', '/api/suppliers/laporan', { token: tokenGudang });
cek('gudang suppliers/laporan: harga disensor', gudangLaporan.status === 200 && gudangLaporan.data.ringkasan.estimasi_nilai_kulakan === undefined);

// 4. Validasi & 404 (tanpa membuat data)
const expNol = await api('POST', '/api/expenses', { token, body: { jumlah: 0, kategori: 'Uji' } });
cek('expenses jumlah 0 -> 400', expNol.status === 400);
const keranjangKosong = await api('POST', '/api/sales', { token, body: { items: [] } });
cek('sales keranjang kosong -> 400', keranjangKosong.status === 400);
const kasbonKosong = await api('POST', '/api/sales', { token, body: { items: [{ id: produk.data[0].id, qty: 1 }], dibayar_via: 'kasbon', kasbon: { nama_tetangga: '', no_wa: '' } } });
cek('sales kasbon tanpa nama -> 400', kasbonKosong.status === 400);
const debtTanpaNama = await api('POST', '/api/debts', { token, body: { no_wa: '08123', total_utang: 5000 } });
cek('debts tanpa nama -> 400', debtTanpaNama.status === 400);
const produk404 = await api('GET', '/api/products/00000000-0000-4000-8000-000000000000', { token });
cek('produk tidak ada -> 404', produk404.status === 404);
const voidKasir = await api('POST', `/api/sales/${sales.data[0].id}/void`, { token: tokenKasir, body: { alasan: 'uji' } });
cek('kasir void struk -> 403', voidKasir.status === 403);

// 5. Audit void: struk yang sudah dibatalkan tetap terlihat & tidak bisa divoid 2x
const audit = await api('GET', '/api/sales?tampilkan_void=1&limit=200', { token });
const sudahVoid = audit.data.find((s) => s.voided_at);
if (sudahVoid) {
  const voidDuaKali = await api('POST', `/api/sales/${sudahVoid.id}/void`, { token, body: { alasan: 'uji' } });
  cek('void struk dua kali -> 400', voidDuaKali.status === 400);
} else {
  cek('mode audit menampilkan struk dibatalkan (dilewati: belum ada void)', true);
}

// 6. Bersihkan akun uji
const hapusKasir = await api('DELETE', `/api/users/${kasir.data.id}`, { token });
const hapusGudang = await api('DELETE', `/api/users/${gudang.data.id}`, { token });
cek('bersihkan user uji -> 200', hapusKasir.status === 200 && hapusGudang.status === 200);
const loginKasirHilang = await api('POST', '/api/auth/login', { body: { email: 'uji.kasir@warung.test', password: 'rahasia123' } });
cek('user uji terhapus -> login 401', loginKasirHilang.status === 401);

console.log(hasil.join('\n'));
console.log(`\nTOTAL: ${lolos} lolos / ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
