import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LayoutGrid } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { menuUntuk } from './Sidebar';
import { cn } from './cn';

/** Maksimal slot di bottom-nav agar target sentuh lega di HP kecil.
 *  Kelebihan menu (mis. owner punya 6) dipindah ke drawer lewat slot "Menu". */
const MAKS_SLOT = 5;

function tombolAktif(pathname, ke) {
  return pathname === ke || (ke !== '/' && pathname.startsWith(ke + '/'));
}

/** Floating bottom-nav untuk HP: mengapung, animasi halus, aman dari gestur bar */
export default function BottomNav({ onBukaMenu }) {
  const { pengguna } = useAuth();
  const tampil = menuUntuk(pengguna?.peran);
  const { pathname } = useLocation();

  const padat = tampil.length > MAKS_SLOT;
  const utama = padat ? tampil.slice(0, MAKS_SLOT - 1) : tampil;
  const sisa = padat ? tampil.slice(MAKS_SLOT - 1) : [];
  const menuAktif = sisa.some((m) => tombolAktif(pathname, m.ke));

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 safe-bottom pointer-events-none" aria-label="Navigasi bawah">
      <div className="px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <motion.div
          layout
          className="pointer-events-auto mx-auto max-w-md bg-slate-900/95 backdrop-blur-md border border-white/10 shadow-pop rounded-2xl px-1.5 py-1.5 flex items-stretch gap-0.5"
        >
          {utama.map((m) => {
            const aktif = tombolAktif(pathname, m.ke);
            return (
              <NavLink key={m.ke} to={m.ke} className="flex-1 min-w-0" aria-label={m.label}>
                <motion.span
                  whileTap={{ scale: 0.92 }}
                  className={cn(
                    'relative flex flex-col items-center gap-0.5 rounded-xl px-1 py-2 min-h-[52px] justify-center text-[10.5px] font-bold transition-colors',
                    aktif ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                  )}
                >
                  {aktif && (
                    <motion.span
                      layoutId="nav-aktif"
                      transition={{ type: 'spring', stiffness: 480, damping: 38 }}
                      className="absolute inset-0 rounded-xl bg-emerald-500/25 border border-emerald-400/30"
                    />
                  )}
                  <m.ikon size={20} strokeWidth={aktif ? 2.6 : 2.1} className="relative" />
                  <span className="relative truncate w-full text-center leading-tight">{m.label}</span>
                </motion.span>
              </NavLink>
            );
          })}
          {padat && (
            <button
              type="button"
              onClick={onBukaMenu}
              aria-label="Buka semua menu"
              className="flex-1 min-w-0"
            >
              <motion.span
                whileTap={{ scale: 0.92 }}
                className={cn(
                  'relative flex flex-col items-center gap-0.5 rounded-xl px-1 py-2 min-h-[52px] justify-center text-[10.5px] font-bold transition-colors w-full',
                  menuAktif ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                )}
              >
                {menuAktif && (
                  <motion.span
                    layoutId="nav-aktif"
                    transition={{ type: 'spring', stiffness: 480, damping: 38 }}
                    className="absolute inset-0 rounded-xl bg-emerald-500/25 border border-emerald-400/30"
                  />
                )}
                <LayoutGrid size={20} strokeWidth={menuAktif ? 2.6 : 2.1} className="relative" />
                <span className="relative truncate w-full text-center leading-tight">Menu</span>
              </motion.span>
            </button>
          )}
        </motion.div>
      </div>
    </nav>
  );
}
