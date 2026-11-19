import { useEffect, useState } from 'react';
import type { DriftReport, FeatureContract, FeaturePsiDetail } from '../shared/types.ts';
import { TableRowsSkeleton } from './GlobalSkeleton.tsx';
import { StatusBadge } from './StatusBadge.tsx';

interface DriftCalibrationViewProps {
  contract: FeatureContract | null;
  drift: DriftReport | null;
  loading: boolean;
  onSimulateShiftTraffic: () => Promise<void>;
  simulatingShift: boolean;
}

export function DriftCalibrationView({
  contract,
  drift,
  loading,
  onSimulateShiftTraffic,
  simulatingShift,
}: DriftCalibrationViewProps) {
  const [selectedFeatureKey, setSelectedFeatureKey] = useState<string>('');

  useEffect(() => {
    if (drift && drift.features.length > 0 && !selectedFeatureKey) {
      setSelectedFeatureKey(drift.features[0].feature);
    }
  }, [drift, selectedFeatureKey]);

  const activeFeature: FeaturePsiDetail | undefined =
    drift?.features.find((f) => f.feature === selectedFeatureKey) ?? drift?.features[0];

  const metrics = contract?.validation_metrics;
  const calBins = contract?.calibration_bins ?? [];

  return (
    <div className="space-y-6">
      {/* Executive Orientation Header */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h2 className="font-display text-base font-semibold text-slate-100">
          Model Trustworthiness &amp; Population Drift Monitor
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Answers two critical governance questions: (1) Were the AI&apos;s risk percentages accurate
          on unseen future applicants? and (2) Are today&apos;s live applicants shifting away from
          what the AI was trained on?
        </p>
      </section>

      {/* Validation & Calibration Scorecard */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-display text-base font-semibold text-slate-100">
              Backtest Proof on Unseen Future Data (Out-of-Time Validation)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Tested strictly on applications after the training cutoff so accuracy reflects real
              production performance
            </p>
          </div>
          {metrics && (
            <span className="text-xs font-mono tabular-nums text-slate-400">
              Train n={metrics.training_samples.toLocaleString()} · Unseen OOT n=
              {metrics.oot_samples.toLocaleString()}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-slate-800">
          {!metrics ? (
            Array.from({ length: 5 }).map((_, idx) => (
              <div key={idx} className="p-5 space-y-2.5">
                <div className="skeleton-bar h-3 w-24 rounded" />
                <div className="skeleton-bar h-7 w-20 rounded" />
                <div className="skeleton-bar h-3 w-28 rounded" />
              </div>
            ))
          ) : (
            <>
              <div className="p-5">
                <p className="text-xs font-medium text-slate-300">Ranking Power (ROC-AUC)</p>
                <p className="mt-1.5 font-mono text-2xl font-semibold tabular-nums text-slate-100">
                  {metrics.oot_roc_auc.toFixed(4)}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  How well the AI ranks risky borrowers above safe ones (1.00 = perfect)
                </p>
              </div>
              <div className="p-5">
                <p className="text-xs font-medium text-slate-300">Default Catch Rate (PR-AUC)</p>
                <p className="mt-1.5 font-mono text-2xl font-semibold tabular-nums text-slate-100">
                  {metrics.pr_auc.toFixed(4)}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Precision at catching defaults without false alarms
                </p>
              </div>
              <div className="p-5">
                <p className="text-xs font-medium text-slate-300">Risk Separation (KS)</p>
                <p className="mt-1.5 font-mono text-2xl font-semibold tabular-nums text-slate-100">
                  {metrics.ks_statistic.toFixed(3)}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Max gap separating good vs. bad borrowers (higher is better)
                </p>
              </div>
              <div className="p-5">
                <p className="text-xs font-medium text-slate-300">Score Accuracy (Brier)</p>
                <p className="mt-1.5 font-mono text-2xl font-semibold tabular-nums text-slate-100">
                  {metrics.brier_score.toFixed(4)}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Average probability error (closer to 0.00 is better)
                </p>
              </div>
              <div className="p-5">
                <p className="text-xs font-medium text-slate-300">Calibration Gap (ECE)</p>
                <p className="mt-1.5 font-mono text-2xl font-semibold tabular-nums text-slate-100">
                  {(metrics.expected_calibration_error * 100).toFixed(2)}%
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Avg gap between predicted % and actual default rate
                </p>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Main 2-column grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <section className="xl:col-span-7 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-3">
                <h3 className="font-display text-base font-semibold text-slate-100">
                  Applicant Behavior Shift (PSI Drift)
                </h3>
                {drift && <StatusBadge variant={drift.overall_status} compact />}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Compares {drift?.sample_size ?? 0} live requests against training baseline · &lt;0.10
                Healthy · 0.10–0.25 Watch · ≥0.25 Retrain
              </p>
            </div>

            <button
              type="button"
              onClick={onSimulateShiftTraffic}
              disabled={simulatingShift}
              className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/70 hover:bg-slate-800 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              {simulatingShift ? 'Injecting Shift...' : 'Simulate Risk Shift (+15)'}
            </button>
          </div>

          {loading || simulatingShift ? (
            <TableRowsSkeleton rows={6} cols={4} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-xs font-medium text-slate-400">
                    <th className="py-2.5 px-4">Tracked Signal (Click to inspect)</th>
                    <th className="py-2.5 px-4 text-right">PSI Score</th>
                    <th className="py-2.5 px-4">Health Status</th>
                    <th className="py-2.5 px-4 text-right">Buckets</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 text-xs">
                  {(drift?.features ?? []).map((item) => {
                    const selected = activeFeature?.feature === item.feature;
                    return (
                      <tr
                        key={item.feature}
                        onClick={() => setSelectedFeatureKey(item.feature)}
                        className={`h-10 cursor-pointer transition-colors ${
                          selected ? 'bg-blue-600/15' : 'hover:bg-slate-800/50'
                        }`}
                      >
                        <td className="px-4 font-medium text-slate-100">
                          <div>{item.label}</div>
                          <div className="font-mono text-[11px] text-slate-400">{item.feature}</div>
                        </td>
                        <td className="px-4 text-right font-mono tabular-nums font-semibold text-slate-100">
                          {item.psi.toFixed(4)}
                        </td>
                        <td className="px-4">
                          <StatusBadge variant={item.status} compact />
                        </td>
                        <td className="px-4 text-right font-mono tabular-nums text-slate-400">
                          {item.bins.length}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {activeFeature && !loading && !simulatingShift && (
            <div className="p-6 border-t border-slate-800 bg-slate-950/40 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="font-display text-sm font-semibold text-slate-100">
                  Distribution Comparison: {activeFeature.label}
                </h4>
                <div className="flex items-center gap-4 text-xs text-slate-400">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block w-2.5 h-2.5 rounded-xs bg-slate-500" />
                    Training Baseline %
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block w-2.5 h-2.5 rounded-xs bg-blue-500" />
                    Live Traffic %
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                {activeFeature.bins.map((bin) => (
                  <div key={bin.label} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-slate-300">{bin.label}</span>
                      <span className="font-mono tabular-nums text-slate-400">
                        Train {bin.baseline_pct.toFixed(1)}% · Live {bin.production_pct.toFixed(1)}% ·
                        Shift {bin.bin_psi.toFixed(4)}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-slate-500 rounded-full"
                          style={{ width: `${Math.min(100, bin.baseline_pct)}%` }}
                        />
                      </div>
                      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${Math.min(100, bin.production_pct)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Platt Calibration Reliability Curve */}
        <section className="xl:col-span-5 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800">
            <h3 className="font-display text-base font-semibold text-slate-100">
              Does a 30% Score Really Mean 30% Default?
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Points sitting near the dashed diagonal prove predicted risk % matches real-world
              default rates
            </p>
          </div>

          <div className="p-6">
            <svg
              viewBox="0 0 360 260"
              className="w-full h-auto overflow-visible"
              role="img"
              aria-label="Calibration reliability curve comparing predicted probabilities against observed default rates"
            >
              {[0, 0.25, 0.5, 0.75, 1].map((t) => {
                const x = 48 + t * 280;
                const y = 216 - t * 184;
                return (
                  <g key={t}>
                    <line
                      x1={48}
                      y1={y}
                      x2={328}
                      y2={y}
                      stroke="#1E293B"
                      strokeDasharray={t === 0 ? undefined : '3 3'}
                    />
                    <text
                      x={40}
                      y={y + 4}
                      textAnchor="end"
                      className="fill-slate-400 text-[10px] font-mono"
                    >
                      {(t * 100).toFixed(0)}%
                    </text>
                    <text
                      x={x}
                      y={236}
                      textAnchor="middle"
                      className="fill-slate-400 text-[10px] font-mono"
                    >
                      {(t * 100).toFixed(0)}%
                    </text>
                  </g>
                );
              })}

              <line
                x1={48}
                y1={216}
                x2={328}
                y2={32}
                stroke="#475569"
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />

              {calBins.length > 0 && (
                <polyline
                  fill="none"
                  stroke="#3B82F6"
                  strokeWidth="2.5"
                  points={calBins
                    .map((b) => {
                      const cx = 48 + b.mean_predicted_prob * 280;
                      const cy = 216 - b.observed_default_rate * 184;
                      return `${cx},${cy}`;
                    })
                    .join(' ')}
                />
              )}

              {calBins.map((b) => {
                const cx = 48 + b.mean_predicted_prob * 280;
                const cy = 216 - b.observed_default_rate * 184;
                return (
                  <g key={b.bin_label}>
                    <circle
                      cx={cx}
                      cy={cy}
                      r={4.5}
                      fill="#3B82F6"
                      stroke="#0F172A"
                      strokeWidth="1.5"
                    />
                  </g>
                );
              })}

              <text
                x={188}
                y={254}
                textAnchor="middle"
                className="fill-slate-400 text-[11px] font-sans"
              >
                AI Predicted Default Risk (%)
              </text>
            </svg>

            <div className="mt-4 border-t border-slate-800 pt-4">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-800">
                    <th className="py-1.5 font-medium">Risk Band</th>
                    <th className="py-1.5 text-right font-medium">AI Predicted</th>
                    <th className="py-1.5 text-right font-medium">Actual Defaults</th>
                    <th className="py-1.5 text-right font-medium">Loans</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 font-mono tabular-nums">
                  {calBins.map((b) => (
                    <tr key={b.bin_label} className="text-slate-300">
                      <td className="py-1.5">{b.bin_label}</td>
                      <td className="py-1.5 text-right">
                        {(b.mean_predicted_prob * 100).toFixed(1)}%
                      </td>
                      <td className="py-1.5 text-right font-medium text-slate-100">
                        {(b.observed_default_rate * 100).toFixed(1)}%
                      </td>
                      <td className="py-1.5 text-right text-slate-400">{b.sample_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
