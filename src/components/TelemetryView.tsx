import { ChevronDown, ChevronRight, Download, RefreshCw, Search } from 'lucide-react';
import { Fragment, useState } from 'react';
import type { Decision, InferenceLogEntry, TelemetryResponse } from '../shared/types.ts';
import { TableRowsSkeleton } from './GlobalSkeleton.tsx';
import { StatusBadge } from './StatusBadge.tsx';

interface TelemetryViewProps {
  telemetry: TelemetryResponse | null;
  loading: boolean;
  onRefresh: () => void;
  onSimulateTraffic: () => Promise<void>;
  simulating: boolean;
}

export function TelemetryView({
  telemetry,
  loading,
  onRefresh,
  onSimulateTraffic,
  simulating,
}: TelemetryViewProps) {
  const [decisionFilter, setDecisionFilter] = useState<'ALL' | Decision>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const logs = (telemetry?.logs ?? []).filter((entry) => {
    if (decisionFilter !== 'ALL' && entry.decision !== decisionFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        entry.customer_id.toLowerCase().includes(q) ||
        entry.request_id.toLowerCase().includes(q) ||
        entry.decision.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const exportCsv = () => {
    if (logs.length === 0) return;
    const headers = [
      'request_id',
      'customer_id',
      'as_of_time',
      'scored_at',
      'model_version',
      'contract_version',
      'calibrated_probability',
      'decision',
      'latency_ms',
      'audit_status',
    ];
    const rows = logs.map((l) => [
      l.request_id,
      l.customer_id,
      l.as_of_time,
      l.scored_at,
      l.model_version,
      l.contract_version,
      l.calibrated_probability.toFixed(4),
      l.decision,
      l.latency_ms.toFixed(2),
      l.audit_status,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ops_inference_logs_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const summary = telemetry?.summary;

  return (
    <div className="space-y-6">
      {/* Executive Orientation Header */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h2 className="font-display text-base font-semibold text-slate-100">
          Production Decision Audit Log
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Every credit decision is permanently recorded with the exact financial snapshot seen by
          the AI, response speed, and policy version—supporting regulatory audits and volume monitoring.
        </p>
      </section>

      {/* 4-Column Operational KPI Strip */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-800">
        {loading && !telemetry ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="p-5 space-y-2.5">
              <div className="skeleton-bar h-3 w-32 rounded" />
              <div className="skeleton-bar h-7 w-24 rounded" />
              <div className="skeleton-bar h-3 w-40 rounded" />
            </div>
          ))
        ) : (
          <>
            <div className="p-5">
              <p className="text-xs font-medium text-slate-300">Total Decisions Audited</p>
              <p className="mt-1.5 font-mono text-2xl font-semibold tabular-nums text-slate-100">
                {summary?.total_inferences ?? 0}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Showing up to 200 most recent scored applications
              </p>
            </div>

            <div className="p-5">
              <p className="text-xs font-medium text-slate-300">
                Outcomes (Approve / Review / Decline)
              </p>
              <p className="mt-1.5 font-mono text-2xl font-semibold tabular-nums text-slate-100">
                {summary?.approve_count ?? 0} / {summary?.manual_review_count ?? 0} /{' '}
                {summary?.decline_count ?? 0}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Split determined by live contract cutoffs
              </p>
            </div>

            <div className="p-5">
              <p className="text-xs font-medium text-slate-300">
                Response Speed (Median / 95th Pct)
              </p>
              <p className="mt-1.5 font-mono text-2xl font-semibold tabular-nums text-slate-100">
                {summary
                  ? `${summary.p50_latency_ms.toFixed(1)} / ${summary.p95_latency_ms.toFixed(1)} ms`
                  : '—'}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                95% of decisions finish within{' '}
                <span className="font-mono tabular-nums">
                  {summary ? `${summary.p95_latency_ms.toFixed(1)} ms` : '—'}
                </span>
              </p>
            </div>

            <div className="p-5">
              <p className="text-xs font-medium text-slate-300">Missing Compliance Logs</p>
              <p
                className={`mt-1.5 font-mono text-2xl font-semibold tabular-nums ${
                  (summary?.audit_failure_count ?? 0) > 0 ? 'text-red-400' : 'text-emerald-400'
                }`}
              >
                {summary?.audit_failure_count ?? 0}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Zero silent drops—failures pause scoring
              </p>
            </div>
          </>
        )}
      </section>

      {/* Filter Toolbar & High-Density Inference Audit Table */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search
                className="h-4 w-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search customer ID (e.g. CUST-2088)"
                aria-label="Filter inference logs"
                className="h-9 pl-9 pr-3 w-64 rounded-lg border border-slate-700 bg-slate-950 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="inline-flex items-center p-1 bg-slate-950 border border-slate-800 rounded-lg">
              {(['ALL', 'APPROVE', 'MANUAL_REVIEW', 'DECLINE'] as const).map((tab) => {
                const active = decisionFilter === tab;
                const label =
                  tab === 'ALL'
                    ? 'All'
                    : tab === 'APPROVE'
                      ? 'Approve'
                      : tab === 'MANUAL_REVIEW'
                        ? 'Review'
                        : 'Decline';
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setDecisionFilter(tab)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-slate-800 text-slate-100'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onSimulateTraffic}
              disabled={simulating}
              className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/70 hover:bg-slate-800 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              {simulating ? 'Simulating...' : 'Simulate Normal Traffic (+12)'}
            </button>
            <button
              type="button"
              onClick={exportCsv}
              disabled={logs.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/70 hover:bg-slate-800 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Export CSV</span>
            </button>
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              aria-label="Refresh telemetry logs"
              className="p-2 rounded-lg border border-slate-700 bg-slate-800/70 hover:bg-slate-800 text-slate-300 transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {loading || simulating ? (
          <TableRowsSkeleton rows={8} cols={7} />
        ) : logs.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <p className="text-sm font-medium text-slate-200">No matching audit records</p>
            <p className="text-xs text-slate-400">
              Clear your search filter or score an applicant to create a new audit entry.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-xs font-medium text-slate-400">
                  <th className="py-2.5 px-4 w-8" aria-label="Expand row" />
                  <th className="py-2.5 px-4">Audit ID</th>
                  <th className="py-2.5 px-4">Applicant</th>
                  <th className="py-2.5 px-4">Decision Time (UTC)</th>
                  <th className="py-2.5 px-4 text-right">Default Risk</th>
                  <th className="py-2.5 px-4">Outcome</th>
                  <th className="py-2.5 px-4 text-right">Speed</th>
                  <th className="py-2.5 px-4">Compliance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 text-xs">
                {logs.map((log: InferenceLogEntry) => {
                  const isExpanded = expandedId === log.request_id;
                  return (
                    <Fragment key={log.request_id}>
                      <tr
                        onClick={() => setExpandedId(isExpanded ? null : log.request_id)}
                        className="h-10 hover:bg-slate-800/50 cursor-pointer transition-colors"
                      >
                        <td className="px-4 text-slate-500">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" aria-hidden="true" />
                          ) : (
                            <ChevronRight className="h-4 w-4" aria-hidden="true" />
                          )}
                        </td>
                        <td className="px-4 font-mono tabular-nums text-slate-400 whitespace-nowrap">
                          {log.request_id.slice(0, 8)}
                        </td>
                        <td className="px-4 font-mono font-medium text-slate-100 whitespace-nowrap">
                          {log.customer_id}
                        </td>
                        <td className="px-4 font-mono tabular-nums text-slate-400 whitespace-nowrap">
                          {log.scored_at.replace('T', ' ').slice(0, 19)}
                        </td>
                        <td className="px-4 text-right font-mono tabular-nums font-medium text-slate-100 whitespace-nowrap">
                          {(log.calibrated_probability * 100).toFixed(2)}%
                        </td>
                        <td className="px-4 whitespace-nowrap">
                          <StatusBadge variant={log.decision} compact />
                        </td>
                        <td className="px-4 text-right font-mono tabular-nums text-slate-400 whitespace-nowrap">
                          {log.latency_ms.toFixed(2)} ms
                        </td>
                        <td className="px-4 whitespace-nowrap">
                          <StatusBadge variant={log.audit_status} compact />
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-slate-950/60">
                          <td colSpan={8} className="px-6 py-4">
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-2 text-xs text-slate-400 font-mono tabular-nums">
                              <span>
                                Captured Signals Snapshot · Model {log.model_version} · Policy{' '}
                                {log.contract_version} · Frozen at {log.as_of_time}
                              </span>
                              <span>Full Audit UUID: {log.request_id}</span>
                            </div>
                            <pre className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs text-slate-200 overflow-x-auto">
                              {JSON.stringify(log.features_json, null, 2)}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
