/* Pendaftar PWA UMKM-Scan v1.
 * - Daftarkan /sw.js hanya di production (aman untuk dev).
 * - Tangkap beforeinstallprompt agar tombol "Pasang Aplikasi" bisa memicunya.
 * - Minta SW baru segera aktif saat ada update, lalu muat ulang sekali.
 */

let tundaPasang = null;
let sudahMuatUlang = false;

export function siapPasang() {
  return !!tundaPasang;
}

export function modeBerdiri() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

export async function mintaPasang() {
  if (!tundaPasang) return 'tak-tersedia';
  tundaPasang.prompt();
  const { outcome } = await tundaPasang.userChoice;
  tundaPasang = null;
  window.dispatchEvent(new CustomEvent('pwa-install-berubah'));
  return outcome; // 'accepted' | 'dismissed'
}

export function initPWA() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    tundaPasang = e;
    window.dispatchEvent(new CustomEvent('pwa-install-berubah'));
  });

  window.addEventListener('appinstalled', () => {
    tundaPasang = null;
    window.dispatchEvent(new CustomEvent('pwa-install-berubah'));
  });

  if (!('serviceWorker' in navigator)) return;
  // Jangan daftarkan SW saat dev (Vite) agar tidak meng-cache kode mentah.
  if (!import.meta.env.PROD) return;

  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      // Bila ada SW baru menunggu, minta segera aktif.
      if (reg.waiting) reg.waiting.postMessage('LEWATI_TUNGGU');
      reg.addEventListener('updatefound', () => {
        const swBaru = reg.installing;
        swBaru?.addEventListener('statechange', () => {
          if (swBaru.state === 'installed' && navigator.serviceWorker.controller) {
            reg.waiting?.postMessage('LEWATI_TUNGGU');
          }
        });
      });
      // Muat ulang sekali agar versi baru langsung dipakai.
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!sudahMuatUlang) {
          sudahMuatUlang = true;
          window.location.reload();
        }
      });
    } catch (err) {
      console.warn('[pwa] gagal mendaftar service worker:', err);
    }
  });
}
