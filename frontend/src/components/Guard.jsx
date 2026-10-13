import { Navigate } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Card } from './ui';

// Guard peran: sembunyikan route sesuai RBAC.
// kasir: kasir+stok+pengaturan | gudang: stok+pengaturan | owner: semua
export default function Guard({ boleh, children }) {
  const { pengguna, siap } = useAuth();
  if (!siap)
    return (
      <div className="p-6 space-y-3 max-w-md mx-auto">
        <div className="animate-pulse h-8 rounded-xl bg-slate-200" />
        <div className="animate-pulse h-24 rounded-2xl bg-slate-200" />
        <p className="text-center text-sm text-slate-500 font-semibold">Membuka warung...</p>
      </div>
    );
  if (!pengguna) return <Navigate to="/masuk" replace />;
  if (boleh && !boleh.includes(pengguna.peran)) {
    return (
      <div className="max-w-md mx-auto p-4">
        <Card className="text-center py-10">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 border border-amber-200">
            <ShieldAlert size={24} />
          </div>
          <p className="font-extrabold text-lg">Maaf, akses dibatasi</p>
          <p className="mt-1 text-sm text-slate-500">
            Peran <b>{pengguna.peran}</b> tidak boleh membuka halaman ini. Minta Owner untuk akses ya.
          </p>
        </Card>
      </div>
    );
  }
  return children;
}
