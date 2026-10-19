import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3,
  Wallet,
  TrendingUp,
  ReceiptText,
  CalendarDays,
  RefreshCw,
  Send,
  NotebookPen,
  Banknote,
  Ban,
  Crown,
  Users,
} from 'lucide-react';
import api, { rupiah } from '../api/client';
import { Card, PageHeader, StatusBadge, Skeleton, Wadah } from '../components/ui';
import GrafikHarian from '../components/GrafikHarian';
import { usePengaturan } from '../context/PengaturanContext';
import { linkWA, drafRekapPeriode } from '../utils/wa';
import { cn } from '../components/cn';

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
  { id: 'hari', label: 'Hari ini', dari: hariIni, sampai: hariIni },
  { id: '7', label: '7 Hari', dari: () => geser(6), sampai: hariIni },
  { id: 'bulan', label: 'Bulan Ini', dari: awalBulan, sampai: hariIni },
  { id: 'lalu', label: 'Bulan Lalu', dari: awalBulanLalu, sampai: akhirBulanLalu },
];

// Laporan Periode — rekap mingguan/bulanan: uang masuk, untung, pengeluaran, per-kasir.
export default function Laporan() {
  const { pengaturan, ubah } = usePengaturan();
  const [dari, setDari] = useState(awalBulan());
  const [sampai, setSampai] = useState(hariIni());
  const [preset, setPreset] = useState('bulan');
  const [data, setData] = useState(null);
  const [memuat, setMemuat] = useState(true);
  const [gagal, setGagal] = useState('');
  const [waBuka, setWaBuka] = useState(false);
  const [waNomor, setWaNomor] = useState('');

  async function muat() {
    setMemuat(true);
    setGagal('');
    try {
      const { data } = await api.get('/api/reports/rentang', { params: { dari, sampai } });
      setData(data);
    } catch (e) {
      setGagal(e.response?.data?.pesan || 'Gagal memuat laporan. Coba lagi ya.');
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

  function kirimRekap() {
    if (!data) return;
    const nomor = (pengaturan.noWaPemilik || waNomor).trim();
    if (!nomor) {
      setWaBuka(true);
      return;
    }
    if (!pengaturan.noWaPemilik && waNomor.trim()) ubah({ noWaPemilik: waNomor.trim() });
    const pesan = drafRekapPeriode({
      toko: pengaturan.namaToko || 'Warung Saya',
      dari: data.dari,
      sampai: data.sampai,
      uangMasukTunai: data.uang_masuk_tunai,
      penjualanKasbon: data.penjualan_kasbon,
      untungKotor: data.untung_kotor,
      pengeluaran: data.pengeluaran,
      untungBersih: data.untung_bersih,
      struk: data.jumlah_struk,
      jumlahVoid: data.jumlah_void,
      produkTerlaris: data.produk_terlaris || [],
    });
    window.open(linkWA(nomor, pesan), '_blank');
  }

  const maksKategori = Math.max(...(data?.pengeluaran_per_kategori || []).map((k) => k.total || 0), 1);

  return (
    <Wadah maks="max-w-[1100px]">
      <PageHeader
        title="Laporan Periode"
        subtitle="Rekap mingguan & bulanan — uang masuk, untung bersih, pengeluaran, per pegawai."
        icon={<BarChart3 size={22} />}
        action={
          <motion.button whileTap={{ scale: 0.94 }} onClick={muat} className="btn-lembut" title="Muat ulang">
            <RefreshCw size={16} className={memuat ? 'animate-spin' : ''} />
          </motion.button>
        }
      />

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

      {gagal && <p className="rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-bold px-4 py-3">{gagal}</p>}

      {memuat && !data ? (
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : data ? (
        <>
          {/* KPI */}
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <motion.div whileHover={{ y: -3 }} className="rounded-2xl p-5 text-white bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 shadow-card border border-emerald-400/30">
              <p className="flex items-center gap-1.5 text-[13px] font-semibold text-emerald-100"><Wallet size={15} /> Uang Masuk Tunai</p>
              <p className="mt-1 text-2xl font-extrabold tracking-tight">{rupiah(data.uang_masuk_tunai)}</p>
              <p className="mt-1 text-[13px] text-emerald-100 flex items-center gap-1.5"><ReceiptText size={14} /> {data.jumlah_struk} struk</p>
            </motion.div>

            <motion.div whileHover={{ y: -3 }} className="rounded-2xl p-5 bg-gradient-to-br from-amber-400 via-amber-500 to-orange-500 text-slate-900 shadow-card border border-amber-300/60">
              <p className="flex items-center gap-1.5 text-[13px] font-bold text-amber-950/70"><NotebookPen size={15} /> Penjualan Kasbon</p>
              <p className="mt-1 text-2xl font-extrabold tracking-tight">{rupiah(data.penjualan_kasbon)}</p>
              <p className="mt-1 text-[13px] font-medium text-amber-950/70">{data.jumlah_struk_kasbon} struk • belum masuk kas</p>
            </motion.div>

            <motion.div whileHover={{ y: -3 }} className="rounded-2xl p-5 bg-gradient-to-br from-rose-500 via-rose-600 to-orange-700 text-white shadow-card border border-rose-400/40">
              <p className="flex items-center gap-1.5 text-[13px] font-semibold text-rose-100"><Banknote size={15} /> Pengeluaran</p>
              <p className="mt-1 text-2xl font-extrabold tracking-tight">{rupiah(data.pengeluaran)}</p>
              <p className="mt-1 text-[13px] text-rose-100">Listrik, sewa, gaji, dll.</p>
            </motion.div>

            <motion.div whileHover={{ y: -3 }} className="rounded-2xl p-5 bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 text-white shadow-card border border-white/10">
              <p className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-300"><TrendingUp size={15} /> Untung Bersih</p>
              <p className="mt-1 text-2xl font-extrabold tracking-tight text-emerald-300">{rupiah(data.untung_bersih)}</p>
              <p className="mt-1 text-[13px] text-slate-400">Kotor {rupiah(data.untung_kotor)} − pengeluaran</p>
            </motion.div>
          </div>

          {/* Baris ringkas */}
          <Card className="flex flex-wrap items-center gap-2">
            <StatusBadge tone="slate">Modal beli {rupiah(data.total_modal)}</StatusBadge>
            <StatusBadge tone="sky">Periode {data.dari} s/d {data.sampai}</StatusBadge>
            {data.jumlah_void > 0 && (
              <StatusBadge tone="rose"><Ban size={13} /> {data.jumlah_void} struk dibatalkan (tidak dihitung)</StatusBadge>
            )}
          </Card>

          {/* Grafik harian */}
          <Card>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-extrabold">Grafik harian</h2>
              <span className="text-xs font-semibold text-slate-400">Tunai & untung per hari</span>
            </div>
            <GrafikHarian data={data.seri_harian || []} />
          </Card>

          <div className="grid lg:grid-cols-2 gap-3">
            {/* Produk terlaris */}
            <Card>
              <h2 className="font-extrabold flex items-center gap-1.5">
                <Crown size={17} className="text-amber-500" /> Paling laris
              </h2>
              <div className="mt-3 space-y-2">
                {(data.produk_terlaris || []).length === 0 && (
                  <p className="text-sm text-slate-500">Belum ada penjualan di periode ini.</p>
                )}
                {(data.produk_terlaris || []).map((p, i) => (
                  <div key={p.nama} className="flex items-center gap-3 rounded-xl bg-slate-50 border border-slate-200/70 px-3 py-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white text-xs font-extrabold">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold text-sm">
                        {p.nama} <span className="text-slate-400 font-semibold">× {p.terjual}</span>
                      </p>
                      <div className="h-1.5 mt-1 rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500"
                          style={{ width: `${Math.min(100, (p.terjual / Math.max(data.produk_terlaris[0]?.terjual || 1, 1)) * 100)}%` }}
                        />
                      </div>
                    </div>
                    <b className="text-sm text-emerald-700 whitespace-nowrap">{rupiah(p.uang_masuk)}</b>
                  </div>
                ))}
              </div>
            </Card>

            {/* Pengeluaran per kategori */}
            <Card>
              <h2 className="font-extrabold flex items-center gap-1.5">
                <Banknote size={17} className="text-rose-500" /> Pengeluaran per kategori
              </h2>
              <div className="mt-3 space-y-2">
                {(data.pengeluaran_per_kategori || []).length === 0 && (
                  <p className="text-sm text-slate-500">Belum ada pengeluaran di periode ini. Catat di menu Pengeluaran.</p>
                )}
                {(data.pengeluaran_per_kategori || []).map((k) => (
                  <div key={k.kategori} className="rounded-xl bg-slate-50 border border-slate-200/70 px-3 py-2.5">
                    <div className="flex items-center justify-between text-sm">
                      <b>{k.kategori}</b>
                      <span className="text-rose-600 font-extrabold">{rupiah(k.total)}</span>
                    </div>
                    <div className="h-1.5 mt-1.5 rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-rose-400 to-orange-500"
                        style={{ width: `${Math.min(100, (k.total / maksKategori) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Per pegawai */}
          <Card>
            <h2 className="font-extrabold flex items-center gap-1.5">
              <Users size={17} className="text-slate-600" /> Jualan per pegawai
            </h2>
            {(data.per_kasir || []).length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">Belum ada transaksi di periode ini.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-slate-400 border-b border-slate-200">
                      <th className="py-2 pr-3 font-bold">Pegawai</th>
                      <th className="py-2 pr-3 font-bold text-right">Struk</th>
                      <th className="py-2 font-bold text-right">Uang Masuk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.per_kasir.map((k) => (
                      <tr key={k.kasir} className="border-b border-slate-100 last:border-0">
                        <td className="py-2.5 pr-3 font-bold">{k.kasir}</td>
                        <td className="py-2.5 pr-3 text-right text-slate-600">{k.jumlah_struk}x</td>
                        <td className="py-2.5 text-right font-extrabold text-emerald-700">{rupiah(k.uang_masuk)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Kirim rekap via WA */}
          <Card className="space-y-2.5 border-emerald-200">
            <h2 className="font-extrabold flex items-center gap-2">
              <Send size={17} className="text-emerald-600" /> Kirim rekap periode via WhatsApp
            </h2>
            <p className="text-sm text-slate-600">
              Ringkasan {data.dari} s/d {data.sampai}: {rupiah(data.uang_masuk_tunai)} masuk, untung bersih {rupiah(data.untung_bersih)} — siap dibaca tanpa buka aplikasi.
            </p>
            {waBuka && !pengaturan.noWaPemilik ? (
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  className="input-besar flex-1"
                  placeholder="No. WA pemilik (08...)"
                  inputMode="tel"
                  value={waNomor}
                  onChange={(e) => setWaNomor(e.target.value)}
                />
                <motion.button whileTap={{ scale: 0.97 }} onClick={kirimRekap} className="btn-primer min-h-[48px]">
                  <Send size={16} /> Kirim Rekap
                </motion.button>
              </div>
            ) : (
              <motion.button whileTap={{ scale: 0.97 }} onClick={kirimRekap} className="btn-primer w-full sm:w-auto min-h-[48px]">
                <Send size={16} /> Kirim Rekap via WhatsApp
              </motion.button>
            )}
            {pengaturan.noWaPemilik ? (
              <p className="text-xs text-slate-400">Terkirim ke {pengaturan.noWaPemilik} — ubah nomor di menu Pengaturan.</p>
            ) : null}
          </Card>
        </>
      ) : null}
    </Wadah>
  );
}
