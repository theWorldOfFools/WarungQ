import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Truck, Plus, X, Pencil, Trash2, Search, BadgeCheck, ShoppingBasket, MessageCircle, BarChart3, History, PackagePlus } from 'lucide-react';
import api, { rupiah } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Card, PageHeader, EmptyState, Notice, StatusBadge, Wadah } from '../components/ui';
import { linkWA } from '../utils/wa';
import { cn } from '../components/cn';

const awalSup = { nama: '', kontak_wa: '', alamat: '' };

export default function Suplier() {
  const { pengguna } = useAuth();
  const bisaUbah = ['owner', 'gudang'].includes(pengguna?.peran);
  const bisaLihatHarga = pengguna?.peran === 'owner';
  const [daftar, setDaftar] = useState([]);
  const [kulakan, setKulakan] = useState([]);
  const [laporan, setLaporan] = useState(null);
  const [cari, setCari] = useState('');
  const [form, setForm] = useState(awalSup);
  const [editId, setEditId] = useState(null);
  const [tampilForm, setTampilForm] = useState(false);
  const [hargaForm, setHargaForm] = useState({}); // {productId: {supplier_id, harga_beli}}
  const [produk, setProduk] = useState([]);
  const [cariProduk, setCariProduk] = useState('');
  const [pesan, setPesan] = useState('');
  const [gagal, setGagal] = useState('');
  const [memuat, setMemuat] = useState(true);

  async function muat() {
    setMemuat(true);
    setGagal('');
    try {
      const [s, k, p, lap] = await Promise.all([
        api.get('/api/suppliers', { params: { q: cari } }),
        api.get('/api/suppliers/daftar-kulakan'),
        api.get('/api/products', { params: { q: cariProduk } }),
        // Laporan statistik: boleh gagal diam-diam (DB lama sebelum migrasi 007).
        api.get('/api/suppliers/laporan').catch(() => ({ data: null })),
      ]);
      setDaftar(s.data);
      setKulakan(k.data);
      setProduk(p.data.slice(0, 50));
      setLaporan(lap.data);
    } catch (e) {
      setGagal(e.response?.data?.pesan || 'Gagal memuat suplier.');
    } finally {
      setMemuat(false);
    }
  }

  useEffect(() => {
    muat('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const butuhKulakan = useMemo(() => kulakan.filter((k) => k.stok <= k.batas_menipis), [kulakan]);

  async function simpan(e) {
    e.preventDefault();
    setPesan('');
    setGagal('');
    try {
      if (editId) await api.put(`/api/suppliers/${editId}`, form);
      else await api.post('/api/suppliers', form);
      setForm(awalSup);
      setEditId(null);
      setTampilForm(false);
      setPesan('Suplier tersimpan.');
      muat();
    } catch (err) {
      setGagal(err.response?.data?.pesan || 'Gagal menyimpan suplier.');
    }
  }

  async function hapus(id) {
    if (!window.confirm('Hapus suplier ini? Harga per barang ikut terhapus.')) return;
    try {
      await api.delete(`/api/suppliers/${id}`);
      setPesan('Suplier dihapus.');
      muat();
    } catch (err) {
      setGagal(err.response?.data?.pesan || 'Gagal menghapus.');
    }
  }

  function mulaiUbah(s) {
    setEditId(s.id);
    setForm({ nama: s.nama, kontak_wa: s.kontak_wa || '', alamat: s.alamat || '' });
    setTampilForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function simpanHarga(productId) {
    const f = hargaForm[productId];
    if (!f?.supplier_id || f?.harga_beli === '' || f?.harga_beli == null) {
      setGagal('Pilih suplier dan isi harga beli dulu ya.');
      return;
    }
    try {
      await api.post(`/api/suppliers/oleh-produk/${productId}`, {
        supplier_id: f.supplier_id,
        harga_beli: Number(f.harga_beli),
      });
      setPesan('Harga suplier tersimpan — badge Termurah diperbarui otomatis.');
      setHargaForm((h) => ({ ...h, [productId]: { supplier_id: '', harga_beli: '' } }));
      muat();
    } catch (err) {
      setGagal(err.response?.data?.pesan || 'Gagal menyimpan harga.');
    }
  }

  return (
    <Wadah maks="max-w-[1100px]">
      <PageHeader
        title="Suplier Pintar"
        subtitle="Bandingkan harga kulakan per barang — yang termurah otomatis ditandai."
        icon={<Truck size={22} />}
        action={
          bisaUbah && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setTampilForm(!tampilForm);
                setEditId(null);
                setForm(awalSup);
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

      {/* Laporan & statistik suplier + integrasi stok */}
      {laporan && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="rounded-2xl p-4 text-white bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 shadow-card border border-white/10">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-300">Suplier</p>
              <p className="text-2xl font-extrabold">{laporan.ringkasan.total_suplier}</p>
              <p className="text-[12px] text-slate-400">{laporan.ringkasan.produk_bisa_dibandingkan} barang bisa dibanding</p>
            </div>
            <div className="rounded-2xl p-4 bg-white border border-slate-200/70 shadow-card">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Terhubung stok</p>
              <p className="text-2xl font-extrabold">{laporan.ringkasan.produk_terhubung}<span className="text-sm font-semibold text-slate-400">/{laporan.ringkasan.total_produk}</span></p>
              <p className="text-[12px] text-slate-500">{laporan.ringkasan.produk_tanpa_suplier} barang belum ada suplier</p>
            </div>
            <div className="rounded-2xl p-4 bg-amber-50 border border-amber-200 shadow-card">
              <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700">Butuh kulakan</p>
              <p className="text-2xl font-extrabold text-amber-800">{laporan.ringkasan.barang_menipis}</p>
              <p className="text-[12px] text-amber-700">{laporan.ringkasan.menipis_tanpa_suplier} tanpa suplier termurah</p>
            </div>
            <div className="rounded-2xl p-4 text-white bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 shadow-card border border-emerald-400/30">
              {bisaLihatHarga ? (
                <>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-100">Estimasi belanja</p>
                  <p className="text-xl font-extrabold">{rupiah(laporan.ringkasan.estimasi_nilai_kulakan)}</p>
                  <p className="text-[12px] text-emerald-100">Hemat {rupiah(laporan.ringkasan.potensi_hemat_per_pcs)}/pcs bila pilih termurah</p>
                </>
              ) : (
                <>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-100">Barang masuk 30 hari</p>
                  <p className="text-2xl font-extrabold">{laporan.ringkasan.unit_masuk_30hari} <span className="text-sm font-semibold text-emerald-100">pcs</span></p>
                  <p className="text-[12px] text-emerald-100">Nominal disensor untuk {pengguna?.peran}</p>
                </>
              )}
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-3">
            {/* Grafik: siapa paling sering termurah */}
            <Card>
              <h2 className="font-extrabold flex items-center gap-2 text-sm">
                <BarChart3 size={16} className="text-emerald-600" /> Paling sering termurah
              </h2>
              {(laporan.per_suplier?.length || 0) === 0 ? (
                <p className="mt-1 text-sm text-slate-500">Belum ada data harga — catat harga di bawah dulu ya.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {laporan.per_suplier.slice(0, 5).map((s) => {
                    const maks = Math.max(...laporan.per_suplier.map((x) => x.menang_termurah || 0), 1);
                    return (
                      <div key={s.id}>
                        <div className="flex items-baseline justify-between gap-2 text-[13px]">
                          <p className="truncate font-bold">{s.nama}</p>
                          <p className="shrink-0 font-semibold text-slate-500">{s.menang_termurah} barang • {s.jumlah_produk} terhubung</p>
                        </div>
                        <div className="h-2 mt-1 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500"
                            style={{ width: `${Math.min(100, ((s.menang_termurah || 0) / maks) * 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {/* Menipis per kategori */}
              {(laporan.per_kategori?.length || 0) > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {laporan.per_kategori.map((k) => (
                    <span key={k.kategori} className="badge bg-slate-100 text-slate-700 border border-slate-200">
                      {k.kategori}: {k.barang_menipis} menipis{bisaLihatHarga && k.estimasi_nilai != null ? ` • ${rupiah(k.estimasi_nilai)}` : ''}
                    </span>
                  ))}
                </div>
              )}
            </Card>

            {/* Integrasi stok: barang masuk + riwayat harga */}
            <Card className="space-y-3">
              <div>
                <h2 className="font-extrabold flex items-center gap-2 text-sm">
                  <PackagePlus size={16} className="text-emerald-600" /> Barang masuk 30 hari
                </h2>
                {(laporan.barang_masuk_30hari?.length || 0) === 0 ? (
                  <p className="mt-1 text-[13px] text-slate-500">Belum ada barang masuk tercatat bulan ini.</p>
                ) : (
                  <div className="mt-2 space-y-1.5">
                    {laporan.barang_masuk_30hari.map((b) => (
                      <div key={b.nama} className="flex items-center justify-between text-[13px] rounded-xl bg-slate-50 border border-slate-200/70 px-3 py-2">
                        <span className="truncate font-bold">{b.nama}</span>
                        <b className="text-emerald-700 shrink-0">+{b.unit_masuk} pcs</b>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <h2 className="font-extrabold flex items-center gap-2 text-sm">
                  <History size={16} className="text-slate-500" /> Riwayat harga terakhir
                </h2>
                {(laporan.riwayat_harga?.length || 0) === 0 ? (
                  <p className="mt-1 text-[13px] text-slate-500">Belum ada perubahan harga tercatat.</p>
                ) : (
                  <div className="mt-2 space-y-1.5">
                    {laporan.riwayat_harga.slice(0, 5).map((r, i) => (
                      <div key={i} className="flex items-center justify-between text-[13px] gap-2">
                        <span className="truncate text-slate-600">
                          {r.nama_produk} • {r.nama_suplier}
                          <span className="text-slate-400"> • {r.created_at ? new Date(r.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : ''}</span>
                        </span>
                        {bisaLihatHarga && r.harga_beli != null && <b className="shrink-0">{rupiah(r.harga_beli)}</b>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Tabel report per suplier */}
          {(laporan.per_suplier?.length || 0) > 0 && (
            <Card className="overflow-hidden !p-0">
              <h2 className="font-extrabold text-sm px-4 pt-4">Report per suplier</h2>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="text-left text-slate-500 border-y border-slate-200 bg-slate-50/60">
                      <th className="px-4 py-2 font-bold">Suplier</th>
                      <th className="px-3 py-2 font-bold text-center">Produk</th>
                      <th className="px-3 py-2 font-bold text-center">Termurah</th>
                      {bisaLihatHarga && <th className="px-3 py-2 font-bold text-right">Estimasi kulakan</th>}
                      <th className="px-4 py-2 font-bold text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {laporan.per_suplier.map((s) => (
                      <tr key={s.id} className="border-b border-slate-100 last:border-0">
                        <td className="px-4 py-2.5">
                          <p className="font-bold">{s.nama}</p>
                          <p className="text-xs text-slate-500">{s.kontak_wa || '-'}</p>
                        </td>
                        <td className="px-3 py-2.5 text-center font-bold">{s.jumlah_produk}</td>
                        <td className="px-3 py-2.5 text-center">
                          <span className="badge bg-emerald-50 text-emerald-700 border border-emerald-200">{s.menang_termurah}</span>
                        </td>
                        {bisaLihatHarga && <td className="px-3 py-2.5 text-right font-bold text-emerald-700">{rupiah(s.estimasi_nilai_kulakan)}</td>}
                        <td className="px-4 py-2.5 text-right">
                          {s.kontak_wa ? (
                            <a
                              className="btn !py-1.5 !px-3 !text-[12px] bg-[#25D366] text-white hover:bg-[#1fb857]"
                              href={linkWA(s.kontak_wa, `Halo ${s.nama}, mau kulakan untuk warung ya.`)}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <MessageCircle size={13} /> Chat
                            </a>
                          ) : <span className="text-slate-300">-</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Rekomendasi kulakan: stok menipis + suplier termurah */}
      <Card className="border-amber-200">
        <h2 className="font-extrabold flex items-center gap-2">
          <ShoppingBasket size={18} className="text-amber-600" />
          Rekomendasi kulakan
          {butuhKulakan.length > 0 && (
            <span className="badge bg-amber-100 text-amber-800 border border-amber-200">
              {butuhKulakan.length} barang
            </span>
          )}
        </h2>
        {butuhKulakan.length === 0 ? (
          <p className="mt-1 text-sm text-slate-500">Stok aman semua. Rekomendasi muncul otomatis saat ada barang menipis/habis.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {butuhKulakan.slice(0, 10).map((k) => (
              <div key={k.product_id} className="flex items-center gap-3 rounded-xl bg-amber-50/60 border border-amber-200/70 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm truncate">
                    {k.nama} <span className="font-semibold text-slate-500">• sisa {k.stok}</span>
                  </p>
                  {k.nama_suplier ? (
                    <p className="text-[13px] text-slate-600">
                      Kulakan di <b>{k.nama_suplier}</b>
                      {bisaLihatHarga && k.harga_beli != null && <> • {rupiah(k.harga_beli)}</>}
                      <span className="ml-1.5 inline-flex items-center gap-1 rounded-full bg-emerald-100 border border-emerald-200 px-2 py-0.5 text-[11px] font-extrabold text-emerald-700">
                        <BadgeCheck size={12} /> Termurah
                      </span>
                    </p>
                  ) : (
                    <p className="text-[13px] text-slate-500">Belum ada harga suplier — catat di bawah ya.</p>
                  )}
                </div>
                {k.kontak_wa && (
                  <a
                    className="btn !py-2 !px-3 !text-[13px] bg-[#25D366] text-white hover:bg-[#1fb857] shrink-0"
                    href={linkWA(k.kontak_wa, `Halo ${k.nama_suplier}, mau tanya harga kulakan "${k.nama}" ya.`)}
                    target="_blank"
                    rel="noreferrer"
                    title="Chat suplier"
                  >
                    <MessageCircle size={14} /> Chat
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
        {!bisaLihatHarga && (
          <div className="mt-2 flex justify-start">
            <StatusBadge>Harga beli disensor untuk peran {pengguna?.peran}</StatusBadge>
          </div>
        )}
      </Card>

      {/* Form suplier */}
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
              <h2 className="font-extrabold">{editId ? 'Ubah suplier' : 'Tambah suplier baru'}</h2>
              <div className="grid sm:grid-cols-3 gap-2">
                <input className="input-besar" placeholder="Nama suplier (mis. Agen Sembako)" value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} required />
                <input className="input-besar" placeholder="No. WA (08...)" value={form.kontak_wa} onChange={(e) => setForm({ ...form, kontak_wa: e.target.value })} inputMode="tel" />
                <input className="input-besar" placeholder="Alamat / pasar (opsional)" value={form.alamat} onChange={(e) => setForm({ ...form, alamat: e.target.value })} />
              </div>
              <motion.button whileTap={{ scale: 0.97 }} className="btn-primer w-full min-h-[48px]">Simpan</motion.button>
            </Card>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Cari */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input-besar pl-10"
            placeholder="Cari suplier..."
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && muat()}
          />
        </div>
        <motion.button whileTap={{ scale: 0.95 }} className="btn-gelap min-h-[48px] px-5" onClick={muat}>
          Cari
        </motion.button>
      </div>

      {/* Daftar suplier */}
      {memuat ? (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="animate-pulse h-24 rounded-2xl bg-white border border-slate-200" />)}
        </div>
      ) : daftar.length === 0 ? (
        <EmptyState icon={<Truck size={36} />} title="Belum ada suplier" subtitle="Tambah agen/langganan kulakan lewat tombol di atas." />
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
          {daftar.map((s) => (
            <div key={s.id} className="card card-hover p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold leading-snug">{s.nama}</p>
                  <p className="text-xs text-slate-500 font-medium">{s.kontak_wa || '-'} • {s.jumlah_produk} barang</p>
                  {s.alamat && <p className="text-xs text-slate-500 truncate">{s.alamat}</p>}
                </div>
                {bisaUbah && (
                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => mulaiUbah(s)} className="btn-lembut !py-1.5 !px-3 !text-[13px]"><Pencil size={14} /> Ubah</button>
                    {pengguna?.peran === 'owner' && (
                      <button onClick={() => hapus(s.id)} className="btn !py-1.5 !px-3 !text-[13px] bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100"><Trash2 size={14} /></button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Catat harga per barang */}
      {bisaUbah && (
        <Card className="space-y-2.5">
          <h2 className="font-extrabold">Catat harga suplier per barang</h2>
          <p className="text-sm text-slate-500">Pilih barang → pilih suplier → isi harga beli. Termurah otomatis jadi rekomendasi kulakan.</p>
          <div className="relative">
            <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-10"
              placeholder="Cari barang untuk dicatat harganya..."
              value={cariProduk}
              onChange={(e) => setCariProduk(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && muat()}
            />
          </div>
          <div className="space-y-2">
            {produk.slice(0, 12).map((p) => {
              const f = hargaForm[p.id] || { supplier_id: '', harga_beli: '' };
              return (
                <div key={p.id} className="rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5">
                  <p className="font-bold text-sm truncate">{p.nama} <span className="font-semibold text-slate-500">• sisa {p.stok}</span></p>
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-[1fr_140px_auto] gap-2">
                    <select
                      className="input"
                      value={f.supplier_id}
                      onChange={(e) => setHargaForm((h) => ({ ...h, [p.id]: { ...f, supplier_id: e.target.value } }))}
                    >
                      <option value="">— Pilih suplier —</option>
                      {daftar.map((s) => <option key={s.id} value={s.id}>{s.nama}</option>)}
                    </select>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      placeholder="Harga beli"
                      value={f.harga_beli}
                      onChange={(e) => setHargaForm((h) => ({ ...h, [p.id]: { ...f, harga_beli: e.target.value } }))}
                    />
                    <button onClick={() => simpanHarga(p.id)} className={cn('btn-primer min-h-[44px]')}>Simpan</button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </Wadah>
  );
}
