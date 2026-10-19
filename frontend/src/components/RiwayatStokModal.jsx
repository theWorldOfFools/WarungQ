import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X, History } from 'lucide-react';
import api from '../api/client';
import { cn } from './cn';

const TIPE_INFO = {
  masuk: { label: 'Masuk', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  jual: { label: 'Jual', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  opname: { label: 'Opname', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  keluar: { label: 'Keluar', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
};

const FILTER = [
  { id: '', label: 'Semua' },
  { id: 'masuk', label: 'Masuk' },
  { id: 'jual', label: 'Jual' },
  { id: 'opname', label: 'Opname' },
];

function waktuTeks(s) {
  return new Date(s).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });
}

/**
 * Modal riwayat stok satu barang: masuk / jual / opname + siapa pelakunya.
 * Dipakai owner & gudang dari halaman Stok.
 */
export default function RiwayatStokModal({ produk, onTutup }) {
  const [tipe, setTipe] = useState('');
  const [gerakan, setGerakan] = useState([]);
  const [memuat, setMemuat] = useState(true);
  const [gagal, setGagal] = useState('');

  async function muat(t = tipe) {
    setMemuat(true);
    setGagal('');
    try {
      const { data } = await api.get(`/api/products/${produk.id}/movements`, {
        params: { tipe: t || undefined },
      });
      setGerakan(data.gerakan || []);
    } catch (e) {
      setGagal(e.response?.data?.pesan || 'Gagal memuat riwayat stok.');
    } finally {
      setMemuat(false);
    }
  }

  useEffect(() => {
    muat('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produk.id]);

  useEffect(() => {
    function tutupEsc(e) {
      if (e.key === 'Escape') onTutup?.();
    }
    window.addEventListener('keydown', tutupEsc);
    return () => window.removeEventListener('keydown', tutupEsc);
  }, [onTutup]);

  function pilihFilter(id) {
    setTipe(id);
    muat(id);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/55 p-3"
      onClick={onTutup}
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.98 }}
        transition={{ duration: 0.18 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Riwayat stok"
      >
        <div className="flex items-start justify-between gap-2">
          <h2 className="flex items-center gap-2 font-extrabold text-slate-900">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white">
              <History size={18} />
            </span>
            Riwayat Stok
          </h2>
          <button onClick={onTutup} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Tutup">
            <X size={18} />
          </button>
        </div>
        <p className="mt-1 truncate font-bold text-slate-800">{produk.nama}</p>
        <p className="text-xs font-semibold text-slate-500">Sisa sekarang: {produk.stok}</p>

        <div className="mt-3 flex gap-1.5 overflow-x-auto pb-0.5">
          {FILTER.map((f) => (
            <button
              key={f.id}
              onClick={() => pilihFilter(f.id)}
              className={cn(
                'px-3 py-1.5 rounded-xl text-[13px] font-bold border whitespace-nowrap transition active:scale-95',
                tipe === f.id
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="mt-3 max-h-[50vh] overflow-y-auto space-y-1.5 pr-0.5">
          {memuat ? (
            <div className="space-y-1.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="animate-pulse h-14 rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : gagal ? (
            <p className="rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-bold px-3.5 py-2.5">
              {gagal}
            </p>
          ) : gerakan.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500 font-semibold">
              Belum ada pergerakan stok pada filter ini.
            </p>
          ) : (
            gerakan.map((g) => {
              const info = TIPE_INFO[g.tipe] || { label: g.tipe, cls: 'bg-slate-100 text-slate-600 border-slate-200' };
              return (
                <div key={g.id} className="rounded-xl bg-slate-50 border border-slate-200/70 px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn('badge border', info.cls)}>{info.label}</span>
                    <b className={cn('text-sm', g.jumlah >= 0 ? 'text-emerald-700' : 'text-rose-600')}>
                      {g.jumlah > 0 ? '+' : ''}{g.jumlah}
                    </b>
                  </div>
                  <p className="mt-1 text-[13px] text-slate-600 font-medium">
                    Sisa {g.sisa} • {waktuTeks(g.created_at)} • {g.oleh_nama || '-'}
                  </p>
                  {g.catatan && <p className="text-xs text-slate-500">{g.catatan}</p>}
                </div>
              );
            })
          )}
        </div>

        <button onClick={onTutup} className="btn-lembut w-full mt-3">
          Tutup
        </button>
      </motion.div>
    </div>
  );
}
