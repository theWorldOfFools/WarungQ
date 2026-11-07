import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Clock3,
  Play,
  Lock,
  RefreshCw,
  Wallet,
  Banknote,
  QrCode,
  NotebookPen,
  CheckCircle2,
  AlertTriangle,
  X,
} from 'lucide-react';
import api, { rupiah } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Card, PageHeader, EmptyState, Notice, StatusBadge, Wadah } from '../components/ui';

function waktuTeks(s) {
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function selisihInfo(n) {
  if (n == null) return { label: 'Belum ditutup', tone: 'slate' };
  if (n === 0) return { label: 'Kas pas', tone: 'emerald' };
  if (n > 0) return { label: `Lebih ${rupiah(n)}`, tone: 'amber' };
  return { label: `Kurang ${rupiah(Math.abs(n))}`, tone: 'rose' };
}

export default function Shift() {
  const { pengguna } = useAuth();
  const owner = pengguna?.peran === 'owner';

  const [aktif, setAktif] = useState(null);
  const [riwayat, setRiwayat] = useState([]);
  const [memuat, setMemuat] = useState(true);
  const [pesan, setPesan] = useState('');
  const [gagal, setGagal] = useState('');
  const [kasAwal, setKasAwal] = useState('0');
  const [bukaProses, setBukaProses] = useState(false);

  const [tutupOpen, setTutupOpen] = useState(false);
  const [kasFisik, setKasFisik] = useState('');
  const [catatan, setCatatan] = useState('');
  const [tutupProses, setTutupProses] = useState(false);

  async function muat() {
    setMemuat(true);
    setGagal('');
    try {
      const [a, r] = await Promise.all([
        api.get('/api/shifts/aktif'),
        api.get('/api/shifts'),
      ]);
      setAktif(a.data);
      setRiwayat(r.data || []);
    } catch (e) {
      setGagal(e.response?.data?.pesan || 'Gagal memuat data shift.');
    } finally {
      setMemuat(false);
    }
  }

  useEffect(() => {
    muat();
  }, []);

  const selisihLive = useMemo(() => {
    if (!aktif || kasFisik === '') return null;
    return Number(kasFisik || 0) - Number(aktif.uang_seharusnya || 0);
  }, [aktif, kasFisik]);

  async function buka(e) {
    e.preventDefault();
    setPesan('');
    setGagal('');
    setBukaProses(true);
    try {
      const { data } = await api.post('/api/shifts/buka', { kas_awal: Number(kasAwal || 0) });
      setPesan(data.pesan || 'Kasir dibuka.');
      muat();
    } catch (err) {
      setGagal(err.response?.data?.pesan || 'Gagal membuka kasir.');
    } finally {
      setBukaProses(false);
    }
  }

  function bukaTutup() {
    setKasFisik(String(aktif?.uang_seharusnya ?? 0));
    setCatatan('');
    setTutupOpen(true);
    setGagal('');
    setPesan('');
  }

  async function tutup(e) {
    e.preventDefault();
    if (!aktif) return;
    setTutupProses(true);
    setGagal('');
    try {
      const { data } = await api.post(`/api/shifts/${aktif.id}/tutup`, {
        kas_fisik: Number(kasFisik || 0),
        catatan,
      });
      setPesan(data.pesan || 'Shift ditutup.');
      setTutupOpen(false);
      muat();
    } catch (err) {
      setGagal(err.response?.data?.pesan || 'Gagal menutup shift.');
    } finally {
      setTutupProses(false);
    }
  }

  return (
    <Wadah maks="max-w-[900px]">
      <PageHeader
        title="Tutup Kasir / Shift"
        subtitle="Catat kas awal, cek uang laci saat tutup, dan ketahui selisihnya."
        icon={<Clock3 size={22} />}
        action={
          <motion.button whileTap={{ scale: 0.94 }} onClick={muat} className="btn-lembut" title="Muat ulang">
            <RefreshCw size={16} className={memuat ? 'animate-spin' : ''} />
          </motion.button>
        }
      />

      <Notice tone="success">{pesan}</Notice>
      {gagal && <Notice tone="error">{gagal}</Notice>}

      {memuat ? (
        <div className="animate-pulse h-40 rounded-2xl bg-white border border-slate-200" />
      ) : aktif ? (
        <Card className="space-y-3 border-emerald-200">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Play size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-extrabold">Kasir sedang buka</h2>
                <StatusBadge tone="emerald" dot>Buka</StatusBadge>
              </div>
              <p className="text-xs text-slate-500">Mulai {waktuTeks(aktif.mulai)}{owner ? ` • ${aktif.kasir_nama}` : ''}</p>
            </div>
            <motion.button whileTap={{ scale: 0.95 }} onClick={bukaTutup} className="btn-primer">
              <Lock size={16} /> Tutup Kasir
            </motion.button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
              <p className="text-[11px] font-bold uppercase text-slate-500">Kas awal</p>
              <p className="text-lg font-extrabold">{rupiah(aktif.kas_awal)}</p>
            </div>
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3">
              <p className="text-[11px] font-bold uppercase text-emerald-700">Tunai masuk</p>
              <p className="text-lg font-extrabold text-emerald-800">{rupiah(aktif.total_tunai)}</p>
            </div>
            <div className="rounded-xl bg-sky-50 border border-sky-200 p-3">
              <p className="text-[11px] font-bold uppercase text-sky-700">Non-tunai</p>
              <p className="text-lg font-extrabold text-sky-800">{rupiah(aktif.total_non_tunai)}</p>
            </div>
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
              <p className="text-[11px] font-bold uppercase text-amber-700">Kasbon</p>
              <p className="text-lg font-extrabold text-amber-800">{rupiah(aktif.total_kasbon)}</p>
            </div>
            <div className="rounded-xl bg-violet-50 border border-violet-200 p-3">
              <p className="text-[11px] font-bold uppercase text-violet-700">Pelunasan kasbon</p>
              <p className="text-lg font-extrabold text-violet-800">{rupiah(aktif.total_pelunasan)}</p>
            </div>
            <div className="rounded-xl bg-slate-900 text-white p-3">
              <p className="text-[11px] font-bold uppercase text-slate-300">Uang seharusnya</p>
              <p className="text-lg font-extrabold">{rupiah(aktif.uang_seharusnya)}</p>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Uang seharusnya = kas awal + tunai masuk + pelunasan kasbon. Non-tunai tidak masuk laci.
          </p>
        </Card>
      ) : (
        <Card className="border-emerald-200">
          <form onSubmit={buka} className="space-y-2.5">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <Wallet size={18} />
              </div>
              <div>
                <h2 className="font-extrabold leading-tight">Buka kasir</h2>
                <p className="text-xs text-slate-500">Masukkan uang modal awal di laci.</p>
              </div>
            </div>
            <div>
              <label className="label">Kas awal (Rp)</label>
              <input
                className="input-besar mt-1 w-full"
                type="number"
                min="0"
                value={kasAwal}
                onChange={(e) => setKasAwal(e.target.value)}
                required
              />
            </div>
            <motion.button
              whileTap={{ scale: 0.98 }}
              disabled={bukaProses}
              className="btn-besar btn-primer w-full disabled:opacity-60"
            >
              {bukaProses ? 'Membuka...' : 'Buka Kasir'}
            </motion.button>
          </form>
        </Card>
      )}

      <div>
        <h2 className="font-extrabold mb-2 flex items-center gap-2">
          <Clock3 size={16} className="text-slate-500" /> Riwayat shift
        </h2>
        {riwayat.length === 0 ? (
          <EmptyState
            icon={<Clock3 size={36} />}
            title="Belum ada shift"
            subtitle="Buka kasir saat mulai jualan, lalu tutup saat pulang agar kas selalu cocok."
          />
        ) : (
          <div className="space-y-2">
            <AnimatePresence initial={false}>
              {riwayat.map((s) => {
                const info = selisihInfo(s.status === 'tutup' ? s.selisih : null);
                return (
                  <motion.div key={s.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    <Card className="p-3.5 space-y-2">
                      <div className="flex items-start gap-3">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${s.status === 'buka' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                          {s.status === 'buka' ? <Play size={18} /> : <Lock size={18} />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold">{s.status === 'buka' ? 'Shift berjalan' : 'Shift ditutup'}</p>
                            <StatusBadge tone={info.tone}>{info.label}</StatusBadge>
                          </div>
                          <p className="text-xs text-slate-500">
                            {waktuTeks(s.mulai)} → {s.status === 'tutup' ? waktuTeks(s.selesai) : 'sekarang'}
                            {owner ? ` • ${s.kasir_nama}` : ''}
                          </p>
                        </div>
                        <div className="text-right shrink-0 text-xs space-y-0.5">
                          <p className="text-slate-500">Kas awal <b className="text-slate-700">{rupiah(s.kas_awal)}</b></p>
                          {s.status === 'tutup' && (
                            <>
                              <p className="text-slate-500">Fisik <b className="text-slate-700">{rupiah(s.kas_fisik)}</b></p>
                              <p className="text-slate-500">Seharusnya <b className="text-slate-700">{rupiah(s.uang_seharusnya)}</b></p>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap text-xs text-slate-500">
                        <span className="flex items-center gap-1"><Banknote size={12} /> Tunai {rupiah(s.total_tunai)}</span>
                        <span className="flex items-center gap-1"><QrCode size={12} /> Non-tunai {rupiah(s.total_non_tunai)}</span>
                        <span className="flex items-center gap-1"><NotebookPen size={12} /> Kasbon {rupiah(s.total_kasbon)}</span>
                        <span className="ml-auto">{s.jumlah_transaksi} transaksi</span>
                      </div>
                      {s.status === 'tutup' && s.catatan && (
                        <p className="text-xs text-slate-500 italic">“{s.catatan}”</p>
                      )}
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      <AnimatePresence>
        {tutupOpen && aktif && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/55 p-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setTutupOpen(false)}
          >
            <motion.form
              onSubmit={tutup}
              className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-pop"
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
                    <Lock size={18} />
                  </div>
                  <div>
                    <h2 className="font-extrabold leading-tight">Tutup kasir</h2>
                    <p className="text-xs text-slate-500">Hitung uang fisik di laci.</p>
                  </div>
                </div>
                <button type="button" onClick={() => setTutupOpen(false)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
                  <X size={18} />
                </button>
              </div>

              <div className="mt-3 rounded-xl bg-slate-50 border border-slate-200 p-3 text-sm space-y-1">
                <div className="flex justify-between"><span>Kas awal</span><b>{rupiah(aktif.kas_awal)}</b></div>
                <div className="flex justify-between"><span>Tunai masuk</span><b>{rupiah(aktif.total_tunai)}</b></div>
                <div className="flex justify-between"><span>Pelunasan kasbon</span><b>{rupiah(aktif.total_pelunasan)}</b></div>
                <div className="flex justify-between border-t border-slate-200 pt-1"><span>Uang seharusnya</span><b>{rupiah(aktif.uang_seharusnya)}</b></div>
              </div>

              <label className="label mt-3">Uang fisik di laci (Rp)</label>
              <input
                className="input-besar mt-1 w-full"
                type="number"
                min="0"
                value={kasFisik}
                onChange={(e) => setKasFisik(e.target.value)}
                required
                autoFocus
              />

              {selisihLive != null && (
                <div className={`mt-2 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold ${selisihLive === 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : selisihLive > 0 ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                  {selisihLive === 0 ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                  {selisihLive === 0 ? 'Kas pas' : selisihLive > 0 ? `Kas lebih ${rupiah(selisihLive)}` : `Kas kurang ${rupiah(Math.abs(selisihLive))}`}
                </div>
              )}

              <label className="label mt-3">Catatan (boleh kosong)</label>
              <input
                className="input-besar mt-1 w-full"
                maxLength={300}
                placeholder="mis. uang kembalian kurang"
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
              />

              <motion.button
                whileTap={{ scale: 0.98 }}
                disabled={tutupProses}
                className="btn-besar btn-primer w-full mt-3 disabled:opacity-60"
              >
                {tutupProses ? 'Menutup...' : 'Tutup & Simpan'}
              </motion.button>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex justify-center">
        <StatusBadge tone="slate">
          <CheckCircle2 size={12} /> Selisih kas tercatat, bukan untuk menuduh — untuk transparansi.
        </StatusBadge>
      </div>
    </Wadah>
  );
}
