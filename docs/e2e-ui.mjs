/**
 * Uji E2E UI + screenshot otomatis (Playwright).
 *
 * Jalankan dari root repo (butuh Playwright + Chromium):
 *   cd frontend && npm i -D playwright && npx playwright install chromium && cd ..
 *   node docs/e2e-ui.mjs
 *
 * Prasyarat: stack docker compose hidup (http://localhost:5175 & :3011).
 * Script ini menjalankan alur nyata lewat browser (login -> jual tunai ->
 * jual kasbon -> pengeluaran -> semua halaman) lalu menyimpan screenshot
 * ke docs/screenshots/. Untuk hasil paling bersih, jalankan pada DB demo baru.
 */
import fs from 'node:fs';

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  ({ chromium } = await import(new URL('../frontend/node_modules/playwright/index.mjs', import.meta.url)));
}
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE_URL || 'http://localhost:5175';
const DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(DIR, 'screenshots');
fs.mkdirSync(OUT, { recursive: true });

const geser = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

async function snapCatatan(page, nama, targetUrl, tunggu) {
  await page.goto(BASE + targetUrl, { waitUntil: 'domcontentloaded' });
  try {
    await page.waitForLoadState('networkidle', { timeout: 8000 });
  } catch {}
  if (tunggu) {
    try { await page.waitForSelector(tunggu, { timeout: 8000 }); } catch {}
  }
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, nama), fullPage: true });
  console.log('[shot]', nama);
}

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'id-ID',
    timezoneId: 'Asia/Jakarta',
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);

  // 1. Halaman login
  await snapCatatan(page, '01-halaman-login.png', '/masuk', 'button:has-text("Masuk ke Warung")');

  // 2. Login owner
  await page.getByRole('button', { name: /Masuk ke Warung/ }).click();
  await page.waitForURL('**/dompet');
  await page.waitForLoadState('networkidle').catch(() => {});

  // 3. Kasir: jual tunai (Kopi Sachet x2, Indomie x1)
  await snapCatatan(page, '02-kasir-cari-barang.png', '/kasir', 'text=Kopi Sachet');
  await page.locator('.card', { hasText: 'Kopi Sachet' }).getByRole('button', { name: /Keranjang/ }).click();
  await page.locator('.card', { hasText: 'Kopi Sachet' }).getByRole('button', { name: /Keranjang/ }).click();
  await page.locator('.card', { hasText: 'Indomie Goreng' }).getByRole('button', { name: /Keranjang/ }).click();
  await page.getByRole('button', { name: '20rb' }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, '03-kasir-keranjang.png'), fullPage: true });
  console.log('[shot] 03-kasir-keranjang.png');

  await page.getByRole('button', { name: /^Bayar / }).click();
  await page.getByText(/Jualan tersimpan/).waitFor();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, '04-kasir-struk-selesai.png'), fullPage: true });
  console.log('[shot] 04-kasir-struk-selesai.png');

  const strukHref = await page.getByRole('link', { name: /Buka halaman struk/ }).getAttribute('href');
  await snapCatatan(page, '05-struk-thermal.png', strukHref, 'text=Cetak 58mm');

  // 4. Kasir: jual kasbon (Beras 1kg) — jatuh tempo kemarin agar badge telat muncul
  await page.locator('.card', { hasText: 'Beras 1kg' }).getByRole('button', { name: /Keranjang/ }).click();
  await page.getByRole('button', { name: 'Kasbon' }).click();
  await page.getByPlaceholder('Nama tetangga').fill('Bu Siti');
  await page.getByPlaceholder('No. WA (08...)').fill('081234567890');
  await page.locator('input[type="date"]').fill(geser(1));
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, '06-kasir-kasbon-form.png'), fullPage: true });
  console.log('[shot] 06-kasir-kasbon-form.png');
  await page.getByRole('button', { name: /^Simpan Kasbon/ }).click();
  await page.getByText(/Jualan kasbon tersimpan/).waitFor();

  // 5. Semua halaman owner
  await snapCatatan(page, '08-riwayat-transaksi.png', '/riwayat', 'text=Riwayat Transaksi');
  await snapCatatan(page, '09-stok-barang.png', '/stok', 'text=Stok Barang');
  await snapCatatan(page, '10-suplier-pintar.png', '/suplier', 'text=Suplier Pintar');
  await snapCatatan(page, '11-kasbon-tetangga.png', '/kasbon', 'text=Kasbon Tetangga');

  // 6. Pengeluaran baru
  await page.goto(BASE + '/pengeluaran', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('text=Pengeluaran Warung');
  await page.getByRole('button', { name: /Catat/ }).click();
  await page.locator('input[list="daftar-kategori-pengeluaran"]').fill('Listrik');
  await page.getByPlaceholder('mis. 150000').fill('15000');
  await page.getByPlaceholder('mis. token listrik').fill('Token listrik warung');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, '12a-pengeluaran-form.png'), fullPage: true });
  console.log('[shot] 12a-pengeluaran-form.png');
  await page.getByRole('button', { name: 'Simpan Pengeluaran' }).click();
  await page.getByText('Pengeluaran tersimpan.').waitFor();
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, '12b-pengeluaran.png'), fullPage: true });
  console.log('[shot] 12b-pengeluaran.png');

  // 7. Dompet setelah pengeluaran mengurangi untung bersih
  await snapCatatan(page, '07-dompet-harian.png', '/dompet', 'text=Dompet Harian');
  await snapCatatan(page, '13-laporan-periode.png', '/laporan', 'text=Laporan Periode');
  await snapCatatan(page, '14-orang-warung.png', '/pengguna', 'text=Orang Warung');
  await snapCatatan(page, '15-pengaturan.png', '/pengaturan', 'text=Profil warung');

  // 8. Tampilan HP (mobile)
  await page.setViewportSize({ width: 390, height: 844 });
  await snapCatatan(page, '16-mobile-kasir.png', '/kasir', 'text=Kopi Sachet');
  await page.getByRole('button', { name: 'Buka menu warung' }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, '17-mobile-menu.png') });
  console.log('[shot] 17-mobile-menu.png');

  await browser.close();
  console.log('SELESAI');
})().catch((e) => {
  console.error('GAGAL:', e);
  process.exit(1);
});
