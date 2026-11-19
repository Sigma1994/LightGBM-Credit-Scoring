import type { FeatureVector, LedgerEvent } from '../src/shared/types.ts';

export const FEATURE_COLUMNS: (keyof FeatureVector)[] = [
  'total_deposits',
  'total_withdrawals',
  'wd_ratio',
  'has_zero_deposits',
  'tx_count',
  'repayment_count',
  'repayment_rate',
  'avg_tx_amount',
  'account_tenure_days',
  'days_since_last_event',
];

export const FEATURE_LABELS: Record<keyof FeatureVector, string> = {
  total_deposits: 'Total Settled Deposits ($)',
  total_withdrawals: 'Total Withdrawals ($)',
  wd_ratio: 'Withdrawal-to-Deposit Ratio',
  has_zero_deposits: 'Zero-Deposit Indicator',
  tx_count: 'Debit Transaction Count',
  repayment_count: 'Settled Repayment Count',
  repayment_rate: 'Repayment-to-Tx Ratio',
  avg_tx_amount: 'Mean Transaction Amount ($)',
  account_tenure_days: 'Account Tenure (Days)',
  days_since_last_event: 'Days Since Last Event',
};

/**
 * Normalizes any ISO-8601 or naive timestamp string to UTC epoch milliseconds.
 * Prevents Polars/Python-style timezone-naive vs UTC-aware comparison crashes.
 */
export function parseUtcMs(timestamp: string): number {
  const trimmed = timestamp.trim();
  if (!trimmed) {
    throw new Error('Timestamp cannot be empty.');
  }
  // If naive ISO string without Z or +/-HH:MM offset, explicitly anchor to UTC
  const hasOffset = /([zZ]|[+-]\d{2}:\d{2})$/.test(trimmed);
  const normalized = hasOffset ? trimmed : `${trimmed}Z`;
  const ms = Date.parse(normalized);
  if (Number.isNaN(ms)) {
    throw new Error(`Invalid UTC timestamp: ${timestamp}`);
  }
  return ms;
}

export interface PointInTimeExtractionResult {
  features: FeatureVector;
  includedEvents: LedgerEvent[];
  excludedFutureEvents: LedgerEvent[];
}

/**
 * Single-pass Point-in-Time feature extraction.
 * Shared verbatim by both offline contract calibration/validation and online scoring
 * to guarantee zero training-serving skew and zero future data leakage.
 */
export function computePointInTimeFeatures(
  events: LedgerEvent[],
  anchorTimeIso: string,
  enforcePointInTime = true
): PointInTimeExtractionResult {
  const anchorMs = parseUtcMs(anchorTimeIso);

  const includedEvents: LedgerEvent[] = [];
  const excludedFutureEvents: LedgerEvent[] = [];

  let totalDeposits = 0;
  let totalWithdrawals = 0;
  let txCount = 0;
  let repaymentCount = 0;
  let minEventMs = Number.POSITIVE_INFINITY;
  let maxEventMs = Number.NEGATIVE_INFINITY;

  for (const ev of events) {
    const evMs = parseUtcMs(ev.event_time);
    if (enforcePointInTime && evMs > anchorMs) {
      excludedFutureEvents.push(ev);
      continue;
    }

    includedEvents.push(ev);
    if (evMs < minEventMs) minEventMs = evMs;
    if (evMs > maxEventMs) maxEventMs = evMs;

    if (ev.event_type === 'DEPOSIT') {
      totalDeposits += ev.amount;
    } else if (ev.event_type === 'TRANSACTION') {
      totalWithdrawals += ev.amount;
      txCount += 1;
    } else if (ev.event_type === 'REPAYMENT') {
      repaymentCount += 1;
    }
  }

  // Safe division-by-zero handling:
  // If deposits == 0 and withdrawals == 0 -> 0.0 (no activity), distinct from withdrawals > 0 -> 1.0 + has_zero_deposits=1
  const hasZeroDeposits = totalDeposits <= 0 ? 1 : 0;
  let wdRatio = 0;
  if (totalDeposits > 0) {
    wdRatio = totalWithdrawals / totalDeposits;
  } else if (totalWithdrawals > 0) {
    wdRatio = 1.0;
  } else {
    wdRatio = 0.0;
  }

  const repaymentRate = txCount > 0 ? repaymentCount / txCount : repaymentCount > 0 ? 1.0 : 0.0;
  const avgTxAmount = txCount > 0 ? totalWithdrawals / txCount : 0.0;

  const msPerDay = 86_400_000;
  const accountTenureDays =
    includedEvents.length > 0 ? Math.max(0, (anchorMs - minEventMs) / msPerDay) : 0;
  const daysSinceLastEvent =
    includedEvents.length > 0 ? Math.max(0, (anchorMs - maxEventMs) / msPerDay) : 0;

  const round4 = (n: number) => Math.round(n * 10000) / 10000;

  return {
    features: {
      total_deposits: round4(totalDeposits),
      total_withdrawals: round4(totalWithdrawals),
      wd_ratio: round4(wdRatio),
      has_zero_deposits: hasZeroDeposits,
      tx_count: txCount,
      repayment_count: repaymentCount,
      repayment_rate: round4(repaymentRate),
      avg_tx_amount: round4(avgTxAmount),
      account_tenure_days: round4(accountTenureDays),
      days_since_last_event: round4(daysSinceLastEvent),
    },
    includedEvents,
    excludedFutureEvents,
  };
}
