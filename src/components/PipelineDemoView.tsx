import { ArrowRight, CheckCircle2, GitFork, Play, RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import type {
  CustomerSummary,
  FeatureContract,
  ScoreResponse,
} from '../shared/types.ts';
import { StatusBadge } from './StatusBadge.tsx';

type AudienceLens = 'dual' | 'executive' | 'technical';

interface PipelineDemoViewProps {
  customers: CustomerSummary[];
  selectedCustomerId: string;
  onSelectCustomerId: (id: string) => void;
  asOfTime: string;
  onChangeAsOfTime: (iso: string) => void;
  scoreResult: ScoreResponse | null;
  contract: FeatureContract | null;
  isScoring: boolean;
  onRunScore: () => void;
}

export function PipelineDemoView({
  customers,
  selectedCustomerId,
  onSelectCustomerId,
  asOfTime,
  onChangeAsOfTime,
  scoreResult,
  contract,
  isScoring,
  onRunScore,
}: PipelineDemoViewProps) {
  const [lens, setLens] = useState<AudienceLens>('dual');
  const [activeStageIdx, setActiveStageIdx] = useState(0);
  const [isStepping, setIsStepping] = useState(false);

  const steps = scoreResult?.walk_along_steps ?? [];

  useEffect(() => {
    if (!isStepping || steps.length === 0) return;
    const timer = window.setInterval(() => {
      setActiveStageIdx((prev) => {
        if (prev >= steps.length - 1) {
          setIsStepping(false);
          return prev;
        }
        return prev + 1;
      });
    }, 1800);
    return () => window.clearInterval(timer);
  }, [isStepping, steps.length]);

  const startWalkthrough = () => {
    setActiveStageIdx(0);
    setIsStepping(true);
    onRunScore();
  };

  const activeStep = steps[activeStageIdx] ?? steps[0];

  return (
    <div className="space-y-6">
      {/* Boardroom Controls & Audience Lens */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="font-display text-lg font-semibold text-slate-100">
              Live Intelligence Layer Walk-Along
            </h2>
            <p className="text-sm text-slate-400 max-w-2xl">
              Step through the real {contract?.tree_count ?? 40}-tree Gradient Boosted Decision Tree
              execution trace for any applicant—toggle between plain-language executive framing and
              ML engineering details.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div
              className="inline-flex items-center p-1 bg-slate-950 border border-slate-800 rounded-lg"
              role="group"
              aria-label="Audience explanation lens"
            >
              {(
                [
                  { id: 'dual', label: 'Dual View' },
                  { id: 'executive', label: 'Plain Language' },
                  { id: 'technical', label: 'Technical Layer' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setLens(opt.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    lens === opt.id
                      ? 'bg-slate-800 text-slate-100'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Live Demo Applicant Selector + Step-through Controls */}
        <div className="pt-4 border-t border-slate-800 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1 max-w-2xl">
            <div>
              <label
                htmlFor="pipeline-customer-select"
                className="block text-xs font-medium text-slate-400 mb-1.5"
              >
                Demo Case Study Account
              </label>
              <select
                id="pipeline-customer-select"
                value={selectedCustomerId}
                onChange={(e) => {
                  const id = e.target.value;
                  onSelectCustomerId(id);
                  const found = customers.find((c) => c.customer_id === id);
                  if (found) onChangeAsOfTime(found.suggested_anchor_time);
                }}
                className="w-full h-10 px-3 rounded-lg border border-slate-700 bg-slate-950 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                htmlFor="pipeline-anchor-display"
                className="block text-xs font-medium text-slate-400 mb-1.5"
              >
                Decision Freeze Timestamp (UTC)
              </label>
              <input
                id="pipeline-anchor-display"
                type="text"
                value={asOfTime}
                onChange={(e) => onChangeAsOfTime(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-700 bg-slate-950 font-mono text-sm tabular-nums text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={startWalkthrough}
              disabled={isScoring}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium transition-colors whitespace-nowrap shrink-0"
            >
              <Play className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{isStepping ? 'Walking Live...' : 'Play 6-Step Walk-Along'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsStepping(false);
                setActiveStageIdx(0);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-700 bg-slate-800/70 hover:bg-slate-800 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Reset</span>
            </button>
          </div>
        </div>
      </section>

      {/* Visual 6-Stage Executed Pipeline Flow */}
      <section className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3" aria-label="Executed pipeline stages">
        {steps.map((step, idx) => {
          const isActive = idx === activeStageIdx;
          const isCompleted = idx < activeStageIdx;
          return (
            <button
              key={step.step_number}
              type="button"
              onClick={() => {
                setIsStepping(false);
                setActiveStageIdx(idx);
              }}
              className={`text-left p-4 rounded-xl border transition-colors flex flex-col justify-between gap-3 ${
                isActive
                  ? 'bg-blue-600/15 border-blue-500/50 text-slate-100'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-300'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`font-mono text-xs font-semibold tabular-nums ${
                    isActive ? 'text-blue-400' : 'text-slate-500'
                  }`}
                >
                  Step 0{step.step_number}
                </span>
                {isCompleted ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" aria-hidden="true" />
                ) : (
                  <ArrowRight
                    className={`h-4 w-4 shrink-0 ${isActive ? 'text-blue-400' : 'text-slate-600'}`}
                    aria-hidden="true"
                  />
                )}
              </div>
              <div>
                <p className="font-display text-xs font-semibold leading-snug text-slate-100">
                  {step.title}
                </p>
                <p className="mt-1.5 font-mono text-[11px] text-slate-400 truncate">
                  {step.live_output}
                </p>
              </div>
            </button>
          );
        })}
      </section>

      {/* Active Stage Deep Inspection Panel */}
      {activeStep && scoreResult && (
        <section className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-mono text-blue-400">
                Executed Step 0{activeStep.step_number} of 0{steps.length} ·{' '}
                {activeStep.duration_ms.toFixed(2)} ms
              </p>
              <h3 className="font-display text-lg font-semibold text-slate-100 mt-0.5">
                {activeStep.title}
              </h3>
            </div>

            <div className="flex items-center gap-3">
              <StatusBadge variant={scoreResult.decision} compact />
              <span className="text-xs text-slate-400 font-mono">
                {scoreResult.model_version} · {contract?.tree_count ?? 40} trees
              </span>
            </div>
          </div>

          <div
            className={`grid grid-cols-1 ${
              lens === 'dual' ? 'lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-800' : ''
            }`}
          >
            {(lens === 'dual' || lens === 'executive') && (
              <div className="p-6 space-y-3">
                <div className="text-xs font-medium text-emerald-300">
                  Plain-Language Executive View
                </div>
                <p className="text-sm leading-relaxed text-slate-200">
                  {activeStep.plain_summary}
                </p>
                <p className="text-xs text-slate-400 font-mono">
                  Live Result: {activeStep.live_output}
                </p>
              </div>
            )}

            {(lens === 'dual' || lens === 'technical') && (
              <div className="p-6 space-y-3 bg-slate-950/35">
                <div className="text-xs font-medium text-blue-300">
                  Technical Intelligence Layer
                </div>
                <p className="text-sm leading-relaxed text-slate-200">
                  {activeStep.technical_detail}
                </p>
                <p className="text-xs text-slate-400 font-mono">
                  Request UUID: {scoreResult.request_id.slice(0, 8)} · Step Runtime:{' '}
                  {activeStep.duration_ms.toFixed(2)} ms
                </p>
              </div>
            )}
          </div>

          {/* Live Tree Rules Evidence when inspecting GBDT ensemble */}
          <div className="px-6 py-5 border-t border-slate-800 bg-slate-950/60 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
                <GitFork className="h-3.5 w-3.5 text-blue-400" aria-hidden="true" />
                <span>Actual Decision Tree Splits Executed for {scoreResult.customer_id}</span>
              </div>
              <span className="text-xs font-mono text-slate-500">
                Saabas tree-path attribution active
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              {scoreResult.top_tree_rules.slice(0, 6).map((rule) => (
                <div
                  key={rule.tree_index}
                  className="px-3 py-2 rounded-lg border border-slate-800 bg-slate-900/90 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-mono text-[11px] text-slate-400">
                      Tree #{rule.tree_index}
                    </div>
                    <div className="font-mono text-[11px] text-slate-200 truncate">
                      {rule.path_summary}
                    </div>
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
        </section>
      )}
    </div>
  );
}
