import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ShoppingCart, Search, Trash2, Minus, Plus, CheckCircle2, ReceiptText, Printer, ExternalLink, Wallet, NotebookPen, QrCode, ArrowLeftRight, Smartphone, WifiOff, RefreshCw, AlertTriangle } from 'lucide-react';
import api, { rupiah } from '../api/client';
// Kamera (html5-qrcode) cukup berat — lazy-load agar bundle awal ringan.
const BarcodeInput = lazy(() => import('../components/BarcodeInput'));
import ProductCard from '../components/ProductCard';
import ChangeCalculator from '../components/ChangeCalculator';
import StrukPrint from '../components/StrukPrint';
import Konfirmasi from '../components/Konfirmasi';
import { urutkanKategori } from '../data/kategori';
import { METODE_BAYAR, labelMetode, nonTunai as isNonTunai } from '../data/metodeBayar';
import { Card, PageHeader, EmptyState, Notice, Wadah } from '../components/ui';
import { usePengaturan } from '../context/PengaturanContext';
import { cn } from '../components/cn';
import {
  simpanProduk,
  produkCache,
  waktuCacheProduk,
  bacaAntrean,
  tambahAntrean,
  hapusAntrean,
  tandaiGagal,
  tandaiAntri,
} from '../utils/offline';

const IKON_METODE = {
  tunai: Wallet,
  qris: QrCode,
  transfer: ArrowLeftRight,
  ewallet: Smartphone,
  kasbon: NotebookPen,
};

export default function Kasir() {
  const { pengaturan } = usePengaturan();
  const [produk, setProduk] = useState([]);
  const [cari, setCari] = useState('');
  const [keranjang, setKeranjang] = useState([]); // {id, nama, harga_jual, qty}
  const [diterima, setDiterima] = useState(0);
  const [bayarVia, setBayarVia] = useState('tunai'); // tunai | qris | transfer | ewallet | kasbon
  const [referensi, setReferensi] = useState('');
  const [kasbonForm, setKasbonForm] = useState({ nama_tetangga: '', no_wa: '', jatuh_tempo: '' });
  const [pesan, setPesan] = useState('');
  const [gagal, setGagal] = useState('');
  const [memuat, setMemuat] = useState(true);
  const [strukTerakhir, setStrukTerakhir] = useState(null);
  const [kategori, setKategori] = useState('Semua');
  const [konfirm, setKonfirm] = useState(null); // {mode:'kosongkan'} | {mode:'hapus', item}
  const [offline, setOffline] = useState(typeof navigator !== 'undefined' && !navigator.onLine);
  const [antrean, setAntrean] = useState([]);
  const [sinkronProses, setSinkronProses] = useState(false);
  const sinkronRef = useRef(false);

  async function muat(q = cari) {
    setMemuat(true);
    try {
      const { data } = await api.get('/api/products', { params: { q } });
      setProduk(data);
      if (!q) simpanProduk(data);
      setOffline(false);
    } catch {
      const kata = String(q || '').toLowerCase();
      const cache = produkCache();
      const hasil = kata
        ? cache.filter(
            (p) =>
              String(p.nama || '').toLowerCase().includes(kata) ||
              String(p.barcode || '').includes(kata)
          )
        : cache;
      if (hasil.length) {
        setProduk(hasil);
        setOffline(true);
        setGagal('');
      } else {
        setGagal('Gagal memuat barang. Coba lagi ya.');
      }
    } finally {
      setMemuat(false);
    }
  }

  async function sinkron() {
    if (sinkronRef.current) return;
    const antri = bacaAntrean().filter((x) => x.status === 'antri');
    if (!antri.length) return;
    sinkronRef.current = true;
    setSinkronProses(true);
    let berhasil = 0;
    for (const item of antri) {
      try {
        await api.post('/api/sales', item.payload);
        hapusAntrean(item.client_id);
        berhasil += 1;
      } catch (e) {
        if (!e.response) break;
        tandaiGagal(item.client_id, e.response.data?.pesan || 'Ditolak server.');
      }
    }
    setAntrean(bacaAntrean());
    sinkronRef.current = false;
    setSinkronProses(false);
    if (berhasil) {
      setPesan(`${berhasil} transaksi offline berhasil disinkronkan.`);
      setGagal('');
      muat('');
    }
  }

  useEffect(() => {
    muat('');
    setAntrean(bacaAntrean());
    function online() {
      setOffline(false);
      sinkron();
    }
    function offlineMode() {
      setOffline(true);
      setPesan('Koneksi putus — kasir tetap jalan, transaksi disimpan di perangkat.');
    }
    function antreanBerubah() {
      setAntrean(bacaAntrean());
    }
    window.addEventListener('online', online);
    window.addEventListener('offline', offlineMode);
    window.addEventListener('wq-antrean', antreanBerubah);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offlineMode);
      window.removeEventListener('wq-antrean', antreanBerubah);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bersihkan penanda mode-cetak setiap selesai print (tombol back / tutup dialog).
  useEffect(() => {
    function bersih() {
      document.body.classList.remove('mau-cetak-struk');
    }
    window.addEventListener('afterprint', bersih);
    return () => window.removeEventListener('afterprint', bersih);
  }, []);

  function tambah(barang, qty = 1) {
    setStrukTerakhir(null);
    setPesan('');
    setGagal('');
    setKeranjang((k) => {
      const ada = k.find((x) => x.id === barang.id);
      if (ada) return k.map((x) => (x.id === barang.id ? { ...x, qty: x.qty + qty } : x));
      return [...k, { id: barang.id, nama: barang.nama, harga_jual: barang.harga_jual, qty }];
    });
  }

  async function tambahViaBarcode(kode) {
    try {
      const { data } = await api.get('/api/products', { params: { q: kode } });
      const pas = data.find((d) => d.barcode === kode) || data[0];
      if (!pas) {
        setGagal(`Barcode ${kode} tidak ketemu.`);
        return;
      }
      tambah(pas);
      setPesan(`"${pas.nama}" masuk keranjang.`);
    } catch {
      const pas = produkCache().find((d) => String(d.barcode || '') === String(kode));
      if (pas) {
        tambah(pas);
        setPesan(`"${pas.nama}" masuk keranjang (mode offline).`);
      } else {
        setGagal('Gagal mencari barang.');
      }
    }
  }

  const total = useMemo(() => keranjang.reduce((s, x) => s + x.harga_jual * x.qty, 0), [keranjang]);
  const jumlahItem = useMemo(() => keranjang.reduce((s, x) => s + x.qty, 0), [keranjang]);
  const kasbonSiap =
    bayarVia === 'kasbon' &&
    kasbonForm.nama_tetangga.trim() !== '' &&
    kasbonForm.no_wa.replace(/\D/g, '').length >= 10;
  const nonTunai = isNonTunai(bayarVia);
  const bisaBayar =
    keranjang.length > 0 &&
    (bayarVia === 'kasbon' ? kasbonSiap : bayarVia === 'tunai' ? diterima >= total : true);

  // Filter kategori cepat: Semua + kategori yang dipakai toko.
  const daftarKategori = useMemo(
    () => ['Semua', ...urutkanKategori(produk.map((p) => p.kategori))],
    [produk]
  );
  const produkTampil = useMemo(
    () => (kategori === 'Semua' ? produk : produk.filter((p) => (p.kategori || 'Lainnya') === kategori)),
    [produk, kategori]
  );

  // Void confirmation: batalkan seluruh keranjang / hapus satu item.
  function jalankanKonfirm() {
    if (!konfirm) return;
    if (konfirm.mode === 'kosongkan') setKeranjang([]);
    if (konfirm.mode === 'hapus') {
      setKeranjang((arr) => arr.filter((x) => x.id !== konfirm.item.id));
    }
    setKonfirm(null);
  }

  function bersihkanKeranjang() {
    setKeranjang([]);
    setDiterima(0);
    setReferensi('');
    if (bayarVia === 'kasbon') setKasbonForm({ nama_tetangga: '', no_wa: '', jatuh_tempo: '' });
  }

  function simpanOffline(payload) {
    const item = tambahAntrean(payload, {
      total,
      jumlah_item: jumlahItem,
      metode: bayarVia,
      kasbon_nama: bayarVia === 'kasbon' ? kasbonForm.nama_tetangga : '',
    });
    setAntrean(bacaAntrean());
    setPesan(
      `Koneksi putus — transaksi ${item.kode_lokal} disimpan di perangkat dan dikirim otomatis saat online.`
    );
    setGagal('');
    bersihkanKeranjang();
    return item;
  }

  async function bayar() {
    setPesan('');
    setGagal('');
    const pakaiKasbon = bayarVia === 'kasbon';
    const pakaiNonTunai = isNonTunai(bayarVia);
    const payload = {
      items: keranjang.map((k) => ({ id: k.id, qty: k.qty })),
      uang_diterima: bayarVia === 'tunai' ? diterima : pakaiNonTunai ? total : 0,
      dibayar_via: bayarVia,
      referensi_bayar: pakaiNonTunai ? referensi : '',
      ...(pakaiKasbon
        ? {
            kasbon: {
              nama_tetangga: kasbonForm.nama_tetangga,
              no_wa: kasbonForm.no_wa,
              jatuh_tempo: kasbonForm.jatuh_tempo || null,
            },
          }
        : {}),
    };
    if (!navigator.onLine) {
      simpanOffline(payload);
      return;
    }
    try {
      const { data } = await api.post('/api/sales', payload);
      setPesan(data.pesan || 'Jualan tersimpan!');
      setStrukTerakhir({
        saleId: data.id || null,
        kode: data.kode_struk || null,
        items: [...keranjang],
        total,
        diterima: bayarVia === 'tunai' ? diterima : pakaiNonTunai ? total : 0,
        kembalian: pakaiKasbon || pakaiNonTunai ? 0 : (data.kembalian ?? diterima - total),
        dibayar_via: bayarVia,
        referensi: pakaiNonTunai ? referensi : '',
        kasbon_nama: pakaiKasbon ? kasbonForm.nama_tetangga : null,
        tanggal: new Date().toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }),
      });
      bersihkanKeranjang();
      muat('');
    } catch (e) {
      if (!e.response) {
        simpanOffline(payload);
        return;
      }
      setGagal(e.response?.data?.pesan || 'Gagal menyimpan. Cek stok & uang diterima ya.');
    }
  }

  function cetakStruk() {
    if (!strukTerakhir) return;
    // Tandai mode cetak struk agar CSS @media print hanya memunculkan
    // #cetak-struk 58mm — dashboard & elemen lain disembunyikan.
    document.body.classList.remove('mau-cetak-label');
    document.body.classList.add('mau-cetak-struk');
    setTimeout(() => {
      window.print();
      // Cadangan bila event afterprint tidak jalan di sebagian browser.
      setTimeout(() => document.body.classList.remove('mau-cetak-struk'), 600);
    }, 60);
  }

  return (
    <Wadah maks="max-w-[1200px]">
      <PageHeader
        title="Kasir Cepat"
        subtitle="Scan barcode, klik produk, hitung kembalian instan."
        icon={<ShoppingCart size={22} />}
        action={
          <span className="badge bg-emerald-50 text-emerald-700 border border-emerald-200">
            <ReceiptText size={14} /> {jumlahItem} item • {rupiah(total)}
          </span>
        }
      />

      <Notice tone="success">{pesan}</Notice>
      {gagal && <Notice tone="error">{gagal}</Notice>}

      {(offline || antrean.length > 0) && (
        <Card className={cn('space-y-2', antrean.some((a) => a.status === 'gagal') ? 'border-rose-200' : 'border-amber-200')}>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-extrabold flex items-center gap-2 text-sm">
              {offline ? <WifiOff size={17} className="text-amber-600" /> : <RefreshCw size={17} className="text-amber-600" />}
              {offline ? 'Mode offline — transaksi disimpan di perangkat' : 'Antrean transaksi offline'}
            </h2>
            <span className="badge bg-amber-50 text-amber-800 border border-amber-200">{antrean.length} antre</span>
            {!offline && antrean.some((a) => a.status === 'antri') && (
              <button
                onClick={sinkron}
                disabled={sinkronProses}
                className="btn-lembut ml-auto py-1.5 px-3 text-xs disabled:opacity-50"
              >
                <RefreshCw size={14} className={sinkronProses ? 'animate-spin' : ''} /> Sinkronkan
              </button>
            )}
          </div>
          {offline && (
            <p className="text-xs text-slate-500">
              Katalog terakhir: {waktuCacheProduk() ? new Date(waktuCacheProduk()).toLocaleString('id-ID') : 'belum tersimpan'}.
              Stok & harga mengikuti cache; transaksi dikirim saat koneksi pulih.
            </p>
          )}
          {antrean.length > 0 && (
            <div className="space-y-1.5">
              {antrean.map((a) => (
                <div key={a.client_id} className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 border border-slate-200 px-2.5 py-1.5 text-xs">
                  <b className="font-mono">{a.kode_lokal}</b>
                  <span className="text-slate-500">{a.meta?.jumlah_item || 0} item • {rupiah(a.meta?.total || 0)}</span>
                  {a.meta?.metode && <span className="badge bg-slate-100 text-slate-600 border-slate-200">{labelMetode(a.meta.metode)}</span>}
                  {a.status === 'gagal' ? (
                    <span className="text-rose-600 font-semibold flex items-center gap-1">
                      <AlertTriangle size={12} /> {a.error || 'Ditolak server'}
                    </span>
                  ) : (
                    <span className="text-amber-700 font-semibold">menunggu koneksi</span>
                  )}
                  <div className="ml-auto flex gap-1">
                    {a.status === 'gagal' && (
                      <button
                        onClick={() => { tandaiAntri(a.client_id); sinkron(); }}
                        className="rounded-lg px-2 py-1 font-bold text-emerald-700 hover:bg-emerald-50"
                      >
                        Coba lagi
                      </button>
                    )}
                    <button
                      onClick={() => { hapusAntrean(a.client_id); setAntrean(bacaAntrean()); }}
                      className="rounded-lg px-2 py-1 font-bold text-rose-600 hover:bg-rose-50"
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <div className="grid lg:grid-cols-3 gap-4 items-start">
        {/* Kiri: scan + grid produk */}
        <div className="lg:col-span-2 space-y-3">
          <Suspense fallback={<div className="card p-4 animate-pulse h-32" />}>
            <BarcodeInput onHasil={tambahViaBarcode} />
          </Suspense>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="input-besar pl-10"
                placeholder="Cari nama barang..."
                value={cari}
                onChange={(e) => setCari(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && muat()}
              />
            </div>
            <motion.button whileTap={{ scale: 0.95 }} className="btn-gelap min-h-[48px] px-5" onClick={() => muat()}>
              Cari
            </motion.button>
          </div>

          {/* Filter kategori cepat */}
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-0.5 px-0.5">
            {daftarKategori.map((k) => (
              <button
                key={k}
                onClick={() => setKategori(k)}
                className={cn(
                  'px-3.5 py-2.5 rounded-xl text-sm font-bold border whitespace-nowrap transition active:scale-95',
                  kategori === k
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                )}
              >
                {k}
              </button>
            ))}
          </div>

          {memuat ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="card p-3 space-y-2">
                  <div className="animate-pulse h-20 rounded-xl bg-slate-200" />
                  <div className="animate-pulse h-4 rounded bg-slate-200" />
                  <div className="animate-pulse h-9 rounded-xl bg-slate-200" />
                </div>
              ))}
            </div>
          ) : produk.length === 0 ? (
            <EmptyState
              icon={<Search size={36} />}
              title="Barang tidak ketemu"
              subtitle="Coba kata kunci lain, atau tambah barang baru lewat menu Stok."
            />
          ) : produkTampil.length === 0 ? (
            <EmptyState
              icon={<Search size={36} />}
              title={`Tidak ada barang ${kategori}`}
              subtitle="Pilih kategori lain atau ubah kata kunci pencarian."
            />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
              {produkTampil.slice(0, 24).map((b, i) => (
                <ProductCard key={b.id} barang={b} onTambah={tambah} index={i} />
              ))}
            </div>
          )}
        </div>

        {/* Kanan: keranjang sticky */}
        <Card className="lg:sticky lg:top-24 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-extrabold text-base flex items-center gap-2">
              <ShoppingCart size={18} className="text-emerald-600" />
              Keranjang ({keranjang.length})
            </h2>
            {keranjang.length > 0 && (
              <button onClick={() => setKonfirm({ mode: 'kosongkan' })} className="text-xs font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1 transition">
                <Trash2 size={13} /> Kosongkan
              </button>
            )}
          </div>

          {keranjang.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
              <p className="font-bold text-slate-700">Keranjang masih kosong</p>
              <p className="text-[13px] text-slate-500 mt-0.5">Klik <b>+ Keranjang</b> pada produk untuk mulai jualan.</p>
            </div>
          ) : (
            <>
              <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-0.5">
                <AnimatePresence initial={false}>
                  {keranjang.map((k) => (
                    <motion.div
                      key={k.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: 24 }}
                      className="flex items-center gap-2 rounded-xl bg-slate-50 border border-slate-200/70 px-2.5 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold text-sm">{k.nama}</p>
                        <p className="text-xs text-slate-500 font-semibold">{rupiah(k.harga_jual)} × {k.qty} = <b className="text-slate-800">{rupiah(k.harga_jual * k.qty)}</b></p>
                      </div>
                      <div className="flex items-center gap-1">
                        <QtyBtn onClick={() => setKeranjang((arr) => arr.map((x) => x.id === k.id ? { ...x, qty: Math.max(1, x.qty - 1) } : x))}><Minus size={14} strokeWidth={3} /></QtyBtn>
                        <span className="w-6 text-center font-extrabold text-sm">{k.qty}</span>
                        <QtyBtn onClick={() => setKeranjang((arr) => arr.map((x) => x.id === k.id ? { ...x, qty: x.qty + 1 } : x))}><Plus size={14} strokeWidth={3} /></QtyBtn>
                        <button
                          className="ml-0.5 h-8 w-8 inline-flex items-center justify-center rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition active:scale-90"
                          onClick={() => setKonfirm({ mode: 'hapus', item: k })}
                          title="Hapus"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* Pilihan bayar: tunai, non-tunai (QRIS/transfer/e-wallet), atau kasbon */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 rounded-2xl bg-slate-100 p-1.5">
                {METODE_BAYAR.map((m) => {
                  const Ikon = IKON_METODE[m.id];
                  const aktif = bayarVia === m.id;
                  const warna =
                    m.id === 'kasbon'
                      ? 'bg-amber-500 text-white shadow-sm'
                      : m.id === 'tunai'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-sky-600 text-white shadow-sm';
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setBayarVia(m.id)}
                      className={cn(
                        'flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-extrabold transition active:scale-95',
                        aktif ? warna : 'text-slate-600 hover:bg-white'
                      )}
                    >
                      <Ikon size={15} /> {m.label}
                    </button>
                  );
                })}
              </div>

              {bayarVia === 'tunai' ? (
                <ChangeCalculator total={total} diterima={diterima} setDiterima={setDiterima} />
              ) : nonTunai ? (
                <div className="space-y-2 rounded-2xl border border-sky-200 bg-sky-50/60 p-3">
                  <p className="text-[13px] font-bold text-sky-900">
                    Dibayar {labelMetode(bayarVia)} — dianggap lunas {rupiah(total)}. Uangnya tetap masuk laporan sebagai non-tunai.
                  </p>
                  <input
                    className="input-besar"
                    placeholder="Referensi (opsional, mis. 4 digit akhir / no. transaksi)"
                    value={referensi}
                    onChange={(e) => setReferensi(e.target.value)}
                    maxLength={120}
                  />
                </div>
              ) : (
                <div className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50/60 p-3">
                  <p className="text-[13px] font-bold text-amber-900">
                    Jual kasbon — utang dicatat otomatis, ditagih nanti lewat menu Kasbon.
                  </p>
                  <input
                    className="input-besar"
                    placeholder="Nama tetangga"
                    value={kasbonForm.nama_tetangga}
                    onChange={(e) => setKasbonForm({ ...kasbonForm, nama_tetangga: e.target.value })}
                  />
                  <input
                    className="input-besar"
                    placeholder="No. WA (08...)"
                    inputMode="tel"
                    value={kasbonForm.no_wa}
                    onChange={(e) => setKasbonForm({ ...kasbonForm, no_wa: e.target.value })}
                  />
                  <div>
                    <label className="label">Janji bayar (boleh dikosongkan)</label>
                    <input
                      className="input-besar mt-1 w-full"
                      type="date"
                      value={kasbonForm.jatuh_tempo}
                      onChange={(e) => setKasbonForm({ ...kasbonForm, jatuh_tempo: e.target.value })}
                    />
                  </div>
                </div>
              )}

              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  'btn-besar w-full text-white shadow-sm',
                  bisaBayar
                    ? bayarVia === 'kasbon'
                      ? 'bg-amber-500 hover:bg-amber-600'
                      : bayarVia === 'tunai'
                        ? 'bg-emerald-600 hover:bg-emerald-700'
                        : 'bg-sky-600 hover:bg-sky-700'
                    : 'bg-slate-300'
                )}
                onClick={bayar}
                disabled={!bisaBayar}
              >
                {bayarVia === 'kasbon' ? (
                  <><NotebookPen size={19} /> Simpan Kasbon {rupiah(total)}</>
                ) : bayarVia === 'tunai' ? (
                  <><CheckCircle2 size={19} /> Bayar {rupiah(total)}</>
                ) : (
                  <><QrCode size={19} /> Simpan {labelMetode(bayarVia)} {rupiah(total)}</>
                )}
              </motion.button>
            </>
          )}

          {/* Struk terakhir */}
          {strukTerakhir && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-slate-200 bg-white p-3.5 text-sm">
              <p className="font-extrabold text-center">{pengaturan.strukHeader || pengaturan.namaToko || 'Struk Belanja'}</p>
              <div className="my-2 border-t border-dashed border-slate-300" />
              {strukTerakhir.items.map((it) => (
                <div key={it.id} className="flex justify-between py-0.5">
                  <span>{it.nama} × {it.qty}</span>
                  <b>{rupiah(it.harga_jual * it.qty)}</b>
                </div>
              ))}
              <div className="my-2 border-t border-dashed border-slate-300" />
              <div className="flex justify-between font-bold"><span>Total</span><span>{rupiah(strukTerakhir.total)}</span></div>
              {strukTerakhir.dibayar_via === 'kasbon' ? (
                <div className="flex justify-between font-extrabold text-amber-700">
                  <span>Bayar</span>
                  <span>KASBON{strukTerakhir.kasbon_nama ? ` — ${strukTerakhir.kasbon_nama}` : ''}</span>
                </div>
              ) : isNonTunai(strukTerakhir.dibayar_via) ? (
                <div className="flex justify-between font-extrabold text-sky-700">
                  <span>Bayar</span>
                  <span>{labelMetode(strukTerakhir.dibayar_via)}</span>
                </div>
              ) : (
                <>
                  <div className="flex justify-between"><span>Diterima</span><span>{rupiah(strukTerakhir.diterima)}</span></div>
                  <div className="flex justify-between font-extrabold text-emerald-700"><span>Kembali</span><span>{rupiah(strukTerakhir.kembalian)}</span></div>
                </>
              )}
              {strukTerakhir.referensi ? (
                <div className="flex justify-between text-xs text-slate-500"><span>Ref</span><span>{strukTerakhir.referensi}</span></div>
              ) : null}
              <p className="text-center text-xs text-slate-500 mt-2">{pengaturan.strukFooter}</p>
              <button onClick={cetakStruk} className="btn-lembut w-full mt-2"><Printer size={16} /> Cetak 58mm</button>
              {strukTerakhir.saleId && (
                <Link
                  to={`/struk/${strukTerakhir.saleId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-besar w-full mt-2 bg-slate-900 text-white hover:bg-slate-700"
                >
                  <ExternalLink size={16} /> Buka halaman struk
                </Link>
              )}
            </motion.div>
          )}
        </Card>
      </div>

      {/* Layout cetak khusus 58mm — tersembunyi di layar, hanya keluar saat print.
          Berisi: Nama Warung, Daftar Belanja, Total, Bayar, Kembalian, terima kasih. */}
      <StrukPrint
        data={strukTerakhir}
        namaToko={pengaturan.namaToko}
        header={pengaturan.strukHeader}
        footer={pengaturan.strukFooter}
      />

      {/* Void confirmation: batalkan keranjang / hapus item */}
      <Konfirmasi
        terbuka={!!konfirm}
        judul={konfirm?.mode === 'hapus' ? 'Hapus barang ini?' : 'Batalkan belanja ini?'}
        pesan={
          konfirm?.mode === 'hapus'
            ? `"${konfirm.item?.nama || ''}" akan keluar dari keranjang. Bisa dimasukkan lagi kapan saja.`
            : `Seluruh ${jumlahItem} barang di keranjang akan dibatalkan. Uang yang sudah dihitung ikut terhapus.`
        }
        teksYa={konfirm?.mode === 'hapus' ? 'Ya, hapus' : 'Ya, batalkan'}
        onYa={jalankanKonfirm}
        onTutup={() => setKonfirm(null)}
      />
    </Wadah>
  );
}

function QtyBtn({ children, onClick }) {
  return (
    <button onClick={onClick} className="h-8 w-8 inline-flex items-center justify-center rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 transition active:scale-90">
      {children}
    </button>
  );
}
