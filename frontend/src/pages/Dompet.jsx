import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Wallet,
  TrendingUp,
  ReceiptText,
  Crown,
  CalendarDays,
  HandCoins,
  RefreshCw,
  AlarmClock,
  Send,
} from 'lucide-react';
import api, { rupiah } from '../api/client';
import { Card, PageHeader, StatusBadge, Skeleton, Wadah } from '../components/ui';
import MiniChart from '../components/MiniChart';
import { usePengaturan } from '../context/PengaturanContext';
import { linkWA, drafRekapHarian } from '../utils/wa';

// Dompet Harian — ringkasan Owner: metrik gradasi + status keuangan + grafik sederhana.
export default function Dompet() {
  const { pengaturan, ubah } = usePengaturan();
  const [data, setData] = useState(null);
  const [tanggal, setTanggal] = useState(new Date().toISOString().slice(0, 10));
  const [memuat, setMemuat] = useState(true);
  const [gagal, setGagal] = useState('');
  const [waBuka, setWaBuka] = useState(false);
  const [waNomor, setWaNomor] = useState('');

  async function muat() {
    setMemuat(true);
    setGagal('');
    try {
      const { data } = await api.get('/api/reports/harian', { params: { tanggal } });
      setData(data);
    } catch (e) {
      setGagal(e.response?.data?.pesan || 'Gagal memuat dompet. Coba lagi ya.');
    } finally {
      setMemuat(false);
    }
  }

  useEffect(() => {
    muat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tanggal]);

  const statusKeuangan = useMemo(() => {
    if (!data) return null;
    const untung = Number(data.perkiraan_untung_bersih || 0);
    const masuk = Number(data.uang_masuk || 0);
    if (masuk === 0) return { label: 'Belum ada jualan', tone: 'slate', saran: 'Mulai jualan lewat menu Kasir ya.' };
    if (untung <= 0) return { label: 'Perlu hemat modal', tone: 'amber', saran: 'Untung tipis — cek Modal Beli di Stok.' };
    if (untung / Math.max(masuk, 1) < 0.1) return { label: 'Cukup stabil', tone: 'sky', saran: 'Jualan jalan, untung masih bisa ditebalkan.' };
    return { label: 'Warung sehat', tone: 'emerald', saran: 'Pertahankan! Untung bersih di atas 10%.' };
  }, [data]);

  const tempo = data?.utang_jatuh_tempo || { jumlah: 0, total_sisa: 0 };

  function kirimRekap() {
    if (!data) return;
    const nomor = (pengaturan.noWaPemilik || waNomor).trim();
    if (!nomor) {
      setWaBuka(true);
      return;
    }
    if (!pengaturan.noWaPemilik && waNomor.trim()) ubah({ noWaPemilik: waNomor.trim() });
    const pesan = drafRekapHarian({
      toko: pengaturan.namaToko || 'Warung Saya',
      tanggal: data.tanggal,
      uangMasuk: data.uang_masuk,
      untung: data.perkiraan_untung_bersih,
      struk: data.jumlah_struk,
      kasbonAktif: data.utang_tetangga_aktif,
      kasbonTempo: tempo,
    });
    window.open(linkWA(nomor, pesan), '_blank');
  }

  return (
    <Wadah maks="max-w-[1100px]">
      <PageHeader
        title="Dompet Harian"
        subtitle="Ringkasan uang masuk, untung, dan barang laris — bahasa warung, rapi dibaca."
        icon={<LayoutDashboard size={22} />}
        action={
          <>
            <div className="relative">
              <CalendarDays size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="input pl-9 w-[170px]" type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
            </div>
            <motion.button whileTap={{ scale: 0.94 }} onClick={muat} className="btn-lembut" title="Muat ulang">
              <RefreshCw size={16} className={memuat ? 'animate-spin' : ''} />
            </motion.button>
          </>
        }
      />

      {gagal && <p className="rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-bold px-4 py-3">{gagal}</p>}

      {memuat && !data ? (
        <div className="grid sm:grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : data ? (
        <>
          {/* Kartu metrik gradasi */}
          <div className="grid sm:grid-cols-3 gap-3">
            <motion.div whileHover={{ y: -3 }} className="rounded-2xl p-5 text-white bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 shadow-card border border-emerald-400/30">
              <p className="flex items-center gap-1.5 text-[13px] font-semibold text-emerald-100"><Wallet size={15} /> Uang Masuk Hari Ini</p>
              <p className="mt-1 text-3xl font-extrabold tracking-tight">{rupiah(data.uang_masuk)}</p>
              <p className="mt-1 text-[13px] text-emerald-100 flex items-center gap-1.5"><ReceiptText size={14} /> dari {data.jumlah_struk} struk belanja</p>
            </motion.div>

            <motion.div whileHover={{ y: -3 }} className="rounded-2xl p-5 bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 text-white shadow-card border border-white/10">
              <p className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-300"><TrendingUp size={15} /> Perkiraan Untung Bersih</p>
              <p className="mt-1 text-3xl font-extrabold tracking-tight text-emerald-300">{rupiah(data.perkiraan_untung_bersih)}</p>
              <p className="mt-1 text-[13px] text-slate-400">Uang masuk dikurangi modal beli.</p>
            </motion.div>

            <motion.div whileHover={{ y: -3 }} className="rounded-2xl p-5 bg-gradient-to-br from-amber-400 via-amber-500 to-orange-500 text-slate-900 shadow-card border border-amber-300/60">
              <p className="flex items-center gap-1.5 text-[13px] font-bold text-amber-950/70"><HandCoins size={15} /> Utang Tetangga Aktif</p>
              <p className="mt-1 text-3xl font-extrabold tracking-tight">{rupiah(data.utang_tetangga_aktif)}</p>
              <p className="mt-1 text-[13px] font-medium text-amber-950/70">Masih di luar — ingatkan via WA di menu Kasbon.</p>
            </motion.div>
          </div>

          {/* Status keuangan */}
          {statusKeuangan && (
            <Card className="flex flex-wrap items-center gap-3">
              <StatusBadge tone={statusKeuangan.tone} dot>{statusKeuangan.label}</StatusBadge>
              <p className="text-sm text-slate-600">{statusKeuangan.saran}</p>
            </Card>
          )}

          {/* Peringatan jatuh tempo kasbon — badge merah dashboard */}
          {tempo.jumlah > 0 && (
            <Link to="/kasbon">
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl bg-rose-50 border border-rose-300 px-4 py-3 flex items-center gap-2.5 hover:bg-rose-100 transition active:scale-[0.99]"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-rose-500 text-white">
                  <AlarmClock size={20} />
                </span>
                <div className="min-w-0">
                  <p className="font-extrabold text-rose-700 text-sm">
                    {tempo.jumlah} kasbon lewat janji bayar • {rupiah(tempo.total_sisa)}
                  </p>
                  <p className="text-xs text-rose-600 font-medium">Ketuk untuk menagih via WhatsApp di menu Kasbon.</p>
                </div>
              </motion.div>
            </Link>
          )}

          <div className="grid lg:grid-cols-5 gap-3">
            {/* Grafik */}
            <Card className="lg:col-span-3">
              <div className="flex items-center justify-between mb-1">
                <h2 className="font-extrabold">Grafik barang laris</h2>
                <span className="text-xs font-semibold text-slate-400">Uang masuk per produk</span>
              </div>
              {data.produk_terlaris?.length ? (
                <MiniChart data={data.produk_terlaris} />
              ) : (
                <p className="text-sm text-slate-500 py-8 text-center">Belum ada jualan hari ini. Grafik muncul setelah ada transaksi.</p>
              )}
            </Card>

            {/* Terlaris */}
            <Card className="lg:col-span-2">
              <h2 className="font-extrabold flex items-center gap-1.5"><Crown size={17} className="text-amber-500" /> Paling laris hari ini</h2>              <div className="mt-3 space-y-2">
                {data.produk_terlaris?.length === 0 && (
                  <p className="text-sm text-slate-500">Belum ada jualan hari ini.</p>
                )}
                {data.produk_terlaris?.map((p, i) => (
                  <motion.div
                    key={p.nama}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center gap-3 rounded-xl bg-slate-50 border border-slate-200/70 px-3 py-2.5"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white text-sm font-extrabold">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold text-sm">{p.nama} <span className="text-slate-400 font-semibold">× {p.terjual}</span></p>
                      <div className="h-1.5 mt-1 rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500"
                          style={{ width: `${Math.min(100, (p.terjual / Math.max(data.produk_terlaris[0]?.terjual || 1, 1)) * 100)}%` }}
                        />
                      </div>
                    </div>
                    <b className="text-sm text-emerald-700 whitespace-nowrap">{rupiah(p.uang_masuk)}</b>
                  </motion.div>
                ))}
              </div>
            </Card>
          </div>

          {/* Kirim rekap harian via WhatsApp ke pemilik */}
          <Card className="space-y-2.5 border-emerald-200">
            <h2 className="font-extrabold flex items-center gap-2">
              <Send size={17} className="text-emerald-600" /> Rekap harian ke pemilik
            </h2>
            <p className="text-sm text-slate-600">
              Kirim ringkasan {data.tanggal} ({rupiah(data.uang_masuk)} masuk, {data.jumlah_struk} struk) via WhatsApp — siap dibaca tanpa buka aplikasi.
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
