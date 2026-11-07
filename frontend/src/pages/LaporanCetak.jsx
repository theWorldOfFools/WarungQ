import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Printer } from 'lucide-react';
import api, { rupiah } from '../api/client';
import { usePengaturan } from '../context/PengaturanContext';

const fmt = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function tanggalPanjang(iso) {
  if (!iso) return '';
  return new Date(iso + 'T00:00:00').toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function LaporanCetak() {
  const [params] = useSearchParams();
  const { pengaturan } = usePengaturan();
  const [data, setData] = useState(null);
  const [gagal, setGagal] = useState('');
  const sudahCetak = useRef(false);

  const sampai = params.get('sampai') || fmt(new Date());
  const dari = params.get('dari') || sampai;

  useEffect(() => {
    let batal = false;
    api
      .get('/api/reports/rentang', { params: { dari, sampai } })
      .then(({ data }) => {
        if (!batal) setData(data);
      })
      .catch((e) => {
        if (!batal) setGagal(e.response?.data?.pesan || 'Gagal memuat laporan.');
      });
    return () => {
      batal = true;
    };
  }, [dari, sampai]);

  useEffect(() => {
    if (!data || sudahCetak.current) return;
    sudahCetak.current = true;
    const t = setTimeout(() => window.print(), 500);
    return () => clearTimeout(t);
  }, [data]);

  if (gagal) return <p className="p-8 text-center font-semibold text-rose-600">{gagal}</p>;
  if (!data) return <p className="p-8 text-center font-semibold text-slate-500">Menyiapkan laporan...</p>;

  return (
    <div className="mx-auto max-w-[900px] bg-white p-6 sm:p-8 text-slate-900">
      <div className="flex items-start justify-between gap-4 border-b-2 border-slate-900 pb-3">
        <div>
          <h1 className="text-2xl font-extrabold">{pengaturan.namaToko || 'Warung Saya'}</h1>
          <p className="text-sm text-slate-600">Laporan Keuangan Warung</p>
          <p className="text-sm font-semibold mt-1">
            Periode {tanggalPanjang(data.dari)} – {tanggalPanjang(data.sampai)}
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="print:hidden btn-lembut shrink-0"
        >
          <Printer size={16} /> Cetak
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4 text-sm">
        {[
          ['Uang masuk tunai', data.uang_masuk_tunai],
          ['Non-tunai', data.uang_masuk_non_tunai],
          ['Penjualan kasbon', data.penjualan_kasbon],
          ['Untung kotor', data.untung_kotor],
          ['Pengeluaran', data.pengeluaran],
          ['Untung bersih', data.untung_bersih],
        ].map(([label, nilai]) => (
          <div key={label} className="rounded-lg border border-slate-300 p-2.5">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
            <p className="font-extrabold">{rupiah(nilai || 0)}</p>
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-500 mt-2">
        {data.jumlah_struk} struk aktif • {data.jumlah_void} struk dibatalkan • retur{' '}
        {rupiah(data.retur_nilai)} • rusak/expired {rupiah(data.kerugian_stok)}
      </p>

      <h2 className="font-extrabold mt-5 mb-1.5">Rekap Harian</h2>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-y border-slate-400 bg-slate-100 text-left">
            <th className="py-1.5 px-2">Tanggal</th>
            <th className="py-1.5 px-2 text-right">Tunai</th>
            <th className="py-1.5 px-2 text-right">Non-tunai</th>
            <th className="py-1.5 px-2 text-right">Untung kotor</th>
          </tr>
        </thead>
        <tbody>
          {data.seri_harian.map((r) => (
            <tr key={r.tanggal} className="border-b border-slate-200">
              <td className="py-1 px-2">{tanggalPanjang(r.tanggal)}</td>
              <td className="py-1 px-2 text-right">{rupiah(r.uang_masuk)}</td>
              <td className="py-1 px-2 text-right">{rupiah(r.non_tunai)}</td>
              <td className="py-1 px-2 text-right">{rupiah(r.untung)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="grid sm:grid-cols-2 gap-4 mt-5">
        <div>
          <h2 className="font-extrabold mb-1.5">Produk Terlaris</h2>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-y border-slate-400 bg-slate-100 text-left">
                <th className="py-1.5 px-2">Produk</th>
                <th className="py-1.5 px-2 text-right">Terjual</th>
                <th className="py-1.5 px-2 text-right">Nilai</th>
              </tr>
            </thead>
            <tbody>
              {data.produk_terlaris.map((p) => (
                <tr key={p.nama} className="border-b border-slate-200">
                  <td className="py-1 px-2">{p.nama}</td>
                  <td className="py-1 px-2 text-right">{p.terjual}</td>
                  <td className="py-1 px-2 text-right">{rupiah(p.uang_masuk)}</td>
                </tr>
              ))}
              {!data.produk_terlaris.length && (
                <tr>
                  <td colSpan={3} className="py-2 px-2 text-slate-500">Belum ada penjualan.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div>
          <h2 className="font-extrabold mb-1.5">Metode Bayar</h2>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-y border-slate-400 bg-slate-100 text-left">
                <th className="py-1.5 px-2">Metode</th>
                <th className="py-1.5 px-2 text-right">Struk</th>
                <th className="py-1.5 px-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.per_metode_bayar.map((m) => (
                <tr key={m.metode} className="border-b border-slate-200">
                  <td className="py-1 px-2 capitalize">{m.metode}</td>
                  <td className="py-1 px-2 text-right">{m.jumlah_struk}</td>
                  <td className="py-1 px-2 text-right">{rupiah(m.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mt-5">
        <div>
          <h2 className="font-extrabold mb-1.5">Pengeluaran per Kategori</h2>
          <table className="w-full text-sm border-collapse">
            <tbody>
              {data.pengeluaran_per_kategori.map((k) => (
                <tr key={k.kategori} className="border-b border-slate-200">
                  <td className="py-1 px-2">{k.kategori}</td>
                  <td className="py-1 px-2 text-right">{rupiah(k.total)}</td>
                </tr>
              ))}
              {!data.pengeluaran_per_kategori.length && (
                <tr>
                  <td className="py-2 px-2 text-slate-500">Tidak ada pengeluaran.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div>
          <h2 className="font-extrabold mb-1.5">Penjualan per Pegawai</h2>
          <table className="w-full text-sm border-collapse">
            <tbody>
              {data.per_kasir.map((k) => (
                <tr key={k.kasir} className="border-b border-slate-200">
                  <td className="py-1 px-2">{k.kasir}</td>
                  <td className="py-1 px-2 text-right">{k.jumlah_struk} struk</td>
                  <td className="py-1 px-2 text-right">{rupiah(k.uang_masuk)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-slate-400 mt-6 border-t border-slate-200 pt-2">
        Dicetak {new Date().toLocaleString('id-ID')} • UMKM-Scan / WarungQ
      </p>
    </div>
  );
}
