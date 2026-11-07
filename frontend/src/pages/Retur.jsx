import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  RotateCcw,
  PackageX,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  CalendarDays,
} from 'lucide-react';
import api, { rupiah } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Card, PageHeader, EmptyState, Notice, StatusBadge, Wadah } from '../components/ui';
import { cn } from '../components/cn';

const ALASAN = [
  { id: 'rusak', label: 'Rusak' },
  { id: 'expired', label: 'Expired' },
  { id: 'salah_input', label: 'Salah input' },
  { id: 'lainnya', label: 'Lainnya' },
];

function waktuTeks(s) {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function Retur() {
  const { pengguna } = useAuth();
  const bisaRetur = ['owner', 'kasir'].includes(pengguna?.peran);
  const bisaWriteoff = ['owner', 'gudang'].includes(pengguna?.peran);
  const owner = pengguna?.peran === 'owner';

  const [tab, setTab] = useState(bisaRetur ? 'retur_jual' : 'writeoff');
  const [daftar, setDaftar] = useState([]);
  const [sales, setSales] = useState([]);
  const [produk, setProduk] = useState([]);
  const [memuat, setMemuat] = useState(true);
  const [pesan, setPesan] = useState('');
  const [gagal, setGagal] = useState('');

  // Retur jual
  const [saleId, setSaleId] = useState('');
  const [saleDetail, setSaleDetail] = useState(null);
  const [returSale, setReturSale] = useState([]);
  const [rForm, setRForm] = useState({ product_id: '', qty: '1', alasan: 'rusak', kembali_ke_stok: true, keterangan: '' });
  const [rProses, setRProses] = useState(false);

  // Writeoff
  const [wForm, setWForm] = useState({ product_id: '', qty: '1', alasan: 'rusak', keterangan: '' });
  const [wProses, setWProses] = useState(false);

  async function muat() {
    setMemuat(true);
    setGagal('');
    try {
      const [r, p] = await Promise.all([
        api.get('/api/returns'),
        api.get('/api/products'),
      ]);
      setDaftar(r.data || []);
      setProduk(p.data || []);
      if (bisaRetur) {
        const s = await api.get('/api/sales?limit=20');
        setSales(s.data || []);
      }
    } catch (e) {
      setGagal(e.response?.data?.pesan || 'Gagal memuat data retur.');
    } finally {
      setMemuat(false);
    }
  }

  useEffect(() => {
    muat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function pilihStruk(id) {
    setSaleId(id);
    setSaleDetail(null);
    setReturSale([]);
    setRForm((f) => ({ ...f, product_id: '', qty: '1' }));
    if (!id) return;
    try {
      const [d, r] = await Promise.all([
        api.get(`/api/sales/${id}`),
        api.get('/api/returns', { params: { sale_id: id } }),
      ]);
      setSaleDetail(d.data);
      setReturSale(r.data || []);
    } catch (e) {
      setGagal(e.response?.data?.pesan || 'Gagal membuka struk.');
    }
  }

  const returPerProduk = useMemo(() => {
    const map = {};
    for (const r of returSale) {
      if (r.tipe !== 'retur_jual' || !r.product_id) continue;
      map[r.product_id] = (map[r.product_id] || 0) + Number(r.qty || 0);
    }
    return map;
  }, [returSale]);

  const itemDipilih = useMemo(
    () => (saleDetail?.items || []).find((i) => i.product_id === rForm.product_id),
    [saleDetail, rForm.product_id]
  );
  const sisaRetur = itemDipilih
    ? Number(itemDipilih.qty || 0) - Number(returPerProduk[itemDipilih.product_id] || 0)
    : 0;
  const refundPreview = itemDipilih ? Number(itemDipilih.harga_jual || 0) * Number(rForm.qty || 0) : 0;

  async function simpanRetur(e) {
    e.preventDefault();
    setPesan('');
    setGagal('');
    if (!saleId) return setGagal('Pilih struk asal retur dulu.');
    if (!rForm.product_id) return setGagal('Pilih barang yang diretur.');
    const qty = Number(rForm.qty || 0);
    if (!Number.isInteger(qty) || qty <= 0) return setGagal('Jumlah retur harus lebih dari 0.');
    if (qty > sisaRetur) return setGagal(`Sisa yang bisa diretur ${sisaRetur} pcs.`);
    setRProses(true);
    try {
      const { data } = await api.post('/api/returns', {
        tipe: 'retur_jual',
        sale_id: saleId,
        product_id: rForm.product_id,
        qty,
        alasan: rForm.alasan,
        kembali_ke_stok: rForm.kembali_ke_stok,
        keterangan: rForm.keterangan,
      });
      setPesan(data.pesan || 'Retur tersimpan.');
      setRForm({ product_id: '', qty: '1', alasan: 'rusak', kembali_ke_stok: true, keterangan: '' });
      await pilihStruk(saleId);
      muat();
    } catch (err) {
      setGagal(err.response?.data?.pesan || 'Gagal menyimpan retur.');
    } finally {
      setRProses(false);
    }
  }

  async function simpanWriteoff(e) {
    e.preventDefault();
    setPesan('');
    setGagal('');
    if (!wForm.product_id) return setGagal('Pilih barang rusak/expired.');
    const qty = Number(wForm.qty || 0);
    if (!Number.isInteger(qty) || qty <= 0) return setGagal('Jumlah barang harus lebih dari 0.');
    setWProses(true);
    try {
      const { data } = await api.post('/api/returns', {
        tipe: 'writeoff',
        product_id: wForm.product_id,
        qty,
        alasan: wForm.alasan,
        keterangan: wForm.keterangan,
      });
      setPesan(data.pesan || 'Barang dikeluarkan dari stok.');
      setWForm({ product_id: '', qty: '1', alasan: 'rusak', keterangan: '' });
      muat();
    } catch (err) {
      setGagal(err.response?.data?.pesan || 'Gagal menyimpan barang rusak.');
    } finally {
      setWProses(false);
    }
  }

  const ringkas = useMemo(() => {
    let retur = 0;
    let kerugian = 0;
    for (const r of daftar) {
      if (r.tipe === 'retur_jual') retur += Number(r.total_nilai || 0);
      if (r.tipe === 'writeoff') kerugian += Number(r.total_nilai || 0);
    }
    return { retur, kerugian };
  }, [daftar]);

  const produkWriteoff = produk.find((p) => p.id === wForm.product_id);

  return (
    <Wadah maks="max-w-[1000px]">
      <PageHeader
        title="Retur & Barang Rusak"
        subtitle="Retur sebagian per item, catat barang rusak/expired, stok tetap akurat."
        icon={<RotateCcw size={22} />}
        action={
          <motion.button whileTap={{ scale: 0.94 }} onClick={muat} className="btn-lembut" title="Muat ulang">
            <RefreshCw size={16} className={memuat ? 'animate-spin' : ''} />
          </motion.button>
        }
      />

      <Notice tone="success">{pesan}</Notice>
      {gagal && <Notice tone="error">{gagal}</Notice>}

      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl p-4 bg-white border border-slate-200/70 shadow-card">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Nilai retur jual</p>
          <p className="text-2xl font-extrabold text-amber-600">{rupiah(ringkas.retur)}</p>
          <p className="text-[12px] text-slate-500">Uang kembali ke pembeli</p>
        </div>
        <div className="rounded-2xl p-4 bg-rose-50 border border-rose-200 shadow-card">
          <p className="text-[11px] font-bold uppercase tracking-wide text-rose-700">Kerugian stok</p>
          <p className="text-2xl font-extrabold text-rose-700">
            {owner ? rupiah(ringkas.kerugian) : `${daftar.filter((r) => r.tipe === 'writeoff').length} catatan`}
          </p>
          <p className="text-[12px] text-rose-600">{owner ? 'Rusak + expired (modal)' : 'Nominal disensor'}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {bisaRetur && (
          <button
            onClick={() => setTab('retur_jual')}
            className={cn(
              'px-3.5 py-2 rounded-xl text-sm font-bold border transition active:scale-95 flex items-center gap-1.5',
              tab === 'retur_jual' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
            )}
          >
            <RotateCcw size={15} /> Retur Jual
          </button>
        )}
        {bisaWriteoff && (
          <button
            onClick={() => setTab('writeoff')}
            className={cn(
              'px-3.5 py-2 rounded-xl text-sm font-bold border transition active:scale-95 flex items-center gap-1.5',
              tab === 'writeoff' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
            )}
          >
            <PackageX size={15} /> Rusak / Expired
          </button>
        )}
      </div>

      {tab === 'retur_jual' && bisaRetur && (
        <Card className="space-y-3 border-amber-200">
          <h2 className="font-extrabold flex items-center gap-2">
            <RotateCcw size={18} className="text-amber-600" /> Retur sebagian dari struk
          </h2>
          <div>
            <label className="label">Struk asal</label>
            <select className="input-besar mt-1 w-full" value={saleId} onChange={(e) => pilihStruk(e.target.value)}>
              <option value="">— pilih struk terbaru —</option>
              {sales.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.kode_struk} • {new Date(s.created_at).toLocaleDateString('id-ID')} • {rupiah(s.total_masuk)}
                </option>
              ))}
            </select>
          </div>

          {saleDetail && (
            <form onSubmit={simpanRetur} className="space-y-2.5">
              <div className="grid sm:grid-cols-2 gap-2">
                <div>
                  <label className="label">Barang</label>
                  <select
                    className="input-besar mt-1 w-full"
                    value={rForm.product_id}
                    onChange={(e) => setRForm({ ...rForm, product_id: e.target.value, qty: '1' })}
                    required
                  >
                    <option value="">— pilih barang di struk —</option>
                    {(saleDetail.items || []).map((it) => {
                      const sisa = Number(it.qty || 0) - Number(returPerProduk[it.product_id] || 0);
                      return (
                        <option key={it.product_id} value={it.product_id} disabled={sisa <= 0}>
                          {it.nama} ({sisa} bisa diretur)
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div>
                  <label className="label">Jumlah retur</label>
                  <input
                    className="input-besar mt-1 w-full"
                    type="number"
                    min="1"
                    max={sisaRetur || undefined}
                    value={rForm.qty}
                    onChange={(e) => setRForm({ ...rForm, qty: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="label">Alasan</label>
                  <select
                    className="input-besar mt-1 w-full"
                    value={rForm.alasan}
                    onChange={(e) => setRForm({ ...rForm, alasan: e.target.value })}
                  >
                    {ALASAN.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Keterangan (boleh kosong)</label>
                  <input
                    className="input-besar mt-1 w-full"
                    maxLength={200}
                    value={rForm.keterangan}
                    onChange={(e) => setRForm({ ...rForm, keterangan: e.target.value })}
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-emerald-600"
                  checked={rForm.kembali_ke_stok}
                  onChange={(e) => setRForm({ ...rForm, kembali_ke_stok: e.target.checked })}
                />
                Barang masih layak jual (kembalikan ke stok)
              </label>

              {itemDipilih && (
                <div className="flex items-center justify-between rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-sm">
                  <span className="text-amber-800">Uang kembali ke pembeli</span>
                  <b className="text-amber-800">{rupiah(refundPreview)}</b>
                </div>
              )}

              <motion.button
                whileTap={{ scale: 0.98 }}
                disabled={rProses || !rForm.product_id}
                className="btn-besar btn-primer w-full disabled:opacity-60"
              >
                {rProses ? 'Menyimpan...' : 'Simpan Retur'}
              </motion.button>
            </form>
          )}
        </Card>
      )}

      {tab === 'writeoff' && bisaWriteoff && (
        <Card className="space-y-3 border-rose-200">
          <h2 className="font-extrabold flex items-center gap-2">
            <PackageX size={18} className="text-rose-600" /> Barang rusak / expired
          </h2>
          <form onSubmit={simpanWriteoff} className="space-y-2.5">
            <div className="grid sm:grid-cols-2 gap-2">
              <div>
                <label className="label">Barang</label>
                <select
                  className="input-besar mt-1 w-full"
                  value={wForm.product_id}
                  onChange={(e) => setWForm({ ...wForm, product_id: e.target.value, qty: '1' })}
                  required
                >
                  <option value="">— pilih barang —</option>
                  {produk.map((p) => (
                    <option key={p.id} value={p.id}>{p.nama} (stok {p.stok})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Jumlah</label>
                <input
                  className="input-besar mt-1 w-full"
                  type="number"
                  min="1"
                  max={produkWriteoff?.stok || undefined}
                  value={wForm.qty}
                  onChange={(e) => setWForm({ ...wForm, qty: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label">Alasan</label>
                <select
                  className="input-besar mt-1 w-full"
                  value={wForm.alasan}
                  onChange={(e) => setWForm({ ...wForm, alasan: e.target.value })}
                >
                  <option value="rusak">Rusak</option>
                  <option value="expired">Expired</option>
                  <option value="lainnya">Lainnya</option>
                </select>
              </div>
              <div>
                <label className="label">Keterangan (boleh kosong)</label>
                <input
                  className="input-besar mt-1 w-full"
                  maxLength={200}
                  value={wForm.keterangan}
                  onChange={(e) => setWForm({ ...wForm, keterangan: e.target.value })}
                />
              </div>
            </div>
            {produkWriteoff && (
              <p className="text-xs text-slate-500">
                Stok sekarang {produkWriteoff.stok} pcs. Barang akan dikurangi dari stok dan dicatat sebagai kerugian.
              </p>
            )}
            <motion.button
              whileTap={{ scale: 0.98 }}
              disabled={wProses || !wForm.product_id}
              className="btn-besar btn-primer w-full disabled:opacity-60"
            >
              {wProses ? 'Menyimpan...' : 'Keluarkan dari Stok'}
            </motion.button>
          </form>
        </Card>
      )}

      <div>
        <h2 className="font-extrabold mb-2 flex items-center gap-2">
          <CalendarDays size={16} className="text-slate-500" /> Riwayat retur
        </h2>
        {memuat ? (
          <div className="animate-pulse h-24 rounded-2xl bg-white border border-slate-200" />
        ) : daftar.length === 0 ? (
          <EmptyState
            icon={<RotateCcw size={36} />}
            title="Belum ada retur"
            subtitle="Retur sebagian atau barang rusak/expired akan muncul di sini."
          />
        ) : (
          <div className="space-y-2">
            <AnimatePresence initial={false}>
              {daftar.map((r) => (
                <motion.div key={r.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <Card className="p-3.5 flex items-start gap-3">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${r.tipe === 'retur_jual' ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'}`}>
                      {r.tipe === 'retur_jual' ? <RotateCcw size={18} /> : <PackageX size={18} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold truncate">{r.nama_snapshot}</p>
                        <StatusBadge tone={r.tipe === 'retur_jual' ? 'amber' : 'rose'}>
                          {r.tipe === 'retur_jual' ? 'Retur jual' : r.alasan === 'expired' ? 'Expired' : 'Rusak'}
                        </StatusBadge>
                      </div>
                      <p className="text-xs text-slate-500">
                        {r.kode_retur} • {waktuTeks(r.created_at)} • {r.qty} pcs
                        {r.kode_struk ? ` • ${r.kode_struk}` : ''}
                        {r.oleh_nama ? ` • ${r.oleh_nama}` : ''}
                      </p>
                      {r.keterangan && <p className="text-xs text-slate-500 italic">“{r.keterangan}”</p>}
                    </div>
                    <div className="text-right shrink-0 text-xs">
                      {r.total_nilai != null ? (
                        <>
                          <p className="text-slate-500">{r.tipe === 'retur_jual' ? 'Refund' : 'Kerugian'}</p>
                          <b className={r.tipe === 'retur_jual' ? 'text-amber-600' : 'text-rose-600'}>{rupiah(r.total_nilai)}</b>
                        </>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </div>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      <div className="flex justify-center">
        <StatusBadge tone="slate">
          <CheckCircle2 size={12} /> Retur mengurangi untung; rusak/expired dihitung kerugian modal.
        </StatusBadge>
      </div>
    </Wadah>
  );
}
