import { motion } from 'framer-motion';
import { Settings as IkonSetelan, Store, Printer, Bell, RotateCcw, CheckCircle2, Smartphone, Download } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePengaturan } from '../context/PengaturanContext';
import { Card, PageHeader, Notice, Wadah } from '../components/ui';
import { cn } from '../components/cn';
import { siapPasang, modeBerdiri, mintaPasang } from '../pwa';

// Menu Konfigurasi baru: profil warung, preferensi cetak, preferensi aplikasi.
export default function Pengaturan() {
  const { pengguna } = useAuth();
  const { pengaturan, ubah, reset } = usePengaturan();
  const [pesan, setPesan] = useState('');
  const isOwner = pengguna?.peran === 'owner';
  const [bisaPasang, setBisaPasang] = useState(() => siapPasang());
  const [sudahPasang, setSudahPasang] = useState(() => modeBerdiri());

  useEffect(() => {
    function segarkan() {
      setBisaPasang(siapPasang());
      setSudahPasang(modeBerdiri());
    }
    window.addEventListener('pwa-install-berubah', segarkan);
    return () => window.removeEventListener('pwa-install-berubah', segarkan);
  }, []);

  async function pasangAplikasi() {
    const hasil = await mintaPasang();
    if (hasil === 'accepted') setPesan('Aplikasi dipasang — cari ikon UMKM-Scan di layar utama HP.');
    else if (hasil === 'dismissed') setPesan('Pemasangan dibatalkan — bisa dicoba lagi kapan saja.');
    else setPesan('Browser belum menawarkan pemasangan di perangkat ini.');
    setTimeout(() => setPesan(''), 2600);
    setBisaPasang(siapPasang());
    setSudahPasang(modeBerdiri());
  }

  function simpanBagian(label) {
    setPesan(`${label} tersimpan otomatis.`);
    setTimeout(() => setPesan(''), 2200);
  }

  return (
    <Wadah maks="max-w-[900px]">
      <PageHeader
        title="Pengaturan"
        subtitle="Atur profil warung, struk cetak, dan kenyamanan aplikasi."
        icon={<IkonSetelan size={22} />}
      />

      <Notice tone="success">{pesan}</Notice>

      {/* Profil warung */}
      <Card className="space-y-3">
        <h2 className="font-extrabold flex items-center gap-2"><Store size={18} className="text-emerald-600" /> Profil warung</h2>
        {!isOwner && <p className="text-[13px] text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">Hanya Owner yang boleh mengubah nama toko. Anda login sebagai <b>{pengguna?.peran}</b>.</p>}
        <div className="grid sm:grid-cols-2 gap-2.5">
          <div>
            <label className="label">Nama toko tampil</label>
            <input
              className="input mt-1"
              placeholder={pengguna?.toko || 'Warung Maju Jaya'}
              value={pengaturan.namaToko}
              disabled={!isOwner}
              onChange={(e) => {
                ubah({ namaToko: e.target.value });
              }}
              onBlur={() => simpanBagian('Nama toko')}
            />
            <p className="text-xs text-slate-400 mt-1">Kosongkan untuk memakai nama dari server.</p>
          </div>
          <div>
            <label className="label">Pemilik / penanggung jawab</label>
            <input className="input mt-1 bg-slate-50" value={pengguna?.nama || ''} disabled />
          </div>
        </div>
        <div>
          <label className="label">No. WA pemilik (terima rekap harian)</label>
          <input
            className="input mt-1"
            placeholder="08..."
            inputMode="tel"
            value={pengaturan.noWaPemilik || ''}
            onChange={(e) => ubah({ noWaPemilik: e.target.value })}
            onBlur={() => simpanBagian('No. WA pemilik')}
          />
          <p className="text-xs text-slate-400 mt-1">Dipakai tombol “Kirim Rekap via WhatsApp” di Dompet.</p>
        </div>
      </Card>

      {/* Cetak */}
      <Card className="space-y-3">
        <h2 className="font-extrabold flex items-center gap-2"><Printer size={18} className="text-emerald-600" /> Preferensi cetak struk</h2>
        <div className="grid sm:grid-cols-2 gap-2.5">
          <div>
            <label className="label">Kepala struk</label>
            <input className="input mt-1" placeholder="Warung Maju Jaya — Jl. Melati 12" value={pengaturan.strukHeader} onChange={(e) => ubah({ strukHeader: e.target.value })} onBlur={() => simpanBagian('Kepala struk')} />
          </div>
          <div>
            <label className="label">Kaki struk</label>
            <input className="input mt-1" value={pengaturan.strukFooter} onChange={(e) => ubah({ strukFooter: e.target.value })} onBlur={() => simpanBagian('Kaki struk')} />
          </div>
        </div>
        <div>
          <label className="label">Ukuran kertas</label>
          <div className="flex gap-1.5 mt-1">
            {['58mm', '80mm', 'A4'].map((k) => (
              <button
                key={k}
                onClick={() => {
                  ubah({ ukuranKertas: k });
                  simpanBagian('Ukuran kertas');
                }}
                className={cn(
                  'flex-1 rounded-xl border px-3 py-2.5 text-sm font-bold transition active:scale-95',
                  pengaturan.ukuranKertas === k ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 hover:border-slate-400'
                )}
              >
                {k}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Aplikasi */}
      <Card className="space-y-2.5">
        <h2 className="font-extrabold flex items-center gap-2"><Bell size={18} className="text-emerald-600" /> Preferensi aplikasi</h2>
        <Toggle
          label="Sidebar rapat saat dibuka (desktop)"
          desc="Cocok untuk layar kecil / tablet."
          aktif={pengaturan.sidebarRapatDefault}
          onClick={() => {
            ubah({ sidebarRapatDefault: !pengaturan.sidebarRapatDefault });
            simpanBagian('Preferensi');
          }}
        />
        <Toggle
          label="Tampilan layar penuh"
          desc="Konten melebar mengikuti layar (tablet/desktop). Matikan untuk tampilan rata tengah."
          aktif={pengaturan.kontenLebar}
          onClick={() => {
            ubah({ kontenLebar: !pengaturan.kontenLebar });
            simpanBagian('Preferensi');
          }}
        />
        <Toggle
          label="Animasi tombol & halaman"
          desc="Matikan jika HP terasa berat (segera hadir — saat ini selalu aktif)."
          aktif
          onClick={() => {}}
        />
      </Card>

      {/* Pasang di HP (PWA v1) */}
      <Card className="space-y-2.5">
        <h2 className="font-extrabold flex items-center gap-2"><Smartphone size={18} className="text-emerald-600" /> Pasang di HP</h2>
        {sudahPasang ? (
          <p className="text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5">
            Aplikasi sudah terpasang — dibuka dari ikon layar utama, bisa jalan walau sinyal putus sesaat.
          </p>
        ) : bisaPasang ? (
          <>
            <p className="text-sm text-slate-600">Pasang UMKM-Scan seperti aplikasi asli: buka cepat dari layar utama + tetap bisa dibuka saat offline.</p>
            <motion.button whileTap={{ scale: 0.97 }} onClick={pasangAplikasi} className="btn-primer w-full sm:w-auto">
              <Download size={16} /> Pasang Aplikasi
            </motion.button>
          </>
        ) : (
          <p className="text-[13px] text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
            Di HP Android: menu ⋮ → <b>Tambahkan ke Layar Utama / Install</b>. Di iPhone Safari: Bagikan → <b>Tambahkan ke Layar Utama</b>. Setelah itu tombol pasang otomatis muncul di sini bila didukung browser.
          </p>
        )}
      </Card>

      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <CheckCircle2 size={16} className="text-emerald-600" />
          Pengaturan tersimpan otomatis di perangkat ini.
        </div>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            reset();
            setPesan('Pengaturan dikembalikan ke bawaan.');
            setTimeout(() => setPesan(''), 2200);
          }}
          className="btn-lembut"
        >
          <RotateCcw size={16} /> Kembalikan bawaan
        </motion.button>
      </Card>
    </Wadah>
  );
}

function Toggle({ label, desc, aktif, onClick }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 px-3.5 py-3 text-left hover:border-slate-300 transition active:scale-[0.99]">
      <span className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors', aktif ? 'bg-emerald-500' : 'bg-slate-300')}>
        <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', aktif ? 'left-[22px]' : 'left-0.5')} />
      </span>
      <span>
        <span className="block text-sm font-bold">{label}</span>
        {desc && <span className="block text-xs text-slate-500">{desc}</span>}
      </span>
    </button>
  );
}
