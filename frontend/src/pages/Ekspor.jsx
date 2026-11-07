import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Download,
  FileSpreadsheet,
  FileText,
  DatabaseBackup,
  Upload,
  Printer,
  ShieldAlert,
  CheckCircle2,
} from 'lucide-react';
import api from '../api/client';
import { Card, PageHeader, Notice, Wadah } from '../components/ui';

const fmt = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const hariIni = () => fmt(new Date());
const geser = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return fmt(d);
};

function simpanBlob(blob, nama) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nama;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function namaDariHeader(disposisi, cadangan) {
  const m = /filename="?([^";]+)"?/i.exec(disposisi || '');
  return m?.[1] || cadangan;
}

export default function Ekspor() {
  const [dari, setDari] = useState(geser(29));
  const [sampai, setSampai] = useState(hariIni());
  const [pesan, setPesan] = useState('');
  const [gagal, setGagal] = useState('');
  const [proses, setProses] = useState('');
  const [konfirmasi, setKonfirmasi] = useState('');
  const [namaFile, setNamaFile] = useState('');
  const [isiBackup, setIsiBackup] = useState(null);
  const [hasilRestore, setHasilRestore] = useState(null);
  const berkas = useRef(null);

  function info() {
    setPesan('');
    setGagal('');
  }

  async function unduhCsv(jalur, nama) {
    info();
    setProses(jalur);
    try {
      const res = await api.get(`/api/exports/${jalur}`, {
        params: { dari, sampai },
        responseType: 'blob',
      });
      simpanBlob(res.data, namaDariHeader(res.headers['content-disposition'], nama));
      setPesan('Berkas CSV siap — bisa dibuka di Excel/Google Sheets.');
    } catch (e) {
      setGagal(e.response?.data?.pesan || 'Gagal mengunduh CSV.');
    } finally {
      setProses('');
    }
  }

  async function unduhBackup() {
    info();
    setProses('backup');
    try {
      const res = await api.get('/api/backup', { responseType: 'blob' });
      simpanBlob(
        res.data,
        namaDariHeader(
          res.headers['content-disposition'],
          `warungq-backup-${hariIni()}.json`
        )
      );
      setPesan('Backup terunduh. Simpan berkas ini di tempat aman.');
    } catch (e) {
      setGagal(e.response?.data?.pesan || 'Gagal membuat backup.');
    } finally {
      setProses('');
    }
  }

  async function pilihBerkas(e) {
    info();
    setHasilRestore(null);
    const file = e.target.files?.[0];
    if (!file) return;
    setNamaFile(file.name);
    try {
      const teks = await file.text();
      const data = JSON.parse(teks);
      if (data?.aplikasi !== 'WarungQ' || !data?.tabel) throw new Error('bukan backup WarungQ');
      setIsiBackup(data);
      setPesan('Berkas backup terbaca. Ketik PULIHKAN lalu tekan tombol pemulihan.');
    } catch {
      setIsiBackup(null);
      setGagal('Berkas bukan backup WarungQ yang valid.');
    }
  }

  async function pulihkan() {
    info();
    setHasilRestore(null);
    if (!isiBackup) return setGagal('Pilih berkas backup dulu.');
    if (konfirmasi.trim().toUpperCase() !== 'PULIHKAN') {
      return setGagal('Ketik PULIHKAN (huruf besar) untuk melanjutkan.');
    }
    setProses('restore');
    try {
      const { data } = await api.post('/api/backup/restore', {
        konfirmasi: 'PULIHKAN',
        data: isiBackup,
      });
      setHasilRestore(data.jumlah || {});
      setPesan(data.pesan || 'Data berhasil dipulihkan.');
      setKonfirmasi('');
      setIsiBackup(null);
      setNamaFile('');
      if (berkas.current) berkas.current.value = '';
    } catch (e) {
      setGagal(e.response?.data?.pesan || 'Gagal memulihkan data.');
    } finally {
      setProses('');
    }
  }

  return (
    <Wadah maks="max-w-[900px]">
      <PageHeader
        title="Ekspor & Backup"
        subtitle="Unduh laporan untuk pembukuan, cetak PDF, dan amankan data warung."
        icon={<Download size={22} />}
      />

      <Notice tone="success">{pesan}</Notice>
      {gagal && <Notice tone="error">{gagal}</Notice>}

      <Card className="space-y-3">
        <h2 className="font-extrabold flex items-center gap-2">
          <FileSpreadsheet size={18} className="text-emerald-600" /> Laporan periode
        </h2>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="label">Dari</label>
            <input className="input mt-1" type="date" value={dari} onChange={(e) => setDari(e.target.value)} />
          </div>
          <div>
            <label className="label">Sampai</label>
            <input className="input mt-1" type="date" value={sampai} onChange={(e) => setSampai(e.target.value)} />
          </div>
        </div>
        <div className="grid sm:grid-cols-3 gap-2">
          <motion.button
            whileTap={{ scale: 0.98 }}
            disabled={proses === 'laporan.csv'}
            onClick={() => unduhCsv('laporan.csv', `laporan-${dari}-${sampai}.csv`)}
            className="btn-lembut justify-start disabled:opacity-50"
          >
            <FileSpreadsheet size={16} /> Rekap Harian CSV
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.98 }}
            disabled={proses === 'penjualan.csv'}
            onClick={() => unduhCsv('penjualan.csv', `penjualan-${dari}-${sampai}.csv`)}
            className="btn-lembut justify-start disabled:opacity-50"
          >
            <FileText size={16} /> Detail Penjualan CSV
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.98 }}
            disabled={proses === 'barang.csv'}
            onClick={() => unduhCsv('barang.csv', `barang-${hariIni()}.csv`)}
            className="btn-lembut justify-start disabled:opacity-50"
          >
            <Download size={16} /> Daftar Barang CSV
          </motion.button>
        </div>
        <div className="border-t border-slate-200 pt-3">
          <button
            onClick={() =>
              window.open(`/laporan/cetak?dari=${dari}&sampai=${sampai}`, '_blank', 'noopener')
            }
            className="btn-primer w-full sm:w-auto"
          >
            <Printer size={16} /> Cetak / Simpan PDF
          </button>
          <p className="text-xs text-slate-500 mt-2">
            Halaman cetak bersih akan terbuka; pilih “Save as PDF” di dialog cetak browser.
          </p>
        </div>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-extrabold flex items-center gap-2">
          <DatabaseBackup size={18} className="text-sky-600" /> Backup & pemulihan
        </h2>
        <p className="text-sm text-slate-600">
          Backup berisi seluruh data warung (termasuk hash sandi akun). Simpan berkas di tempat aman
          dan jangan dibagikan.
        </p>
        <button
          onClick={unduhBackup}
          disabled={proses === 'backup'}
          className="btn-lembut w-full sm:w-auto disabled:opacity-50"
        >
          <Download size={16} /> {proses === 'backup' ? 'Membuat backup...' : 'Unduh Backup JSON'}
        </button>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
          <p className="flex items-start gap-2 text-sm font-semibold text-amber-900">
            <ShieldAlert size={18} className="shrink-0 mt-0.5" />
            Pemulihan akan MENGGANTI seluruh data saat ini dengan isi backup.
          </p>
          <input
            ref={berkas}
            type="file"
            accept="application/json,.json"
            onChange={pilihBerkas}
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-xl file:border-0 file:bg-white file:px-3 file:py-2 file:text-sm file:font-bold file:text-slate-700 hover:file:bg-slate-50"
          />
          {namaFile && <p className="text-xs font-semibold text-slate-600">Berkas: {namaFile}</p>}
          <div className="flex flex-wrap gap-2">
            <input
              className="input flex-1 min-w-[180px]"
              placeholder="Ketik PULIHKAN"
              value={konfirmasi}
              onChange={(e) => setKonfirmasi(e.target.value)}
            />
            <button
              onClick={pulihkan}
              disabled={!isiBackup || proses === 'restore'}
              className="btn-besar bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50"
            >
              <Upload size={16} /> {proses === 'restore' ? 'Memulihkan...' : 'Pulihkan Data'}
            </button>
          </div>
        </div>

        {hasilRestore && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <p className="flex items-center gap-2 text-sm font-bold text-emerald-800">
              <CheckCircle2 size={16} /> Pemulihan selesai
            </p>
            <p className="text-xs text-emerald-700 mt-1">
              {Object.entries(hasilRestore)
                .filter(([, n]) => n > 0)
                .map(([t, n]) => `${t}: ${n}`)
                .join(' • ')}
            </p>
            <p className="text-xs text-emerald-700 mt-1">Silakan login ulang bila sesi terasa aneh.</p>
          </div>
        )}
      </Card>
    </Wadah>
  );
}
