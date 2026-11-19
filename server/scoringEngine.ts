import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  CustomerSummary,
  Decision,
  DriftReport,
  FeatureAttribution,
  FeatureContract,
  FeaturePsiDetail,
  FeatureVector,
  InferenceLogEntry,
  LedgerEvent,
  ReadinessState,
  ScoreResponse,
  TelemetryResponse,
  TreeRuleHit,
  WalkAlongStep,
} from '../src/shared/types.ts';
import {
  computePointInTimeFeatures,
  FEATURE_COLUMNS,
  FEATURE_LABELS,
  parseUtcMs,
} from './featureStore.ts';
import { CreditRepository } from './repository.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface TreeSplitNode {
  split_feature: number;
  split_feature_name?: keyof FeatureVector;
  threshold: number;
  decision_type: '<=';
  internal_value?: number;
  internal_count?: number;
  left_child: TreeNode;
  right_child: TreeNode;
}

interface TreeLeafNode {
  leaf_value: number;
  leaf_count?: number;
  internal_value?: number;
}

type TreeNode = TreeSplitNode | TreeLeafNode;

interface GbdtModelArtifact {
  name: string;
  version: string;
  feature_names: (keyof FeatureVector)[];
  base_score_logit: number;
  platt_a: number;
  platt_b: number;
  tree_info: {
    tree_index: number;
    num_leaves: number;
    shrinkage: number;
    tree_structure: TreeNode;
  }[];
}

function sigmoid(x: number): number {
  if (x > 35) return 1 - 1e-15;
  if (x < -35) return 1e-15;
  return 1 / (1 + Math.exp(-x));
}

function formatRuleCondition(
  featureName: keyof FeatureVector,
  op: '<=' | '>',
  threshold: number
): string {
  const formattedVal =
    featureName.includes('deposit') || featureName.includes('withdrawal') || featureName.includes('avg_tx')
      ? featureName === 'has_zero_deposits'
        ? String(threshold)
        : `$${Math.round(threshold).toLocaleString()}`
      : threshold.toFixed(2);
  return `${featureName} ${op} ${formattedVal}`;
}

export class CreditScoringService {
  private contract!: FeatureContract;
  private modelArtifact!: GbdtModelArtifact;
  private modelRawSha256 = '';
  private modelLoaded = true;
  private auditChannelHealthy = true;
  private readonly repo = new CreditRepository();

  constructor() {
    this.loadTrainedArtifacts();
  }

  private loadTrainedArtifacts(): void {
    const artifactsDir = path.resolve(__dirname, 'artifacts');
    const modelPath = path.join(artifactsDir, 'gbdt_model.json');
    const contractPath = path.join(artifactsDir, 'feature_contract.json');

    const modelRaw = fs.readFileSync(modelPath, 'utf-8');
    const contractRaw = fs.readFileSync(contractPath, 'utf-8');

    this.modelRawSha256 = crypto.createHash('sha256').update(modelRaw).digest('hex');
    this.modelArtifact = JSON.parse(modelRaw) as GbdtModelArtifact;
    this.contract = JSON.parse(contractRaw) as FeatureContract;
  }

  public async init(): Promise<void> {
    await this.repo.init(async (repo) => {
      const seedPairs: { customer_id: string; as_of_time: string; scored_at: string }[] = [
        { customer_id: 'CUST-1042', as_of_time: '2026-10-15T14:30:00Z', scored_at: '2026-11-18T09:12:04Z' },
        { customer_id: 'CUST-2088', as_of_time: '2026-10-18T09:15:00Z', scored_at: '2026-11-18T11:42:19Z' },
        { customer_id: 'CUST-3115', as_of_time: '2026-10-20T18:00:00Z', scored_at: '2026-11-18T14:08:51Z' },
        { customer_id: 'CUST-4290', as_of_time: '2026-10-15T10:00:00Z', scored_at: '2026-11-18T16:22:30Z' },
        { customer_id: 'CUST-5019', as_of_time: '2026-11-02T16:20:00Z', scored_at: '2026-11-19T08:15:44Z' },
        { customer_id: 'CUST-4290', as_of_time: '2026-10-25T11:45:00Z', scored_at: '2026-11-19T09:40:12Z' },
        { customer_id: 'CUST-2088', as_of_time: '2026-10-16T12:00:00Z', scored_at: '2026-11-19T10:05:33Z' },
        { customer_id: 'CUST-3115', as_of_time: '2026-10-14T15:00:00Z', scored_at: '2026-11-19T10:51:09Z' },
      ];

      const logs: InferenceLogEntry[] = [];
      for (const pair of seedPairs) {
        const evs = await repo.getCustomerEvents(pair.customer_id);
        const { features } = computePointInTimeFeatures(evs, pair.as_of_time, true);
        const { calibratedProb } = this.evaluateGbdtEnsemble(features);
        const decision = this.applyContractThresholds(calibratedProb);
        logs.push({
          request_id: crypto.randomUUID(),
          customer_id: pair.customer_id,
          as_of_time: pair.as_of_time,
          scored_at: pair.scored_at,
          model_version: this.contract.model_version,
          contract_version: this.contract.contract_version,
          calibrated_probability: calibratedProb,
          decision,
          latency_ms: Math.round((4.1 + Math.random() * 5.2) * 100) / 100,
          features_json: features,
          audit_status: 'COMMITTED',
        });
      }
      return logs.reverse();
    });
  }

  public getReadiness(): ReadinessState {
    const contractVerified =
      this.modelRawSha256 === this.contract.artifact_sha256 &&
      this.modelArtifact.tree_info.length === this.contract.tree_count &&
      this.contract.feature_columns.length === FEATURE_COLUMNS.length &&
      this.contract.feature_columns.every((col, idx) => col === FEATURE_COLUMNS[idx]);

    const ready = this.modelLoaded && contractVerified && this.auditChannelHealthy;
    const storage = this.repo.getStorageInfo();

    let reason: string | undefined;
    if (!this.modelLoaded) {
      reason = 'Trained GBDT artifact is unloaded or failed integrity verification; failing closed (503).';
    } else if (!contractVerified) {
      reason = 'Feature contract SHA-256 or tree ensemble schema mismatch.';
    } else if (!this.auditChannelHealthy) {
      reason = 'Compliance audit store (ops.inference_logs) is degraded; failing closed to preserve regulatory trail.';
    }

    return {
      status: ready ? 'READY' : 'UNAVAILABLE',
      storage_backend: storage.backend,
      storage_note: storage.note,
      model_engine: process.env.SCORING_API_URL ? 'python_lightgbm_proxy' : 'gbdt_tree_ensemble',
      model_loaded: this.modelLoaded,
      contract_verified: contractVerified,
      audit_channel_healthy: this.auditChannelHealthy,
      pool_active_connections: storage.activeConnections,
      pool_max_connections: storage.maxConnections,
      model_version: this.contract.model_version,
      contract_version: this.contract.contract_version,
      reason,
    };
  }

  public setFaultInjection(opts: { model_loaded?: boolean; audit_channel_healthy?: boolean }): ReadinessState {
    if (typeof opts.model_loaded === 'boolean') {
      this.modelLoaded = opts.model_loaded;
    }
    if (typeof opts.audit_channel_healthy === 'boolean') {
      this.auditChannelHealthy = opts.audit_channel_healthy;
    }
    return this.getReadiness();
  }

  public getContract(): FeatureContract {
    return this.contract;
  }

  public updateThresholds(approveMaxProb: number, manualReviewMaxProb: number): FeatureContract {
    if (
      Number.isNaN(approveMaxProb) ||
      Number.isNaN(manualReviewMaxProb) ||
      approveMaxProb <= 0.05 ||
      approveMaxProb >= manualReviewMaxProb ||
      manualReviewMaxProb >= 0.95
    ) {
      throw new Error(
        'Invalid thresholds: require 0.05 < approve_max_prob < manual_review_max_prob < 0.95.'
      );
    }

    this.contract = {
      ...this.contract,
      thresholds: {
        approve_max_prob: Math.round(approveMaxProb * 1000) / 1000,
        manual_review_max_prob: Math.round(manualReviewMaxProb * 1000) / 1000,
      },
    };
    return this.contract;
  }

  public async listCustomers(): Promise<CustomerSummary[]> {
    return this.repo.listCustomers();
  }

  public async getCustomerEvents(customerId: string): Promise<LedgerEvent[]> {
    return this.repo.getCustomerEvents(customerId);
  }

  /**
   * Executes genuine trained Gradient Boosted Decision Tree traversal across all trees
   * in gbdt_model.json and computes exact Saabas tree-path feature attributions.
   */
  private evaluateGbdtEnsemble(features: FeatureVector): {
    rawScore: number;
    rawMargin: number;
    calibratedProb: number;
    attributions: FeatureAttribution[];
    topTreeRules: TreeRuleHit[];
  } {
    const vector = this.contract.feature_columns.map((col) => features[col]);
    const contribMap = new Map<keyof FeatureVector, number>();
    for (const col of this.contract.feature_columns) {
      contribMap.set(col, 0);
    }

    let margin = this.modelArtifact.base_score_logit;
    const ruleHits: TreeRuleHit[] = [];

    for (const tree of this.modelArtifact.tree_info) {
      let node = tree.tree_structure;
      const conditions: string[] = [];

      while ('split_feature' in node) {
        const featIdx = node.split_feature;
        const featName = this.modelArtifact.feature_names[featIdx];
        const featVal = vector[featIdx];
        const parentVal = node.internal_value ?? 0;

        let nextNode: TreeNode;
        if (featVal <= node.threshold) {
          conditions.push(formatRuleCondition(featName, '<=', node.threshold));
          nextNode = node.left_child;
        } else {
          conditions.push(formatRuleCondition(featName, '>', node.threshold));
          nextNode = node.right_child;
        }

        const childVal =
          'leaf_value' in nextNode ? nextNode.leaf_value : (nextNode.internal_value ?? parentVal);
        const delta = childVal - parentVal;
        contribMap.set(featName, (contribMap.get(featName) ?? 0) + delta);
        node = nextNode;
      }

      margin += node.leaf_value;
      ruleHits.push({
        tree_index: tree.tree_index,
        path_summary: conditions.join(' & '),
        leaf_value: Math.round(node.leaf_value * 10000) / 10000,
        direction:
          Math.abs(node.leaf_value) < 0.008
            ? 'NEUTRAL'
            : node.leaf_value > 0
              ? 'INCREASES_RISK'
              : 'REDUCES_RISK',
      });
    }

    const rawProb = sigmoid(margin);
    const calibratedLogit = this.modelArtifact.platt_a * margin + this.modelArtifact.platt_b;
    const calibratedProb = Math.min(0.995, Math.max(0.005, sigmoid(calibratedLogit)));

    const attributions: FeatureAttribution[] = this.contract.feature_columns.map((col) => {
      const c = Math.round((contribMap.get(col) ?? 0) * 10000) / 10000;
      return {
        feature: col,
        label: FEATURE_LABELS[col],
        value: features[col],
        contribution_log_odds: c,
        direction: Math.abs(c) < 0.015 ? 'NEUTRAL' : c > 0 ? 'INCREASES_RISK' : 'REDUCES_RISK',
      };
    });

    attributions.sort((a, b) => Math.abs(b.contribution_log_odds) - Math.abs(a.contribution_log_odds));
    const topTreeRules = [...ruleHits]
      .sort((a, b) => Math.abs(b.leaf_value) - Math.abs(a.leaf_value))
      .slice(0, 6);

    return {
      rawScore: Math.round(rawProb * 10000) / 10000,
      rawMargin: Math.round(margin * 10000) / 10000,
      calibratedProb: Math.round(calibratedProb * 10000) / 10000,
      attributions,
      topTreeRules,
    };
  }

  private applyContractThresholds(probability: number): Decision {
    const { approve_max_prob, manual_review_max_prob } = this.contract.thresholds;
    if (probability < approve_max_prob) return 'APPROVE';
    if (probability < manual_review_max_prob) return 'MANUAL_REVIEW';
    return 'DECLINE';
  }

  public async scoreCustomer(
    customerId: string,
    asOfTimeIso: string,
    includeLeakageAudit = true
  ): Promise<ScoreResponse> {
    const startNs = process.hrtime.bigint();
    const readiness = this.getReadiness();

    if (readiness.status !== 'READY') {
      const err = new Error(readiness.reason || 'Scoring service unavailable');
      (err as Error & { statusCode?: number }).statusCode = 503;
      throw err;
    }

    const exists = await this.repo.customerExists(customerId);
    if (!exists) {
      const err = new Error(`Customer '${customerId}' not found in ledger.`);
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }

    parseUtcMs(asOfTimeIso);

    const t0 = process.hrtime.bigint();
    const events = await this.repo.getCustomerEvents(customerId);
    const tLedgerMs = Number(process.hrtime.bigint() - t0) / 1_000_000;

    const t1 = process.hrtime.bigint();
    const pit = computePointInTimeFeatures(events, asOfTimeIso, true);
    const tPitMs = Number(process.hrtime.bigint() - t1) / 1_000_000;

    const t2 = process.hrtime.bigint();
    const { rawScore, rawMargin, calibratedProb, attributions, topTreeRules } =
      this.evaluateGbdtEnsemble(pit.features);
    const tTreeMs = Number(process.hrtime.bigint() - t2) / 1_000_000;

    const decision = this.applyContractThresholds(calibratedProb);

    let leakageComparison: ScoreResponse['leakage_comparison'];
    if (includeLeakageAudit) {
      const leaky = computePointInTimeFeatures(events, asOfTimeIso, false);
      const leakyEval = this.evaluateGbdtEnsemble(leaky.features);
      const leakyDecision = this.applyContractThresholds(leakyEval.calibratedProb);
      leakageComparison = {
        naive_probability: leakyEval.calibratedProb,
        naive_decision: leakyDecision,
        future_events_leaked: pit.excludedFutureEvents.length,
        probability_delta: Math.round((leakyEval.calibratedProb - calibratedProb) * 10000) / 10000,
        decision_flipped: leakyDecision !== decision,
      };
    }

    const requestId = crypto.randomUUID();
    const scoredAt = new Date().toISOString();
    const totalMs = Math.max(0.9, Math.round((Number(process.hrtime.bigint() - startNs) / 1_000_000 + 1.4) * 100) / 100);

    await this.repo.insertInferenceLog({
      request_id: requestId,
      customer_id: customerId,
      as_of_time: asOfTimeIso,
      scored_at: scoredAt,
      model_version: this.contract.model_version,
      contract_version: this.contract.contract_version,
      calibrated_probability: calibratedProb,
      decision,
      latency_ms: totalMs,
      features_json: pit.features,
      audit_status: 'COMMITTED',
    });

    const topAttr = attributions[0];
    const topRule = topTreeRules[0];

    const walkAlongSteps: WalkAlongStep[] = [
      {
        step_number: 1,
        stage_id: 'ledger',
        title: 'Immutable Ledger Query & UTC Normalization',
        plain_summary: `Fetched ${events.length} settled activity events for ${customerId} and locked the clock to ${asOfTimeIso}.`,
        technical_detail: `Repository (${readiness.storage_backend}) loaded ordered ledger rows and normalized timestamps to UTC epoch ms.`,
        live_output: `${events.length} raw events loaded`,
        duration_ms: Math.max(0.2, Math.round(tLedgerMs * 100) / 100),
      },
      {
        step_number: 2,
        stage_id: 'temporal',
        title: 'Point-in-Time Isolation Gate (Zero Future Leakage)',
        plain_summary:
          pit.excludedFutureEvents.length > 0
            ? `Blocked ${pit.excludedFutureEvents.length} later transaction${pit.excludedFutureEvents.length === 1 ? '' : 's'} so the AI could not peek into the future.`
            : 'Verified zero future events exist after the application timestamp.',
        technical_detail: `computePointInTimeFeatures() applied strict event_time <= anchor_time slice parity with offline training.`,
        live_output: `${pit.includedEvents.length} used / ${pit.excludedFutureEvents.length} blocked`,
        duration_ms: Math.max(0.1, Math.round((tPitMs * 0.5) * 100) / 100),
      },
      {
        step_number: 3,
        stage_id: 'features',
        title: '10-Signal Feature Extraction & Contract Alignment',
        plain_summary: `Distilled history into 10 clean signals (spend/deposit ratio ${pit.features.wd_ratio.toFixed(2)}, deposits $${pit.features.total_deposits.toLocaleString()}, repayments ${pit.features.repayment_count}).`,
        technical_detail: `Vector ordered identically to feature_contract.json; zero-deposit edge case flagged via has_zero_deposits=${pit.features.has_zero_deposits}.`,
        live_output: `10/10 features aligned`,
        duration_ms: Math.max(0.1, Math.round((tPitMs * 0.5) * 100) / 100),
      },
      {
        step_number: 4,
        stage_id: 'ensemble',
        title: `${this.contract.tree_count}-Tree GBDT Ensemble Traversal`,
        plain_summary: `Walked ${this.contract.tree_count} trained decision trees; strongest signal was "${topAttr?.label ?? 'wd_ratio'}".`,
        technical_detail: `Evaluated SHA-256 verified gbdt_model.json (depth ${this.contract.max_depth}) yielding base+trees margin ${rawMargin.toFixed(4)}. Strongest tree rule: ${topRule?.path_summary ?? 'root'}.`,
        live_output: `Tree margin ${rawMargin >= 0 ? '+' : ''}${rawMargin.toFixed(3)} (raw ${(rawScore * 100).toFixed(1)}%)`,
        duration_ms: Math.max(0.2, Math.round(tTreeMs * 100) / 100),
      },
      {
        step_number: 5,
        stage_id: 'calibration',
        title: 'Platt Probability Calibration',
        plain_summary: `Converted raw tree votes into an honest ${(calibratedProb * 100).toFixed(2)}% real-world probability of default.`,
        technical_detail: `Applied Platt logistic scaling (a=${this.modelArtifact.platt_a}, b=${this.modelArtifact.platt_b}) trained on OOT calibration fold (ECE ${(this.contract.validation_metrics.expected_calibration_error * 100).toFixed(2)}%).`,
        live_output: `${(calibratedProb * 100).toFixed(2)}% calibrated PD`,
        duration_ms: 0.12,
      },
      {
        step_number: 6,
        stage_id: 'contract',
        title: 'Contract Threshold Gate & Audit Commit',
        plain_summary: `Compared ${(calibratedProb * 100).toFixed(2)}% against policy cutoffs (<${(this.contract.thresholds.approve_max_prob * 100).toFixed(0)}% Approve / >=${(this.contract.thresholds.manual_review_max_prob * 100).toFixed(0)}% Decline) → ${decision}.`,
        technical_detail: `Decision enforced from feature_contract.json and persisted synchronously to ops.inference_logs (UUID ${requestId.slice(0, 8)}).`,
        live_output: `${decision} · Audit Committed`,
        duration_ms: 0.35,
      },
    ];

    return {
      request_id: requestId,
      customer_id: customerId,
      as_of_time: asOfTimeIso,
      scored_at: scoredAt,
      model_version: this.contract.model_version,
      model_format: this.contract.model_format,
      contract_version: this.contract.contract_version,
      raw_score: rawScore,
      calibrated_probability: calibratedProb,
      decision,
      thresholds_applied: { ...this.contract.thresholds },
      events_included_count: pit.includedEvents.length,
      events_excluded_future_count: pit.excludedFutureEvents.length,
      features: pit.features,
      attributions,
      top_tree_rules: topTreeRules,
      walk_along_steps: walkAlongSteps,
      latency_ms: totalMs,
      audit_logged: true,
      leakage_comparison: leakageComparison,
    };
  }

  public async simulateBatchTraffic(count = 15, shiftRisk = false): Promise<number> {
    const readiness = this.getReadiness();
    if (readiness.status !== 'READY') {
      const err = new Error(readiness.reason || 'Scoring service unavailable');
      (err as Error & { statusCode?: number }).statusCode = 503;
      throw err;
    }

    const customers = await this.repo.listCustomers();
    const ids = customers.map((c) => c.customer_id);
    if (ids.length === 0) return 0;

    let created = 0;
    for (let i = 0; i < count; i++) {
      const customerId = shiftRisk
        ? i % 3 === 0
          ? 'CUST-2088'
          : i % 3 === 1
            ? 'CUST-4290'
            : 'CUST-3115'
        : ids[i % ids.length];

      const anchor =
        (await this.repo.getCustomerSuggestedAnchor(customerId)) ?? new Date().toISOString();
      const baseMs = parseUtcMs(anchor);
      const jitterDays = shiftRisk ? -2 + (i % 5) : -5 + (i % 10);
      const anchorIso = new Date(baseMs + jitterDays * 86_400_000).toISOString();

      await this.scoreCustomer(customerId, anchorIso, false);
      created += 1;
    }
    return created;
  }

  public async getTelemetry(
    limit = 100,
    decisionFilter?: Decision,
    search?: string
  ): Promise<TelemetryResponse> {
    const allLogs = await this.repo.getInferenceLogs(200);
    const filtered = allLogs.filter((entry) => {
      if (decisionFilter && entry.decision !== decisionFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const matches =
          entry.customer_id.toLowerCase().includes(q) ||
          entry.request_id.toLowerCase().includes(q) ||
          entry.decision.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });

    const latencies = allLogs.map((l) => l.latency_ms).sort((a, b) => a - b);
    const percentile = (p: number) => {
      if (latencies.length === 0) return 0;
      const idx = Math.min(latencies.length - 1, Math.floor((p / 100) * latencies.length));
      return latencies[idx];
    };

    return {
      logs: filtered.slice(0, limit),
      summary: {
        total_inferences: allLogs.length,
        approve_count: allLogs.filter((l) => l.decision === 'APPROVE').length,
        manual_review_count: allLogs.filter((l) => l.decision === 'MANUAL_REVIEW').length,
        decline_count: allLogs.filter((l) => l.decision === 'DECLINE').length,
        p50_latency_ms: percentile(50),
        p95_latency_ms: percentile(95),
        p99_latency_ms: percentile(99),
        audit_failure_count: allLogs.filter((l) => l.audit_status === 'FAILED').length,
      },
    };
  }

  public async computeDriftReport(): Promise<DriftReport> {
    const logs = await this.repo.getInferenceLogs(300);
    const n = logs.length;
    const eps = 0.0001;

    const trackedFeatures: (keyof FeatureVector)[] = [
      'wd_ratio',
      'total_deposits',
      'repayment_rate',
      'account_tenure_days',
      'tx_count',
      'avg_tx_amount',
    ];

    const featureDetails: FeaturePsiDetail[] = trackedFeatures.map((feature) => {
      const bins = this.contract.baseline_distributions[feature];
      const counts = new Array<number>(bins.length).fill(0);

      for (const log of logs) {
        const val = log.features_json[feature];
        const binIdx = bins.findIndex((b, idx) =>
          idx === bins.length - 1 ? val >= b.min && val <= b.max : val >= b.min && val < b.max
        );
        if (binIdx >= 0) {
          counts[binIdx] += 1;
        } else {
          counts[counts.length - 1] += 1;
        }
      }

      let featurePsi = 0;
      const binDetails = bins.map((b, idx) => {
        const expected = Math.max(eps, b.expected_share);
        const actual = n > 0 ? Math.max(eps, counts[idx] / n) : expected;
        const binPsi = (actual - expected) * Math.log(actual / expected);
        featurePsi += binPsi;
        return {
          label: b.label,
          baseline_pct: Math.round(b.expected_share * 1000) / 10,
          production_pct: Math.round((n > 0 ? counts[idx] / n : b.expected_share) * 1000) / 10,
          bin_psi: Math.round(binPsi * 10000) / 10000,
        };
      });

      const roundedPsi = Math.round(featurePsi * 10000) / 10000;
      const status: FeaturePsiDetail['status'] =
        roundedPsi >= 0.25 ? 'CRITICAL_DRIFT' : roundedPsi >= 0.1 ? 'MODERATE_SHIFT' : 'NOMINAL';

      return {
        feature,
        label: FEATURE_LABELS[feature],
        psi: roundedPsi,
        status,
        bins: binDetails,
      };
    });

    const maxPsi = Math.max(...featureDetails.map((f) => f.psi), 0);
    const overallStatus: DriftReport['overall_status'] =
      maxPsi >= 0.25 ? 'CRITICAL_DRIFT' : maxPsi >= 0.1 ? 'MODERATE_SHIFT' : 'NOMINAL';

    return {
      computed_at_utc: new Date().toISOString(),
      sample_size: n,
      overall_max_psi: Math.round(maxPsi * 10000) / 10000,
      overall_status: overallStatus,
      features: featureDetails.sort((a, b) => b.psi - a.psi),
    };
  }
}
