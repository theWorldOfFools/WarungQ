// Metode bayar yang didukung kasir. Urutan ini dipakai tombol di Kasir.
export const METODE_BAYAR = [
  { id: 'tunai', label: 'Tunai' },
  { id: 'qris', label: 'QRIS' },
  { id: 'transfer', label: 'Transfer' },
  { id: 'ewallet', label: 'E-Wallet' },
  { id: 'kasbon', label: 'Kasbon' },
];

export const METODE_NON_TUNAI = ['qris', 'transfer', 'ewallet'];

export function labelMetode(id) {
  return METODE_BAYAR.find((m) => m.id === id)?.label || id || '-';
}

export function nonTunai(id) {
  return METODE_NON_TUNAI.includes(id);
}
