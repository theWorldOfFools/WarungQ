import { rupiah } from '../api/client';

function singkatRp(n) {
  const v = Number(n || 0);
  if (v >= 1_000_000) return `Rp${(v / 1_000_000).toFixed(1)}jt`;
  if (v >= 1000) return `Rp${Math.round(v / 1000)}rb`;
  return `Rp${v}`;
}

function labelHari(tgl) {
  const teks = String(tgl || '');
  const d = new Date(teks.includes('T') ? teks : `${teks}T00:00:00`);
  if (Number.isNaN(d.getTime())) return teks;
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

/**
 * Grafik batang harian SVG ringan tanpa dependensi — untuk Laporan periode.
 * Dua seri: Uang Masuk Tunai (hijau) & Untung (biru) per hari.
 */
export default function GrafikHarian({ data = [] }) {
  if (!data.length) return null;
  const maks = Math.max(...data.map((d) => Math.max(d.uang_masuk || 0, d.untung || 0)), 1);
  const H = 190;
  const padX = 34;
  const padY = 26;
  const slot = Math.max(20, Math.min(40, Math.floor(880 / data.length)));
  const W = Math.max(560, data.length * slot + padX * 2);
  const barW = Math.max(4, Math.min(10, slot * 0.3));
  const xFor = (i) => padX + i * slot + (slot - barW * 2 - 3) / 2;
  const yFor = (v) => H - padY - Math.max(2, (v / maks) * (H - padY * 2));
  const step = Math.ceil(data.length / 8);

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ minWidth: `${Math.min(W, 900)}px` }}
        className="w-full h-48"
        role="img"
        aria-label="Grafik uang masuk dan untung harian"
      >
        <defs>
          <linearGradient id="grafikTunai" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
          <linearGradient id="grafikUntung" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#0284c7" />
          </linearGradient>
        </defs>

        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line
            key={f}
            x1={padX}
            x2={W - padX}
            y1={H - padY - f * (H - padY * 2)}
            y2={H - padY - f * (H - padY * 2)}
            stroke="#e2e8f0"
            strokeDasharray="4 4"
          />
        ))}

        {data.map((d, i) => {
          const yMasuk = yFor(d.uang_masuk || 0);
          const yUntung = yFor(d.untung || 0);
          return (
            <g key={d.tanggal || i}>
              <rect
                x={xFor(i)}
                y={yMasuk}
                width={barW}
                height={H - padY - yMasuk}
                rx={3}
                fill="url(#grafikTunai)"
                opacity={0.95}
              >
                <title>{`${labelHari(d.tanggal)} — Uang masuk: ${rupiah(d.uang_masuk)}`}</title>
              </rect>
              <rect
                x={xFor(i) + barW + 3}
                y={yUntung}
                width={barW}
                height={H - padY - yUntung}
                rx={3}
                fill="url(#grafikUntung)"
                opacity={0.9}
              >
                <title>{`${labelHari(d.tanggal)} — Untung: ${rupiah(d.untung)}`}</title>
              </rect>
              {i % step === 0 && (
                <text
                  x={xFor(i) + barW}
                  y={H - 8}
                  textAnchor="middle"
                  fontSize={10}
                  fontWeight={700}
                  fill="#64748b"
                >
                  {labelHari(d.tanggal)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="flex items-center justify-center gap-4 text-xs font-bold text-slate-600">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-gradient-to-b from-emerald-500 to-emerald-600" /> Uang masuk tunai
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-gradient-to-b from-sky-400 to-sky-600" /> Untung
        </span>
        <span className="text-slate-400">Tertinggi: {singkatRp(maks)}</span>
      </div>
    </div>
  );
}
