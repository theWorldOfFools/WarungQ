import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Banknote, Plus, X, Trash2, CalendarDays, RefreshCw } from 'lucide-react';
import api, { rupiah } from '../api/client';
import { Card, PageHeader, EmptyState, Notice, StatusBadge, Wadah } from '../components/ui';
import Konfirmasi from '../components/Konfirmasi';
import { cn } from '../components/cn';

const KATEGORI_BAKU = ['Listrik', 'Air', 'Sewa', 'Gaji', 'Transport', 'Belanja', 'Lainnya'];

const fmt = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const hariIni = () => fmt(new Date());
const geser = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return fmt(d);
};
const awalBulan = () => {
  const d = new Date();
  return fmt(new Date(d.getFullYear(), d.getMonth(), 1));
};
const awalBulanLalu = () => {
  const d = new Date();
  return fmt(new Date(d.getFullYear(), d.getMonth() - 1, 1));
};
const akhirBulanLalu = () => {
  const d = new Date();
  return fmt(new Date(d.getFullYear(), d.getMonth(), 0));
};

const PRESETS = [
  { id: 'bulan', label: 'Bulan Ini', dari: awalBulan, sampai: hariIni },
  { id: 'lalu', label: 'Bulan Lalu', dari: awalBulanLalu, sampai: akhirBulanLalu },
  { id: '7', label: '7 Hari', dari: () => geser(6), sampai: hariIni },
];

const formAwal = { tanggal: hariIni(), kategori: 'Lainnya', keterangan: '', jumlah: '' };

function tanggalTeks(s) {
  const teks = String(s || '').slice(0, 10);
  const d = new Date(`${teks}T00:00:00`);
  if (Number.isNaN(d.getTime())) return String(s || '');
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Pengeluaran Warung — listrik, sewa, gaji, dll. Mengurangi Perkiraan Untung Bersih.
export default function Pengeluaran() {
  const [dari, setDari] = useState(awalBulan());
  const [sampai, setSampai] = useState(hariIni());
  const [preset, setPreset] = useState('bulan');
  const [daftar, setDaftar] = useState([]);
  const [total, setTotal] = useState(0);
  const [memuat, setMemuat] = useState(true);
  const [pesan, setPesan] = useState('');
  const [gagal, setGagal] = useState('');
  const [form, setForm] = useState(formAwal);
  const [tampilForm, setTampilForm] = useState(false);
  const [hapusTarget, setHapusTarget] = useState(null);

  async function muat() {
    setMemuat(true);
    setGagal('');
    try {
      const { data } = await api.get('/api/expenses', { params: { dari, sampai } });
      setDaftar(data.pengeluaran || []);
      setTotal(data.total || 0);
    } catch (e) {
      setGagal(e.response?.data?.pesan || 'Gagal memuat pengeluaran.');
    } finally {
      setMemuat(false);
    }
  }

  useEffect(() => {
    muat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dari, sampai]);

  function pilihPreset(p) {
    setPreset(p.id);
    setDari(p.dari());
    setSampai(p.sampai());
  }

  const perKategori = useMemo(() => {
    const map = {};
    for (const d of daftar) {
      map[d.kategori] = (map[d.kategori] || 0) + Number(d.jumlah || 0);
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [daftar]);

  async function simpan(e) {
    e.preventDefault();
    setPesan('');
    setGagal('');
    try {
      await api.post('/api/expenses', {
        tanggal: form.tanggal || null,
        kategori: form.kategori || 'Lainnya',
        keterangan: form.keterangan,
        jumlah: Number(form.jumlah || 0),
      });
      setForm({ ...formAwal, tanggal: form.tanggal });
      setTampilForm(false);
      setPesan('Pengeluaran tersimpan.');
      muat();
    } catch (err) {
      setGagal(err.response?.data?.pesan || 'Gagal menyimpan pengeluaran.');
    }
  }

  async function hapus() {
    if (!hapusTarget) return;
    try {
      await api.delete(`/api/expenses/${hapusTarget.id}`);
      setPesan('Pengeluaran dihapus.');
      setHapusTarget(null);
      muat();
    } catch (err) {
      setGagal(err.response?.data?.pesan || 'Gagal menghapus.');
    }
  }

  return (
    <Wadah maks="max-w-[900px]">
      <PageHeader
        title="Pengeluaran Warung"
        subtitle="Catat listrik, sewa, gaji, dan belanja — Untung Bersih jadi lebih jujur."
        icon={<Banknote size={22} />}
        action={
          <>
            <motion.button whileTap={{ scale: 0.94 }} onClick={muat} className="btn-lembut" title="Muat ulang">
              <RefreshCw size={16} className={memuat ? 'animate-spin' : ''} />
            </motion.button>
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => setTampilForm(!tampilForm)} className="btn-primer">
              {tampilForm ? <><X size={16} /> Tutup</> : <><Plus size={16} strokeWidth={3} /> Catat</>}
            </motion.button>
          </>
        }
      />

      <Notice tone="success">{pesan}</Notice>
      {gagal && <Notice tone="error">{gagal}</Notice>}

      {/* Filter periode */}
      <div className="flex flex-wrap items-center gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => pilihPreset(p)}
            className={cn(
              'px-3.5 py-2 rounded-xl text-sm font-bold border transition active:scale-95',
              preset === p.id
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
            )}
          >
            {p.label}
          </button>
        ))}
        <div className="flex items-center gap-1.5 ml-auto">
          <div className="relative">
            <CalendarDays size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-9 w-[150px]"
              type="date"
              value={dari}
              onChange={(e) => {
                setDari(e.target.value);
                setPreset('');
              }}
            />
          </div>
          <span className="text-slate-400 font-bold">–</span>
          <input
            className="input w-[150px]"
            type="date"
            value={sampai}
            onChange={(e) => {
              setSampai(e.target.value);
              setPreset('');
            }}
          />
        </div>
      </div>

      {/* Ringkasan */}
      <div className="grid sm:grid-cols-2 gap-2.5">
        <div className="rounded-2xl p-4 bg-gradient-to-br from-rose-500 to-orange-500 text-white shadow-card">
          <p className="text-xs font-bold uppercase tracking-wide text-white/80">Total pengeluaran periode</p>
          <p className="text-2xl font-extrabold">{rupiah(total)}</p>
        </div>
        <Card className="flex flex-col justify-center">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Catatan</p>
          <p className="text-2xl font-extrabold">{daftar.length} <span className="text-sm font-semibold text-slate-500">pengeluaran</span></p>
          {perKategori.length > 0 && (
            <p className="text-xs text-slate-500 mt-1 truncate">
              {perKategori.slice(0, 3).map(([k, v]) => `${k} ${rupiah(v)}`).join(' • ')}
            </p>
          )}
        </Card>
      </div>

      {/* Form */}
      <AnimatePresence>
        {tampilForm && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={simpan}
            className="overflow-hidden"
          >
            <Card className="space-y-2.5 border-emerald-200">
              <h2 className="font-extrabold">Catat pengeluaran baru</h2>
              <div className="grid sm:grid-cols-2 gap-2">
                <div>
                  <label className="label">Tanggal</label>
                  <input
                    className="input-besar mt-1 w-full"
                    type="date"
                    value={form.tanggal}
                    onChange={(e) => setForm({ ...form, tanggal: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Kategori</label>
                  <input
                    className="input-besar mt-1 w-full"
                    list="daftar-kategori-pengeluaran"
                    value={form.kategori}
                    onChange={(e) => setForm({ ...form, kategori: e.target.value })}
                  />
                  <datalist id="daftar-kategori-pengeluaran">
                    {KATEGORI_BAKU.map((k) => <option key={k} value={k} />)}
                  </datalist>
                </div>
                <div>
                  <label className="label">Nominal (Rp)</label>
                  <input
                    className="input-besar mt-1 w-full"
                    type="number"
                    min="1"
                    placeholder="mis. 150000"
                    value={form.jumlah}
                    onChange={(e) => setForm({ ...form, jumlah: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="label">Keterangan (boleh kosong)</label>
                  <input
                    className="input-besar mt-1 w-full"
                    placeholder="mis. token listrik"
                    maxLength={200}
                    value={form.keterangan}
                    onChange={(e) => setForm({ ...form, keterangan: e.target.value })}
                  />
                </div>
              </div>
              <motion.button whileTap={{ scale: 0.98 }} className="btn-besar btn-primer w-full">
                Simpan Pengeluaran
              </motion.button>
            </Card>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Daftar */}
      {memuat ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse h-16 rounded-2xl bg-white border border-slate-200" />
          ))}
        </div>
      ) : daftar.length === 0 ? (
        <EmptyState
          icon={<Banknote size={36} />}
          title="Belum ada pengeluaran"
          subtitle="Catat biaya operasional warung agar Untung Bersih tidak kelihatan lebih besar dari aslinya."
        />
      ) : (
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {daftar.map((d) => (
              <motion.div
                key={d.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="card card-hover p-3.5 flex items-center gap-3"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600 font-extrabold">
                  -
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold leading-snug truncate">
                    {d.keterangan || d.kategori}
                  </p>
                  <p className="text-xs text-slate-500 font-medium">
                    {tanggalTeks(d.tanggal)} • {d.kategori}
                    {d.dicatat_oleh_nama ? ` • ${d.dicatat_oleh_nama}` : ''}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <b className="text-rose-600">{rupiah(d.jumlah)}</b>
                  <button
                    onClick={() => setHapusTarget(d)}
                    className="text-xs font-bold text-slate-400 hover:text-rose-600 flex items-center gap-1 transition"
                  >
                    <Trash2 size={12} /> Hapus
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <div className="flex justify-center">
        <StatusBadge>Pengeluaran otomatis mengurangi Untung Bersih di Dompet & Laporan</StatusBadge>
      </div>

      <Konfirmasi
        terbuka={!!hapusTarget}
        judul="Hapus pengeluaran ini?"
        pesan={`${hapusTarget?.keterangan || hapusTarget?.kategori || 'Catatan'} (${rupiah(hapusTarget?.jumlah)}) akan dihapus dari rekap.`}
        teksYa="Ya, hapus"
        onYa={hapus}
        onTutup={() => setHapusTarget(null)}
      />
    </Wadah>
  );
}
