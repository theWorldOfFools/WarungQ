import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  History,
  Search,
  ReceiptText,
  Printer,
  RefreshCw,
  CalendarDays,
  Wallet,
  NotebookPen,
  Ban,
  X,
} from 'lucide-react';
import api, { rupiah } from '../api/client';
import { Card, PageHeader, EmptyState, Notice, StatusBadge, Wadah } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { cn } from '../components/cn';

const LIMIT = 50;

function hariIni() {
  return new Date().toISOString().slice(0, 10);
}

function geserHari(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

const PRESETS = [
  { id: 'hari', label: 'Hari ini', dari: () => hariIni(), sampai: () => hariIni() },
  { id: '7', label: '7 Hari', dari: () => geserHari(6), sampai: () => hariIni() },
  { id: '30', label: '30 Hari', dari: () => geserHari(29), sampai: () => hariIni() },
];

const FILTER_BAYAR = [
  { id: '', label: 'Semua' },
  { id: 'tunai', label: 'Tunai' },
  { id: 'kasbon', label: 'Kasbon' },
];

function waktuTeks(s) {
  return new Date(s).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });
}

// Riwayat Transaksi — daftar struk, filter periode, cari kode, cetak ulang, batalkan (owner).
export default function Riwayat() {
  const { pengguna } = useAuth();
  const owner = pengguna?.peran === 'owner';

  const [dari, setDari] = useState(geserHari(6));
  const [sampai, setSampai] = useState(hariIni());
  const [preset, setPreset] = useState('7');
  const [cari, setCari] = useState('');
  const [cariAktif, setCariAktif] = useState('');
  const [filterBayar, setFilterBayar] = useState('');
  const [tampilVoid, setTampilVoid] = useState(false);

  const [daftar, setDaftar] = useState([]);
  const [memuat, setMemuat] = useState(true);
  const [habis, setHabis] = useState(false);
  const [pesan, setPesan] = useState('');
  const [gagal, setGagal] = useState('');

  const [voidTarget, setVoidTarget] = useState(null);
  const [alasanVoid, setAlasanVoid] = useState('');
  const [memprosesVoid, setMemprosesVoid] = useState(false);

  async function muat({ tambah = false } = {}) {
    setMemuat(true);
    setGagal('');
    try {
      const { data } = await api.get('/api/sales', {
        params: {
          dari,
          sampai,
          q: cariAktif || undefined,
          dibayar_via: filterBayar || undefined,
          tampilkan_void: tampilVoid ? 1 : undefined,
          limit: LIMIT,
          offset: tambah ? daftar.length : 0,
        },
      });
      setDaftar(tambah ? [...daftar, ...data] : data);
      setHabis(data.length < LIMIT);
    } catch (e) {
      setGagal(e.response?.data?.pesan || 'Gagal memuat riwayat. Coba lagi ya.');
    } finally {
      setMemuat(false);
    }
  }

  useEffect(() => {
    muat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dari, sampai, filterBayar, tampilVoid, cariAktif]);

  function pilihPreset(p) {
    setPreset(p.id);
    setDari(p.dari());
    setSampai(p.sampai());
  }

  const ringkas = useMemo(() => {
    const total = daftar.reduce((s, d) => s + Number(d.total_masuk || 0), 0);
    const kasbon = daftar.filter((d) => d.dibayar_via === 'kasbon').length;
    return { total, kasbon };
  }, [daftar]);

  async function batalkan() {
    if (!voidTarget) return;
    setMemprosesVoid(true);
    setGagal('');
    try {
      const { data } = await api.post(`/api/sales/${voidTarget.id}/void`, { alasan: alasanVoid });
      setPesan(data.pesan || 'Struk dibatalkan.');
      setVoidTarget(null);
      setAlasanVoid('');
      muat();
    } catch (e) {
      setGagal(e.response?.data?.pesan || 'Gagal membatalkan struk.');
    } finally {
      setMemprosesVoid(false);
    }
  }

  return (
    <Wadah maks="max-w-[1100px]">
      <PageHeader
        title="Riwayat Transaksi"
        subtitle="Semua struk tersimpan — cari, cetak ulang, atau batalkan salah input."
        icon={<History size={22} />}
        action={
          <motion.button whileTap={{ scale: 0.94 }} onClick={() => muat()} className="btn-lembut" title="Muat ulang">
            <RefreshCw size={16} className={memuat ? 'animate-spin' : ''} />
          </motion.button>
        }
      />

      <Notice tone="success">{pesan}</Notice>
      {gagal && <Notice tone="error">{gagal}</Notice>}

      {/* Filter periode + cari */}
      <Card className="space-y-2.5">
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

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input-besar pl-10"
              placeholder="Cari kode struk (mis. WQ-2026...)"
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && setCariAktif(cari.trim())}
            />
          </div>
          <motion.button
            whileTap={{ scale: 0.96 }}
            className="btn-gelap min-h-[48px] px-5"
            onClick={() => setCariAktif(cari.trim())}
          >
            Cari
          </motion.button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {FILTER_BAYAR.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilterBayar(f.id)}
              className={cn(
                'px-3.5 py-2 rounded-xl text-[13px] font-bold border transition active:scale-95',
                filterBayar === f.id
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
              )}
            >
              {f.label}
            </button>
          ))}
          {owner && (
            <label className="ml-auto flex items-center gap-2 text-[13px] font-bold text-slate-600 select-none cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 accent-rose-600"
                checked={tampilVoid}
                onChange={(e) => setTampilVoid(e.target.checked)}
              />
              Tampilkan struk dibatalkan
            </label>
          )}
        </div>
      </Card>

      {/* Ringkasan yang dimuat */}
      {daftar.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <StatusBadge tone="sky">{daftar.length} struk dimuat</StatusBadge>
          <StatusBadge tone="emerald">Total {rupiah(ringkas.total)}</StatusBadge>
          {ringkas.kasbon > 0 && <StatusBadge tone="amber">{ringkas.kasbon} struk kasbon</StatusBadge>}
        </div>
      )}

      {/* Daftar struk */}
      {memuat && daftar.length === 0 ? (
        <div className="grid xl:grid-cols-2 gap-2.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse h-28 rounded-2xl bg-white border border-slate-200" />
          ))}
        </div>
      ) : daftar.length === 0 ? (
        <EmptyState
          icon={<ReceiptText size={36} />}
          title="Belum ada transaksi"
          subtitle="Ubah periode atau filter, lalu coba lagi. Transaksi kasir otomatis muncul di sini."
        />
      ) : (
        <div className="grid xl:grid-cols-2 gap-2.5">
          <AnimatePresence initial={false}>
            {daftar.map((s) => {
              const kasbon = s.dibayar_via === 'kasbon';
              const dibatalkan = !!s.voided_at;
              return (
                <motion.div
                  key={s.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={cn('card card-hover p-4 space-y-2', dibatalkan && 'opacity-70 border-rose-200')}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-extrabold text-sm truncate">{s.kode_struk}</p>
                      <p className="text-xs text-slate-500 font-medium">
                        {waktuTeks(s.created_at)} • {s.kasir_nama || '-'} • {s.jumlah_item} item
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {dibatalkan ? (
                        <StatusBadge tone="rose"><Ban size={13} /> Dibatalkan</StatusBadge>
                      ) : kasbon ? (
                        <StatusBadge tone="amber"><NotebookPen size={13} /> Kasbon</StatusBadge>
                      ) : (
                        <StatusBadge tone="emerald"><Wallet size={13} /> Tunai</StatusBadge>
                      )}
                    </div>
                  </div>

                  {kasbon && s.kasbon_nama && (
                    <p className="text-[13px] text-slate-600">
                      Atas nama <b>{s.kasbon_nama}</b> — belum dibayar.
                    </p>
                  )}
                  {dibatalkan && s.alasan_void && (
                    <p className="text-[13px] text-rose-600 font-medium">Alasan: {s.alasan_void}</p>
                  )}

                  <div className="flex items-end justify-between gap-2">
                    <div>
                      <p className="text-lg font-extrabold text-emerald-700">{rupiah(s.total_masuk)}</p>
                      {owner && !dibatalkan && s.perkiraan_untung != null && (
                        <p className="text-xs text-slate-500 font-semibold">Untung {rupiah(s.perkiraan_untung)}</p>
                      )}
                    </div>
                    <div className="flex gap-1.5">
                      <Link
                        to={`/struk/${s.id}`}
                        className="btn !py-1.5 !px-3 !text-[13px] bg-slate-900 text-white hover:bg-slate-700"
                      >
                        <Printer size={14} /> Struk
                      </Link>
                      {owner && !dibatalkan && (
                        <button
                          onClick={() => {
                            setVoidTarget(s);
                            setAlasanVoid('');
                          }}
                          className="btn !py-1.5 !px-3 !text-[13px] bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100"
                        >
                          <Ban size={14} /> Batalkan
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {!habis && (
            <div className="xl:col-span-2 flex justify-center">
              <motion.button whileTap={{ scale: 0.97 }} onClick={() => muat({ tambah: true })} className="btn-lembut" disabled={memuat}>
                {memuat ? 'Memuat...' : 'Muat lebih banyak'}
              </motion.button>
            </div>
          )}
        </div>
      )}

      {/* Modal batalkan struk (owner) */}
      <AnimatePresence>
        {voidTarget && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/55 p-3"
            onClick={() => !memprosesVoid && setVoidTarget(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"
              role="alertdialog"
              aria-modal="true"
              aria-label="Batalkan struk"
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="flex items-center gap-2 font-extrabold text-slate-900">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500 text-white">
                    <Ban size={18} />
                  </span>
                  Batalkan struk?
                </h2>
                <button
                  onClick={() => !memprosesVoid && setVoidTarget(null)}
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                  aria-label="Tutup"
                >
                  <X size={18} />
                </button>
              </div>
              <p className="mt-1 text-sm text-slate-600">
                Struk <b>{voidTarget.kode_struk}</b> ({rupiah(voidTarget.total_masuk)}) akan dibatalkan.
                Stok barang dikembalikan dan struk tidak dihitung di laporan.
                {voidTarget.dibayar_via === 'kasbon' && ' Catatan utangnya ikut dihapus (bila belum ada cicilan).'}
              </p>
              <input
                className="input-besar mt-3 w-full"
                placeholder="Alasan (mis. salah input) — boleh dikosongkan"
                value={alasanVoid}
                onChange={(e) => setAlasanVoid(e.target.value)}
                maxLength={200}
              />
              <div className="mt-4 flex gap-2">
                <button
                  onClick={batalkan}
                  disabled={memprosesVoid}
                  className="btn flex-1 bg-rose-600 text-white hover:bg-rose-700 min-h-[46px] disabled:opacity-60"
                >
                  {memprosesVoid ? 'Memproses...' : 'Ya, batalkan'}
                </button>
                <button
                  onClick={() => setVoidTarget(null)}
                  disabled={memprosesVoid}
                  className="btn-lembut flex-1 min-h-[46px]"
                >
                  Tidak jadi
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Wadah>
  );
}
