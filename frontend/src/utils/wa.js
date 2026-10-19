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
// Uang masuk = tunai; kasbon dipisah karena uang fisiknya belum diterima.
export function drafRekapHarian({
  toko,
  tanggal,
  uangMasuk,
  kasbon = 0,
  untung = 0,
  pengeluaran = 0,
  untungBersih = 0,
  struk,
  kasbonAktif,
  kasbonTempo,
}) {
  const baris = [
    `*REKAP HARIAN ${String(toko || 'WARUNG').toUpperCase()}*`,
    `Tanggal: ${tanggal}`,
    ``,
    `• Uang masuk tunai: ${rupiahTeks(uangMasuk)}`,
  ];
  if (Number(kasbon) > 0) baris.push(`• Jual kasbon (belum masuk kas): ${rupiahTeks(kasbon)}`);
  if (Number(pengeluaran) > 0) {
    baris.push(`• Untung kotor: ${rupiahTeks(untung)}`);
    baris.push(`• Pengeluaran: ${rupiahTeks(pengeluaran)}`);
    baris.push(`• *Untung bersih: ${rupiahTeks(untungBersih)}*`);
  } else {
    baris.push(`• Perkiraan untung: ${rupiahTeks(untungBersih || untung)}`);
  }
  baris.push(`• Struk belanja: ${Number(struk || 0)}x`);
  baris.push(`• Kasbon aktif di luar: ${rupiahTeks(kasbonAktif)}`);
  if (kasbonTempo?.jumlah > 0) {
    baris.push(`• Lewat janji bayar: ${kasbonTempo.jumlah} orang (${rupiahTeks(kasbonTempo.total_sisa)})`);
  }
  baris.push(``, `Dikirim otomatis dari UMKM-Scan.`);
  return baris.join('\n');
}

// Draf rekap periode (mingguan/bulanan) untuk menu Laporan.
export function drafRekapPeriode({
  toko,
  dari,
  sampai,
  uangMasukTunai,
  penjualanKasbon,
  untungKotor,
  pengeluaran,
  untungBersih,
  struk,
  jumlahVoid = 0,
  produkTerlaris = [],
}) {
  const baris = [
    `*REKAP ${String(toko || 'WARUNG').toUpperCase()}*`,
    `Periode: ${dari} s/d ${sampai}`,
    ``,
    `• Uang masuk tunai: ${rupiahTeks(uangMasukTunai)}`,
  ];
  if (Number(penjualanKasbon) > 0) baris.push(`• Jual kasbon: ${rupiahTeks(penjualanKasbon)}`);
  baris.push(`• Untung kotor: ${rupiahTeks(untungKotor)}`);
  baris.push(`• Pengeluaran: ${rupiahTeks(pengeluaran)}`);
  baris.push(`• *Untung bersih: ${rupiahTeks(untungBersih)}*`);
  baris.push(`• Struk belanja: ${Number(struk || 0)}x`);
  if (Number(jumlahVoid) > 0) baris.push(`• Struk dibatalkan: ${Number(jumlahVoid)}x (tidak dihitung)`);
  if (produkTerlaris.length) {
    baris.push(``, `Paling laris:`);
    produkTerlaris.slice(0, 3).forEach((p, i) => {
      baris.push(`${i + 1}. ${p.nama} (${p.terjual}x)`);
    });
  }
  baris.push(``, `Dikirim otomatis dari UMKM-Scan.`);
  return baris.join('\n');
}
