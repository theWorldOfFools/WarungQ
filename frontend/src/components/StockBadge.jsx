import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { StatusBadge } from './ui';

// Badge stok mencolok: Aman (emerald) / Menipis (amber) / Habis (rose)
export default function StockBadge({ status }) {
  if (status === 'menipis')
    return (
      <StatusBadge tone="amber" dot>
        <AlertTriangle size={13} strokeWidth={2.5} /> Menipis
      </StatusBadge>
    );
  if (status === 'habis')
    return (
      <StatusBadge tone="rose" dot>
        <XCircle size={13} strokeWidth={2.5} /> Habis
      </StatusBadge>
    );
  return (
    <StatusBadge tone="emerald" dot>
      <CheckCircle2 size={13} strokeWidth={2.5} /> Aman
    </StatusBadge>
  );
}

export function toneStok(status) {
  if (status === 'habis') return 'rose';
  if (status === 'menipis') return 'amber';
  return 'emerald';
}
