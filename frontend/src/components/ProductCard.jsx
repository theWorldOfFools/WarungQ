import { motion } from 'framer-motion';
import { Plus, Package } from 'lucide-react';
import { rupiah } from '../api/client';
import StockBadge from './StockBadge';
import { cn } from './cn';

const GRADASI = [
  'from-emerald-50 to-teal-50 text-emerald-700',
  'from-amber-50 to-orange-50 text-amber-700',
  'from-sky-50 to-indigo-50 text-sky-700',
  'from-rose-50 to-pink-50 text-rose-700',
  'from-violet-50 to-purple-50 text-violet-700',
  'from-lime-50 to-emerald-50 text-lime-700',
];

function gradasiUntuk(nama = '') {
  let h = 0;
  for (const c of nama) h = (h * 31 + c.charCodeAt(0)) % 997;
  return GRADASI[h % GRADASI.length];
}

function inisial(nama = '?') {
  return nama.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

/** Kartu produk grid: placeholder estetik + tombol keranjang interaktif */
export default function ProductCard({ barang, onTambah, index = 0 }) {
  const habis = (barang.stok ?? 0) <= 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.3), duration: 0.25 }}
      whileHover={{ y: -3 }}
      className="card card-hover p-3 flex flex-col gap-2.5"
    >
      <div className={cn('relative flex h-20 items-center justify-center rounded-xl bg-gradient-to-br border border-white', gradasiUntuk(barang.nama))}>
        <span className="text-2xl font-extrabold tracking-tight opacity-90">{inisial(barang.nama)}</span>
        <span className="absolute left-2 top-2">
          <StockBadge status={barang.status_stok} />
        </span>
        {habis && (
          <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-slate-900/45 text-white text-xs font-extrabold tracking-wide">
            STOK HABIS
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-bold text-slate-900 leading-snug" title={barang.nama}>{barang.nama}</p>
        <p className="text-[13px] text-slate-500 font-medium">Sisa {barang.stok} • {barang.barcode || 'tanpa barcode'}</p>
        <p className="mt-0.5 text-lg font-extrabold text-emerald-700">{rupiah(barang.harga_jual)}</p>
      </div>

      {onTambah && (
        <motion.button
          whileTap={{ scale: 0.94 }}
          onClick={() => onTambah(barang)}
          disabled={habis}
          className={cn(
            'btn w-full',
            habis ? 'bg-slate-100 text-slate-400' : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'
          )}
        >
          {habis ? <><Package size={16} /> Habis</> : <><Plus size={17} strokeWidth={3} /> Keranjang</>}
        </motion.button>
      )}
    </motion.div>
  );
}
