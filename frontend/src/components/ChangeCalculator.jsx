import { motion } from 'framer-motion';
import { Wallet, Banknote } from 'lucide-react';
import { rupiah } from '../api/client';
import { cn } from './cn';

// Kalkulator kembalian instan.
export default function ChangeCalculator({ total, diterima, setDiterima }) {
  const kurang = (Number(diterima) || 0) - total;
  const cukup = kurang >= 0;

  return (
    <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3.5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="label flex items-center gap-1.5"><Wallet size={14} /> Total belanja</span>
        <b className="text-xl text-emerald-700 font-extrabold">{rupiah(total)}</b>
      </div>

      <div>
        <label className="label">Uang diterima pembeli</label>
        <div className="relative mt-1">
          <Banknote size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input-besar pl-10 font-bold"
            type="number"
            min="0"
            value={diterima || ''}
            onChange={(e) => setDiterima(Number(e.target.value || 0))}
            placeholder="Contoh: 50000"
          />
        </div>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {[10000, 20000, 50000, 100000].map((n) => (
          <motion.button
            key={n}
            whileTap={{ scale: 0.93 }}
            className={cn(
              'flex-1 min-w-[64px] py-2 rounded-xl font-bold text-sm border transition',
              Number(diterima) === n
                ? 'bg-amber-400 border-amber-400 text-slate-900'
                : 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
            )}
            onClick={() => setDiterima(n)}
          >
            {n / 1000}rb
          </motion.button>
        ))}
        <motion.button
          whileTap={{ scale: 0.93 }}
          className={cn(
            'flex-1 min-w-[80px] py-2 rounded-xl font-bold text-sm border transition',
            Number(diterima) === total && total > 0
              ? 'bg-emerald-600 border-emerald-600 text-white'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
          )}
          onClick={() => setDiterima(total)}
        >
          Uang pas
        </motion.button>
      </div>

      {Number(diterima) > 0 && (
        <motion.p
          key={kurang}
          initial={{ scale: 0.97, opacity: 0.6 }}
          animate={{ scale: 1, opacity: 1 }}
          className={cn(
            'rounded-xl px-3 py-2.5 text-center text-base font-extrabold border',
            cukup ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-rose-50 text-rose-700 border-rose-200'
          )}
        >
          {cukup ? `Kembalian: ${rupiah(kurang)}` : `Kurang ${rupiah(-kurang)}`}
        </motion.p>
      )}
    </div>
  );
}
