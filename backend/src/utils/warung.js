// Bahasa warung: Modal Beli, Uang Masuk, Untung Bersih, Utang Tetangga.

function rupiah(n) {
  return 'Rp' + Number(n || 0).toLocaleString('id-ID');
}

function normalisasiWA(no) {
  let s = String(no || '').replace(/[^0-9]/g, '');
  if (s.startsWith('0')) s = '62' + s.slice(1);
  if (s.startsWith('8')) s = '62' + s;
  return s;
}

function linkWA(no, pesan) {
  return `https://wa.me/${normalisasiWA(no)}?text=${encodeURIComponent(pesan)}`;
}

function drafTagihan({ nama, sisa, total, dibayar = 0, jatuhTempo, toko = 'warung kami' }) {
  const baris = [
    `Halo ${nama}, ini dari *${toko}*.`,
    ``,
    `Catatan belanja masih ada:`,
    `• Total: ${rupiah(total)}`,
    `• Sudah dibayar: ${rupiah(dibayar)}`,
    `• Sisa: ${rupiah(sisa)}`,
  ];
  if (jatuhTempo) baris.push(`• Janji bayar: ${jatuhTempo}`);
  baris.push(
    ``,
    `Kalau sudah sempat, boleh dibayar ya. Terima kasih banyak!`
  );
  return baris.join('\n');
}

function kodeStruk() {
  const d = new Date();
  const p = (x) => String(x).padStart(2, '0');
  const tgl = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  return `WQ-${tgl}-${Math.floor(Math.random() * 900 + 100)}`;
}

// Sensor modal_beli untuk kasir/gudang: jangan bocorkan ke frontend.
function sensorProduk(row, role) {
  if (role === 'owner') return row;
  const { modal_beli, total_modal, modal_snapshot, ...rest } = row;
  return rest;
}

module.exports = { rupiah, normalisasiWA, linkWA, drafTagihan, kodeStruk, sensorProduk };
