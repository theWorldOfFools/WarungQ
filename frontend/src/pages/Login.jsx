import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Store, Mail, Lock, LogIn, Eye, EyeOff, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { masuk } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('owner@warung.test');
  const [password, setPassword] = useState('warung123');
  const [lihat, setLihat] = useState(false);
  const [salah, setSalah] = useState('');
  const [sibuk, setSibuk] = useState(false);

  async function kirim(e) {
    e.preventDefault();
    setSalah('');
    setSibuk(true);
    try {
      const p = await masuk(email, password);
      nav(p.peran === 'gudang' ? '/stok' : p.peran === 'owner' ? '/dompet' : '/kasir', { replace: true });
    } catch (err) {
      setSalah(err.response?.data?.pesan || 'Gagal masuk. Cek email & kata sandi ya.');
    } finally {
      setSibuk(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 relative overflow-hidden">
      {/* hiasan */}
      <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-amber-400/15 blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md"
      >
        <form onSubmit={kirim} className="bg-white rounded-3xl shadow-pop border border-white/40 p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-md">
              <Store size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight">UMKM-Scan</h1>
              <p className="text-sm text-slate-500">Kasir warung gampang & modern</p>
            </div>
          </div>

          <div className="rounded-2xl bg-emerald-50 border border-emerald-100 px-3.5 py-2.5 flex items-center gap-2 text-[13px] text-emerald-800 font-medium">
            <Sparkles size={15} className="shrink-0" />
            Akun demo: owner@warung.test / warung123
          </div>

          <div>
            <label className="label">Email</label>
            <div className="relative mt-1">
              <Mail size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="input-besar pl-10" value={email} onChange={(e) => setEmail(e.target.value)} type="email" required autoComplete="email" />
            </div>
          </div>

          <div>
            <label className="label">Kata sandi</label>
            <div className="relative mt-1">
              <Lock size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="input-besar pl-10 pr-11"
                type={lihat ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <button type="button" onClick={() => setLihat(!lihat)} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-slate-700 transition">
                {lihat ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {salah && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-bold px-3.5 py-2.5">
              {salah}
            </motion.p>
          )}

          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            disabled={sibuk}
            className="btn-besar btn-primer w-full text-base"
          >
            <LogIn size={18} strokeWidth={2.5} />
            {sibuk ? 'Membuka warung...' : 'Masuk ke Warung'}
          </motion.button>

          <p className="text-center text-xs text-slate-400">Uang Masuk • Modal Beli • Utang Tetangga — bahasa warung sehari-hari</p>
        </form>
      </motion.div>
    </div>
  );
}
