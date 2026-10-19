import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { NotebookPen, Plus, X, MessageCircle, HandCoins, CheckCircle2, Clock, AlarmClock, History, Copy, Send } from 'lucide-react';
import api, { rupiah } from '../api/client';
import { Card, PageHeader, EmptyState, Notice, StatusBadge, Wadah } from '../components/ui';

// Hitung status janji bayar: telat / hari ini / dekat / masih lama.
function infoTempo(d) {
  if (!d.jatuh_tempo || d.status === 'lunas') return null;
  const hariIni = new Date();
  hariIni.setHours(0, 0, 0, 0);
  const tempo = new Date(d.jatuh_tempo);
  tempo.setHours(0, 0, 0, 0);
  const selisih = Math.round((tempo - hariIni) / 86400000);
  if (selisih < 0) return { label: `Telat ${-selisih} hari`, nada: 'rose', telat: true };
  if (selisih === 0) return { label: 'Tempo hari ini', nada: 'rose', telat: true };
  if (selisih <= 3) return { label: `${selisih} hari lagi`, nada: 'amber', telat: false };
  return { label: tempo.toLocaleDateString('id-ID'), nada: 'slate', telat: false };
}

// Kasbon Tetangga — kartu bersih + aksi cepat WA ikonik.
export default function Kasbon() {
  const [daftar, setDaftar] = useState([]);
  const [form, setForm] = useState({ nama_tetangga: '', no_wa: '', total_utang: '', jatuh_tempo: '' });
  const [bayar, setBayar] = useState({});
  const [pesan, setPesan] = useState('');
  const [gagal, setGagal] = useState('');
  const [tampilForm, setTampilForm] = useState(false);
  const [filter, setFilter] = useState('aktif');
  const [riwayat, setRiwayat] = useState({}); // {debtId: [{jumlah_bayar, dibayar_pada, diterima_oleh}]}
  const [bukaRiwayat, setBukaRiwayat] = useState(null);
  const [waPreview, setWaPreview] = useState(null); // {id, nama, draf, link}

  async function muat() {
    try {
      const { data } = await api.get('/api/debts');
      setDaftar(data);
    } catch {
      setGagal('Gagal memuat kasbon.');
    }
  }

  useEffect(() => {
    muat();
  }, []);

  const totalAktif = useMemo(
    () => daftar.filter((d) => d.status !== 'lunas').reduce((s, d) => s + Number(d.sisa_utang || 0), 0),
    [daftar]
  );

  const tampil = useMemo(
    () => (filter === 'semua' ? daftar : daftar.filter((d) => (filter === 'lunas' ? d.status === 'lunas' : d.status !== 'lunas'))),
    [daftar, filter]
  );

  const jumlahTelat = useMemo(
    () => daftar.filter((d) => infoTempo(d)?.telat).length,
    [daftar]
  );

  async function simpan(e) {
    e.preventDefault();
    setPesan('');
    setGagal('');
    try {
      await api.post('/api/debts', { ...form, total_utang: Number(form.total_utang), jatuh_tempo: form.jatuh_tempo || null });
      setForm({ nama_tetangga: '', no_wa: '', total_utang: '', jatuh_tempo: '' });
      setTampilForm(false);
      setPesan('Catatan utang tersimpan.');
      muat();
    } catch (err) {
      setGagal(err.response?.data?.pesan || 'Gagal menyimpan.');
    }
  }

  async function bukaPreview(id, nama) {
    setGagal('');
    try {
      const { data } = await api.get(`/api/debts/${id}/wa-link`);
      setWaPreview({ id, nama, draf: data.draf, link: data.link });
    } catch {
      setGagal('Gagal membuat draf WA.');
    }
  }

  async function kirimWa() {
    if (!waPreview) return;
    try {
      await api.post(`/api/debts/${waPreview.id}/ingatkan`);
    } catch {}
    window.open(waPreview.link, '_blank');
    setWaPreview(null);
    muat();
  }

  async function salinDraf() {
    if (!waPreview) return;
    try {
      await navigator.clipboard.writeText(waPreview.draf);
      setPesan('Draf pesan tersalin — tempel di WA mana saja.');
    } catch {
      setGagal('Gagal menyalin. Blokir manual pesannya ya.');
    }
  }

  async function muatRiwayat(id) {
    if (bukaRiwayat === id) {
      setBukaRiwayat(null);
      return;
    }
    setBukaRiwayat(id);
    if (riwayat[id]) return;
    try {
      const { data } = await api.get(`/api/debts/${id}/payments`);
      setRiwayat((r) => ({ ...r, [id]: data }));
    } catch {
      setGagal('Gagal memuat riwayat cicilan.');
    }
  }

  async function lunasi(id) {
    const nominal = Number(bayar[id] || 0);
    if (!nominal) {
      setGagal('Isi nominal bayar dulu ya.');
      return;
    }
    try {
      await api.post(`/api/debts/${id}/bayar`, { jumlah_bayar: nominal });
      setBayar({ ...bayar, [id]: '' });
      setPesan('Pembayaran tercatat.');
      setRiwayat((r) => {
        const next = { ...r };
        delete next[id]; // muat ulang agar riwayat segar
        return next;
      });
      if (bukaRiwayat === id) {
        try {
          const { data } = await api.get(`/api/debts/${id}/payments`);
          setRiwayat((r) => ({ ...r, [id]: data }));
        } catch {}
      }
      muat();
    } catch (err) {
      setGagal(err.response?.data?.pesan || 'Gagal mencatat bayar.');
    }
  }

  return (
    <Wadah maks="max-w-[900px]">
      <PageHeader
        title="Kasbon Tetangga"
        subtitle="Catat utang, terima cicilan, ingatkan via WhatsApp."
        icon={<NotebookPen size={22} />}
        action={
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => setTampilForm(!tampilForm)} className="btn-primer">
            {tampilForm ? <><X size={16} /> Tutup</> : <><Plus size={16} strokeWidth={3} /> Catat Utang</>}
          </motion.button>
        }
      />

      <Notice tone="success">{pesan}</Notice>
      {gagal && <Notice tone="error">{gagal}</Notice>}

      {/* Ringkasan */}
      {jumlahTelat > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-rose-500 text-white px-4 py-3 flex items-center gap-2.5 shadow-card"
        >
          <AlarmClock size={20} className="shrink-0" />
          <p className="text-sm font-bold">{jumlahTelat} kasbon lewat janji bayar — segera ingatkan ya.</p>
        </motion.div>
      )}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl p-4 bg-gradient-to-br from-rose-500 to-orange-500 text-white shadow-card">
          <p className="text-xs font-bold uppercase tracking-wide text-white/80">Utang aktif di luar</p>
          <p className="text-2xl font-extrabold">{rupiah(totalAktif)}</p>
        </div>
        <div className="rounded-2xl p-4 card">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Tetangga berutang</p>
          <p className="text-2xl font-extrabold">{daftar.filter((d) => d.status !== 'lunas').length} <span className="text-sm font-semibold text-slate-500">orang</span></p>
        </div>
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
              <h2 className="font-extrabold">Catat utang baru</h2>
              <div className="grid sm:grid-cols-2 gap-2">
                <input className="input-besar" placeholder="Nama tetangga" value={form.nama_tetangga} onChange={(e) => setForm({ ...form, nama_tetangga: e.target.value })} required />
                <input className="input-besar" placeholder="No. WA (08...)" value={form.no_wa} onChange={(e) => setForm({ ...form, no_wa: e.target.value })} required inputMode="tel" />
                <input className="input-besar" type="number" min="1" placeholder="Nominal (Rp)" value={form.total_utang} onChange={(e) => setForm({ ...form, total_utang: e.target.value })} required />
                <input className="input-besar" type="date" value={form.jatuh_tempo} onChange={(e) => setForm({ ...form, jatuh_tempo: e.target.value })} />
              </div>
              <motion.button whileTap={{ scale: 0.98 }} className="btn-besar btn-primer w-full">Simpan Catatan</motion.button>
            </Card>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Filter */}
      <div className="flex gap-1.5">
        {[{ id: 'aktif', label: 'Belum lunas' }, { id: 'lunas', label: 'Lunas' }, { id: 'semua', label: 'Semua' }].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3.5 py-2 rounded-xl text-sm font-bold border transition active:scale-95 ${filter === f.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Daftar */}
      {tampil.length === 0 ? (
        <EmptyState icon={<NotebookPen size={36} />} title="Tidak ada catatan" subtitle="Belum ada kasbon pada filter ini. Catat utang baru lewat tombol di atas." />
      ) : (
        <div className="grid xl:grid-cols-2 gap-2.5">
          <AnimatePresence initial={false}>
            {tampil.map((d) => {              const lunas = d.status === 'lunas';
              const persen = d.total_utang > 0 ? Math.round(((d.total_utang - d.sisa_utang) / d.total_utang) * 100) : 100;
              const tempo = infoTempo(d);
              const cicilan = riwayat[d.id] || [];
              return (
                <motion.div
                  key={d.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={`card card-hover p-4 ${lunas ? 'opacity-70' : ''} ${tempo?.telat ? '!border-rose-300' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl font-extrabold text-white ${lunas ? 'bg-slate-400' : tempo?.telat ? 'bg-gradient-to-br from-rose-500 to-orange-500' : 'bg-gradient-to-br from-amber-400 to-orange-500'}`}>
                        {d.nama_tetangga.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-extrabold leading-tight truncate">{d.nama_tetangga}</p>
                        <p className="text-xs text-slate-500 font-medium">{d.no_wa || '-'}</p>
                        {d.kode_struk && (
                          <p className="text-[11px] font-bold text-sky-600">Dari struk {d.kode_struk}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {lunas
                        ? <StatusBadge tone="emerald"><CheckCircle2 size={13} /> Lunas</StatusBadge>
                        : <StatusBadge tone="amber"><Clock size={13} /> {d.status}</StatusBadge>}
                      {tempo && (
                        <StatusBadge tone={tempo.nada}><AlarmClock size={13} /> {tempo.label}</StatusBadge>
                      )}
                    </div>
                  </div>

                  <div className="mt-2.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-sm text-slate-500">Sisa <b className={`text-xl ${lunas ? 'text-slate-500' : 'text-rose-600'}`}>{rupiah(d.sisa_utang)}</b></p>
                      <p className="text-xs text-slate-500">dari {rupiah(d.total_utang)} • {persen}% lunas</p>
                    </div>
                    <div className="h-2 mt-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${lunas ? 'bg-emerald-500' : 'bg-gradient-to-r from-amber-400 to-orange-500'}`} style={{ width: `${persen}%` }} />
                    </div>
                  </div>

                  {!lunas && (
                    <div className="mt-3 space-y-2">
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        className="btn w-full bg-[#25D366] hover:bg-[#1fb857] text-white shadow-sm min-h-[46px]"
                        onClick={() => bukaPreview(d.id, d.nama_tetangga)}
                      >
                        <MessageCircle size={18} strokeWidth={2.5} /> Ingatkan via WhatsApp
                      </motion.button>
                      <div className="flex gap-2">
                        <input
                          className="input"
                          type="number"
                          min="1"
                          placeholder="Nominal bayar / cicilan"
                          value={bayar[d.id] || ''}
                          onChange={(e) => setBayar({ ...bayar, [d.id]: e.target.value })}
                        />
                        <motion.button whileTap={{ scale: 0.95 }} className="btn-gelap whitespace-nowrap" onClick={() => lunasi(d.id)}>
                          <HandCoins size={16} /> Bayar
                        </motion.button>
                      </div>
                      <button
                        onClick={() => muatRiwayat(d.id)}
                        className="w-full flex items-center justify-center gap-1.5 text-[13px] font-bold text-slate-500 hover:text-slate-800 py-1.5 transition"
                      >
                        <History size={14} />
                        {bukaRiwayat === d.id ? 'Sembunyikan riwayat' : `Riwayat cicilan (${persen}% lunas)`}
                      </button>
                      {bukaRiwayat === d.id && (
                        <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 space-y-1.5">
                          {cicilan.length === 0 ? (
                            <p className="text-[13px] text-slate-500">Belum ada cicilan tercatat.</p>
                          ) : (
                            cicilan.map((c) => (
                              <div key={c.id} className="flex items-center justify-between text-[13px]">
                                <span className="text-slate-500 font-medium">
                                  {new Date(c.dibayar_pada).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                  {c.diterima_oleh ? ` • ${c.diterima_oleh}` : ''}
                                </span>
                                <b className="text-emerald-700">+{rupiah(c.jumlah_bayar)}</b>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {lunas && cicilan.length === 0 && bukaRiwayat !== d.id && (
                    <button
                      onClick={() => muatRiwayat(d.id)}
                      className="mt-2 w-full flex items-center justify-center gap-1.5 text-[13px] font-bold text-slate-500 hover:text-slate-800 py-1.5 transition"
                    >
                      <History size={14} /> Lihat riwayat cicilan
                    </button>
                  )}
                  {lunas && bukaRiwayat === d.id && (
                    <div className="mt-2 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 space-y-1.5">
                      {(riwayat[d.id] || []).map((c) => (
                        <div key={c.id} className="flex items-center justify-between text-[13px]">
                          <span className="text-slate-500 font-medium">
                            {new Date(c.dibayar_pada).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                            {c.diterima_oleh ? ` • ${c.diterima_oleh}` : ''}
                          </span>
                          <b className="text-emerald-700">+{rupiah(c.jumlah_bayar)}</b>
                        </div>
                      ))}
                      <button onClick={() => setBukaRiwayat(null)} className="w-full text-center text-[13px] font-bold text-slate-500 py-1">
                        Sembunyikan riwayat
                      </button>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Preview template WA sebelum dikirim */}
      <AnimatePresence>
        {waPreview && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/55 p-3"
            onClick={() => setWaPreview(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"
              role="dialog"
              aria-label="Draf pesan WhatsApp"
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="flex items-center gap-2 font-extrabold text-slate-900">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#25D366] text-white">
                    <MessageCircle size={18} />
                  </span>
                  Tagih {waPreview.nama}
                </h2>
                <button onClick={() => setWaPreview(null)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Tutup">
                  <X size={18} />
                </button>
              </div>
              <p className="mt-1 text-[13px] text-slate-500">Cek dulu pesannya — sopan, rapi, lengkap dengan rincian.</p>
              <div className="mt-3 rounded-2xl rounded-tl-md bg-[#DCF8C6] border border-[#bfe3ab] p-3.5 text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                {waPreview.draf}
              </div>
              <div className="mt-4 flex gap-2">
                <button onClick={kirimWa} className="btn flex-1 bg-[#25D366] hover:bg-[#1fb857] text-white min-h-[48px]">
                  <Send size={16} /> Buka WhatsApp
                </button>
                <button onClick={salinDraf} className="btn-lembut min-h-[48px]">
                  <Copy size={16} /> Salin
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Wadah>
  );
}
