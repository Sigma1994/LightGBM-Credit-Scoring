import { AlertTriangle, CheckCircle2, Clock, ShieldAlert, XCircle } from 'lucide-react';
import type { Decision } from '../shared/types.ts';

type SemanticVariant =
  | Decision
  | 'NOMINAL'
  | 'MODERATE_SHIFT'
  | 'CRITICAL_DRIFT'
  | 'READY'
  | 'UNAVAILABLE'
  | 'COMMITTED'
  | 'FAILED';

const VARIANT_CONFIG: Record<
  SemanticVariant,
  { label: string; classes: string; Icon: typeof CheckCircle2 }
> = {
  APPROVE: {
    label: 'Approve',
    classes: 'bg-emerald-950/80 text-emerald-300 border-emerald-800/80',
    Icon: CheckCircle2,
  },
  MANUAL_REVIEW: {
    label: 'Manual Review',
    classes: 'bg-amber-950/80 text-amber-300 border-amber-800/80',
    Icon: Clock,
  },
  DECLINE: {
    label: 'Decline',
    classes: 'bg-red-950/80 text-red-300 border-red-800/80',
    Icon: XCircle,
  },
  NOMINAL: {
    label: 'Nominal (PSI < 0.10)',
    classes: 'bg-emerald-950/80 text-emerald-300 border-emerald-800/80',
    Icon: CheckCircle2,
  },
  MODERATE_SHIFT: {
    label: 'Moderate Shift',
    classes: 'bg-amber-950/80 text-amber-300 border-amber-800/80',
    Icon: AlertTriangle,
  },
  CRITICAL_DRIFT: {
    label: 'Critical Drift',
    classes: 'bg-red-950/80 text-red-300 border-red-800/80',
    Icon: ShieldAlert,
  },
  READY: {
    label: 'Ready (200)',
    classes: 'bg-emerald-950/80 text-emerald-300 border-emerald-800/80',
    Icon: CheckCircle2,
  },
  UNAVAILABLE: {
    label: 'Fail-Closed (503)',
    classes: 'bg-red-950/80 text-red-300 border-red-800/80',
    Icon: ShieldAlert,
  },
  COMMITTED: {
    label: 'Committed',
    classes: 'bg-emerald-950/80 text-emerald-300 border-emerald-800/80',
    Icon: CheckCircle2,
  },
  FAILED: {
    label: 'Audit Failed',
    classes: 'bg-red-950/80 text-red-300 border-red-800/80',
    Icon: XCircle,
  },
};

export function StatusBadge({
  variant,
  compact = false,
}: {
  variant: SemanticVariant;
  compact?: boolean;
}) {
  const { label, classes, Icon } = VARIANT_CONFIG[variant];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border font-medium whitespace-nowrap shrink-0 ${
        compact ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-0.5 text-xs'
      } ${classes}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
