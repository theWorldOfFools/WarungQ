import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';
import { cn } from './cn';

/**
 * Modal konfirmasi ramah (bahasa warung) — dipakai untuk void/batal:
 * kosongkan keranjang, hapus item, hapus pengguna, dll.
 */
export default function Konfirmasi({
  terbuka,
  judul = 'Yakin dibatalkan?',
  pesan = 'Tindakan ini tidak bisa dibatalkan.',
  teksYa = 'Ya, lanjutkan',
  teksBatal = 'Tidak jadi',
  bahaya = true,
  onYa,
  onTutup,
}) {
  return (
    <AnimatePresence>
      {terbuka && (
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
            className="w-full max-w-xs rounded-2xl bg-white p-5 shadow-2xl"
            role="alertdialog"
            aria-modal="true"
            aria-label={judul}
          >
            <div className="flex items-start justify-between gap-2">
              <span className={cn(
                'flex h-10 w-10 items-center justify-center rounded-2xl text-white',
                bahaya ? 'bg-rose-500' : 'bg-slate-900'
              )}>
                <AlertTriangle size={20} />
              </span>
              <button onClick={onTutup} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Tutup">
                <X size={18} />
              </button>
            </div>
            <h2 className="mt-2 font-extrabold text-slate-900">{judul}</h2>
            <p className="mt-1 text-sm text-slate-600">{pesan}</p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={onYa}
                className={bahaya
                  ? 'btn flex-1 bg-rose-600 text-white hover:bg-rose-700 min-h-[46px]'
                  : 'btn-primer flex-1 min-h-[46px]'}
              >
                {teksYa}
              </button>
              <button onClick={onTutup} className="btn-lembut flex-1 min-h-[46px]">
                {teksBatal}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
