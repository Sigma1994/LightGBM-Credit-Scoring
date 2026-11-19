import {
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Cpu,
  FileJson,
  GitFork,
  Play,
  RotateCcw,
  Server,
  Terminal,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type {
  CustomerSummary,
  FeatureContract,
  ReadinessState,
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
  readiness: ReadinessState | null;
  isScoring: boolean;
  onRunScore: () => void;
}

const SYNC_COMMANDS = `pip install -r python/requirements.txt
python python/train_lightgbm.py
# Option A (Cloud Preview / Zero-Python Node): commit server/artifacts/gbdt_model.json + feature_contract.json
# Option B (Live Local Python Sidecar): uvicorn python.api:app --host 0.0.0.0 --port 8000`;

export function PipelineDemoView({
  customers,
  selectedCustomerId,
  onSelectCustomerId,
  asOfTime,
  onChangeAsOfTime,
  scoreResult,
  contract,
  readiness,
  isScoring,
  onRunScore,
}: PipelineDemoViewProps) {
  const [lens, setLens] = useState<AudienceLens>('dual');
  const [activeStageIdx, setActiveStageIdx] = useState(0);
  const [isStepping, setIsStepping] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);

  const steps = scoreResult?.walk_along_steps ?? [];
  const isPythonProxyActive =
    scoreResult?.model_format === 'lightgbm_python_proxy' ||
    readiness?.model_engine === 'python_lightgbm_proxy';

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

  const handleCopyCommands = async () => {
    try {
      await navigator.clipboard.writeText(SYNC_COMMANDS);
      setCopiedCmd(true);
      window.setTimeout(() => setCopiedCmd(false), 1800);
    } catch {
      setCopiedCmd(false);
    }
  };

  const activeStep = steps[activeStageIdx] ?? steps[0];

  return (
    <div className="space-y-6">
      {/* Boardroom Controls & Audience Lens */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <h2 className="font-display text-lg font-semibold text-slate-100">
              Live Intelligence Layer Walk-Along (LightGBM Architecture)
            </h2>
            <p className="text-sm text-slate-400 max-w-2xl">
              Trace how raw ledger history passes through Point-in-Time isolation, {contract?.tree_count ?? 40}-tree
              gradient-boosted scoring, Platt calibration, and policy enforcement—with dual-mode execution for
              Python LightGBM or zero-dependency JSON tree inference.
            </p>
            <div className="pt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono tabular-nums text-slate-400">
              <span className={isPythonProxyActive ? 'text-emerald-400' : 'text-blue-400'}>
                Active Engine:{' '}
                {isPythonProxyActive
                  ? 'Python LightGBM FastAPI (TreeSHAP)'
                  : 'Node LightGBM-Schema Tree Walker (gbdt_model.json)'}
              </span>
              <span className="text-slate-600">·</span>
              <span>Model {contract?.model_version ?? 'gbdt-3.0.0-platt'}</span>
              {contract && (
                <>
                  <span className="text-slate-600">·</span>
                  <span>OOT ROC-AUC {contract.validation_metrics.oot_roc_auc.toFixed(4)}</span>
                  <span className="text-slate-600">·</span>
                  <span>KS {contract.validation_metrics.ks_statistic.toFixed(3)}</span>
                </>
              )}
            </div>
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
                  Request UUID: {scoreResult.request_id.slice(0, 8)} · Attribution:{' '}
                  {isPythonProxyActive ? 'LightGBM pred_contrib=True (TreeSHAP)' : 'Saabas Tree-Path Delta'}
                </p>
              </div>
            )}
          </div>

          {/* Live Tree Rules Evidence */}
          <div className="px-6 py-5 border-t border-slate-800 bg-slate-950/60 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
                <GitFork className="h-3.5 w-3.5 text-blue-400" aria-hidden="true" />
                <span>Actual Decision Tree Splits Executed for {scoreResult.customer_id}</span>
              </div>
              <span className="text-xs font-mono text-slate-500">
                {isPythonProxyActive
                  ? 'Live Python lightgbm.Booster + TreeSHAP'
                  : 'LightGBM tree_info JSON + Saabas attribution'}
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

      {/* LightGBM Training-to-Serving Parity Architecture */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-base font-semibold text-slate-100">
              How Python LightGBM Powers Both Local &amp; Cloud Serving
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Train once in Python LightGBM, then run via live FastAPI sidecar or commit the exported
              tree contract so zero-Python cloud containers execute the exact same splits
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400">
            Contract SHA-256: {contract?.artifact_sha256.slice(0, 12) ?? 'verified'}...
          </span>
        </div>

        <div className="p-6 space-y-6">
          {(lens === 'dual' || lens === 'executive') && (
            <div className="rounded-lg bg-slate-950/60 border border-slate-800 p-4 text-xs leading-relaxed text-slate-300">
              <span className="font-semibold text-emerald-300">Executive Summary: </span>
              Think of Python LightGBM as the master risk architect that learns 40 decision trees from
              historical loans. Once trained, it publishes a tamper-proof rulebook (
              <code className="font-mono text-slate-200">gbdt_model.json</code>). Your local Docker or
              API server can run the live Python engine directly, while lightweight cloud previews read
              that exact rulebook—guaranteeing 100% identical credit decisions without heavyweight Python
              dependencies in the web container.
            </div>
          )}

          {/* 3-Step Dual-Path Parity Flow */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-blue-400 font-semibold">01 · Offline Training</span>
                <Cpu className="h-4 w-4 text-blue-400" aria-hidden="true" />
              </div>
              <h4 className="font-display text-sm font-semibold text-slate-100">
                Train Python LightGBM + Platt Calibrator
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Run <code className="font-mono text-slate-200">python/train_lightgbm.py</code> on strict
                Out-of-Time PIT snapshots. Fits 40 depth-3 trees (<code className="font-mono text-slate-200">LGBMClassifier</code>)
                and logistic calibration, then validates ROC-AUC, KS, Brier, and ECE on future loans.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-emerald-400 font-semibold">02 · Dual Export</span>
                <FileJson className="h-4 w-4 text-emerald-400" aria-hidden="true" />
              </div>
              <h4 className="font-display text-sm font-semibold text-slate-100">
                Emit Native Booster + Tree JSON Contract
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Saves <code className="font-mono text-slate-200">lightgbm_model.txt</code> for Python and
                calls <code className="font-mono text-slate-200">booster.dump_model()</code> to write{' '}
                <code className="font-mono text-slate-200">server/artifacts/gbdt_model.json</code> + SHA-256
                signed <code className="font-mono text-slate-200">feature_contract.json</code>.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-slate-300 font-semibold">03 · Two Serving Modes</span>
                <Server className="h-4 w-4 text-slate-300" aria-hidden="true" />
              </div>
              <h4 className="font-display text-sm font-semibold text-slate-100">
                Live FastAPI Sidecar or Zero-Python Node
              </h4>
              <ul className="text-xs text-slate-400 space-y-1.5 leading-relaxed">
                <li>
                  <span className={isPythonProxyActive ? 'text-emerald-400 font-medium' : 'text-slate-200 font-medium'}>
                    Mode A (SCORING_API_URL set):
                  </span>{' '}
                  Node forwards PIT features to <code className="font-mono text-slate-200">python/api.py</code>{' '}
                  for live <code className="font-mono text-slate-200">lightgbm.Booster</code> + TreeSHAP.
                </li>
                <li>
                  <span className={!isPythonProxyActive ? 'text-blue-400 font-medium' : 'text-slate-200 font-medium'}>
                    Mode B (Cloud Preview / Unset):
                  </span>{' '}
                  Node traverses the committed LightGBM-dumped{' '}
                  <code className="font-mono text-slate-200">gbdt_model.json</code> trees directly.
                </li>
              </ul>
            </div>
          </div>

          {(lens === 'dual' || lens === 'technical') && (
            <div className="rounded-xl bg-slate-950 border border-slate-800 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-800 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
                  <Terminal className="h-3.5 w-3.5 text-blue-400" aria-hidden="true" />
                  <span>Workflow: Export Local Python LightGBM Trees to Cloud Preview or Run Sidecar</span>
                </div>
                <button
                  type="button"
                  onClick={() => void handleCopyCommands()}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-[11px] font-medium text-slate-300 transition-colors"
                >
                  {copiedCmd ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-400" aria-hidden="true" />
                      <span className="text-emerald-300">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" aria-hidden="true" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-4 text-xs font-mono text-slate-200 overflow-x-auto leading-relaxed">
                {SYNC_COMMANDS}
              </pre>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
