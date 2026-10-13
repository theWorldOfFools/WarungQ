// Kategori baku V1 untuk filter cepat kasir & stok.
export const KATEGORI_BAKU = [
  'Sembako',
  'Makanan',
  'Minuman',
  'Rokok',
  'Kebersihan',
  'Kesehatan',
  'Lainnya',
];

// Urutkan kategori yang dipakai toko: baku dulu sesuai urutan, sisanya alfabet.
export function urutkanKategori(pakai = []) {
  const unik = [...new Set(pakai.filter(Boolean))];
  return unik.sort((a, b) => {
    const ia = KATEGORI_BAKU.indexOf(a);
    const ib = KATEGORI_BAKU.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b, 'id');
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}
