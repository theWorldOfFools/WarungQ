import { rupiah } from '../api/client';

/** Grafik batang SVG ringan tanpa dependensi — untuk Dompet Harian */
export default function MiniChart({ data = [] }) {
  if (!data.length) return null;
  const maks = Math.max(...data.map((d) => d.uang_masuk || 0), 1);
  const W = 560;
  const H = 168;
  const pad = 28;
  const n = data.length;
  const slot = (W - pad * 2) / n;
  const barW = Math.min(46, slot * 0.55);

  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-40" role="img" aria-label="Grafik produk terlaris">
        <defs>
          <linearGradient id="uangMasuk" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line
            key={f}
            x1={pad}
            x2={W - pad}
            y1={H - pad - f * (H - pad * 2)}
            y2={H - pad - f * (H - pad * 2)}
            stroke="#e2e8f0"
            strokeDasharray="4 4"
          />
        ))}
        {data.slice(0, 7).map((d, i) => {
          const h = Math.max(6, ((d.uang_masuk || 0) / maks) * (H - pad * 2));
          const x = pad + i * slot + (slot - barW) / 2;
          const y = H - pad - h;
          return (
            <g key={d.nama || i}>
              <rect x={x} y={y} width={barW} height={h} rx={8} fill="url(#uangMasuk)" opacity={0.92} />
              <text
                x={x + barW / 2}
                y={H - 8}
                textAnchor="middle"
                fontSize={10.5}
                fontWeight={700}
                fill="#64748b"
              >
                {(d.nama || '').slice(0, 8)}
              </text>
              <text x={x + barW / 2} y={y - 6} textAnchor="middle" fontSize={10} fontWeight={800} fill="#047857">
                {singkatRp(d.uang_masuk)}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="sr-only">{data.map((d) => `${d.nama} ${rupiah(d.uang_masuk)}`).join(', ')}</p>
    </div>
  );
}

function singkatRp(n) {
  const v = Number(n || 0);
  if (v >= 1_000_000) return `Rp${(v / 1_000_000).toFixed(1)}jt`;
  if (v >= 1000) return `Rp${Math.round(v / 1000)}rb`;
  return `Rp${v}`;
}
