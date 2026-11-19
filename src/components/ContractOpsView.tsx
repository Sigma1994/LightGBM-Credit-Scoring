import { CheckCircle2, ShieldAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { FeatureContract, ReadinessState } from '../shared/types.ts';
import { StatusBadge } from './StatusBadge.tsx';

interface ContractOpsViewProps {
  contract: FeatureContract | null;
  readiness: ReadinessState | null;
  loadingReadiness?: boolean;
  onUpdateThresholds: (approveMax: number, manualReviewMax: number) => Promise<void>;
  onFaultInject: (opts: { model_loaded?: boolean; audit_channel_healthy?: boolean }) => Promise<void>;
}

const AUDIT_REMEDIATIONS: {
  area: string;
  issue: string;
  resolution: string;
}[] = [
  {
    area: 'Safe Outage Handling',
    issue: 'Old prototype kept returning HTTP 200 healthy and fell back to a rough heuristic guess when the AI model failed to load.',
    resolution: 'Split liveness vs. readiness probes (/api/health/ready returns HTTP 503) and blocks scoring rather than guessing.',
  },
  {
    area: 'Centralized Policy Cutoffs',
    issue: 'Approval thresholds (35% / 65%) were hardcoded in the API and ignored changes in feature_contract.json.',
    resolution: 'Scoring reads approval and review cutoffs live from the signed policy contract.',
  },
  {
    area: 'Mandatory Audit Logging',
    issue: 'Database audit write failures were silently ignored, risking missing regulatory records.',
    resolution: 'Explicit audit_status verification with correlation IDs and fail-closed gating if logging degrades.',
  },
  {
    area: 'Consistent UTC Timezones',
    issue: 'Local server clock was mislabeled as UTC and crashed when comparing naive vs. timezone-aware dates.',
    resolution: 'All timestamps normalize explicitly to UTC via parseUtcMs() before filtering ledger history.',
  },
  {
    area: 'Clean Input Signals',
    issue: 'Duplicate tenure column, dead constant feature, and ambiguous zero-deposit ratio distorted model behavior.',
    resolution: 'Pruned redundant columns to 10 orthogonal signals with explicit has_zero_deposits handling.',
  },
  {
    area: 'LightGBM Model & Honest Odds',
    issue: 'Unsafe pickle loading risked code execution, and raw tree outputs were not calibrated probabilities.',
    resolution: 'Uses Python LightGBM (python/train_lightgbm.py & FastAPI sidecar via SCORING_API_URL with TreeSHAP) or SHA-256 verified booster.dump_model() JSON tree traversal + Platt calibration.',
  },
];

export function ContractOpsView({
  contract,
  readiness,
  loadingReadiness = false,
  onUpdateThresholds,
  onFaultInject,
}: ContractOpsViewProps) {
  const [approveMax, setApproveMax] = useState('0.35');
  const [manualMax, setManualMax] = useState('0.65');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (contract) {
      setApproveMax(String(contract.thresholds.approve_max_prob));
      setManualMax(String(contract.thresholds.manual_review_max_prob));
    }
  }, [contract]);

  const handleSaveThresholds = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaveMessage(null);
    try {
      await onUpdateThresholds(Number(approveMax), Number(manualMax));
      setSaveMessage('Policy cutoffs updated and immediately active on Live Scoring.');
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Executive Orientation Header */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h2 className="font-display text-base font-semibold text-slate-100">
          Policy Governance, Safety Fail-Safes &amp; Engineering Hardening
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Adjust credit approval cutoffs without code deployments, test how the platform fails safely
          during outages, and review every production safeguard built into the system.
        </p>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Dynamic Contract Thresholds */}
        <section className="xl:col-span-6 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800">
            <h3 className="font-display text-base font-semibold text-slate-100">
              Live Credit Policy Cutoffs
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Saved in feature_contract.json and applied immediately to every new decision
            </p>
          </div>

          <form onSubmit={handleSaveThresholds} className="p-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="approve-threshold"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Auto-Approve Below Risk (0–1)
                </label>
                <input
                  id="approve-threshold"
                  type="number"
                  step="0.01"
                  min="0.06"
                  max="0.90"
                  value={approveMax}
                  onChange={(e) => setApproveMax(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-700 bg-slate-950 font-mono text-sm tabular-nums text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-slate-400">
                  Example: 0.35 approves applicants with &lt;35% default risk.
                </p>
              </div>

              <div>
                <label
                  htmlFor="review-threshold"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Auto-Decline At or Above Risk (0–1)
                </label>
                <input
                  id="review-threshold"
                  type="number"
                  step="0.01"
                  min="0.10"
                  max="0.94"
                  value={manualMax}
                  onChange={(e) => setManualMax(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-700 bg-slate-950 font-mono text-sm tabular-nums text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-slate-400">
                  Scores between the two cutoffs go to human underwriters.
                </p>
              </div>
            </div>

            {saveError && (
              <p className="text-xs text-red-300 bg-red-950/60 border border-red-800/80 rounded-lg px-3 py-2">
                {saveError}
              </p>
            )}
            {saveMessage && (
              <p className="text-xs text-emerald-300 bg-emerald-950/60 border border-emerald-800/80 rounded-lg px-3 py-2">
                {saveMessage}
              </p>
            )}

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => {
                  setApproveMax('0.35');
                  setManualMax('0.65');
                }}
                className="text-xs font-medium text-slate-400 hover:text-slate-200"
              >
                Reset to Policy Defaults (0.35 / 0.65)
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors disabled:opacity-50"
              >
                {saving ? 'Applying...' : 'Apply Policy Cutoffs'}
              </button>
            </div>
          </form>
        </section>

        {/* Fail-Closed Readiness Simulator */}
        <section className="xl:col-span-6 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between gap-4">
            <div>
              <h3 className="font-display text-base font-semibold text-slate-100">
                Outage Fail-Safe Demo (No Guessing Policy)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Simulate an outage to prove the platform pauses safely (HTTP 503) instead of guessing
              </p>
            </div>
            {loadingReadiness ? (
              <div className="skeleton-bar h-6 w-24 rounded" />
            ) : (
              readiness && <StatusBadge variant={readiness.status} />
            )}
          </div>

          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between gap-4 py-2 border-b border-slate-800">
              <div>
                <p className="text-sm font-medium text-slate-100">AI Model Availability</p>
                <p className="text-xs text-slate-400">
                  Simulate a missing or corrupted model file on startup
                </p>
              </div>
              <button
                type="button"
                onClick={() => onFaultInject({ model_loaded: !(readiness?.model_loaded ?? true) })}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  readiness?.model_loaded
                    ? 'border-slate-700 bg-slate-800/70 text-slate-200 hover:bg-slate-800'
                    : 'border-red-800 bg-red-950/70 text-red-300 hover:bg-red-950'
                }`}
              >
                {readiness?.model_loaded ? 'Simulate Unloaded Model' : 'Restore Model Artifact'}
              </button>
            </div>

            <div className="flex items-center justify-between gap-4 py-2 border-b border-slate-800">
              <div>
                <p className="text-sm font-medium text-slate-100">Compliance Audit Database</p>
                <p className="text-xs text-slate-400">
                  Simulate audit log failure (blocks unrecorded credit decisions)
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  onFaultInject({
                    audit_channel_healthy: !(readiness?.audit_channel_healthy ?? true),
                  })
                }
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  readiness?.audit_channel_healthy
                    ? 'border-slate-700 bg-slate-800/70 text-slate-200 hover:bg-slate-800'
                    : 'border-red-800 bg-red-950/70 text-red-300 hover:bg-red-950'
                }`}
              >
                {readiness?.audit_channel_healthy ? 'Simulate Audit Outage' : 'Restore Audit DB'}
              </button>
            </div>

            {loadingReadiness ? (
              <div className="skeleton-bar h-16 w-full rounded-lg" />
            ) : (
              readiness && (
                <div className="rounded-lg bg-slate-950 border border-slate-800 p-3.5 text-xs font-mono text-slate-300 space-y-1.5">
                  <div className="flex items-center gap-2">
                    {readiness.status === 'READY' ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    ) : (
                      <ShieldAlert className="h-4 w-4 text-red-400 shrink-0" />
                    )}
                    <span>
                      Health Readiness Check → HTTP{' '}
                      {readiness.status === 'READY' ? '200 OK' : '503 Service Unavailable'}
                    </span>
                  </div>
                  <p className="text-slate-400 pl-6">
                    AI Engine:{' '}
                    {readiness.model_engine === 'python_lightgbm_proxy'
                      ? `Python LightGBM${readiness.lightgbm_version ? ` v${readiness.lightgbm_version}` : ''} (SCORING_API_URL reachable)`
                      : readiness.scoring_api_configured
                        ? 'Node JSON Trees (SCORING_API_URL unreachable — fallback active)'
                        : 'Node JSON Trees (gbdt_model.json · SCORING_API_URL not set)'}
                  </p>
                  <p className="text-slate-400 pl-6">
                    Database:{' '}
                    {readiness.storage_backend === 'postgres'
                      ? 'PostgreSQL (Pooled)'
                      : 'Presentation Fallback'}{' '}
                    · {readiness.storage_note}
                  </p>
                  {readiness.reason && <p className="text-red-400 pl-6">{readiness.reason}</p>}
                </div>
              )
            )}
          </div>
        </section>
      </div>

      {/* Contract Manifest & SHA-256 Digest */}
      {contract && (
        <section className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-display text-base font-semibold text-slate-100">
                Signed Model &amp; Policy Contract (Tamper-Verified)
              </h3>
              <p className="text-xs text-slate-400 font-mono tabular-nums mt-0.5">
                SHA-256 Checksum: {contract.artifact_sha256}
              </p>
            </div>
            <span className="text-xs font-mono text-slate-400">
              Format: {contract.model_format}
            </span>
          </div>

          <div className="p-6">
            <pre className="p-4 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs text-slate-200 overflow-x-auto max-h-72">
              {JSON.stringify(
                {
                  contract_version: contract.contract_version,
                  model_version: contract.model_version,
                  model_format: contract.model_format,
                  artifact_sha256: contract.artifact_sha256,
                  thresholds: contract.thresholds,
                  feature_columns: contract.feature_columns,
                  validation_metrics: contract.validation_metrics,
                },
                null,
                2
              )}
            </pre>
          </div>
        </section>
      )}

      {/* Production Remediation Register */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800">
          <h3 className="font-display text-base font-semibold text-slate-100">
            Production Hardening Checklist (Prototype → Enterprise Grade)
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Key reliability, security, and ML engineering issues resolved in this system
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-xs font-medium text-slate-400">
                <th className="py-2.5 px-4">Safeguard</th>
                <th className="py-2.5 px-4">Risk in Prototype</th>
                <th className="py-2.5 px-4">How It Is Solved Today</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 text-xs">
              {AUDIT_REMEDIATIONS.map((row) => (
                <tr key={row.area} className="hover:bg-slate-800/40">
                  <td className="py-3 px-4 font-medium text-slate-100 whitespace-nowrap align-top">
                    {row.area}
                  </td>
                  <td className="py-3 px-4 text-slate-400 align-top">{row.issue}</td>
                  <td className="py-3 px-4 text-slate-200 align-top">{row.resolution}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
