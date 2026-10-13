import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Printer, ArrowLeft, Loader2 } from 'lucide-react';
import api, { rupiah } from '../api/client';
import StrukPrint from '../components/StrukPrint';
import { usePengaturan } from '../context/PengaturanContext';

/**
 * Halaman struk terpisah (/struk/:id) — layout print-only 58mm.
 * TANPA sidebar / header / bottom-nav (dirender di luar Kerangka utama).
 * Aman dicetak: hanya struk yang keluar, UI tombol disembunyikan saat print.
 */
export default function StrukPage() {
  const { id } = useParams();
  const { pengaturan } = usePengaturan();
  const [data, setData] = useState(null);
  const [gagal, setGagal] = useState('');
  const [memuat, setMemuat] = useState(true);

  useEffect(() => {
    async function muat() {
      setMemuat(true);
      setGagal('');
      try {
        const { data } = await api.get(`/api/sales/${id}`);
        setData({
          items: (data.items || []).map((it, i) => ({
            id: it.product_id || i,
            nama: it.nama,
            harga_jual: it.harga_jual,
            qty: it.qty,
          })),
          total: data.total_masuk,
          diterima: data.uang_diterima,
          kembalian: data.kembalian,
          tanggal: new Date(data.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }),
          kode: data.kode_struk,
          nama_toko: data.nama_toko,
        });
      } catch (e) {
        setGagal(e.response?.data?.pesan || 'Struk tidak ketemu.');
      } finally {
        setMemuat(false);
      }
    }
    muat();
  }, [id]);

  function cetak() {
    document.body.classList.remove('mau-cetak-label');
    document.body.classList.add('mau-cetak-struk');
    setTimeout(() => {
      window.print();
      setTimeout(() => document.body.classList.remove('mau-cetak-struk'), 600);
    }, 60);
  }

  useEffect(() => {
    function bersih() {
      document.body.classList.remove('mau-cetak-struk');
    }
    window.addEventListener('afterprint', bersih);
    return () => window.removeEventListener('afterprint', bersih);
  }, []);

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Toolbar layar — disembunyikan otomatis saat print via CSS visibility */}
      <div className="mx-auto max-w-md px-4 pt-4 flex items-center gap-2 print:hidden">
        <Link to="/kasir" className="btn-lembut !py-2">
          <ArrowLeft size={16} /> Kasir
        </Link>
        <button onClick={cetak} className="btn-primer flex-1 min-h-[48px]" disabled={!data}>
          <Printer size={16} /> Cetak 58mm
        </button>
      </div>

      {memuat ? (
        <p className="flex items-center justify-center gap-2 p-10 text-sm font-bold text-slate-500">
          <Loader2 size={18} className="animate-spin" /> Memuat struk...
        </p>
      ) : gagal ? (
        <div className="mx-auto max-w-md p-4">
          <p className="rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-bold px-4 py-3">{gagal}</p>
          <Link to="/kasir" className="btn-lembut w-full mt-3">Kembali ke Kasir</Link>
        </div>
      ) : (
        <>
          {/* Preview layar */}
          <div className="mx-auto max-w-md p-4 print:hidden">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-card">
              <p className="font-extrabold text-center">{data?.nama_toko || pengaturan.namaToko || 'Struk Belanja'}</p>
              <p className="text-center text-xs text-slate-500">{data?.kode} • {data?.tanggal}</p>
              <div className="my-2 border-t border-dashed border-slate-300" />
              {data?.items?.map((it) => (
                <div key={it.id} className="flex justify-between py-0.5">
                  <span>{it.nama} × {it.qty}</span>
                  <b>{rupiah(it.harga_jual * it.qty)}</b>
                </div>
              ))}
              <div className="my-2 border-t border-dashed border-slate-300" />
              <div className="flex justify-between font-bold"><span>Total</span><span>{rupiah(data?.total)}</span></div>
              <div className="flex justify-between"><span>Diterima</span><span>{rupiah(data?.diterima)}</span></div>
              <div className="flex justify-between font-extrabold text-emerald-700"><span>Kembali</span><span>{rupiah(data?.kembalian)}</span></div>
              <p className="text-center text-xs text-slate-500 mt-2">{pengaturan.strukFooter}</p>
            </div>
          </div>

          {/* Area cetak 58mm — satu-satunya yang keluar saat print */}
          <StrukPrint
            data={data}
            namaToko={data?.nama_toko || pengaturan.namaToko}
            header={pengaturan.strukHeader}
            footer={pengaturan.strukFooter}
          />
        </>
      )}
    </div>
  );
}
