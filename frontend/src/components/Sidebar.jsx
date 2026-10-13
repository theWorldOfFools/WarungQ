import { NavLink } from 'react-router-dom';
import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  NotebookPen,
  Users,
  Settings,
  Store,
  ChevronsLeft,
  ChevronsRight,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { cn } from './cn';

const SEMUA = [
  { ke: '/dompet', label: 'Dompet', desc: 'Uang masuk & untung', ikon: LayoutDashboard, boleh: ['owner'] },
  { ke: '/kasir', label: 'Kasir', desc: 'Jualan cepat', ikon: ShoppingCart, boleh: ['owner', 'kasir'] },
  { ke: '/stok', label: 'Stok', desc: 'Barang & sisa', ikon: Package, boleh: ['owner', 'kasir', 'gudang'] },
  { ke: '/kasbon', label: 'Kasbon', desc: 'Utang tetangga', ikon: NotebookPen, boleh: ['owner'] },
  { ke: '/pengguna', label: 'Orang', desc: 'Kelola pegawai', ikon: Users, boleh: ['owner'] },
  { ke: '/pengaturan', label: 'Pengaturan', desc: 'Toko & aplikasi', ikon: Settings, boleh: ['owner', 'kasir', 'gudang'] },
];

export const NAV_ITEMS = SEMUA;

export function menuUntuk(peran) {
  return SEMUA.filter((m) => m.boleh.includes(peran || 'kasir'));
}

export default function Sidebar({ rapat, onToggle, namaToko, mobileBuka = false, onTutup }) {
  const { pengguna } = useAuth();
  const tampil = menuUntuk(pengguna?.peran);

  // Kunci scroll halaman saat drawer mobile terbuka.
  useEffect(() => {
    if (!mobileBuka) return;
    const semula = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = semula;
    };
  }, [mobileBuka]);

  return (
    <>
      <motion.aside
        animate={{ width: rapat ? 84 : 260 }}
        transition={{ type: 'spring', stiffness: 260, damping: 30 }}
        className="hidden lg:flex flex-col fixed inset-y-0 left-0 z-40 bg-slate-900 text-slate-200 border-r border-slate-800"
      >
      {/* Brand */}
      <div className={cn('flex items-center gap-3 px-4 h-16 border-b border-white/10', rapat && 'justify-center px-2')}>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-md">
          <Store size={20} strokeWidth={2.4} />
        </div>
        {!rapat && (
          <div className="min-w-0">
            <p className="truncate font-extrabold text-white leading-tight">UMKM-Scan</p>
            <p className="truncate text-xs text-slate-400">{namaToko || pengguna?.toko || 'Warung'}</p>
          </div>
        )}
      </div>

      {/* Menu */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {!rapat && <p className="px-2 pt-1 pb-2 text-[11px] font-bold uppercase tracking-widest text-slate-500">Menu Warung</p>}
        {tampil.map((m) => (
          <NavLink key={m.ke} to={m.ke} title={m.label}>
            {({ isActive }) => (
              <motion.span
                whileHover={{ x: 2 }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
                  rapat && 'justify-center px-0',
                  isActive
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/20'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white border border-transparent'
                )}
              >
                <m.ikon size={20} strokeWidth={2.2} className="shrink-0" />
                {!rapat && (
                  <span className="min-w-0">
                    <span className="block leading-tight">{m.label}</span>
                    <span className={cn('block text-[11px] font-medium', isActive ? 'text-emerald-400/80' : 'text-slate-500')}>
                      {m.desc}
                    </span>
                  </span>
                )}
                {!rapat && isActive && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-400" />}
              </motion.span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Toggle */}
      <div className="p-3 border-t border-white/10">
        <button
          onClick={onToggle}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white py-2.5 text-sm font-semibold transition active:scale-95"
        >
          {rapat ? <ChevronsRight size={18} /> : <><ChevronsLeft size={18} /> Lipat</>}
        </button>
      </div>
    </motion.aside>

      {/* ===== Drawer mobile: overlay + panel geser (hanya < lg) ===== */}
      <AnimatePresence>
        {mobileBuka && (
          <>
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={onTutup}
              className="lg:hidden fixed inset-0 z-40 bg-slate-900/55"
              aria-hidden
            />
            <motion.aside
              key="panel"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 34 }}
              className="lg:hidden fixed inset-y-0 left-0 z-50 flex w-[280px] max-w-[85vw] flex-col bg-slate-900 text-slate-200 border-r border-slate-800 shadow-pop"
              role="dialog"
              aria-label="Menu warung"
            >
              {/* Brand + tombol tutup */}
              <div className="flex items-center gap-3 px-4 h-16 border-b border-white/10">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-md">
                  <Store size={20} strokeWidth={2.4} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-extrabold text-white leading-tight">UMKM-Scan</p>
                  <p className="truncate text-xs text-slate-400">{namaToko || pengguna?.toko || 'Warung'}</p>
                </div>
                <button
                  onClick={onTutup}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-white/10 hover:text-white transition active:scale-95"
                  aria-label="Tutup menu"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Menu lengkap */}
              <nav className="flex-1 overflow-y-auto p-3 space-y-1">
                <p className="px-2 pt-1 pb-2 text-[11px] font-bold uppercase tracking-widest text-slate-500">Menu Warung</p>
                {tampil.map((m) => (
                  <NavLink key={m.ke} to={m.ke} title={m.label} onClick={onTutup}>
                    {({ isActive }) => (
                      <span
                        className={cn(
                          'flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-colors min-h-[48px]',
                          isActive
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/20'
                            : 'text-slate-300 hover:bg-white/5 hover:text-white border border-transparent active:bg-white/10'
                        )}
                      >
                        <m.ikon size={20} strokeWidth={2.2} className="shrink-0" />
                        <span className="min-w-0 flex-1">
                          <span className="block leading-tight">{m.label}</span>
                          <span className={cn('block text-[11px] font-medium', isActive ? 'text-emerald-400/80' : 'text-slate-500')}>
                            {m.desc}
                          </span>
                        </span>
                        {isActive && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />}
                      </span>
                    )}
                  </NavLink>
                ))}
              </nav>

              {/* Info pengguna */}
              <div className="p-3 border-t border-white/10">
                <p className="truncate px-1 text-xs text-slate-400">
                  Masuk sebagai <b className="text-slate-200">{pengguna?.nama || pengguna?.email}</b>
                </p>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
