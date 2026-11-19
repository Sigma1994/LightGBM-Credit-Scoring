export type EventType = 'DEPOSIT' | 'TRANSACTION' | 'REPAYMENT';

export type Decision = 'APPROVE' | 'MANUAL_REVIEW' | 'DECLINE';

export interface LedgerEvent {
  event_uuid: string;
  customer_id: string;
  event_type: EventType;
  amount: number;
  event_time: string; // ISO-8601 UTC
  channel: 'ACH' | 'CARD' | 'WIRE' | 'AUTOPAY';
  status: 'SETTLED' | 'PENDING_EXCLUDED';
}

export interface CustomerSummary {
  customer_id: string;
  full_name: string;
  segment: 'Prime Payroll' | 'Thin-File Gig' | 'High-Utilization' | 'Seasonal Merchant';
  first_event_time: string;
  last_event_time: string;
  total_events: number;
  settled_balance_net: number;
  suggested_anchor_time: string;
}

export interface FeatureVector {
  total_deposits: number;
  total_withdrawals: number;
  wd_ratio: number;
  has_zero_deposits: number;
  tx_count: number;
  repayment_count: number;
  repayment_rate: number;
  avg_tx_amount: number;
  account_tenure_days: number;
  days_since_last_event: number;
}

export interface FeatureAttribution {
  feature: keyof FeatureVector;
  label: string;
  value: number;
  contribution_log_odds: number;
  direction: 'INCREASES_RISK' | 'REDUCES_RISK' | 'NEUTRAL';
}

export interface TreeRuleHit {
  tree_index: number;
  path_summary: string;
  leaf_value: number;
  direction: 'INCREASES_RISK' | 'REDUCES_RISK' | 'NEUTRAL';
}

export interface WalkAlongStep {
  step_number: number;
  stage_id: 'ledger' | 'temporal' | 'features' | 'ensemble' | 'calibration' | 'contract';
  title: string;
  plain_summary: string;
  technical_detail: string;
  live_output: string;
  duration_ms: number;
}

export interface FeatureBaselineBin {
  label: string;
  min: number;
  max: number;
  expected_share: number;
}

export interface FeatureContract {
  contract_version: string;
  model_version: string;
  model_format: 'gbdt_tree_json' | 'lightgbm_python_proxy';
  tree_count: number;
  max_depth: number;
  artifact_sha256: string;
  created_at_utc: string;
  feature_columns: (keyof FeatureVector)[];
  thresholds: {
    approve_max_prob: number;
    manual_review_max_prob: number;
  };
  validation_metrics: {
    split_strategy: string;
    oot_roc_auc: number;
    pr_auc: number;
    ks_statistic: number;
    brier_score: number;
    expected_calibration_error: number;
    training_samples: number;
    oot_samples: number;
  };
  calibration_bins: {
    bin_label: string;
    mean_predicted_prob: number;
    observed_default_rate: number;
    sample_count: number;
  }[];
  baseline_distributions: Record<keyof FeatureVector, FeatureBaselineBin[]>;
}

export interface ScoreRequest {
  customer_id: string;
  as_of_time: string;
  requested_amount?: number;
  include_leakage_audit?: boolean;
}

export interface ScoreResponse {
  request_id: string;
  customer_id: string;
  as_of_time: string;
  scored_at: string;
  model_version: string;
  model_format: FeatureContract['model_format'];
  contract_version: string;
  raw_score: number;
  calibrated_probability: number;
  decision: Decision;
  thresholds_applied: {
    approve_max_prob: number;
    manual_review_max_prob: number;
  };
  events_included_count: number;
  events_excluded_future_count: number;
  features: FeatureVector;
  attributions: FeatureAttribution[];
  top_tree_rules: TreeRuleHit[];
  walk_along_steps: WalkAlongStep[];
  latency_ms: number;
  audit_logged: boolean;
  leakage_comparison?: {
    naive_probability: number;
    naive_decision: Decision;
    future_events_leaked: number;
    probability_delta: number;
    decision_flipped: boolean;
  };
}

export interface InferenceLogEntry {
  request_id: string;
  customer_id: string;
  as_of_time: string;
  scored_at: string;
  model_version: string;
  contract_version: string;
  calibrated_probability: number;
  decision: Decision;
  latency_ms: number;
  features_json: FeatureVector;
  audit_status: 'COMMITTED' | 'FAILED';
}

export interface TelemetryResponse {
  logs: InferenceLogEntry[];
  summary: {
    total_inferences: number;
    approve_count: number;
    manual_review_count: number;
    decline_count: number;
    p50_latency_ms: number;
    p95_latency_ms: number;
    p99_latency_ms: number;
    audit_failure_count: number;
  };
}

export interface FeaturePsiDetail {
  feature: keyof FeatureVector;
  label: string;
  psi: number;
  status: 'NOMINAL' | 'MODERATE_SHIFT' | 'CRITICAL_DRIFT';
  bins: {
    label: string;
    baseline_pct: number;
    production_pct: number;
    bin_psi: number;
  }[];
}

export interface DriftReport {
  computed_at_utc: string;
  sample_size: number;
  overall_max_psi: number;
  overall_status: 'NOMINAL' | 'MODERATE_SHIFT' | 'CRITICAL_DRIFT';
  features: FeaturePsiDetail[];
}

export interface ReadinessState {
  status: 'READY' | 'UNAVAILABLE';
  storage_backend: 'postgres' | 'memory_fallback';
  storage_note: string;
  model_engine: 'gbdt_tree_ensemble' | 'python_lightgbm_proxy';
  model_loaded: boolean;
  contract_verified: boolean;
  audit_channel_healthy: boolean;
  pool_active_connections: number;
  pool_max_connections: number;
  model_version: string;
  contract_version: string;
  reason?: string;
}
