import { AlertCircle, ArrowRight, CheckCircle2, Clock, GitFork, Play, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import type {
  CustomerSummary,
  FeatureContract,
  FeatureVector,
  LedgerEvent,
  ScoreResponse,
} from '../shared/types.ts';
import { TableRowsSkeleton } from './GlobalSkeleton.tsx';
import { StatusBadge } from './StatusBadge.tsx';

interface LiveScoringViewProps {
  customers: CustomerSummary[];
  contract: FeatureContract | null;
  selectedCustomerId: string;
  onSelectCustomerId: (id: string) => void;
  asOfTime: string;
  onChangeAsOfTime: (isoUtc: string) => void;
  scoreResult: ScoreResponse | null;
  scoreError: { status: number; message: string; correlationId?: string } | null;
  isScoring: boolean;
  onRunScore: () => void;
}

const FEATURE_PLAIN_HINTS: Record<keyof FeatureVector, string> = {
  wd_ratio: 'Total money spent divided by total money deposited',
  repayment_rate: 'Repayments made relative to debit card transactions',
  repayment_count: 'Number of completed loan repayments on record',
  avg_tx_amount: 'Average dollar size per spending transaction',
  total_deposits: 'Total verified income & cash deposits settled',
  tx_count: 'Total number of spending transactions',
  has_zero_deposits: 'Flags brand-new or unfunded accounts (1 = no deposits)',
  days_since_last_event: 'Days elapsed since most recent account activity',
  total_withdrawals: 'Total cumulative outgoing spend & withdrawals',
  account_tenure_days: 'How long the account has been active prior to applying',
};

function formatUtcDisplay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

function formatCurrency(val: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(val);
}

export function LiveScoringView({
  customers,
  contract,
  selectedCustomerId,
  onSelectCustomerId,
  asOfTime,
  onChangeAsOfTime,
  scoreResult,
  scoreError,
  isScoring,
  onRunScore,
}: LiveScoringViewProps) {
  const [ledgerEvents, setLedgerEvents] = useState<LedgerEvent[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [activeWalkStep, setActiveWalkStep] = useState(0);
  const [walking, setWalking] = useState(false);

  const selectedCustomer = customers.find((c) => c.customer_id === selectedCustomerId) ?? null;

  useEffect(() => {
    if (!selectedCustomerId) return;
    let cancelled = false;
    setLoadingLedger(true);
    fetch(`/api/customers/${encodeURIComponent(selectedCustomerId)}/ledger`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load ledger'))))
      .then((data) => {
        if (!cancelled) setLedgerEvents(data.events ?? []);
      })
      .catch(() => {
        if (!cancelled) setLedgerEvents([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingLedger(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCustomerId]);

  useEffect(() => {
    if (!walking || !scoreResult?.walk_along_steps.length) return;
    const total = scoreResult.walk_along_steps.length;
    const timer = window.setInterval(() => {
      setActiveWalkStep((prev) => {
        if (prev >= total - 1) {
          setWalking(false);
          return prev;
        }
        return prev + 1;
      });
    }, 1500);
    return () => window.clearInterval(timer);
  }, [walking, scoreResult]);

  const anchorMs = Date.parse(asOfTime);

  const applyPreset = (mode: 'suggested' | 'early' | 'latest' | 'nowUtc') => {
    if (!selectedCustomer && mode !== 'nowUtc') return;
    if (mode === 'nowUtc') {
      onChangeAsOfTime(new Date().toISOString().slice(0, 19) + 'Z');
      return;
    }
    if (!selectedCustomer) return;
    if (mode === 'suggested') {
      onChangeAsOfTime(selectedCustomer.suggested_anchor_time);
    } else if (mode === 'early') {
      const firstMs = Date.parse(selectedCustomer.first_event_time);
      onChangeAsOfTime(new Date(firstMs + 5 * 86_400_000).toISOString().slice(0, 19) + 'Z');
    } else if (mode === 'latest') {
      const lastMs = Date.parse(selectedCustomer.last_event_time);
      onChangeAsOfTime(new Date(lastMs + 3_600_000).toISOString().slice(0, 19) + 'Z');
    }
  };

  const currentWalkStep = scoreResult?.walk_along_steps[activeWalkStep] ?? scoreResult?.walk_along_steps[0];

  return (
    <div className="space-y-6">
      {/* Executive Flow Banner */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-100">
              Simulate an Automated Credit Decision
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              1. Pick a borrower and freeze their timeline at the moment they applied · 2. Walk
              along the 40-tree AI decision process · 3. Inspect risk drivers &amp; blocked future
              activity.
            </p>
          </div>
          <span
            className={`text-xs font-mono shrink-0 ${
              scoreResult?.execution_engine === 'python_lightgbm'
                ? 'text-emerald-400'
                : 'text-blue-300'
            }`}
          >
            Runtime: {scoreResult?.execution_engine_label ?? 'JSON Trees / Python LightGBM'} · UTC
          </span>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
            <div>
              <label
                htmlFor="customer-select"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Applicant Profile
              </label>
              <select
                id="customer-select"
                value={selectedCustomerId}
                onChange={(e) => {
                  const id = e.target.value;
                  onSelectCustomerId(id);
                  const found = customers.find((c) => c.customer_id === id);
                  if (found) onChangeAsOfTime(found.suggested_anchor_time);
                }}
                className="w-full h-10 px-3 rounded-lg border border-slate-700 bg-slate-950 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {customers.map((c) => (
                  <option key={c.customer_id} value={c.customer_id}>
                    {c.customer_id} — {c.full_name} ({c.segment})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="anchor-time-input"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Decision Freeze Timestamp (UTC)
              </label>
              <input
                id="anchor-time-input"
                type="text"
                value={asOfTime}
                onChange={(e) => onChangeAsOfTime(e.target.value)}
                placeholder="2026-10-18T09:15:00Z"
                className="w-full h-10 px-3 rounded-lg border border-slate-700 bg-slate-950 font-mono text-sm tabular-nums text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => applyPreset('early')}
              title="Rewind timeline to 5 days after account opening"
              className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-800/70 hover:bg-slate-800 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0"
            >
              Day 5 History
            </button>
            <button
              type="button"
              onClick={() => applyPreset('suggested')}
              title="Freeze timeline at the exact loan application date"
              className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-800/70 hover:bg-slate-800 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0"
            >
              At Loan Application
            </button>
            <button
              type="button"
              onClick={() => applyPreset('latest')}
              title="Move clock past all future events to compare"
              className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-800/70 hover:bg-slate-800 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0"
            >
              After All Activity
            </button>
            <button
              type="button"
              onClick={() => applyPreset('nowUtc')}
              title="Use current live UTC timestamp"
              className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-800/70 hover:bg-slate-800 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0"
            >
              Now (UTC)
            </button>
          </div>
        </div>

        {selectedCustomer && (
          <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
            <span>Borrower Segment: {selectedCustomer.segment}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              Activity Dates: {selectedCustomer.first_event_time.slice(0, 10)} to{' '}
              {selectedCustomer.last_event_time.slice(0, 10)}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              Recorded Transactions: {selectedCustomer.total_events}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              Net Cash Flow: {formatCurrency(selectedCustomer.settled_balance_net)}
            </span>
          </div>
        )}
      </section>

      {/* Fail-Closed 503 or Validation Error State */}
      {scoreError && (
        <div
          role="alert"
          className="bg-red-950/50 border border-red-800/80 rounded-xl p-5 flex items-start gap-3.5"
        >
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-1 min-w-0">
            <h2 className="font-display text-sm font-semibold text-red-200">
              Scoring Paused Safely — HTTP {scoreError.status}
            </h2>
            <p className="text-sm text-red-300">{scoreError.message}</p>
            {scoreError.correlationId && (
              <p className="text-xs font-mono tabular-nums text-red-400">
                Reference ID: {scoreError.correlationId} · Fail-closed safety active (system refuses
                to guess when model or audit DB is offline)
              </p>
            )}
          </div>
        </div>
      )}

      {/* Primary Decision Output + Walk-Along Intelligence Trace */}
      {isScoring ? (
        <section
          className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden"
          aria-busy="true"
          aria-label="Computing underwriting decision"
        >
          <div className="p-6 border-b border-slate-800 flex items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="skeleton-bar h-5 w-48 rounded" />
              <div className="skeleton-bar h-3 w-72 rounded" />
            </div>
            <div className="skeleton-bar h-9 w-40 rounded-lg" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-800">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="p-5 space-y-2.5">
                <div className="skeleton-bar h-3 w-32 rounded" />
                <div className="skeleton-bar h-7 w-28 rounded" />
                <div className="skeleton-bar h-3 w-40 rounded" />
              </div>
            ))}
          </div>
          <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/40">
            <div className="skeleton-bar h-4 w-80 rounded" />
          </div>
        </section>
      ) : scoreResult ? (
        <>
          <section className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="p-6 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <h2 className="font-display text-lg font-semibold text-slate-100">
                    AI Credit Decision
                  </h2>
                  <StatusBadge variant={scoreResult.decision} />
                </div>
                <p className="text-xs text-slate-400 font-mono tabular-nums">
                  Audit ID {scoreResult.request_id.slice(0, 8)} ·{' '}
                  <span
                    className={
                      scoreResult.execution_engine === 'python_lightgbm'
                        ? 'text-emerald-400 font-medium'
                        : 'text-blue-300 font-medium'
                    }
                  >
                    {scoreResult.execution_engine_label}
                  </span>{' '}
                  · Model {scoreResult.model_version} · Policy {scoreResult.contract_version} ·{' '}
                  {scoreResult.latency_ms.toFixed(2)} ms
                </p>
              </div>

              <button
                type="button"
                onClick={onRunScore}
                disabled={isScoring}
                className="px-3.5 py-2 rounded-lg border border-slate-700 bg-slate-800/70 hover:bg-slate-800 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0"
              >
                Re-score at Freeze Time
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-800">
              <div className="p-5">
                <p className="text-xs font-medium text-slate-300">Predicted Default Risk</p>
                <p className="mt-1.5 font-mono text-2xl font-semibold tabular-nums text-slate-100">
                  {(scoreResult.calibrated_probability * 100).toFixed(2)}%
                </p>
                <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                  Platt-calibrated default odds (raw tree ensemble:{' '}
                  <span className="font-mono tabular-nums">
                    {(scoreResult.raw_score * 100).toFixed(2)}%
                  </span>
                  )
                </p>
              </div>

              <div className="p-5">
                <p className="text-xs font-medium text-slate-300">Automated Policy Cutoffs</p>
                <p className="mt-1.5 font-mono text-lg font-semibold tabular-nums text-slate-100">
                  Approve &lt; {(scoreResult.thresholds_applied.approve_max_prob * 100).toFixed(0)}% ·
                  Decline ≥ {(scoreResult.thresholds_applied.manual_review_max_prob * 100).toFixed(0)}%
                </p>
                <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                  Scores in between go to Human Review (governed by live contract)
                </p>
              </div>

              <div className="p-5">
                <p className="text-xs font-medium text-slate-300">Account History Used</p>
                <p className="mt-1.5 font-mono text-2xl font-semibold tabular-nums text-slate-100">
                  {scoreResult.events_included_count}{' '}
                  <span className="text-sm font-normal text-slate-400">
                    used / {scoreResult.events_excluded_future_count} hidden
                  </span>
                </p>
                <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                  Only transactions on or before the freeze timestamp are visible
                </p>
              </div>

              <div className="p-5">
                <p className="text-xs font-medium text-slate-300">Regulatory Audit Record</p>
                <div className="mt-2">
                  <StatusBadge variant={scoreResult.audit_logged ? 'COMMITTED' : 'FAILED'} />
                </div>
                <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
                  Snapshot saved permanently for compliance review
                </p>
              </div>
            </div>

            {scoreResult.leakage_comparison && (
              <div
                className={`px-6 py-4 border-t border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  scoreResult.leakage_comparison.decision_flipped
                    ? 'bg-amber-950/35'
                    : 'bg-slate-950/50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <ShieldCheck
                    className={`h-5 w-5 shrink-0 mt-0.5 ${
                      scoreResult.leakage_comparison.decision_flipped
                        ? 'text-amber-400'
                        : 'text-slate-400'
                    }`}
                    aria-hidden="true"
                  />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-slate-100">
                      {scoreResult.leakage_comparison.future_events_leaked === 0
                        ? 'Timeline Check: No future events exist after this timestamp.'
                        : scoreResult.leakage_comparison.decision_flipped
                          ? `Future-Data Cheating Prevented: ${scoreResult.leakage_comparison.future_events_leaked} ${
                              scoreResult.leakage_comparison.future_events_leaked === 1
                                ? 'transaction'
                                : 'transactions'
                            } happened after applying and would have fooled a naive AI into flipping this decision.`
                          : `Time-Lock Verified: ${scoreResult.leakage_comparison.future_events_leaked} later ${
                              scoreResult.leakage_comparison.future_events_leaked === 1
                                ? 'transaction was'
                                : 'transactions were'
                            } hidden from the AI so it could not peek into the future.`}
                    </p>
                    <p className="text-xs text-slate-400 font-mono tabular-nums">
                      Time-Locked AI: {(scoreResult.calibrated_probability * 100).toFixed(2)}% (
                      {scoreResult.decision}) vs. Naive AI Peeking at Future:{' '}
                      {(scoreResult.leakage_comparison.naive_probability * 100).toFixed(2)}% (
                      {scoreResult.leakage_comparison.naive_decision})
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs font-mono tabular-nums text-slate-200 shrink-0">
                  <span className="text-slate-400">Error Prevented:</span>
                  <span className="font-semibold">
                    {scoreResult.leakage_comparison.probability_delta >= 0 ? '+' : ''}
                    {(scoreResult.leakage_comparison.probability_delta * 100).toFixed(2)} pp
                  </span>
                </div>
              </div>
            )}
          </section>

          {/* Interactive Walk-Along of the AI Intelligence Steps */}
          <section className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-semibold text-slate-100">
                  Walk Along the AI Decision (6 Executed Steps)
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Follow the exact intelligence layer steps that just produced this decision—click
                  any step or play the walkthrough
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveWalkStep(0);
                  setWalking(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/70 hover:bg-slate-800 text-xs font-medium text-slate-100 transition-colors whitespace-nowrap shrink-0"
              >
                <Play className="h-3.5 w-3.5 text-blue-400" aria-hidden="true" />
                <span>{walking ? 'Walking Through Steps...' : 'Walk Through Steps'}</span>
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
                {scoreResult.walk_along_steps.map((step, idx) => {
                  const active = idx === activeWalkStep;
                  const done = idx < activeWalkStep;
                  return (
                    <button
                      key={step.step_number}
                      type="button"
                      onClick={() => {
                        setWalking(false);
                        setActiveWalkStep(idx);
                      }}
                      className={`text-left p-3 rounded-lg border transition-colors flex flex-col justify-between gap-2 ${
                        active
                          ? 'bg-blue-600/15 border-blue-500/60 text-slate-100'
                          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 text-[11px] font-mono">
                        <span className={active ? 'text-blue-400 font-semibold' : 'text-slate-500'}>
                          Step 0{step.step_number}
                        </span>
                        {done ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                        ) : (
                          <span className="text-slate-500 tabular-nums">{step.duration_ms}ms</span>
                        )}
                      </div>
                      <p className="text-xs font-medium leading-snug text-slate-100">
                        {step.title}
                      </p>
                      <p className="text-[11px] font-mono text-slate-400 truncate">
                        {step.live_output}
                      </p>
                    </button>
                  );
                })}
              </div>

              {currentWalkStep && (
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                  <div className="lg:col-span-6 space-y-1.5">
                    <p className="text-xs font-medium text-emerald-300">
                      Plain-Language Summary — Step 0{currentWalkStep.step_number}
                    </p>
                    <p className="text-sm text-slate-100 leading-relaxed">
                      {currentWalkStep.plain_summary}
                    </p>
                  </div>
                  <div className="lg:col-span-6 space-y-1.5 lg:border-l lg:border-slate-800 lg:pl-5">
                    <p className="text-xs font-medium text-blue-300">
                      Technical Intelligence Detail
                    </p>
                    <p className="text-xs font-mono text-slate-300 leading-relaxed">
                      {currentWalkStep.technical_detail}
                    </p>
                  </div>
                </div>
              )}

              {/* Top Decision Tree Rules Triggered */}
              {scoreResult.top_tree_rules.length > 0 && (
                <div className="pt-2 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
                    <GitFork className="h-3.5 w-3.5 text-blue-400" aria-hidden="true" />
                    <span>Top Decision Tree Paths Fired Across the 40-Tree GBDT Ensemble</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {scoreResult.top_tree_rules.slice(0, 4).map((rule) => (
                      <div
                        key={rule.tree_index}
                        className="px-3.5 py-2.5 rounded-lg border border-slate-800 bg-slate-950/60 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0">
                          <span className="font-mono text-slate-400 mr-2">
                            Tree #{rule.tree_index}
                          </span>
                          <span className="font-mono text-slate-200 break-all">
                            {rule.path_summary}
                          </span>
                        </div>
                        <span
                          className={`font-mono tabular-nums font-semibold shrink-0 ${
                            rule.direction === 'INCREASES_RISK'
                              ? 'text-red-400'
                              : rule.direction === 'REDUCES_RISK'
                                ? 'text-emerald-400'
                                : 'text-slate-400'
                          }`}
                        >
                          {rule.leaf_value >= 0 ? '+' : ''}
                          {rule.leaf_value.toFixed(3)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        </>
      ) : null}

      {/* Two-column analysis: Feature Attribution + Inspectable Ledger Timeline */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <section className="xl:col-span-5 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-100">
                Why the AI Scored This Way (Tree Path Attribution)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Red bars pushed tree votes toward Decline · Green bars pulled toward Approve
              </p>
            </div>
            <span className="text-xs font-mono text-slate-400">
              {contract?.feature_columns.length ?? 10} signals
            </span>
          </div>

          {isScoring ? (
            <div className="divide-y divide-slate-800/80" aria-busy="true">
              {Array.from({ length: 8 }).map((_, idx) => (
                <div key={idx} className="px-6 py-3 space-y-2">
                  <div className="flex justify-between">
                    <div className="skeleton-bar h-3 w-36 rounded" />
                    <div className="skeleton-bar h-3 w-16 rounded" />
                  </div>
                  <div className="skeleton-bar h-1.5 w-full rounded-full" />
                </div>
              ))}
            </div>
          ) : scoreResult ? (
            <div className="divide-y divide-slate-800/80">
              {scoreResult.attributions.map((attr) => {
                const maxBar = 1.4;
                const widthPct = Math.min(100, (Math.abs(attr.contribution_log_odds) / maxBar) * 100);
                const barColor =
                  attr.direction === 'INCREASES_RISK'
                    ? 'bg-red-500'
                    : attr.direction === 'REDUCES_RISK'
                      ? 'bg-emerald-500'
                      : 'bg-slate-500';
                const impactLabel =
                  attr.direction === 'INCREASES_RISK'
                    ? 'Raises Risk'
                    : attr.direction === 'REDUCES_RISK'
                      ? 'Lowers Risk'
                      : 'Neutral';

                return (
                  <div key={attr.feature} className="px-6 py-3 space-y-1.5">
                    <div className="flex items-start justify-between gap-2 text-xs">
                      <div>
                        <div className="font-medium text-slate-200">{attr.label}</div>
                        <div className="text-[11px] text-slate-400">
                          {FEATURE_PLAIN_HINTS[attr.feature]}
                        </div>
                      </div>
                      <span className="font-mono tabular-nums text-slate-100 font-semibold shrink-0">
                        {attr.feature.includes('deposit') ||
                        attr.feature.includes('withdrawal') ||
                        attr.feature.includes('avg_tx')
                          ? attr.feature === 'has_zero_deposits'
                            ? attr.value
                            : formatCurrency(attr.value)
                          : attr.value.toFixed(attr.feature.includes('count') ? 0 : 2)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${barColor}`}
                          style={{ width: `${Math.max(4, widthPct)}%` }}
                        />
                      </div>
                      <span
                        className={`text-right font-mono text-[11px] tabular-nums whitespace-nowrap ${
                          attr.direction === 'INCREASES_RISK'
                            ? 'text-red-400'
                            : attr.direction === 'REDUCES_RISK'
                              ? 'text-emerald-400'
                              : 'text-slate-400'
                        }`}
                      >
                        {attr.contribution_log_odds >= 0 ? '+' : ''}
                        {attr.contribution_log_odds.toFixed(3)} · {impactLabel}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-6 text-sm text-slate-400">
              Run scoring to inspect which applicant behaviors drove the decision.
            </div>
          )}
        </section>

        <section className="xl:col-span-7 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-100">
                Complete Account Activity Log
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Activity after {formatUtcDisplay(asOfTime)} is dimmed and hidden from the AI
              </p>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-400">
              {ledgerEvents.length} events
            </span>
          </div>

          {loadingLedger ? (
            <TableRowsSkeleton rows={7} cols={5} />
          ) : ledgerEvents.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">
              No ledger events found for this account.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-xs font-medium text-slate-400">
                    <th className="py-2.5 px-4">Date &amp; Time (UTC)</th>
                    <th className="py-2.5 px-4">Activity</th>
                    <th className="py-2.5 px-4">Method</th>
                    <th className="py-2.5 px-4 text-right">Amount</th>
                    <th className="py-2.5 px-4">Visible to AI?</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 text-sm">
                  {ledgerEvents.map((ev) => {
                    const evMs = Date.parse(ev.event_time);
                    const isFuture = !Number.isNaN(anchorMs) && evMs > anchorMs;
                    return (
                      <tr
                        key={ev.event_uuid}
                        className={`transition-colors ${
                          isFuture
                            ? 'bg-slate-950/40 text-slate-500'
                            : 'hover:bg-slate-800/50 text-slate-200'
                        }`}
                      >
                        <td className="py-2.5 px-4 font-mono text-xs tabular-nums whitespace-nowrap">
                          {ev.event_time.replace('T', ' ').replace('Z', '')}
                        </td>
                        <td className="py-2.5 px-4 font-medium text-xs whitespace-nowrap">
                          {ev.event_type === 'DEPOSIT'
                            ? 'Cash Deposit'
                            : ev.event_type === 'REPAYMENT'
                              ? 'Loan Repayment'
                              : 'Card / Wire Spend'}
                        </td>
                        <td className="py-2.5 px-4 text-xs font-mono whitespace-nowrap">
                          {ev.channel}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-xs tabular-nums whitespace-nowrap">
                          {formatCurrency(ev.amount)}
                        </td>
                        <td className="py-2.5 px-4 text-xs whitespace-nowrap">
                          {isFuture ? (
                            <span className="inline-flex items-center gap-1 text-amber-400 font-medium">
                              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                              Hidden (Future Event)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                              Included
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
