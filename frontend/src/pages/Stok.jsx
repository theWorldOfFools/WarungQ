import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Package, Search, Plus, Pencil, X, PackagePlus, AlertTriangle, QrCode, Truck } from 'lucide-react';
import api, { rupiah } from '../api/client';
import StockBadge from '../components/StockBadge';
import LabelBarcodeModal from '../components/LabelBarcodeModal';
import { KATEGORI_BAKU, urutkanKategori } from '../data/kategori';
import { useAuth } from '../context/AuthContext';
import { Card, PageHeader, EmptyState, Notice, StatusBadge } from '../components/ui';
import { cn } from '../components/cn';

const awal = { nama: '', barcode: '', kategori: 'Lainnya', harga_jual: '', modal_beli: '', stok: '', batas_menipis: 5 };
const FILTERS = [
  { id: 'semua', label: 'Semua' },
  { id: 'aman', label: 'Aman' },
  { id: 'menipis', label: 'Menipis' },
  { id: 'habis', label: 'Habis' },
];

export default function Stok() {
  const { pengguna } = useAuth();
  const bisaUbah = ['owner', 'gudang'].includes(pengguna?.peran);
  const bisaLihatModal = pengguna?.peran === 'owner';
  const [daftar, setDaftar] = useState([]);
  const [cari, setCari] = useState('');
  const [filter, setFilter] = useState('semua');
  const [katFilter, setKatFilter] = useState('Semua');
  const [form, setForm] = useState(awal);
  const [editId, setEditId] = useState(null);
  const [tampilForm, setTampilForm] = useState(false);
  const [pesan, setPesan] = useState('');
  const [gagal, setGagal] = useState('');
  const [memuat, setMemuat] = useState(true);
  const [labelProduk, setLabelProduk] = useState(null);
  const [kulakan, setKulakan] = useState([]);

  async function muat(q = cari) {
    setMemuat(true);
    try {
      const [prod, kul] = await Promise.all([
        api.get('/api/products', { params: { q } }),
        // Rekomendasi kulakan: boleh gagal diam-diam (mis. DB belum migrasi) tanpa merusak halaman stok.
        api.get('/api/suppliers/daftar-kulakan').catch(() => ({ data: [] })),
      ]);
      setDaftar(prod.data);
      setKulakan(kul.data || []);
    } catch {
      setGagal('Gagal memuat stok.');
    } finally {
      setMemuat(false);
    }
  }

  useEffect(() => {
    muat('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ringkas = useMemo(() => ({
    aman: daftar.filter((d) => d.status_stok === 'aman').length,
    menipis: daftar.filter((d) => d.status_stok === 'menipis').length,
    habis: daftar.filter((d) => d.status_stok === 'habis').length,
  }), [daftar]);

  const tampil = useMemo(() => {
    let data = filter === 'semua' ? daftar : daftar.filter((d) => d.status_stok === filter);
    if (katFilter !== 'Semua') data = data.filter((d) => (d.kategori || 'Lainnya') === katFilter);
    return data;
  }, [daftar, filter, katFilter]);

  const daftarKategori = useMemo(
    () => ['Semua', ...urutkanKategori(daftar.map((d) => d.kategori))],
    [daftar]
  );

  async function simpan(e) {
    e.preventDefault();
    setPesan('');
    setGagal('');
    try {
      const body = {
        nama: form.nama,
        barcode: form.barcode || null,
        kategori: form.kategori || 'Lainnya',
        harga_jual: Number(form.harga_jual || 0),
        modal_beli: Number(form.modal_beli || 0),
        stok: Number(form.stok || 0),
        batas_menipis: Number(form.batas_menipis || 5),
      };
      if (editId) await api.put(`/api/products/${editId}`, body);
      else await api.post('/api/products', body);
      setForm(awal);
      setEditId(null);
      setTampilForm(false);
      setPesan('Barang tersimpan.');
      muat('');
    } catch (err) {
      setGagal(err.response?.data?.pesan || 'Gagal menyimpan.');
    }
  }

  function mulaiUbah(b) {
    setEditId(b.id);
    setForm({
      nama: b.nama,
      barcode: b.barcode || '',
      kategori: b.kategori || 'Lainnya',
      harga_jual: b.harga_jual,
      modal_beli: b.modal_beli ?? '',
      stok: b.stok,
      batas_menipis: b.batas_menipis,
    });
    setTampilForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function barangMasuk(b) {
    try {
      await api.post(`/api/products/${b.id}/masuk`, { jumlah: 1 });
      setPesan(`+1 ${b.nama} masuk.`);
      muat('');
    } catch (err) {
      setGagal(err.response?.data?.pesan || 'Gagal menambah stok.');
    }
  }

  return (
    <div className="p-3 sm:p-6 pb-safe space-y-4 max-w-[1100px] mx-auto w-full">
      <PageHeader
        title="Stok Barang"
        subtitle="Pantau sisa barang & tambah stok — badge warna mudah dibaca."
        icon={<Package size={22} />}
        action={
          bisaUbah && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setTampilForm(!tampilForm);
                setEditId(null);
                setForm(awal);
              }}
              className="btn-primer"
            >
              {tampilForm ? <><X size={16} /> Tutup</> : <><Plus size={16} strokeWidth={3} /> Tambah</>}
            </motion.button>
          )
        }
      />

      <Notice tone="success">{pesan}</Notice>
      {gagal && <Notice tone="error">{gagal}</Notice>}

      {/* Ringkasan status */}
      <div className="grid grid-cols-3 gap-2.5">
        {[
          { label: 'Aman', n: ringkas.aman, cls: 'bg-emerald-50 border-emerald-200 text-emerald-800', dot: 'bg-emerald-500' },
          { label: 'Menipis', n: ringkas.menipis, cls: 'bg-amber-50 border-amber-200 text-amber-800', dot: 'bg-amber-500' },
          { label: 'Habis', n: ringkas.habis, cls: 'bg-rose-50 border-rose-200 text-rose-800', dot: 'bg-rose-500' },
        ].map((s) => (
          <div key={s.label} className={cn('rounded-2xl border px-3 py-2.5 sm:px-4 sm:py-3', s.cls)}>
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide opacity-80">
              <span className={cn('h-2 w-2 rounded-full', s.dot)} /> {s.label}
            </p>
            <p className="text-2xl font-extrabold leading-tight">{s.n}</p>
          </div>
        ))}
      </div>

      {/* Cari + filter */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input-besar pl-10"
            placeholder="Cari barang..."
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && muat()}
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                'px-3.5 py-2.5 rounded-xl text-sm font-bold border whitespace-nowrap transition active:scale-95',
                filter === f.id
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filter kategori cepat */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5">
        {daftarKategori.map((k) => (
          <button
            key={k}
            onClick={() => setKatFilter(k)}
            className={cn(
              'px-3.5 py-2 rounded-xl text-[13px] font-bold border whitespace-nowrap transition active:scale-95',
              katFilter === k
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
            )}
          >
            {k}
          </button>
        ))}
      </div>

      {/* Form tambah/ubah */}
      <AnimatePresence>
        {bisaUbah && tampilForm && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={simpan}
            className="overflow-hidden"
          >
            <Card className="space-y-2.5 border-emerald-200">
              <h2 className="font-extrabold flex items-center gap-2">
                <PackagePlus size={18} className="text-emerald-600" />
                {editId ? 'Ubah barang' : 'Tambah barang baru'}
              </h2>
              <input className="input-besar" placeholder="Nama barang (mis. Indomie Goreng)" value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} required />
              <div className="grid grid-cols-2 gap-2">
                <input className="input-besar" placeholder="Barcode (boleh kosong)" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
                <input
                  className="input-besar"
                  placeholder="Kategori (mis. Sembako)"
                  list="daftar-kategori"
                  value={form.kategori}
                  onChange={(e) => setForm({ ...form, kategori: e.target.value })}
                />
              </div>
              <datalist id="daftar-kategori">
                {KATEGORI_BAKU.map((k) => <option key={k} value={k} />)}
              </datalist>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="label">Harga jual</label><input className="input-besar mt-1" type="number" min="0" value={form.harga_jual} onChange={(e) => setForm({ ...form, harga_jual: e.target.value })} required /></div>
                {bisaLihatModal
                  ? <div><label className="label">Modal beli</label><input className="input-besar mt-1" type="number" min="0" value={form.modal_beli} onChange={(e) => setForm({ ...form, modal_beli: e.target.value })} /></div>
                  : <div><label className="label">Stok</label><input className="input-besar mt-1" type="number" min="0" value={form.stok} onChange={(e) => setForm({ ...form, stok: e.target.value })} /></div>}
                {bisaLihatModal && <div><label className="label">Stok</label><input className="input-besar mt-1" type="number" min="0" value={form.stok} onChange={(e) => setForm({ ...form, stok: e.target.value })} /></div>}
                <div><label className="label">Batas menipis</label><input className="input-besar mt-1" type="number" min="0" value={form.batas_menipis} onChange={(e) => setForm({ ...form, batas_menipis: e.target.value })} /></div>
              </div>
              <div className="flex gap-2">
                <motion.button whileTap={{ scale: 0.97 }} className="btn-primer flex-1 min-h-[48px]">Simpan</motion.button>
                {editId && <button type="button" className="btn-lembut flex-1" onClick={() => { setEditId(null); setForm(awal); setTampilForm(false); }}>Batal</button>}
              </div>
            </Card>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Peringatan menipis + rekomendasi kulakan */}
      {ringkas.menipis + ringkas.habis > 0 && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-center gap-2.5 text-sm font-semibold text-amber-900">
          <AlertTriangle size={18} className="shrink-0" />
          <span className="flex-1">
            {ringkas.habis > 0 ? `${ringkas.habis} barang habis` : ''}{ringkas.habis > 0 && ringkas.menipis > 0 ? ' • ' : ''}{ringkas.menipis > 0 ? `${ringkas.menipis} barang menipis` : ''} — segera belanja kulakan ya.
          </span>
          {['owner', 'gudang'].includes(pengguna?.peran) && (
            <Link to="/suplier" className="btn !py-2 !px-3 !text-[13px] bg-amber-500 text-white hover:bg-amber-600 shrink-0">
              <Truck size={14} /> Kulakan
            </Link>
          )}
        </div>
      )}

      {/* Daftar belanja rekomendasi: 3 teratas menipis + suplier termurah */}
      {kulakan.length > 0 && ['owner', 'gudang'].includes(pengguna?.peran) && (
        <Card className="border-amber-200 !bg-amber-50/50">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-extrabold text-sm flex items-center gap-2">
              <Truck size={16} className="text-amber-600" /> Rekomendasi kulakan hari ini
            </h2>
            <Link to="/suplier" className="text-[13px] font-bold text-amber-700 hover:text-amber-900">Lihat semua →</Link>
          </div>
          <div className="mt-2 space-y-1.5">
            {kulakan.slice(0, 3).map((k) => (
              <p key={k.product_id} className="text-[13px] text-slate-700">
                • <b>{k.nama}</b> (sisa {k.stok})
                {k.nama_suplier ? <> — kulakan di <b>{k.nama_suplier}</b>{bisaLihatModal && k.harga_beli != null && <> ({rupiah(k.harga_beli)})</>}</> : ' — belum ada suplier'}
              </p>
            ))}
          </div>
        </Card>
      )}

      {/* Daftar */}
      {memuat ? (
        <div className="grid sm:grid-cols-2 gap-2.5">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="animate-pulse h-24 rounded-2xl bg-white border border-slate-200" />)}
        </div>
      ) : tampil.length === 0 ? (
        <EmptyState icon={<Package size={36} />} title="Tidak ada barang" subtitle="Ubah filter atau kata kunci pencarian." />
      ) : (
        <div className="grid sm:grid-cols-2 gap-2.5">
          <AnimatePresence initial={false}>
            {tampil.map((b) => (
              <motion.div
                key={b.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="card card-hover p-3.5 flex gap-3 items-start"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 font-extrabold">
                  {b.nama.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold leading-snug">{b.nama}</p>
                    <StockBadge status={b.status_stok} />
                  </div>
                  <span className="mt-1 inline-flex items-center rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                    {b.kategori || 'Lainnya'}
                  </span>
                  <p className="mt-0.5 font-extrabold text-emerald-700">{rupiah(b.harga_jual)} <span className="font-semibold text-slate-500">• Sisa {b.stok}</span></p>
                  {bisaLihatModal && b.modal_beli != null && (
                    <p className="text-xs text-slate-500">Modal beli: {rupiah(b.modal_beli)}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <button
                      onClick={() => setLabelProduk(b)}
                      className="btn !py-1.5 !px-3 !text-[13px] bg-slate-900 text-white hover:bg-slate-700"
                      title="Lihat QR / Barcode & cetak label stiker"
                    >
                      <QrCode size={14} /> Label QR
                    </button>
                    {bisaUbah && (
                      <>
                        <button onClick={() => mulaiUbah(b)} className="btn-lembut !py-1.5 !px-3 !text-[13px]"><Pencil size={14} /> Ubah</button>
                        <button onClick={() => barangMasuk(b)} className="btn !py-1.5 !px-3 !text-[13px] bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"><PackagePlus size={14} /> +1 Masuk</button>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {!bisaLihatModal && (
        <div className="flex justify-center">
          <StatusBadge>Modal beli disensor untuk peran {pengguna?.peran}</StatusBadge>
        </div>
      )}

      {/* Modal QR / Barcode labeling */}
      <AnimatePresence>
        {labelProduk && (
          <LabelBarcodeModal produk={labelProduk} onTutup={() => setLabelProduk(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
