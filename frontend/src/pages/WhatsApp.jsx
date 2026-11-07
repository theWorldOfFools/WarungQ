import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  MessageCircle,
  RefreshCw,
  Send,
  CheckCircle2,
  Clock3,
  AlertTriangle,
  Settings2,
  Play,
} from 'lucide-react';
import api from '../api/client';
import { Card, PageHeader, EmptyState, Notice, StatusBadge, Wadah } from '../components/ui';

const fmt = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const hariIni = () => fmt(new Date());

function waktuTeks(s) {
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const STATUS = {
  antri: { label: 'Antri', tone: 'amber' },
  terkirim: { label: 'Terkirim', tone: 'emerald' },
  gagal: { label: 'Gagal', tone: 'rose' },
};

export default function WhatsApp() {
  const [status, setStatus] = useState(null);
  const [outbox, setOutbox] = useState([]);
  const [memuat, setMemuat] = useState(true);
  const [pesan, setPesan] = useState('');
  const [gagal, setGagal] = useState('');
  const [proses, setProses] = useState('');

  const [setForm, setSetForm] = useState({ no_pemilik: '', jam_rekap: '21:00', rekap_aktif: true });
  const [tes, setTes] = useState({ tujuan: '', pesan: 'Tes pesan dari UMKM-Scan.' });
  const [tanggalRekap, setTanggalRekap] = useState(hariIni());

  async function muat() {
    setMemuat(true);
    setGagal('');
    try {
      const [s, o] = await Promise.all([
        api.get('/api/wa/status'),
        api.get('/api/wa/outbox'),
      ]);
      setStatus(s.data);
      setOutbox(o.data || []);
      setSetForm({
        no_pemilik: s.data.no_pemilik || '',
        jam_rekap: s.data.jam_rekap || '21:00',
        rekap_aktif: !!s.data.rekap_aktif,
      });
    } catch (e) {
      setGagal(e.response?.data?.pesan || 'Gagal memuat status WhatsApp.');
    } finally {
      setMemuat(false);
    }
  }

  useEffect(() => {
    muat();
  }, []);

  const ringkas = useMemo(() => {
    const h = { antri: 0, terkirim: 0, gagal: 0 };
    for (const o of outbox) h[o.status] = (h[o.status] || 0) + 1;
    return h;
  }, [outbox]);

  async function simpanSetelan(e) {
    e.preventDefault();
    setPesan('');
    setGagal('');
    setProses('setelan');
    try {
      const { data } = await api.put('/api/wa/pengaturan', setForm);
      setPesan(data.pesan || 'Pengaturan tersimpan.');
      muat();
    } catch (err) {
      setGagal(err.response?.data?.pesan || 'Gagal menyimpan pengaturan.');
    } finally {
      setProses('');
    }
  }

  async function kirimTes(e) {
    e.preventDefault();
    setPesan('');
    setGagal('');
    setProses('tes');
    try {
      const { data } = await api.post('/api/wa/kirim', tes);
      setPesan(data.pesan || 'Pesan diproses.');
      muat();
    } catch (err) {
      setGagal(err.response?.data?.pesan || 'Gagal mengirim pesan.');
    } finally {
      setProses('');
    }
  }

  async function kirimRekap() {
    setPesan('');
    setGagal('');
    setProses('rekap');
    try {
      const { data } = await api.post('/api/wa/rekap', { tanggal: tanggalRekap });
      setPesan(data.pesan || 'Rekap diproses.');
      muat();
    } catch (err) {
      setGagal(err.response?.data?.pesan || 'Gagal mengirim rekap.');
    } finally {
      setProses('');
    }
  }

  async function prosesAntrean() {
    setPesan('');
    setGagal('');
    setProses('antre');
    try {
      const { data } = await api.post('/api/wa/proses');
      setPesan(data.pesan || 'Antrean diproses.');
      muat();
    } catch (err) {
      setGagal(err.response?.data?.pesan || 'Gagal memproses antrean.');
    } finally {
      setProses('');
    }
  }

  return (
    <Wadah maks="max-w-[900px]">
      <PageHeader
        title="WhatsApp Otomatis"
        subtitle="Rekap harian & tagihan kasbon terkirim lewat WAHA, dengan antrean yang aman."
        icon={<MessageCircle size={22} />}
        action={
          <motion.button whileTap={{ scale: 0.94 }} onClick={muat} className="btn-lembut" title="Muat ulang">
            <RefreshCw size={16} className={memuat ? 'animate-spin' : ''} />
          </motion.button>
        }
      />

      <Notice tone="success">{pesan}</Notice>
      {gagal && <Notice tone="error">{gagal}</Notice>}

      {status && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className={`rounded-2xl p-4 text-white shadow-card ${status.siap ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : 'bg-gradient-to-br from-slate-600 to-slate-800'}`}>
            <p className="text-[11px] font-bold uppercase text-white/80">Driver</p>
            <p className="text-xl font-extrabold">{status.driver}</p>
            <p className="text-[12px] text-white/80">{status.siap ? 'Siap mengirim' : 'Belum aktif'}</p>
          </div>
          <div className="rounded-2xl p-4 bg-amber-50 border border-amber-200 shadow-card">
            <p className="text-[11px] font-bold uppercase text-amber-700">Antri</p>
            <p className="text-2xl font-extrabold text-amber-800">{ringkas.antri}</p>
          </div>
          <div className="rounded-2xl p-4 bg-emerald-50 border border-emerald-200 shadow-card">
            <p className="text-[11px] font-bold uppercase text-emerald-700">Terkirim</p>
            <p className="text-2xl font-extrabold text-emerald-800">{ringkas.terkirim}</p>
          </div>
          <div className="rounded-2xl p-4 bg-rose-50 border border-rose-200 shadow-card">
            <p className="text-[11px] font-bold uppercase text-rose-700">Gagal</p>
            <p className="text-2xl font-extrabold text-rose-700">{ringkas.gagal}</p>
          </div>
        </div>
      )}

      {status && !status.siap && (
        <Card className="border-amber-200 space-y-2">
          <h2 className="font-extrabold flex items-center gap-2 text-amber-800">
            <AlertTriangle size={18} /> Aktifkan WhatsApp otomatis
          </h2>
          <p className="text-sm text-slate-600">
            Isi variabel berikut di server, lalu restart backend. Antrean tetap aman sampai driver siap.
          </p>
          <div className="rounded-xl bg-slate-900 text-slate-100 p-3 text-xs font-mono space-y-1 overflow-x-auto">
            <p>WA_DRIVER=waha</p>
            <p>WAHA_URL=http://waha:3000</p>
            <p>WAHA_SESSION=default</p>
            <p>WAHA_API_KEY=opsional</p>
          </div>
          <p className="text-xs text-slate-500">
            Tombol kirim otomatis nonaktif selama driver belum siap; tagihan kasbon kembali memakai wa.me manual.
          </p>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-3">
        <Card className="space-y-3">
          <h2 className="font-extrabold flex items-center gap-2">
            <Settings2 size={18} className="text-emerald-600" /> Pengaturan pengiriman
          </h2>
          <form onSubmit={simpanSetelan} className="space-y-2.5">
            <div>
              <label className="label">No. WA pemilik (penerima rekap)</label>
              <input
                className="input mt-1 w-full"
                inputMode="tel"
                placeholder="08..."
                value={setForm.no_pemilik}
                onChange={(e) => setSetForm({ ...setForm, no_pemilik: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">Jam rekap harian</label>
                <input
                  className="input mt-1 w-full"
                  type="time"
                  value={setForm.jam_rekap}
                  onChange={(e) => setSetForm({ ...setForm, jam_rekap: e.target.value })}
                />
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mt-6">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-emerald-600"
                  checked={setForm.rekap_aktif}
                  onChange={(e) => setSetForm({ ...setForm, rekap_aktif: e.target.checked })}
                />
                Rekap otomatis
              </label>
            </div>
            <motion.button
              whileTap={{ scale: 0.98 }}
              disabled={proses === 'setelan'}
              className="btn-besar btn-primer w-full disabled:opacity-60"
            >
              {proses === 'setelan' ? 'Menyimpan...' : 'Simpan Pengaturan'}
            </motion.button>
          </form>
        </Card>

        <Card className="space-y-3">
          <h2 className="font-extrabold flex items-center gap-2">
            <Send size={18} className="text-emerald-600" /> Kirim sekarang
          </h2>
          <div className="space-y-2">
            <label className="label">Tanggal rekap</label>
            <div className="flex gap-1.5">
              <input
                className="input flex-1"
                type="date"
                value={tanggalRekap}
                onChange={(e) => setTanggalRekap(e.target.value)}
              />
              <button
                onClick={kirimRekap}
                disabled={!status?.siap || proses === 'rekap'}
                className="btn-primer whitespace-nowrap disabled:opacity-50"
              >
                <Send size={15} /> Kirim Rekap
              </button>
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={prosesAntrean}
                disabled={!status?.siap || proses === 'antre'}
                className="btn-lembut flex-1 disabled:opacity-50"
              >
                <Play size={15} /> Proses Antrean
              </button>
            </div>
          </div>

          <form onSubmit={kirimTes} className="space-y-2 border-t border-slate-200 pt-3">
            <label className="label">Tes kirim</label>
            <input
              className="input w-full"
              inputMode="tel"
              placeholder="Nomor tujuan (08...)"
              value={tes.tujuan}
              onChange={(e) => setTes({ ...tes, tujuan: e.target.value })}
              required
            />
            <input
              className="input w-full"
              placeholder="Isi pesan"
              maxLength={500}
              value={tes.pesan}
              onChange={(e) => setTes({ ...tes, pesan: e.target.value })}
              required
            />
            <button
              disabled={!status?.siap || proses === 'tes'}
              className="btn-lembut w-full disabled:opacity-50"
            >
              <MessageCircle size={15} /> {proses === 'tes' ? 'Mengirim...' : 'Kirim Tes'}
            </button>
          </form>
        </Card>
      </div>

      <div>
        <h2 className="font-extrabold mb-2 flex items-center gap-2">
          <Clock3 size={16} className="text-slate-500" /> Antrean pesan
        </h2>
        {memuat ? (
          <div className="animate-pulse h-24 rounded-2xl bg-white border border-slate-200" />
        ) : outbox.length === 0 ? (
          <EmptyState
            icon={<MessageCircle size={36} />}
            title="Belum ada pesan"
            subtitle="Rekap harian dan tagihan kasbon otomatis akan muncul di antrean ini."
          />
        ) : (
          <div className="space-y-2">
            <AnimatePresence initial={false}>
              {outbox.map((o) => {
                const st = STATUS[o.status] || STATUS.antri;
                return (
                  <motion.div key={o.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    <Card className="p-3 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
                        <b className="text-sm">{o.tipe.replace(/_/g, ' ')}</b>
                        <span className="text-xs text-slate-500">→ {o.tujuan}</span>
                        <span className="text-xs text-slate-400 ml-auto">{waktuTeks(o.created_at)}</span>
                      </div>
                      <p className="text-xs text-slate-600 whitespace-pre-wrap line-clamp-3">{o.pesan}</p>
                      {o.error && <p className="text-xs text-rose-600">{o.error}</p>}
                      <p className="text-[11px] text-slate-400">
                        Percobaan {o.percobaan}
                        {o.terkirim_at ? ` • terkirim ${waktuTeks(o.terkirim_at)}` : ''}
                      </p>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      <div className="flex justify-center">
        <StatusBadge tone="slate">
          <CheckCircle2 size={12} /> Pesan disimpan dulu, dikirim ulang otomatis bila WAHA sempat mati.
        </StatusBadge>
      </div>
    </Wadah>
  );
}
