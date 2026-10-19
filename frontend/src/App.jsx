import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { AuthProvider, useAuth } from './context/AuthContext';
import { PengaturanProvider, usePengaturan } from './context/PengaturanContext';
import Guard from './components/Guard';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import PageTransition from './components/PageTransition';
import Login from './pages/Login';
import Kasir from './pages/Kasir';
import Riwayat from './pages/Riwayat';
import Stok from './pages/Stok';
import Suplier from './pages/Suplier';
import StrukPage from './pages/Struk';
import Dompet from './pages/Dompet';
import Pengeluaran from './pages/Pengeluaran';
import Laporan from './pages/Laporan';
import Kasbon from './pages/Kasbon';
import Pengguna from './pages/Pengguna';
import Pengaturan from './pages/Pengaturan';
import { cn } from './components/cn';

function RuteAwal() {
  const { pengguna, siap } = useAuth();
  if (!siap) return <p className="p-6 text-center text-sm font-semibold text-slate-500">Membuka warung...</p>;
  if (!pengguna) return <Navigate to="/masuk" replace />;
  if (pengguna.peran === 'owner') return <Navigate to="/dompet" replace />;
  if (pengguna.peran === 'gudang') return <Navigate to="/stok" replace />;
  return <Navigate to="/kasir" replace />;
}

function Kerangka({ children }) {
  const { pengguna } = useAuth();
  const { pengaturan } = usePengaturan();
  const [rapat, setRapat] = useState(pengaturan.sidebarRapatDefault);
  const [drawer, setDrawer] = useState(false);
  const loc = useLocation();
  const diLogin = loc.pathname === '/masuk';
  // Halaman struk: layout print-only terpisah — tanpa sidebar/header/bottom-nav
  // agar cetak thermal 58mm bersih dari antarmuka aplikasi.
  const diStruk = loc.pathname.startsWith('/struk');

  useEffect(() => {
    setRapat(pengaturan.sidebarRapatDefault);
  }, [pengaturan.sidebarRapatDefault]);

  // Tutup drawer mobile setiap pindah halaman.
  useEffect(() => {
    setDrawer(false);
  }, [loc.pathname]);

  if (diLogin || diStruk) return children;

  return (
    <div className="min-h-screen">
      {pengguna && (
        <Sidebar
          rapat={rapat}
          onToggle={() => setRapat(!rapat)}
          namaToko={pengaturan.namaToko}
          mobileBuka={drawer}
          onTutup={() => setDrawer(false)}
        />
      )}
      <div className={cn('min-h-screen flex flex-col transition-all duration-300', pengguna ? (rapat ? 'lg:pl-[84px]' : 'lg:pl-[260px]') : '')}>
        <Header
          onToggleSidebar={() => setRapat(!rapat)}
          onBukaMenu={() => setDrawer(true)}
          namaToko={pengaturan.namaToko}
        />
        <div className="flex-1 w-full">
          <AnimatePresence mode="wait">
            <PageTransition>{children}</PageTransition>
          </AnimatePresence>
        </div>
        <footer className="hidden lg:block border-t border-slate-200/70 py-3 text-center text-xs text-slate-400">
          UMKM-Scan • Uang Masuk • Modal Beli • Utang Tetangga
        </footer>
        {/* ruang untuk floating bottom nav di HP */}
        <div className="h-24 lg:hidden" />
      </div>
      {pengguna && <BottomNav onBukaMenu={() => setDrawer(true)} />}
    </div>
  );
}

function Rute() {
  return (
    <Kerangka>
      <Routes>
        <Route path="/masuk" element={<Login />} />
        <Route path="/dompet" element={<Guard boleh={['owner']}><Dompet /></Guard>} />
        <Route path="/laporan" element={<Guard boleh={['owner']}><Laporan /></Guard>} />
        <Route path="/kasir" element={<Guard boleh={['owner', 'kasir']}><Kasir /></Guard>} />
        <Route path="/riwayat" element={<Guard boleh={['owner', 'kasir']}><Riwayat /></Guard>} />
        <Route path="/stok" element={<Guard boleh={['owner', 'kasir', 'gudang']}><Stok /></Guard>} />
        <Route path="/suplier" element={<Guard boleh={['owner', 'gudang']}><Suplier /></Guard>} />
        <Route path="/struk/:id" element={<Guard boleh={['owner', 'kasir']}><StrukPage /></Guard>} />
        <Route path="/pengeluaran" element={<Guard boleh={['owner']}><Pengeluaran /></Guard>} />
        <Route path="/kasbon" element={<Guard boleh={['owner']}><Kasbon /></Guard>} />
        <Route path="/pengguna" element={<Guard boleh={['owner']}><Pengguna /></Guard>} />
        <Route path="/pengaturan" element={<Guard boleh={['owner', 'kasir', 'gudang']}><Pengaturan /></Guard>} />
        <Route path="/" element={<RuteAwal />} />
        <Route path="*" element={<RuteAwal />} />
      </Routes>
    </Kerangka>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <PengaturanProvider>
        <BrowserRouter>
          <Rute />
        </BrowserRouter>
      </PengaturanProvider>
    </AuthProvider>
  );
}
