const KUNCI_PRODUK = 'wq_cache_produk';
const KUNCI_ANTREAN = 'wq_antrean_jual';

function baca(kunci, cadangan) {
  try {
    const teks = localStorage.getItem(kunci);
    if (!teks) return cadangan;
    const nilai = JSON.parse(teks);
    return nilai ?? cadangan;
  } catch {
    return cadangan;
  }
}

function tulis(kunci, nilai) {
  try {
    localStorage.setItem(kunci, JSON.stringify(nilai));
  } catch {}
}

export function simpanProduk(rows) {
  tulis(KUNCI_PRODUK, { disimpan_pada: new Date().toISOString(), rows });
}

export function produkCache() {
  const isi = baca(KUNCI_PRODUK, null);
  return Array.isArray(isi?.rows) ? isi.rows : [];
}

export function waktuCacheProduk() {
  return baca(KUNCI_PRODUK, null)?.disimpan_pada || null;
}

function kabarkan() {
  window.dispatchEvent(new Event('wq-antrean'));
}

export function bacaAntrean() {
  const isi = baca(KUNCI_ANTREAN, []);
  return Array.isArray(isi) ? isi : [];
}

export function clientIdBaru() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function tambahAntrean(payload, meta = {}) {
  const daftar = bacaAntrean();
  const clientId = payload.client_id || clientIdBaru();
  const item = {
    client_id: clientId,
    kode_lokal: `OFF-${Date.now().toString().slice(-8)}`,
    dibuat_pada: new Date().toISOString(),
    status: 'antri',
    error: '',
    meta,
    payload: payload.client_id ? payload : { ...payload, client_id: clientId },
  };
  tulis(KUNCI_ANTREAN, [...daftar, item]);
  kabarkan();
  return item;
}

export function hapusAntrean(clientId) {
  tulis(KUNCI_ANTREAN, bacaAntrean().filter((x) => x.client_id !== clientId));
  kabarkan();
}

export function tandaiGagal(clientId, pesan) {
  tulis(
    KUNCI_ANTREAN,
    bacaAntrean().map((x) =>
      x.client_id === clientId ? { ...x, status: 'gagal', error: String(pesan || '').slice(0, 200) } : x
    )
  );
  kabarkan();
}

export function tandaiAntri(clientId) {
  tulis(
    KUNCI_ANTREAN,
    bacaAntrean().map((x) =>
      x.client_id === clientId ? { ...x, status: 'antri', error: '' } : x
    )
  );
  kabarkan();
}
