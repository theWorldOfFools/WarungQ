import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, UserPlus, ShieldCheck, Crown, Package, ShoppingCart, Power, Trash2 } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Card, PageHeader, EmptyState, Notice, StatusBadge, Wadah } from '../components/ui';
import Konfirmasi from '../components/Konfirmasi';

const PERAN_META = {
  owner: { label: 'Owner', tone: 'emerald', ikon: Crown, desc: 'Semua menu' },
  kasir: { label: 'Kasir', tone: 'sky', ikon: ShoppingCart, desc: 'Kasir + Stok' },
  gudang: { label: 'Gudang', tone: 'amber', ikon: Package, desc: 'Stok saja' },
};

export default function Pengguna() {
  const { pengguna } = useAuth();
  const [daftar, setDaftar] = useState([]);
  const [form, setForm] = useState({ nama_pengguna: '', email: '', password: '', role: 'kasir' });
  const [pesan, setPesan] = useState('');
  const [gagal, setGagal] = useState('');
  const [hapusTarget, setHapusTarget] = useState(null);

  async function muat() {
    try {
      const { data } = await api.get('/api/users');
      setDaftar(data);
    } catch {
      setGagal('Gagal memuat daftar orang.');
    }
  }

  useEffect(() => {
    muat();
  }, []);

  async function simpan(e) {
    e.preventDefault();
    setPesan('');
    setGagal('');
    try {
      await api.post('/api/users', form);
      setForm({ nama_pengguna: '', email: '', password: '', role: 'kasir' });
      setPesan('Pengguna baru tersimpan.');
      muat();
    } catch (err) {
      setGagal(err.response?.data?.pesan || 'Gagal menyimpan.');
    }
  }

  async function alihAktif(u) {
    setPesan('');
    setGagal('');
    try {
      await api.put(`/api/users/${u.id}/aktif`, { aktif: !u.aktif });
      setPesan(`${u.nama_pengguna} ${u.aktif ? 'dinonaktifkan' : 'diaktifkan kembali'}.`);
      muat();
    } catch (err) {
      setGagal(err.response?.data?.pesan || 'Gagal mengubah status.');
    }
  }

  async function jalankanHapus() {
    if (!hapusTarget) return;
    setPesan('');
    setGagal('');
    try {
      await api.delete(`/api/users/${hapusTarget.id}`);
      setPesan(`${hapusTarget.nama_pengguna} dihapus dari warung.`);
      setHapusTarget(null);
      muat();
    } catch (err) {
      setGagal(err.response?.data?.pesan || 'Gagal menghapus.');
      setHapusTarget(null);
    }
  }

  return (
    <Wadah maks="max-w-[900px]">
      <PageHeader
        title="Orang Warung"
        subtitle="Kelola siapa boleh buka apa — Kasir jualan, Gudang stok, Owner semua."
        icon={<Users size={22} />}
      />

      <Notice tone="success">{pesan}</Notice>
      {gagal && <Notice tone="error">{gagal}</Notice>}

      {/* Matriks hak akses */}
      <Card>
        <h2 className="font-extrabold flex items-center gap-2 text-[15px]"><ShieldCheck size={17} className="text-emerald-600" /> Hak akses per peran</h2>
        <div className="mt-3 grid sm:grid-cols-3 gap-2">
          {Object.entries(PERAN_META).map(([k, m]) => (
            <div key={k} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3.5">
              <StatusBadge tone={m.tone}>{m.label}</StatusBadge>
              <p className="mt-1.5 text-[13px] text-slate-600 font-medium">{m.desc}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid lg:grid-cols-5 gap-3 items-start">
        {/* Form */}
        <Card className="lg:col-span-2 lg:sticky lg:top-24">
          <form onSubmit={simpan} className="space-y-2.5">
            <h2 className="font-extrabold flex items-center gap-2"><UserPlus size={17} className="text-emerald-600" /> Tambah orang</h2>
            <div><label className="label">Nama</label><input className="input mt-1" placeholder="mis. Ani Kasir" value={form.nama_pengguna} onChange={(e) => setForm({ ...form, nama_pengguna: e.target.value })} required /></div>
            <div><label className="label">Email</label><input className="input mt-1" type="email" placeholder="ani@warung.test" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
            <div><label className="label">Kata sandi (min 6)</label><input className="input mt-1" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></div>
            <div>
              <label className="label">Peran</label>
              <div className="grid grid-cols-3 gap-1.5 mt-1">
                {Object.entries(PERAN_META).map(([k, m]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setForm({ ...form, role: k })}
                    className={`rounded-xl border px-2 py-2.5 text-[13px] font-bold flex flex-col items-center gap-1 transition active:scale-95 ${form.role === k ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}
                  >
                    <m.ikon size={17} /> {m.label}
                  </button>
                ))}
              </div>
            </div>
            <motion.button whileTap={{ scale: 0.98 }} className="btn-besar btn-primer w-full">Tambah Orang</motion.button>
          </form>
        </Card>

        {/* Daftar */}
        <div className="lg:col-span-3 space-y-2">
          {daftar.length === 0 ? (
            <EmptyState icon={<Users size={36} />} title="Belum ada pegawai" subtitle="Tambah kasir / gudang lewat formulir di samping." />
          ) : (
            daftar.map((u, i) => {
              const meta = PERAN_META[u.role] || PERAN_META.kasir;
              const diriSendiri = pengguna?.id === u.id;
              return (
                <motion.div
                  key={u.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className={`card card-hover p-3.5 flex items-center gap-3 ${u.aktif === false ? 'opacity-60' : ''}`}
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white font-extrabold">
                    {(u.nama_pengguna?.[0] || '?').toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold truncate">{u.nama_pengguna}</p>
                    <p className="text-[13px] text-slate-500 truncate">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {u.aktif === false && <StatusBadge tone="slate">Nonaktif</StatusBadge>}
                    <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
                    {!diriSendiri && (
                      <>
                        <button
                          onClick={() => alihAktif(u)}
                          title={u.aktif === false ? 'Aktifkan lagi' : 'Nonaktifkan'}
                          className="h-9 w-9 inline-flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition active:scale-90"
                        >
                          <Power size={15} />
                        </button>
                        <button
                          onClick={() => setHapusTarget(u)}
                          title="Hapus"
                          className="h-9 w-9 inline-flex items-center justify-center rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 transition active:scale-90"
                        >
                          <Trash2 size={15} />
                        </button>
                      </>
                    )}
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </div>

      <Konfirmasi
        terbuka={!!hapusTarget}
        judul={`Hapus ${hapusTarget?.nama_pengguna || ''}?`}
        pesan="Akunnya tidak bisa login lagi. Riwayat jualan/kasbon yang pernah dicatat tetap aman."
        teksYa="Ya, hapus"
        onYa={jalankanHapus}
        onTutup={() => setHapusTarget(null)}
      />
    </Wadah>
  );
}
