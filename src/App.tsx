/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';
import { ContractOpsView } from './components/ContractOpsView.tsx';
import { DriftCalibrationView } from './components/DriftCalibrationView.tsx';
import { ViewSkeleton } from './components/GlobalSkeleton.tsx';
import { LiveScoringView } from './components/LiveScoringView.tsx';
import { PipelineDemoView } from './components/PipelineDemoView.tsx';
import { ScalingRoadmapView } from './components/ScalingRoadmapView.tsx';
import { Sidebar, type NavSection } from './components/Sidebar.tsx';
import { TelemetryView } from './components/TelemetryView.tsx';
import { TopBar } from './components/TopBar.tsx';
import type {
  CustomerSummary,
  DriftReport,
  FeatureContract,
  ReadinessState,
  ScoreResponse,
  TelemetryResponse,
} from './shared/types.ts';

export default function App() {
  const [activeSection, setActiveSection] = useState<NavSection>('scoring');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);

  const [readiness, setReadiness] = useState<ReadinessState | null>(null);
  const [contract, setContract] = useState<FeatureContract | null>(null);
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [telemetry, setTelemetry] = useState<TelemetryResponse | null>(null);
  const [drift, setDrift] = useState<DriftReport | null>(null);

  const [selectedCustomerId, setSelectedCustomerId] = useState('CUST-2088');
  const [asOfTime, setAsOfTime] = useState('2026-10-18T09:15:00Z');
  const [scoreResult, setScoreResult] = useState<ScoreResponse | null>(null);
  const [scoreError, setScoreError] = useState<{
    status: number;
    message: string;
    correlationId?: string;
  } | null>(null);

  const [isScoring, setIsScoring] = useState(false);
  const [loadingTelemetry, setLoadingTelemetry] = useState(false);
  const [loadingDrift, setLoadingDrift] = useState(false);
  const [loadingReadiness, setLoadingReadiness] = useState(false);
  const [simulatingTraffic, setSimulatingTraffic] = useState(false);
  const [simulatingShift, setSimulatingShift] = useState(false);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

  const refreshReadiness = useCallback(async () => {
    setLoadingReadiness(true);
    try {
      const res = await fetch('/api/health/ready');
      const data = (await res.json()) as ReadinessState;
      setReadiness(data);
    } catch {
      setReadiness(null);
    } finally {
      setLoadingReadiness(false);
    }
  }, []);

  const refreshTelemetry = useCallback(async () => {
    setLoadingTelemetry(true);
    try {
      const res = await fetch('/api/telemetry?limit=100');
      if (res.ok) {
        const data = (await res.json()) as TelemetryResponse;
        setTelemetry(data);
      }
    } finally {
      setLoadingTelemetry(false);
    }
  }, []);

  const refreshDrift = useCallback(async () => {
    setLoadingDrift(true);
    try {
      const res = await fetch('/api/drift');
      if (res.ok) {
        const data = (await res.json()) as DriftReport;
        setDrift(data);
      }
    } finally {
      setLoadingDrift(false);
    }
  }, []);

  const runScore = useCallback(
    async (customerIdOverride?: string, asOfTimeOverride?: string) => {
      const targetId = customerIdOverride ?? selectedCustomerId;
      const targetTime = asOfTimeOverride ?? asOfTime;
      if (!targetId || !targetTime) return;

      setIsScoring(true);
      setScoreError(null);
      try {
        const res = await fetch('/api/score-customer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customer_id: targetId,
            as_of_time: targetTime,
            include_leakage_audit: true,
          }),
        });
        const body = await res.json();
        if (!res.ok) {
          setScoreResult(null);
          setScoreError({
            status: res.status,
            message: body.error || 'Scoring request failed.',
            correlationId: body.correlation_id,
          });
        } else {
          setScoreResult(body as ScoreResponse);
          void refreshTelemetry();
          void refreshDrift();
        }
      } catch (err) {
        setScoreResult(null);
        setScoreError({
          status: 500,
          message: (err as Error).message || 'Network error while reaching scoring engine.',
        });
      } finally {
        setIsScoring(false);
        void refreshReadiness();
      }
    },
    [selectedCustomerId, asOfTime, refreshTelemetry, refreshDrift, refreshReadiness]
  );

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      setBootstrapping(true);
      try {
        const [readyRes, custRes, contractRes, telRes, driftRes] = await Promise.all([
          fetch('/api/health/ready'),
          fetch('/api/customers'),
          fetch('/api/contract'),
          fetch('/api/telemetry?limit=100'),
          fetch('/api/drift'),
        ]);

        if (cancelled) return;
        setReadiness((await readyRes.json()) as ReadinessState);

        if (custRes.ok) {
          const custJson = (await custRes.json()) as { customers: CustomerSummary[] };
          setCustomers(custJson.customers);
        }
        if (contractRes.ok) {
          setContract((await contractRes.json()) as FeatureContract);
        }
        if (telRes.ok) {
          setTelemetry((await telRes.json()) as TelemetryResponse);
        }
        if (driftRes.ok) {
          setDrift((await driftRes.json()) as DriftReport);
        }

        await runScore('CUST-2088', '2026-10-18T09:15:00Z');
      } catch (err) {
        if (!cancelled) {
          setBootstrapError((err as Error).message || 'Failed to connect to Risk Engine API.');
        }
      } finally {
        if (!cancelled) {
          setBootstrapping(false);
        }
      }
    }
    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleUpdateThresholds = async (approveMax: number, manualReviewMax: number) => {
    const res = await fetch('/api/contract/thresholds', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        approve_max_prob: approveMax,
        manual_review_max_prob: manualReviewMax,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to update contract thresholds.');
    }
    setContract(data as FeatureContract);
    await runScore();
  };

  const handleFaultInject = async (opts: {
    model_loaded?: boolean;
    audit_channel_healthy?: boolean;
  }) => {
    setLoadingReadiness(true);
    try {
      const res = await fetch('/api/ops/fault-injection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(opts),
      });
      if (res.ok) {
        setReadiness((await res.json()) as ReadinessState);
        void runScore();
      }
    } finally {
      setLoadingReadiness(false);
    }
  };

  const handleSimulateTraffic = async (shiftRisk: boolean) => {
    if (shiftRisk) setSimulatingShift(true);
    else setSimulatingTraffic(true);
    try {
      const res = await fetch('/api/telemetry/batch-seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: shiftRisk ? 15 : 12, shift_risk: shiftRisk }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.drift) setDrift(data.drift as DriftReport);
        await refreshTelemetry();
      }
    } finally {
      setSimulatingTraffic(false);
      setSimulatingShift(false);
    }
  };

  const topBarAction = (() => {
    if (activeSection === 'scoring' || activeSection === 'pipeline') {
      return {
        label: isScoring ? 'Scoring...' : 'Score Application',
        handler: () => void runScore(),
        disabled: isScoring || bootstrapping,
      };
    }
    if (activeSection === 'telemetry') {
      return {
        label: loadingTelemetry ? 'Refreshing...' : 'Refresh Logs',
        handler: () => void refreshTelemetry(),
        disabled: loadingTelemetry || bootstrapping,
      };
    }
    if (activeSection === 'drift') {
      return {
        label: loadingDrift ? 'Computing...' : 'Recompute PSI',
        handler: () => void refreshDrift(),
        disabled: loadingDrift || bootstrapping,
      };
    }
    if (activeSection === 'roadmap') {
      return {
        label: 'Open Live Scoring',
        handler: () => setActiveSection('scoring'),
        disabled: bootstrapping,
      };
    }
    return {
      label: loadingReadiness ? 'Checking...' : 'Check Readiness',
      handler: () => void refreshReadiness(),
      disabled: loadingReadiness || bootstrapping,
    };
  })();

  return (
    <div className="min-h-screen flex bg-slate-950 text-slate-100">
      <Sidebar
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        readiness={readiness}
        bootstrapping={bootstrapping}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          activeSection={activeSection}
          onOpenMobileNav={() => setMobileNavOpen(true)}
          primaryActionLabel={topBarAction.label}
          onPrimaryAction={topBarAction.handler}
          primaryActionDisabled={topBarAction.disabled}
        />

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-[1360px] w-full mx-auto">
          {bootstrapError && (
            <div
              role="alert"
              className="mb-6 bg-red-950/60 border border-red-800/80 rounded-xl p-4 text-sm text-red-200"
            >
              {bootstrapError}
            </div>
          )}

          {bootstrapping ? (
            <ViewSkeleton section={activeSection} />
          ) : (
            <>
              {activeSection === 'scoring' && (
                <LiveScoringView
                  customers={customers}
                  contract={contract}
                  selectedCustomerId={selectedCustomerId}
                  onSelectCustomerId={setSelectedCustomerId}
                  asOfTime={asOfTime}
                  onChangeAsOfTime={setAsOfTime}
                  scoreResult={scoreResult}
                  scoreError={scoreError}
                  isScoring={isScoring}
                  onRunScore={() => void runScore()}
                />
              )}

              {activeSection === 'pipeline' && (
                <PipelineDemoView
                  customers={customers}
                  selectedCustomerId={selectedCustomerId}
                  onSelectCustomerId={setSelectedCustomerId}
                  asOfTime={asOfTime}
                  onChangeAsOfTime={setAsOfTime}
                  scoreResult={scoreResult}
                  contract={contract}
                  readiness={readiness}
                  isScoring={isScoring}
                  onRunScore={() => void runScore()}
                />
              )}

              {activeSection === 'telemetry' && (
                <TelemetryView
                  telemetry={telemetry}
                  loading={loadingTelemetry}
                  onRefresh={() => void refreshTelemetry()}
                  onSimulateTraffic={() => handleSimulateTraffic(false)}
                  simulating={simulatingTraffic}
                />
              )}

              {activeSection === 'drift' && (
                <DriftCalibrationView
                  contract={contract}
                  drift={drift}
                  loading={loadingDrift}
                  onSimulateShiftTraffic={() => handleSimulateTraffic(true)}
                  simulatingShift={simulatingShift}
                />
              )}

              {activeSection === 'contract' && (
                <ContractOpsView
                  contract={contract}
                  readiness={readiness}
                  loadingReadiness={loadingReadiness}
                  onUpdateThresholds={handleUpdateThresholds}
                  onFaultInject={handleFaultInject}
                />
              )}

              {activeSection === 'roadmap' && <ScalingRoadmapView />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
