// Util WhatsApp sisi frontend (rekap dompet, dll).
// Normalisasi: 08xx -> 62xx, 8xx -> 62xx (sama aturan dengan backend).

export function normalisasiWA(no) {
  let s = String(no || '').replace(/[^0-9]/g, '');
  if (s.startsWith('0')) s = '62' + s.slice(1);
  else if (s.startsWith('8')) s = '62' + s;
  return s;
}

export function linkWA(no, pesan) {
  return `https://wa.me/${normalisasiWA(no)}?text=${encodeURIComponent(pesan)}`;
}

export function rupiahTeks(n) {
  return 'Rp' + Number(n || 0).toLocaleString('id-ID');
}

// Draf rekap harian untuk dikirim ke pemilik via WA.
export function drafRekapHarian({ toko, tanggal, uangMasuk, untung, struk, kasbonAktif, kasbonTempo }) {
  const baris = [
    `*REKAP HARIAN ${String(toko || 'WARUNG').toUpperCase()}*`,
    `Tanggal: ${tanggal}`,
    ``,
    `• Uang masuk: ${rupiahTeks(uangMasuk)}`,
    `• Perkiraan untung: ${rupiahTeks(untung)}`,
    `• Struk belanja: ${Number(struk || 0)}x`,
    `• Kasbon aktif di luar: ${rupiahTeks(kasbonAktif)}`,
  ];
  if (kasbonTempo?.jumlah > 0) {
    baris.push(`• Lewat janji bayar: ${kasbonTempo.jumlah} orang (${rupiahTeks(kasbonTempo.total_sisa)})`);
  }
  baris.push(``, `Dikirim otomatis dari UMKM-Scan.`);
  return baris.join('\n');
}
