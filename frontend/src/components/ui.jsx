import { motion } from 'framer-motion';
import { cn } from './cn';

/** Kartu SaaS lembut */
export function Card({ className, children, ...rest }) {
  return (
    <div className={cn('card p-4 sm:p-5', className)} {...rest}>
      {children}
    </div>
  );
}

/** Kepala halaman konsisten */
export function PageHeader({ title, subtitle, action, icon }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        {icon && (
          <div className="hidden sm:flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600/10 text-emerald-700 border border-emerald-100">
            {icon}
          </div>
        )}
        <div>
          <h1 className="judul-halaman">{title}</h1>
          {subtitle && <p className="subjudul-halaman">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  );
}

/** Badge status generik */
export function StatusBadge({ tone = 'slate', children, dot = false }) {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    rose: 'bg-rose-50 text-rose-700 border-rose-200',
    slate: 'bg-slate-100 text-slate-600 border-slate-200',
    sky: 'bg-sky-50 text-sky-700 border-sky-200',
  };
  const dots = {
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500',
    slate: 'bg-slate-400',
    sky: 'bg-sky-500',
  };
  return (
    <span className={cn('badge border', tones[tone])}>
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', dots[tone])} />}
      {children}
    </span>
  );
}

/** Pesan sukses / error yang hidup */
export function Notice({ tone = 'success', children }) {
  if (!children) return null;
  const styles =
    tone === 'success'
      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
      : 'bg-rose-50 border-rose-200 text-rose-800';
  return (
    <motion.p
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('rounded-xl border px-3.5 py-2.5 text-sm font-semibold', styles)}
    >
      {children}
    </motion.p>
  );
}

/** State kosong yang ramah */
export function EmptyState({ icon, title, subtitle }) {
  return (
    <div className="card flex flex-col items-center justify-center gap-1.5 px-6 py-10 text-center">
      {icon && <div className="mb-1 text-slate-300">{icon}</div>}
      <p className="font-bold text-slate-800">{title}</p>
      {subtitle && <p className="text-sm text-slate-500 max-w-sm">{subtitle}</p>}
    </div>
  );
}

/** Skeleton loading */
export function Skeleton({ className }) {
  return <div className={cn('animate-pulse rounded-xl bg-slate-200/80', className)} />;
}
