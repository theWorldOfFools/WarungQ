import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LogOut, PanelLeft, Menu } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { StatusBadge } from './ui';

const WARNA_PERAN = {
  owner: 'emerald',
  kasir: 'sky',
  gudang: 'amber',
};

const LABEL_PERAN = {
  owner: 'Owner',
  kasir: 'Kasir',
  gudang: 'Gudang',
};

export default function Header({ onToggleSidebar, onBukaMenu, namaToko }) {
  const { pengguna, keluar } = useAuth();
  const nav = useNavigate();
  if (!pengguna) return null;

  const inisial = (pengguna.nama?.[0] || pengguna.email?.[0] || 'W').toUpperCase();

  return (
    <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-slate-200/80">
      <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-6 h-16 max-w-[1200px] mx-auto">
        {/* Toggle sidebar (desktop) */}
        <button
          onClick={onToggleSidebar}
          className="hidden lg:inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition active:scale-95"
          title="Lipat / buka sidebar"
          aria-label="Lipat / buka sidebar"
        >
          <PanelLeft size={20} />
        </button>
        {/* Hamburger pembuka drawer (mobile) */}
        <button
          onClick={onBukaMenu}
          className="lg:hidden inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition active:scale-95"
          aria-label="Buka menu warung"
        >
          <Menu size={21} />
        </button>

        <div className="min-w-0 flex-1">
          <p className="truncate font-extrabold text-slate-900 leading-tight text-[15px] sm:text-base">
            {namaToko || pengguna.toko || 'UMKM-Scan'}
          </p>
          <p className="truncate text-xs text-slate-500 hidden min-[380px]:block">Halo, {pengguna.nama} — selamat jualan hari ini</p>
        </div>

        <StatusBadge tone={WARNA_PERAN[pengguna.peran] || 'slate'}>
          {LABEL_PERAN[pengguna.peran] || pengguna.peran}
        </StatusBadge>

        <div className="hidden sm:flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-white font-extrabold text-sm">
          {inisial}
        </div>

        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => {
            keluar();
            nav('/masuk');
          }}
          className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 hover:bg-rose-600 text-white text-sm font-bold px-3 sm:px-3.5 py-2.5 transition-colors"
        >
          <LogOut size={16} strokeWidth={2.5} />
          <span className="hidden sm:inline">Keluar</span>
        </motion.button>
      </div>
    </header>
  );
}
