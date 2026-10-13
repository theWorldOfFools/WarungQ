import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, Printer, QrCode } from 'lucide-react';
import JsBarcode from 'jsbarcode';
import { QRCodeSVG } from 'qrcode.react';
import { rupiah } from '../api/client';

/** Ambil kode label: barcode asli, atau SKU sementara dari id. */
export function kodeLabelUntuk(produk = {}) {
  const b = (produk.barcode || '').trim();
  if (b) return { kode: b, sementara: false };
  const pendek = String(produk.id || 'TANPA-KODE').replace(/-/g, '').slice(0, 8).toUpperCase() || 'TANPA-KODE';
  return { kode: `SKU-${pendek}`, sementara: true };
}

function renderBarcode(svgEl, kode) {
  if (!svgEl || !kode) return;
  try {
    JsBarcode(svgEl, kode, {
      format: 'CODE128',
      width: 1.6,
      height: 48,
      displayValue: true,
      fontSize: 11,
      margin: 0,
      background: '#ffffff',
      lineColor: '#000000',
    });
  } catch {
    try {
      JsBarcode(svgEl, kode, { format: 'CODE39', width: 1.4, height: 48, displayValue: true, fontSize: 11, margin: 0 });
    } catch {}
  }
}

/**
 * Modal Lihat / Cetak Label QR + Barcode untuk 1 produk.
 * - Layar: preview QR (qrcode.react) + Barcode linear (jsbarcode) + tombol Cetak Label.
 * - Cetak: hanya stiker kecil #cetak-label yang keluar (lihat index.css @media print).
 */
export default function LabelBarcodeModal({ produk, onTutup }) {
  const layarRef = useRef(null);
  const cetakRef = useRef(null);

  const { kode, sementara } = kodeLabelUntuk(produk || {});

  useEffect(() => {
    renderBarcode(layarRef.current, kode);
    renderBarcode(cetakRef.current, kode);
  }, [kode]);

  useEffect(() => {
    function tutupEsc(e) {
      if (e.key === 'Escape') onTutup?.();
    }
    window.addEventListener('keydown', tutupEsc);
    return () => window.removeEventListener('keydown', tutupEsc);
  }, [onTutup]);

  if (!produk) return null;

  function cetakLabel() {
    document.body.classList.remove('mau-cetak-struk');
    document.body.classList.add('mau-cetak-label');
    // beri waktu agar CSS print siap, lalu print
    setTimeout(() => {
      window.print();
      // bersihkan setelah dialog print tertutup
      setTimeout(() => document.body.classList.remove('mau-cetak-label'), 500);
    }, 60);
  }

  return (
    <>
      {/* ===== Overlay modal (layar saja, jangan ikut tercetak) ===== */}
      <div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/55 p-3"
        onClick={onTutup}
        data-tutup-label
      >
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.98 }}
          transition={{ duration: 0.18 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"
        >
          <div className="flex items-start justify-between gap-2">
            <h2 className="flex items-center gap-2 font-extrabold text-slate-900">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white">
                <QrCode size={18} />
              </span>
              Label QR / Barcode
            </h2>
            <button onClick={onTutup} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" title="Tutup">
              <X size={18} />
            </button>
          </div>

          <p className="mt-1 truncate font-bold text-slate-800">{produk.nama}</p>
          <p className="text-sm font-extrabold text-emerald-700">{rupiah(produk.harga_jual)}</p>

          {sementara && (
            <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
              Produk ini belum punya barcode — memakai kode sementara <b>{kode}</b>. Isi barcode di menu Stok → Ubah agar label permanen.
            </p>
          )}

          {/* Preview QR */}
          <div className="mt-3 flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <QRCodeSVG value={kode} size={150} level="M" includeMargin />
            <p className="font-mono text-sm font-bold tracking-widest text-slate-800">{kode}</p>
          </div>

          {/* Preview Barcode linear */}
          <div className="mt-2 flex justify-center rounded-2xl border border-slate-200 bg-white p-3 overflow-x-auto">
            <svg ref={layarRef} />
          </div>

          <div className="mt-4 flex gap-2">
            <button onClick={cetakLabel} className="btn-primer flex-1">
              <Printer size={16} /> Cetak Label
            </button>
            <button onClick={onTutup} className="btn-lembut flex-1">
              Tutup
            </button>
          </div>
          <p className="mt-2 text-center text-[11px] text-slate-400">
            Stiker dicetak kecil (±40mm) — cocok untuk printer label / thermal.
          </p>
        </motion.div>
      </div>

      {/* ===== Area cetak stiker kecil — hanya muncul saat print ===== */}
      <div id="cetak-label" className="area-cetak" aria-hidden>
        <div
          style={{
            width: '40mm',
            padding: '2mm',
            background: '#fff',
            color: '#000',
            fontFamily: 'Arial, sans-serif',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '10pt', fontWeight: 800, lineHeight: 1.2, wordBreak: 'break-word' }}>
            {produk.nama}
          </div>
          <div style={{ fontSize: '11pt', fontWeight: 800, marginTop: '1mm' }}>
            {`Rp${Number(produk.harga_jual || 0).toLocaleString('id-ID')}`}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.5mm' }}>
            <svg ref={cetakRef} style={{ maxWidth: '36mm' }} />
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: '8pt', letterSpacing: '1px', marginTop: '1mm' }}>
            {kode}
          </div>
        </div>
      </div>
    </>
  );
}
