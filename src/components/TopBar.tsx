import { Menu } from 'lucide-react';
import type { NavSection } from './Sidebar.tsx';

interface TopBarProps {
  activeSection: NavSection;
  onOpenMobileNav: () => void;
  primaryActionLabel: string;
  onPrimaryAction: () => void;
  primaryActionDisabled?: boolean;
}

const SECTION_TITLES: Record<NavSection, string> = {
  scoring: 'Live Scoring',
  pipeline: 'AI Intelligence Pipeline',
  telemetry: 'Portfolio Telemetry',
  drift: 'Drift & Calibration',
  contract: 'Contract & Ops',
  roadmap: 'Scaling & Next-Gen AI',
};

export function TopBar({
  activeSection,
  onOpenMobileNav,
  primaryActionLabel,
  onPrimaryAction,
  primaryActionDisabled = false,
}: TopBarProps) {
  return (
    <header className="h-16 bg-slate-900 border-b border-slate-800 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-8 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileNav}
          className="lg:hidden rounded-md p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-100 focus-visible:outline-2 focus-visible:outline-blue-500"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm min-w-0">
          <span className="text-slate-400 whitespace-nowrap shrink-0 hidden sm:inline">
            Credit Risk Engine
          </span>
          <span className="text-slate-600 hidden sm:inline" aria-hidden="true">
            /
          </span>
          <h1 className="font-display font-semibold text-slate-100 truncate">
            {SECTION_TITLES[activeSection]}
          </h1>
        </nav>
      </div>

      <div className="flex items-center shrink-0">
        <button
          type="button"
          onClick={onPrimaryAction}
          disabled={primaryActionDisabled}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
        >
          {primaryActionLabel}
        </button>
      </div>
    </header>
  );
}
