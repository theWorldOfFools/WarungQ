import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Camera, Keyboard, X } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { Card } from './ui';

// Kamera HP + input manual (USB scanner terbaca sebagai ketikan cepat).
export default function BarcodeInput({ onHasil }) {
  const [manual, setManual] = useState('');
  const [kameraAktif, setKameraAktif] = useState(false);
  const idPemindai = 'pemindai-kamera';
  const pemindaiRef = useRef(null);

  useEffect(() => {
    return () => {
      pemindaiRef.current?.stop().catch(() => {});
      pemindaiRef.current?.clear().catch(() => {});
    };
  }, []);

  async function nyalakanKamera() {
    try {
      setKameraAktif(true);
      // beri waktu render div pemindai
      await new Promise((r) => setTimeout(r, 60));
      const qr = new Html5Qrcode(idPemindai);
      pemindaiRef.current = qr;
      await qr.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: 220 },
        (teks) => {
          onHasil(teks);
          matikanKamera();
        }
      );
    } catch {
      alert('Kamera tidak bisa dibuka. Pakai ketik manual ya.');
      setKameraAktif(false);
    }
  }

  async function matikanKamera() {
    try {
      await pemindaiRef.current?.stop();
      await pemindaiRef.current?.clear();
    } catch {}
    setKameraAktif(false);
  }

  function kirimManual() {
    if (!manual.trim()) return;
    onHasil(manual.trim());
    setManual('');
  }

  return (
    <Card className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Keyboard size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input-besar pl-10"
            placeholder="Ketik / scan barcode..."
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && kirimManual()}
            inputMode="numeric"
          />
        </div>
        <motion.button whileTap={{ scale: 0.95 }} className="btn-gelap min-h-[48px] px-5" onClick={kirimManual}>
          Cari
        </motion.button>
      </div>
      {!kameraAktif ? (
        <motion.button whileTap={{ scale: 0.98 }} className="btn-lembut w-full min-h-[48px]" onClick={nyalakanKamera}>
          <Camera size={18} /> Scan Pakai Kamera HP
        </motion.button>
      ) : (
        <motion.button whileTap={{ scale: 0.98 }} className="btn-bahaya-lembut w-full min-h-[48px]" onClick={matikanKamera}>
          <X size={18} /> Tutup Kamera
        </motion.button>
      )}
      <div id={idPemindai} className={kameraAktif ? 'overflow-hidden rounded-xl border border-slate-200' : 'hidden'} />
      {kameraAktif && <p className="text-xs text-slate-500 text-center">Arahkan kamera ke barcode barang</p>}
    </Card>
  );
}
