import {
  Activity,
  BarChart3,
  Cpu,
  FileCheck2,
  GitBranch,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { ReadinessState } from '../shared/types.ts';
import { StatusBadge } from './StatusBadge.tsx';

export type NavSection =
  | 'scoring'
  | 'pipeline'
  | 'telemetry'
  | 'drift'
  | 'contract'
  | 'roadmap';

interface SidebarProps {
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  readiness: ReadinessState | null;
  bootstrapping: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const NAV_ITEMS: { id: NavSection; label: string; Icon: typeof ShieldCheck }[] = [
  { id: 'scoring', label: 'Live Scoring', Icon: ShieldCheck },
  { id: 'pipeline', label: 'AI Pipeline', Icon: Cpu },
  { id: 'telemetry', label: 'Portfolio Telemetry', Icon: Activity },
  { id: 'drift', label: 'Drift & Calibration', Icon: BarChart3 },
  { id: 'contract', label: 'Contract & Ops', Icon: FileCheck2 },
  { id: 'roadmap', label: 'Scaling & Next AI', Icon: GitBranch },
];

export function Sidebar({
  activeSection,
  onSelectSection,
  readiness,
  bootstrapping,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const navContent = (
    <div className="flex h-full flex-col justify-between bg-slate-900 border-r border-slate-800">
      <div>
        <div className="flex h-16 items-center justify-between px-5 border-b border-slate-800">
          <span className="font-display text-lg font-bold tracking-tight text-slate-100 whitespace-nowrap shrink-0">
            AegisCredit
          </span>
          <button
            type="button"
            onClick={onCloseMobile}
            className="lg:hidden rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100 focus-visible:outline-2 focus-visible:outline-blue-500"
            aria-label="Close navigation menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="p-3 space-y-1" aria-label="Primary sections">
          {NAV_ITEMS.map(({ id, label, Icon }) => {
            const active = activeSection === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  onSelectSection(id);
                  onCloseMobile();
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-blue-500 ${
                  active
                    ? 'bg-blue-600/15 text-blue-300 border border-blue-500/30'
                    : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-100 border border-transparent'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 ${active ? 'text-blue-400' : 'text-slate-500'}`}
                  aria-hidden="true"
                />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-slate-800 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-slate-400">Readiness Probe</span>
          {bootstrapping || !readiness ? (
            <div className="skeleton-bar h-5 w-20 rounded" aria-hidden="true" />
          ) : (
            <StatusBadge variant={readiness.status} compact />
          )}
        </div>

        {bootstrapping || !readiness ? (
          <div className="space-y-2" aria-hidden="true">
            <div className="skeleton-bar h-3 w-full rounded" />
            <div className="skeleton-bar h-3 w-4/5 rounded" />
            <div className="skeleton-bar h-3 w-3/4 rounded" />
          </div>
        ) : (
          <dl className="space-y-1.5 text-xs text-slate-400">
            <div className="flex items-center justify-between gap-2">
              <dt className="text-slate-500">AI Engine</dt>
              <dd
                className={`font-mono truncate ${
                  readiness.model_engine === 'python_lightgbm_proxy'
                    ? 'text-emerald-400'
                    : 'text-blue-300'
                }`}
                title={
                  readiness.model_engine === 'python_lightgbm_proxy'
                    ? `Connected to Python FastAPI LightGBM ${readiness.lightgbm_version ?? ''}`
                    : readiness.scoring_api_configured
                      ? 'SCORING_API_URL unreachable; running Node JSON tree fallback'
                      : 'SCORING_API_URL not set; running Node JSON trees (gbdt_model.json)'
                }
              >
                {readiness.model_engine === 'python_lightgbm_proxy'
                  ? `Python LightGBM${readiness.lightgbm_version ? ` v${readiness.lightgbm_version}` : ''}`
                  : 'JSON Trees (Node)'}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-slate-500">Python API</dt>
              <dd
                className={`font-mono truncate ${
                  readiness.scoring_api_reachable
                    ? 'text-emerald-400'
                    : readiness.scoring_api_configured
                      ? 'text-amber-400'
                      : 'text-slate-400'
                }`}
              >
                {readiness.scoring_api_reachable
                  ? 'Connected'
                  : readiness.scoring_api_configured
                    ? 'Unreachable (Fallback)'
                    : 'Not Configured'}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-slate-500">Model</dt>
              <dd className="font-mono tabular-nums text-slate-200 truncate">
                {readiness.model_version}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-slate-500">Contract</dt>
              <dd className="font-mono tabular-nums text-slate-200">
                {readiness.contract_version}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-slate-500">Storage</dt>
              <dd className="font-mono text-slate-200 truncate">
                {readiness.storage_backend === 'postgres' ? 'PostgreSQL Pool' : 'Presentation Store'}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-slate-500">DB Pool</dt>
              <dd className="font-mono tabular-nums text-slate-200">
                {readiness.pool_active_connections}/{readiness.pool_max_connections}
              </dd>
            </div>
          </dl>
        )}
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block w-[248px] shrink-0">{navContent}</aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/75"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative w-64 max-w-[80vw] h-full shadow-2xl z-10">{navContent}</div>
        </div>
      )}
    </>
  );
}
