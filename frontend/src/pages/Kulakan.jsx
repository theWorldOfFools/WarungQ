import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Truck,
  Plus,
  X,
  Trash2,
  RefreshCw,
  Wallet,
  CalendarDays,
  PackagePlus,
  Search,
  CheckCircle2,
} from 'lucide-react';
import api, { rupiah } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Card, PageHeader, EmptyState, Notice, StatusBadge, Wadah } from '../components/ui';
import { cn } from '../components/cn';

const fmt = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const hariIni = () => fmt(new Date());

function tanggalTeks(s) {
  const teks = String(s || '').slice(0, 10);
  const d = new Date(`${teks}T00:00:00`);
  if (Number.isNaN(d.getTime())) return String(s || '');
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

const STATUS = {
  belum: { label: 'Belum dibayar', tone: 'rose' },
  sebagian: { label: 'Dibayar sebagian', tone: 'amber' },
  lunas: { label: 'Lunas', tone: 'emerald' },
};

const itemKosong = () => ({ product_id: '', qty: '1', harga_beli: '' });

export default function Kulakan() {
  const { pengguna } = useAuth();
  const bisaBayar = pengguna?.peran === 'owner';

  const [daftar, setDaftar] = useState([]);
  const [ringkasan, setRingkasan] = useState({ total_hutang: 0, jumlah_belum_lunas: 0, jumlah_telat: 0 });
  const [suppliers, setSuppliers] = useState([]);
  const [produk, setProduk] = useState([]);
  const [cari, setCari] = useState('');
  const [status, setStatus] = useState('');
  const [memuat, setMemuat] = useState(true);
  const [pesan, setPesan] = useState('');
  const [gagal, setGagal] = useState('');

  const [tampilForm, setTampilForm] = useState(false);
  const [form, setForm] = useState({ supplier_id: '', tanggal: hariIni(), jatuh_tempo: '', catatan: '' });
  const [baris, setBaris] = useState([itemKosong()]);
  const [menyimpan, setMenyimpan] = useState(false);

  const [detail, setDetail] = useState(null);
  const [bayarTarget, setBayarTarget] = useState(null);
  const [jumlahBayar, setJumlahBayar] = useState('');
  const [menyimpanBayar, setMenyimpanBayar] = useState(false);

  async function muat() {
    setMemuat(true);
    setGagal('');
    try {
      const [d, r] = await Promise.all([
        api.get('/api/purchases', { params: { q: cari, status } }),
        api.get('/api/purchases/ringkasan'),
      ]);
      setDaftar(d.data);
      setRingkasan(r.data);
    } catch (e) {
      setGagal(e.response?.data?.pesan || 'Gagal memuat data kulakan.');
    } finally {
      setMemuat(false);
    }
  }

  useEffect(() => {
    muat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    let batal = false;
    (async () => {
      try {
        const [s, p] = await Promise.all([
          api.get('/api/suppliers'),
          api.get('/api/products'),
        ]);
        if (batal) return;
        setSuppliers(s.data);
        setProduk(p.data);
      } catch {
        // daftar pendukung boleh gagal diam-diam; error utama muncul saat simpan.
      }
    })();
    return () => {
      batal = true;
    };
  }, []);

  const totalForm = useMemo(
    () => baris.reduce((s, b) => s + Number(b.qty || 0) * Number(b.harga_beli || 0), 0),
    [baris]
  );

  function ubahBaris(i, patch) {
    setBaris((b) => b.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  }

  function pilihProduk(i, productId) {
    const p = produk.find((x) => x.id === productId);
    const harga = p?.modal_beli != null ? String(p.modal_beli) : '';
    ubahBaris(i, { product_id: productId, harga_beli: harga || baris[i]?.harga_beli || '' });
  }

  async function simpan(e) {
    e.preventDefault();
    setPesan('');
    setGagal('');
    if (!form.supplier_id) return setGagal('Pilih suplier dulu ya.');
    const items = baris
      .filter((b) => b.product_id)
      .map((b) => ({
        product_id: b.product_id,
        qty: Number(b.qty || 0),
        harga_beli: Number(b.harga_beli || 0),
      }));
    if (items.length === 0) return setGagal('Pilih minimal satu barang.');
    if (items.some((b) => !Number.isInteger(b.qty) || b.qty <= 0)) {
      return setGagal('Jumlah barang harus lebih dari 0.');
    }
    setMenyimpan(true);
    try {
      const { data } = await api.post('/api/purchases', {
        supplier_id: form.supplier_id,
        tanggal: form.tanggal || null,
        jatuh_tempo: form.jatuh_tempo || null,
        catatan: form.catatan,
        items,
        tambah_stok: true,
      });
      setPesan(data.pesan || 'Kulakan tersimpan.');
      setForm({ supplier_id: '', tanggal: hariIni(), jatuh_tempo: '', catatan: '' });
      setBaris([itemKosong()]);
      setTampilForm(false);
      muat();
    } catch (err) {
      setGagal(err.response?.data?.pesan || 'Gagal menyimpan kulakan.');
    } finally {
      setMenyimpan(false);
    }
  }

  async function bukaDetail(p) {
    try {
      const { data } = await api.get(`/api/purchases/${p.id}`);
      setDetail(data);
    } catch (err) {
      setGagal(err.response?.data?.pesan || 'Gagal membuka detail.');
    }
  }

  function bukaBayar(p) {
    setBayarTarget(p);
    setJumlahBayar(String(p.sisa_hutang));
    setGagal('');
    setPesan('');
  }

  async function bayar(e) {
    e.preventDefault();
    if (!bayarTarget) return;
    setMenyimpanBayar(true);
    setGagal('');
    try {
      const { data } = await api.post(`/api/purchases/${bayarTarget.id}/bayar`, {
        jumlah_bayar: Number(jumlahBayar || 0),
      });
      setPesan(data.pesan || 'Pembayaran tersimpan.');
      setBayarTarget(null);
      muat();
    } catch (err) {
      setGagal(err.response?.data?.pesan || 'Gagal menyimpan pembayaran.');
    } finally {
      setMenyimpanBayar(false);
    }
  }

  const adaItemValid = baris.some((b) => b.product_id);

  return (
    <Wadah maks="max-w-[1100px]">
      <PageHeader
        title="Kulakan & Hutang Suplier"
        subtitle="Catat belanja ke suplier, stok langsung masuk, sisa hutang terjaga."
        icon={<Truck size={22} />}
        action={
          <>
            <motion.button whileTap={{ scale: 0.94 }} onClick={muat} className="btn-lembut" title="Muat ulang">
              <RefreshCw size={16} className={memuat ? 'animate-spin' : ''} />
            </motion.button>
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => setTampilForm(!tampilForm)} className="btn-primer">
              {tampilForm ? <><X size={16} /> Tutup</> : <><Plus size={16} strokeWidth={3} /> Catat Kulakan</>}
            </motion.button>
          </>
        }
      />

      <Notice tone="success">{pesan}</Notice>
      {gagal && <Notice tone="error">{gagal}</Notice>}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        <div className="rounded-2xl p-4 text-white bg-gradient-to-br from-rose-500 to-orange-500 shadow-card">
          <p className="text-[11px] font-bold uppercase tracking-wide text-white/80">Total hutang suplier</p>
          <p className="text-2xl font-extrabold">{rupiah(ringkasan.total_hutang)}</p>
          <p className="text-[12px] text-white/80">{ringkasan.jumlah_belum_lunas} pembelian belum lunas</p>
        </div>
        <div className="rounded-2xl p-4 bg-amber-50 border border-amber-200 shadow-card">
          <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700">Lewat jatuh tempo</p>
          <p className="text-2xl font-extrabold text-amber-800">{ringkasan.jumlah_telat}</p>
          <p className="text-[12px] text-amber-700">Segera bayar agar langganan aman</p>
        </div>
        <Card className="col-span-2 sm:col-span-1 flex flex-col justify-center">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Kulakan tercatat</p>
          <p className="text-2xl font-extrabold">{daftar.length} <span className="text-sm font-semibold text-slate-500">pembelian</span></p>
          <p className="text-[12px] text-slate-500">Stok bertambah otomatis</p>
        </Card>
      </div>

      {/* Form kulakan */}
      <AnimatePresence>
        {tampilForm && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={simpan}
            className="overflow-hidden"
          >
            <Card className="space-y-3 border-emerald-200">
              <h2 className="font-extrabold flex items-center gap-2">
                <PackagePlus size={18} className="text-emerald-600" /> Catat kulakan baru
              </h2>
              <div className="grid sm:grid-cols-2 gap-2">
                <div>
                  <label className="label">Suplier</label>
                  <select
                    className="input-besar mt-1 w-full"
                    value={form.supplier_id}
                    onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}
                    required
                  >
                    <option value="">— pilih suplier —</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.nama}</option>
                    ))}
                  </select>
                </div>
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
                  <label className="label">Jatuh tempo (boleh kosong)</label>
                  <input
                    className="input-besar mt-1 w-full"
                    type="date"
                    value={form.jatuh_tempo}
                    onChange={(e) => setForm({ ...form, jatuh_tempo: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Catatan (boleh kosong)</label>
                  <input
                    className="input-besar mt-1 w-full"
                    placeholder="mis. kulakan mingguan"
                    maxLength={200}
                    value={form.catatan}
                    onChange={(e) => setForm({ ...form, catatan: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="label mb-0">Barang yang dibeli</p>
                  <button type="button" onClick={() => setBaris((b) => [...b, itemKosong()])} className="btn-lembut text-xs">
                    <Plus size={14} /> Tambah baris
                  </button>
                </div>
                {baris.map((b, i) => {
                  const sub = Number(b.qty || 0) * Number(b.harga_beli || 0);
                  return (
                    <div key={i} className="grid grid-cols-12 gap-1.5 items-end rounded-xl bg-slate-50 p-2">
                      <div className="col-span-12 sm:col-span-5">
                        <label className="label">Barang</label>
                        <select
                          className="input mt-1 w-full"
                          value={b.product_id}
                          onChange={(e) => pilihProduk(i, e.target.value)}
                        >
                          <option value="">— pilih barang —</option>
                          {produk.map((p) => (
                            <option key={p.id} value={p.id}>{p.nama}</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-3 sm:col-span-2">
                        <label className="label">Qty</label>
                        <input
                          className="input mt-1 w-full"
                          type="number"
                          min="1"
                          value={b.qty}
                          onChange={(e) => ubahBaris(i, { qty: e.target.value })}
                        />
                      </div>
                      <div className="col-span-5 sm:col-span-3">
                        <label className="label">Harga beli</label>
                        <input
                          className="input mt-1 w-full"
                          type="number"
                          min="0"
                          placeholder="Rp/pcs"
                          value={b.harga_beli}
                          onChange={(e) => ubahBaris(i, { harga_beli: e.target.value })}
                        />
                      </div>
                      <div className="col-span-3 sm:col-span-1 text-right">
                        <p className="text-[11px] text-slate-500">Subtotal</p>
                        <p className="text-sm font-bold">{rupiah(sub)}</p>
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <button
                          type="button"
                          onClick={() => setBaris((x) => (x.length === 1 ? [itemKosong()] : x.filter((_, j) => j !== i)))}
                          className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                          aria-label="Hapus baris"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2">
                <span className="text-sm font-bold text-emerald-800">Total belanja</span>
                <b className="text-lg text-emerald-700">{rupiah(totalForm)}</b>
              </div>
              <p className="text-xs text-slate-500">
                Stok barang otomatis bertambah. Hutang tercatat penuh sampai dibayar ke suplier.
              </p>
              <motion.button
                whileTap={{ scale: 0.98 }}
                disabled={menyimpan || !adaItemValid}
                className="btn-besar btn-primer w-full disabled:opacity-60"
              >
                {menyimpan ? 'Menyimpan...' : 'Simpan Kulakan'}
              </motion.button>
            </Card>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Filter */}
      <div className="flex flex-wrap items-center gap-1.5">
        {[
          { id: '', label: 'Semua' },
          { id: 'belum', label: 'Belum bayar' },
          { id: 'sebagian', label: 'Sebagian' },
          { id: 'lunas', label: 'Lunas' },
        ].map((s) => (
          <button
            key={s.id}
            onClick={() => setStatus(s.id)}
            className={cn(
              'px-3.5 py-2 rounded-xl text-sm font-bold border transition active:scale-95',
              status === s.id
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
            )}
          >
            {s.label}
          </button>
        ))}
        <form
          className="ml-auto flex items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            muat();
          }}
        >
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-9 w-[200px]"
              placeholder="Cari kode / suplier"
              value={cari}
              onChange={(e) => setCari(e.target.value)}
            />
          </div>
        </form>
      </div>

      {/* Daftar pembelian */}
      {memuat ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse h-20 rounded-2xl bg-white border border-slate-200" />
          ))}
        </div>
      ) : daftar.length === 0 ? (
        <EmptyState
          icon={<Truck size={36} />}
          title="Belum ada kulakan"
          subtitle="Catat pembelian ke suplier agar stok dan hutang tercatat rapi."
        />
      ) : (
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {daftar.map((p) => {
              const st = STATUS[p.status] || STATUS.belum;
              return (
                <motion.div key={p.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <Card className="card-hover p-3.5 space-y-2">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                        <Truck size={20} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold truncate">{p.supplier_nama}</p>
                          <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
                        </div>
                        <p className="text-xs text-slate-500 font-medium">
                          {p.kode_pembelian} • {tanggalTeks(p.tanggal)} • {p.jumlah_item} barang
                          {p.jatuh_tempo ? ` • tempo ${tanggalTeks(p.jatuh_tempo)}` : ''}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[11px] text-slate-500">Sisa hutang</p>
                        <b className={p.sisa_hutang > 0 ? 'text-rose-600' : 'text-emerald-600'}>{rupiah(p.sisa_hutang)}</b>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <span className="text-slate-500">Total {rupiah(p.total_beli)}</span>
                      <span className="text-slate-300">•</span>
                      <span className="text-slate-500">Dibayar {rupiah(p.total_dibayar)}</span>
                      <div className="ml-auto flex items-center gap-1.5">
                        <button onClick={() => bukaDetail(p)} className="btn-lembut text-xs">Detail</button>
                        {bisaBayar && p.sisa_hutang > 0 && (
                          <button onClick={() => bukaBayar(p)} className="btn-primer text-xs">
                            <Wallet size={14} /> Bayar
                          </button>
                        )}
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Modal detail */}
      <AnimatePresence>
        {detail && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/55 p-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDetail(null)}
          >
            <motion.div
              className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl bg-white p-4 shadow-pop"
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-extrabold text-lg">{detail.supplier_nama}</h2>
                  <p className="text-xs text-slate-500">{detail.kode_pembelian} • {tanggalTeks(detail.tanggal)}</p>
                </div>
                <button onClick={() => setDetail(null)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
                  <X size={18} />
                </button>
              </div>

              <div className="mt-3 space-y-1.5">
                {(detail.items || []).map((it) => (
                  <div key={it.id} className="flex items-center justify-between text-sm border-b border-slate-100 pb-1.5">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{it.nama_snapshot}</p>
                      <p className="text-xs text-slate-500">{it.qty} × {rupiah(it.harga_beli)}</p>
                    </div>
                    <b>{rupiah(it.subtotal)}</b>
                  </div>
                ))}
              </div>

              <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm space-y-1">
                <div className="flex justify-between"><span>Total belanja</span><b>{rupiah(detail.total_beli)}</b></div>
                <div className="flex justify-between"><span>Sudah dibayar</span><b>{rupiah(detail.total_dibayar)}</b></div>
                <div className="flex justify-between text-rose-600"><span>Sisa hutang</span><b>{rupiah(detail.sisa_hutang)}</b></div>
              </div>

              <p className="mt-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Riwayat bayar</p>
              {(detail.payments || []).length === 0 ? (
                <p className="text-sm text-slate-500">Belum ada pembayaran.</p>
              ) : (
                <div className="mt-1 space-y-1">
                  {detail.payments.map((b) => (
                    <div key={b.id} className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">
                        {new Date(b.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {b.oleh_nama ? ` • ${b.oleh_nama}` : ''}
                      </span>
                      <b className="text-emerald-600">{rupiah(b.jumlah_bayar)}</b>
                    </div>
                  ))}
                </div>
              )}

              {bisaBayar && detail.sisa_hutang > 0 && (
                <button
                  onClick={() => {
                    const p = daftar.find((x) => x.id === detail.id) || detail;
                    setDetail(null);
                    bukaBayar(p);
                  }}
                  className="btn-primer w-full mt-3"
                >
                  <Wallet size={16} /> Bayar Hutang
                </button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal bayar */}
      <AnimatePresence>
        {bayarTarget && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/55 p-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setBayarTarget(null)}
          >
            <motion.form
              onSubmit={bayar}
              className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-pop"
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <Wallet size={20} />
                </div>
                <div className="min-w-0">
                  <h2 className="font-extrabold leading-tight">Bayar hutang kulakan</h2>
                  <p className="text-xs text-slate-500 truncate">{bayarTarget.supplier_nama} • {bayarTarget.kode_pembelian}</p>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-sm">
                <span className="font-semibold text-rose-700">Sisa hutang</span>
                <b className="text-rose-700">{rupiah(bayarTarget.sisa_hutang)}</b>
              </div>

              <label className="label mt-3">Nominal bayar (Rp)</label>
              <input
                className="input-besar mt-1 w-full"
                type="number"
                min="1"
                max={bayarTarget.sisa_hutang}
                value={jumlahBayar}
                onChange={(e) => setJumlahBayar(e.target.value)}
                required
                autoFocus
              />
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setJumlahBayar(String(bayarTarget.sisa_hutang))}
                  className="btn-lembut flex-1 text-xs"
                >
                  <CheckCircle2 size={14} /> Lunasi
                </button>
                <button type="button" onClick={() => setBayarTarget(null)} className="btn-lembut flex-1 text-xs">
                  Batal
                </button>
              </div>

              <motion.button
                whileTap={{ scale: 0.98 }}
                disabled={menyimpanBayar}
                className="btn-besar btn-primer w-full mt-3 disabled:opacity-60"
              >
                {menyimpanBayar ? 'Menyimpan...' : 'Simpan Pembayaran'}
              </motion.button>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex justify-center">
        <StatusBadge tone="slate">
          <CalendarDays size={12} /> Kulakan menambah stok & mencatat hutang ke suplier
        </StatusBadge>
      </div>
    </Wadah>
  );
}
