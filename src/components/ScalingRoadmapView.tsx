import { ArrowRight, Layers } from 'lucide-react';
import { useState } from 'react';

interface HorizonSpec {
  id: string;
  phase: string;
  title: string;
  tagline: string;
  plainSummary: string;
  techStack: string;
  involves: string[];
  guardrails: string;
  impactMetric: string;
}

const HORIZONS: HorizonSpec[] = [
  {
    id: 'streaming',
    phase: 'Step 01',
    title: 'Real-Time Streaming Feature Store & Horizontal Scale',
    tagline: 'From on-demand SQL queries to sub-10ms event-driven online features',
    plainSummary:
      'Instead of waiting to recalculate an applicant’s history when they submit a form, every deposit or card swipe updates their risk profile continuously in milliseconds—allowing instant pre-approvals and 10,000+ requests per second without slowing down the core bank database.',
    techStack: 'Kafka + Debezium CDC · Apache Flink · Redis / Feast Online Store · ONNX Runtime',
    involves: [
      'Stream PostgreSQL WAL changes via Debezium CDC into Kafka topics partitioned by customer_id.',
      'Maintain sliding-window aggregates (7d/30d/90d velocity, balance volatility) inside Apache Flink with strict event-time watermarks.',
      'Dual-write materialized vectors into Redis (online low-latency serving) and Iceberg/Parquet (offline point-in-time training parity).',
      'Export LightGBM models to ONNX Runtime behind stateless horizontal Kubernetes pods with PgBouncer transaction pooling.',
    ],
    guardrails:
      'Watermark-enforced event-time windows prevent out-of-order streaming events from causing training-serving skew.',
    impactMetric: 'Target: < 10 ms p99 scoring latency at 10,000+ RPS',
  },
  {
    id: 'sequence',
    phase: 'Step 02',
    title: 'Temporal Sequence Transformers (Multimodal Fusion)',
    tagline: 'Beyond aggregate totals to deep behavioral cash-flow trajectory modeling',
    plainSummary:
      'Today’s model reads summary totals like total deposits and spending ratio. A Temporal Sequence Transformer reads the actual rhythm and order of transactions—spotting subtle early warning signs like delayed paychecks or sudden merchant category shifts weeks before totals look bad.',
    techStack: 'PyTorch Temporal Transformer · Merchant Text Embeddings · Tabular-Sequence Fusion',
    involves: [
      'Tokenize chronological transaction streams (amount deltas, inter-arrival times, normalized merchant/channel embeddings).',
      'Train a causal Transformer encoder (masked strictly to t <= as_of_time) to produce a fixed-length behavioral risk embedding.',
      'Fuse sequence embeddings with the 10 audited tabular signals via a calibrated stacking meta-learner (LightGBM + Platt scaling).',
      'Validate incremental lift strictly via Out-of-Time PR-AUC and Brier score against the current tabular champion.',
    ],
    guardrails:
      'Causal attention masking guarantees zero future-token leakage; tabular fallback remains shadow-benchmarked if sequence length < 3.',
    impactMetric: 'Target: +4–7% PR-AUC lift on thin-file & gig-economy segments',
  },
  {
    id: 'conformal',
    phase: 'Step 03',
    title: 'Conformal Uncertainty Intervals & Causal Recourse',
    tagline: 'Knowing when the AI is uncertain and telling applicants how to qualify',
    plainSummary:
      'Instead of giving a single overconfident guess on unfamiliar applicants, the system attaches a mathematically guaranteed confidence interval—automatically routing uncertain cases to human underwriters, while giving declined applicants concrete steps to qualify next time.',
    techStack: 'Split Conformal Prediction · DiCE Counterfactuals · Regulated Adverse Action Engine',
    involves: [
      'Calibrate non-conformity scores on a held-out temporal calibration fold to emit finite-sample coverage intervals (e.g., 90% PI).',
      'Route applications whose prediction interval spans both Approve and Decline thresholds directly to Manual Review.',
      'Solve constrained counterfactual optimization over actionable features only (excluding immutable tenure/history) to generate recourse.',
      'Map top attributions and counterfactual deltas directly to standardized ECOA / adverse action reason codes.',
    ],
    guardrails:
      'Actionability constraints forbid impossible recommendations (e.g., altering past timestamps) and enforce fairness monotonicity.',
    impactMetric: 'Target: 35% fewer false declines on borderline thin-file applications',
  },
  {
    id: 'copilot',
    phase: 'Step 04',
    title: 'Governed LLM Underwriting Co-Pilot & Auto-Drift Routing',
    tagline: 'Grounded AI analyst briefs & self-healing Champion/Challenger pipelines',
    plainSummary:
      'For applications sent to Manual Review, a tightly governed language assistant summarizes bank statements, risk drivers, and verification checks into a 30-second briefing for human underwriters—while automated drift monitors spin up challenger retrains whenever population behavior shifts.',
    techStack: 'Grounded RAG + Structured Tool Calling · Champion/Challenger Shadow Router · Automated Retrain DAG',
    involves: [
      'Bind an LLM analyst assistant exclusively to read-only structured tools (SHAP drivers, ledger anomalies, policy handbook RAG).',
      'Prohibit the LLM from altering probabilities or issuing decisions—its sole output is a cited, auditable underwriting memo.',
      'Wire PSI > 0.25 or ECE > 0.04 alerts to automatically deploy a newly calibrated Challenger model in dark shadow mode.',
      'Promote Challengers only after passing automated OOT backtesting, calibration checks, and human risk-committee sign-off.',
    ],
    guardrails:
      'Deterministic policy contract retains 100% decision authority; every LLM summary cites exact ledger event UUIDs.',
    impactMetric: 'Target: 60% reduction in manual review handle time with full auditability',
  },
];

const EVOLUTION_MATRIX: {
  dimension: string;
  today: string;
  nextStep: string;
}[] = [
  {
    dimension: 'Data Ingestion & Freshness',
    today: 'Append-only PostgreSQL ledger queried on demand per request',
    nextStep: 'Debezium CDC → Kafka → Flink sliding-window online store (sub-second freshness)',
  },
  {
    dimension: 'Model Intelligence',
    today: '10 orthogonal tabular signals + Platt-calibrated scoring contract',
    nextStep: 'Causal Temporal Transformer sequence encoder fused with tabular GBDT',
  },
  {
    dimension: 'Uncertainty & Explainability',
    today: 'Calibrated point probability + per-feature log-odds attribution',
    nextStep: 'Split Conformal Prediction uncertainty routing + actionable counterfactual recourse',
  },
  {
    dimension: 'Human-in-the-Loop Review',
    today: 'Manual Review queue flagged by contract threshold band',
    nextStep: 'Grounded LLM Co-Pilot generating cited underwriter memos over deterministic scores',
  },
  {
    dimension: 'Drift & Lifecycle Ops',
    today: 'Live PSI & calibration monitoring with fail-closed 503 readiness',
    nextStep: 'Automated PSI-triggered shadow Challenger evaluation & gated promotion pipeline',
  },
];

export function ScalingRoadmapView() {
  const [selectedId, setSelectedId] = useState<string>(HORIZONS[0].id);
  const activeHorizon = HORIZONS.find((h) => h.id === selectedId) ?? HORIZONS[0];

  return (
    <div className="space-y-6">
      {/* Header Framing */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1 max-w-3xl">
          <div className="flex items-center gap-2 text-xs font-medium text-blue-400">
            <Layers className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Architectural Evolution Specification (Conceptual Blueprint)</span>
          </div>
          <h2 className="font-display text-lg font-semibold text-slate-100">
            Next Step: Scaling Infrastructure &amp; Next-Generation AI Capabilities
          </h2>
          <p className="text-sm text-slate-400">
            How the current Point-in-Time foundation evolves into a high-throughput streaming,
            sequence-aware, uncertainty-calibrated, and LLM-assisted underwriting platform—without
            sacrificing determinism or regulatory auditability.
          </p>
        </div>

        <div className="text-xs font-mono text-slate-400 shrink-0">
          Select any horizon node below to inspect
        </div>
      </section>

      {/* Interactive Architecture Visualization Diagram */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-base font-semibold text-slate-100">
            System Evolution Topology
          </h3>
          <span className="text-xs text-slate-400">
            Current Production Core (Left) → Next-Generation AI Expansion Layers (Right)
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Current Core Column */}
          <div className="lg:col-span-4 rounded-xl border border-slate-800 bg-slate-950/70 p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-1">
              <span className="text-xs font-mono text-emerald-400">Live Foundation Today</span>
              <h4 className="font-display text-base font-semibold text-slate-100">
                Audited Credit Scoring Core
              </h4>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="p-3 rounded-lg border border-slate-800 bg-slate-900 text-slate-200">
                <div className="font-medium text-slate-100">1. Immutable Postgres Ledger</div>
                <div className="text-slate-400 mt-0.5">Idempotent events + strict UTC anchor</div>
              </div>
              <div className="p-3 rounded-lg border border-slate-800 bg-slate-900 text-slate-200">
                <div className="font-medium text-slate-100">2. Point-in-Time Feature Store</div>
                <div className="text-slate-400 mt-0.5">10 clean signals · zero future leakage</div>
              </div>
              <div className="p-3 rounded-lg border border-slate-800 bg-slate-900 text-slate-200">
                <div className="font-medium text-slate-100">3. Calibrated Tabular Scorer</div>
                <div className="text-slate-400 mt-0.5">SHA-256 JSON model + Platt scaling</div>
              </div>
              <div className="p-3 rounded-lg border border-slate-800 bg-slate-900 text-slate-200">
                <div className="font-medium text-slate-100">4. Contract Gate &amp; PSI Audit</div>
                <div className="text-slate-400 mt-0.5">Fail-closed 503 + real PSI monitoring</div>
              </div>
            </div>
          </div>

          {/* Connector Arrow Column on Desktop */}
          <div className="hidden lg:flex lg:col-span-1 items-center justify-center">
            <div className="flex flex-col items-center gap-2 text-blue-400">
              <div className="h-24 w-px bg-slate-800" />
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
              <span className="text-[11px] font-mono text-slate-500">Scale</span>
              <div className="h-24 w-px bg-slate-800" />
            </div>
          </div>

          {/* Next-Gen AI Horizons Topology Nodes */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {HORIZONS.map((h) => {
              const active = h.id === activeHorizon.id;
              return (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => setSelectedId(h.id)}
                  className={`text-left p-5 rounded-xl border transition-colors flex flex-col justify-between gap-3 ${
                    active
                      ? 'bg-blue-600/15 border-blue-500/60'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`font-mono text-xs font-semibold ${
                          active ? 'text-blue-400' : 'text-slate-400'
                        }`}
                      >
                        {h.phase}
                      </span>
                      <ArrowRight
                        className={`h-4 w-4 shrink-0 ${active ? 'text-blue-400' : 'text-slate-600'}`}
                        aria-hidden="true"
                      />
                    </div>
                    <h4 className="font-display text-sm font-semibold text-slate-100 leading-snug">
                      {h.title}
                    </h4>
                    <p className="text-xs text-slate-400 leading-relaxed">{h.tagline}</p>
                  </div>

                  <div className="pt-3 border-t border-slate-800/80 font-mono text-[11px] text-slate-300">
                    {h.impactMetric}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Selected Horizon Detailed Breakdown */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-mono text-blue-400">{activeHorizon.phase} Deep-Dive</p>
            <h3 className="font-display text-lg font-semibold text-slate-100 mt-0.5">
              {activeHorizon.title}
            </h3>
          </div>
          <span className="text-xs font-mono text-slate-300">{activeHorizon.techStack}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-800">
          <div className="lg:col-span-5 p-6 space-y-5">
            <div>
              <p className="text-xs font-medium text-emerald-300">Plain-Language Explanation</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-200">
                {activeHorizon.plainSummary}
              </p>
            </div>

            <div className="pt-4 border-t border-slate-800">
              <p className="text-xs font-medium text-amber-300">Safety &amp; Governance Guardrail</p>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
                {activeHorizon.guardrails}
              </p>
            </div>
          </div>

          <div className="lg:col-span-7 p-6 bg-slate-950/35 space-y-4">
            <p className="text-xs font-medium text-blue-300">
              What This Integration Involves (Engineering Steps)
            </p>
            <ol className="space-y-3">
              {activeHorizon.involves.map((step, idx) => (
                <li key={idx} className="flex items-start gap-3 text-sm text-slate-200">
                  <span className="font-mono text-xs text-blue-400 mt-0.5 shrink-0">
                    0{idx + 1}.
                  </span>
                  <span className="leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* Evolution Comparison Matrix */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800">
          <h3 className="font-display text-base font-semibold text-slate-100">
            Capability Progression: Current Core vs. Next-Gen Target State
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-xs font-medium text-slate-400">
                <th className="py-2.5 px-4">Architecture Dimension</th>
                <th className="py-2.5 px-4">Current Production Core</th>
                <th className="py-2.5 px-4">Next-Step AI &amp; Scale Target</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 text-xs">
              {EVOLUTION_MATRIX.map((row) => (
                <tr key={row.dimension} className="hover:bg-slate-800/40">
                  <td className="py-3 px-4 font-medium text-slate-100 whitespace-nowrap align-top">
                    {row.dimension}
                  </td>
                  <td className="py-3 px-4 text-slate-400 align-top">{row.today}</td>
                  <td className="py-3 px-4 text-slate-200 align-top">{row.nextStep}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
