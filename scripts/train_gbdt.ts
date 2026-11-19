import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { computePointInTimeFeatures, FEATURE_COLUMNS } from '../server/featureStore.ts';
import type { FeatureBaselineBin, FeatureContract, FeatureVector, LedgerEvent } from '../src/shared/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface TreeSplitNode {
  split_feature: number;
  split_feature_name: keyof FeatureVector;
  threshold: number;
  decision_type: '<=';
  internal_value: number;
  internal_count: number;
  left_child: TreeNode;
  right_child: TreeNode;
}

export interface TreeLeafNode {
  leaf_value: number;
  leaf_count: number;
  internal_value: number;
}

export type TreeNode = TreeSplitNode | TreeLeafNode;

export interface GbdtModelArtifact {
  name: 'tree';
  version: string;
  num_class: 1;
  num_tree_per_iteration: 1;
  max_feature_idx: number;
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

// Deterministic PRNG for reproducible training & OOT validation
function createRng(seed = 20261119) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function sigmoid(x: number): number {
  if (x > 35) return 1 - 1e-15;
  if (x < -35) return 1e-15;
  return 1 / (1 + Math.exp(-x));
}

interface TrainingRow {
  customerId: string;
  anchorIso: string;
  anchorMs: number;
  features: FeatureVector;
  vector: number[];
  label: 0 | 1;
}

function generateRealisticCreditDataset(): TrainingRow[] {
  const rand = createRng(42026);
  const rows: TrainingRow[] = [];

  const may1Ms = Date.parse('2026-05-01T00:00:00Z');
  const oct20Ms = Date.parse('2026-10-20T00:00:00Z');

  for (let i = 0; i < 4000; i++) {
    const customerId = `TRAIN-${String(i).padStart(5, '0')}`;
    // Application anchor distributed across May 20 -> Oct 20, 2026
    const anchorMs = may1Ms + (20 + rand() * 152) * 86_400_000;
    const anchorIso = new Date(anchorMs).toISOString();

    // Sample latent borrower archetype
    const u = rand();
    const archetype =
      u < 0.34 ? 'prime' : u < 0.62 ? 'moderate' : u < 0.86 ? 'stressed' : 'thin_or_unfunded';

    const tenureDays =
      archetype === 'prime'
        ? 30 + rand() * 75
        : archetype === 'thin_or_unfunded'
          ? 3 + rand() * 25
          : 15 + rand() * 65;

    const firstEventMs = anchorMs - tenureDays * 86_400_000;
    const events: LedgerEvent[] = [];

    const depositCount =
      archetype === 'thin_or_unfunded' && rand() < 0.32
        ? 0
        : archetype === 'prime'
          ? 2 + Math.floor(rand() * 4)
          : 1 + Math.floor(rand() * 3);

    for (let d = 0; d < depositCount; d++) {
      const t = firstEventMs + (rand() * 0.92 * tenureDays) * 86_400_000;
      const amt =
        archetype === 'prime'
          ? 2400 + rand() * 2600
          : archetype === 'moderate'
            ? 1400 + rand() * 1800
            : 650 + rand() * 1100;
      events.push({
        event_uuid: `${customerId}-d-${d}`,
        customer_id: customerId,
        event_type: 'DEPOSIT',
        amount: Math.round(amt),
        event_time: new Date(t).toISOString(),
        channel: 'ACH',
        status: 'SETTLED',
      });
    }

    const txCount =
      archetype === 'prime'
        ? 3 + Math.floor(rand() * 7)
        : archetype === 'stressed'
          ? 6 + Math.floor(rand() * 10)
          : 2 + Math.floor(rand() * 6);

    for (let tx = 0; tx < txCount; tx++) {
      const t = firstEventMs + (rand() * 0.98 * tenureDays) * 86_400_000;
      const amt =
        archetype === 'prime'
          ? 120 + rand() * 320
          : archetype === 'stressed'
            ? 260 + rand() * 540
            : 110 + rand() * 290;
      events.push({
        event_uuid: `${customerId}-t-${tx}`,
        customer_id: customerId,
        event_type: 'TRANSACTION',
        amount: Math.round(amt),
        event_time: new Date(t).toISOString(),
        channel: rand() < 0.8 ? 'CARD' : 'WIRE',
        status: 'SETTLED',
      });
    }

    const repCount =
      archetype === 'prime'
        ? 2 + Math.floor(rand() * 4)
        : archetype === 'moderate'
          ? 1 + Math.floor(rand() * 3)
          : rand() < 0.25
            ? 1
            : 0;

    for (let r = 0; r < repCount; r++) {
      const t = firstEventMs + (0.2 + rand() * 0.78) * tenureDays * 86_400_000;
      events.push({
        event_uuid: `${customerId}-r-${r}`,
        customer_id: customerId,
        event_type: 'REPAYMENT',
        amount: Math.round(250 + rand() * 550),
        event_time: new Date(t).toISOString(),
        channel: 'AUTOPAY',
        status: 'SETTLED',
      });
    }

    // Add post-anchor future events that MUST be excluded by computePointInTimeFeatures()
    if (anchorMs < oct20Ms) {
      events.push({
        event_uuid: `${customerId}-future-1`,
        customer_id: customerId,
        event_type: rand() < 0.5 ? 'DEPOSIT' : 'TRANSACTION',
        amount: Math.round(1200 + rand() * 2800),
        event_time: new Date(anchorMs + (2 + rand() * 12) * 86_400_000).toISOString(),
        channel: 'WIRE',
        status: 'PENDING_EXCLUDED',
      });
    }

    const { features } = computePointInTimeFeatures(events, anchorIso, true);
    const vector = FEATURE_COLUMNS.map((col) => features[col]);

    // Ground-truth non-linear risk generating process (interaction terms + saturation)
    let trueLogit = -1.15;
    if (features.has_zero_deposits === 1) trueLogit += 1.65;
    if (features.wd_ratio > 0.95) trueLogit += 1.55;
    else if (features.wd_ratio > 0.7) trueLogit += 0.75;
    else if (features.wd_ratio < 0.35) trueLogit -= 0.95;

    if (features.repayment_rate >= 0.45) trueLogit -= 1.05;
    else if (features.repayment_count === 0) trueLogit += 0.95;

    if (features.total_deposits >= 5000) trueLogit -= 0.75;
    else if (features.total_deposits < 1500) trueLogit += 0.65;

    if (features.account_tenure_days < 18) trueLogit += 0.45;
    else if (features.account_tenure_days > 55) trueLogit -= 0.55;

    if (features.avg_tx_amount > 420 && features.wd_ratio > 0.65) trueLogit += 0.65;
    if (features.days_since_last_event > 10) trueLogit += 0.35;

    // Small temporal drift term in late Sep/Oct
    if (anchorMs > Date.parse('2026-09-20T00:00:00Z')) trueLogit += 0.12;

    const pTrue = sigmoid(trueLogit);
    const label: 0 | 1 = rand() < pTrue ? 1 : 0;

    rows.push({
      customerId,
      anchorIso,
      anchorMs,
      features,
      vector,
      label,
    });
  }

  return rows;
}

function buildTree(
  indices: number[],
  vectors: number[][],
  grads: number[],
  hessians: number[],
  depth: number,
  maxDepth: number,
  lambdaL2: number,
  minLeafCount: number,
  learningRate: number
): { node: TreeNode; leaves: number } {
  let sumG = 0;
  let sumH = 0;
  for (const idx of indices) {
    sumG += grads[idx];
    sumH += hessians[idx];
  }

  const optimalWeight = (-learningRate * sumG) / (sumH + lambdaL2);

  if (depth >= maxDepth || indices.length < minLeafCount * 2) {
    return {
      node: {
        leaf_value: Math.round(optimalWeight * 1_000_000) / 1_000_000,
        leaf_count: indices.length,
        internal_value: Math.round(optimalWeight * 1_000_000) / 1_000_000,
      },
      leaves: 1,
    };
  }

  const parentScore = (sumG * sumG) / (sumH + lambdaL2);
  let bestGain = 1e-6;
  let bestFeature = -1;
  let bestThreshold = 0;

  const numFeatures = FEATURE_COLUMNS.length;
  for (let f = 0; f < numFeatures; f++) {
    // Sort indices by feature value
    const sorted = [...indices].sort((a, b) => vectors[a][f] - vectors[b][f]);

    // Evaluate quantile candidate thresholds (up to 32 bins like LightGBM histogram binning)
    let leftG = 0;
    let leftH = 0;
    for (let pos = 0; pos < sorted.length - 1; pos++) {
      const idx = sorted[pos];
      leftG += grads[idx];
      leftH += hessians[idx];

      const nextIdx = sorted[pos + 1];
      if (vectors[idx][f] === vectors[nextIdx][f]) continue;

      const leftCount = pos + 1;
      const rightCount = sorted.length - leftCount;
      if (leftCount < minLeafCount || rightCount < minLeafCount) continue;

      const rightG = sumG - leftG;
      const rightH = sumH - leftH;
      const gain =
        0.5 *
        ((leftG * leftG) / (leftH + lambdaL2) +
          (rightG * rightG) / (rightH + lambdaL2) -
          parentScore);

      if (gain > bestGain) {
        bestGain = gain;
        bestFeature = f;
        bestThreshold = (vectors[idx][f] + vectors[nextIdx][f]) / 2;
      }
    }
  }

  if (bestFeature === -1) {
    return {
      node: {
        leaf_value: Math.round(optimalWeight * 1_000_000) / 1_000_000,
        leaf_count: indices.length,
        internal_value: Math.round(optimalWeight * 1_000_000) / 1_000_000,
      },
      leaves: 1,
    };
  }

  const leftIndices: number[] = [];
  const rightIndices: number[] = [];
  for (const idx of indices) {
    if (vectors[idx][bestFeature] <= bestThreshold) leftIndices.push(idx);
    else rightIndices.push(idx);
  }

  const leftBuilt = buildTree(
    leftIndices,
    vectors,
    grads,
    hessians,
    depth + 1,
    maxDepth,
    lambdaL2,
    minLeafCount,
    learningRate
  );
  const rightBuilt = buildTree(
    rightIndices,
    vectors,
    grads,
    hessians,
    depth + 1,
    maxDepth,
    lambdaL2,
    minLeafCount,
    learningRate
  );

  return {
    node: {
      split_feature: bestFeature,
      split_feature_name: FEATURE_COLUMNS[bestFeature],
      threshold: Math.round(bestThreshold * 10000) / 10000,
      decision_type: '<=',
      internal_value: Math.round(optimalWeight * 1_000_000) / 1_000_000,
      internal_count: indices.length,
      left_child: leftBuilt.node,
      right_child: rightBuilt.node,
    },
    leaves: leftBuilt.leaves + rightBuilt.leaves,
  };
}

function predictSingleTree(node: TreeNode, vector: number[]): number {
  let curr = node;
  while ('split_feature' in curr) {
    if (vector[curr.split_feature] <= curr.threshold) {
      curr = curr.left_child;
    } else {
      curr = curr.right_child;
    }
  }
  return curr.leaf_value;
}

function fitPlattCalibration(logits: number[], labels: number[]): { a: number; b: number } {
  let a = 1.0;
  let b = 0.0;
  const lr = 0.08;
  for (let epoch = 0; epoch < 600; epoch++) {
    let gradA = 0;
    let gradB = 0;
    for (let i = 0; i < logits.length; i++) {
      const p = sigmoid(a * logits[i] + b);
      const err = p - labels[i];
      gradA += err * logits[i];
      gradB += err;
    }
    a -= (lr * gradA) / logits.length;
    b -= (lr * gradB) / logits.length;
  }
  return {
    a: Math.round(a * 10000) / 10000,
    b: Math.round(b * 10000) / 10000,
  };
}

function computeMetrics(probs: number[], labels: (0 | 1)[]) {
  const n = probs.length;
  const pairs = probs.map((p, i) => ({ p, y: labels[i] })).sort((a, b) => b.p - a.p);

  const totalPos = labels.filter((y) => y === 1).length;
  const totalNeg = n - totalPos;

  // ROC-AUC & KS Statistic
  let tp = 0;
  let fp = 0;
  let prevTpr = 0;
  let prevFpr = 0;
  let rocAuc = 0;
  let maxKs = 0;

  // PR-AUC
  let prAuc = 0;
  let prevRecall = 0;

  for (let i = 0; i < pairs.length; i++) {
    if (pairs[i].y === 1) tp += 1;
    else fp += 1;

    const tpr = tp / totalPos;
    const fpr = fp / totalNeg;
    rocAuc += ((fpr - prevFpr) * (tpr + prevTpr)) / 2;
    prevTpr = tpr;
    prevFpr = fpr;

    const ks = Math.abs(tpr - fpr);
    if (ks > maxKs) maxKs = ks;

    const precision = tp / (i + 1);
    const recall = tpr;
    prAuc += (recall - prevRecall) * precision;
    prevRecall = recall;
  }

  // Brier Score & 5-bin Calibration Curve (ECE)
  let brier = 0;
  for (let i = 0; i < n; i++) {
    brier += (probs[i] - labels[i]) ** 2;
  }
  brier /= n;

  const binRanges = [
    { label: '0.00 - 0.20', min: 0, max: 0.2 },
    { label: '0.20 - 0.40', min: 0.2, max: 0.4 },
    { label: '0.40 - 0.60', min: 0.4, max: 0.6 },
    { label: '0.60 - 0.80', min: 0.6, max: 0.8 },
    { label: '0.80 - 1.00', min: 0.8, max: 1.0001 },
  ];

  let ece = 0;
  const calibrationBins = binRanges.map((r) => {
    const members = pairs.filter((item) => item.p >= r.min && item.p < r.max);
    if (members.length === 0) {
      return {
        bin_label: r.label,
        mean_predicted_prob: Math.round(((r.min + r.max) / 2) * 1000) / 1000,
        observed_default_rate: Math.round(((r.min + r.max) / 2) * 1000) / 1000,
        sample_count: 0,
      };
    }
    const meanPred = members.reduce((acc, m) => acc + m.p, 0) / members.length;
    const obsRate = members.reduce((acc, m) => acc + m.y, 0) / members.length;
    ece += (members.length / n) * Math.abs(meanPred - obsRate);
    return {
      bin_label: r.label,
      mean_predicted_prob: Math.round(meanPred * 1000) / 1000,
      observed_default_rate: Math.round(obsRate * 1000) / 1000,
      sample_count: members.length,
    };
  });

  return {
    oot_roc_auc: Math.round(rocAuc * 10000) / 10000,
    pr_auc: Math.round(prAuc * 10000) / 10000,
    ks_statistic: Math.round(maxKs * 1000) / 1000,
    brier_score: Math.round(brier * 10000) / 10000,
    expected_calibration_error: Math.round(ece * 10000) / 10000,
    calibration_bins: calibrationBins,
  };
}

function computeBaselineDistributions(
  trainRows: TrainingRow[]
): Record<keyof FeatureVector, FeatureBaselineBin[]> {
  const templates: Record<keyof FeatureVector, { label: string; min: number; max: number }[]> = {
    total_deposits: [
      { label: '< $1,500', min: 0, max: 1500 },
      { label: '$1,500 - $4,000', min: 1500, max: 4000 },
      { label: '$4,000 - $8,000', min: 4000, max: 8000 },
      { label: '> $8,000', min: 8000, max: 1e12 },
    ],
    total_withdrawals: [
      { label: '< $1,000', min: 0, max: 1000 },
      { label: '$1,000 - $3,000', min: 1000, max: 3000 },
      { label: '$3,000 - $6,000', min: 3000, max: 6000 },
      { label: '> $6,000', min: 6000, max: 1e12 },
    ],
    wd_ratio: [
      { label: '0.00 - 0.45', min: 0, max: 0.45 },
      { label: '0.45 - 0.75', min: 0.45, max: 0.75 },
      { label: '0.75 - 1.00', min: 0.75, max: 1.0 },
      { label: '> 1.00', min: 1.0, max: 1e12 },
    ],
    has_zero_deposits: [
      { label: 'Has Deposits (0)', min: 0, max: 0.5 },
      { label: 'Zero Deposits (1)', min: 0.5, max: 2 },
    ],
    tx_count: [
      { label: '0 - 5 tx', min: 0, max: 5 },
      { label: '5 - 12 tx', min: 5, max: 12 },
      { label: '12 - 20 tx', min: 12, max: 20 },
      { label: '20+ tx', min: 20, max: 1e12 },
    ],
    repayment_count: [
      { label: '0 - 1', min: 0, max: 2 },
      { label: '2 - 4', min: 2, max: 5 },
      { label: '5+', min: 5, max: 1e12 },
    ],
    repayment_rate: [
      { label: '0.00 - 0.15', min: 0, max: 0.15 },
      { label: '0.15 - 0.40', min: 0.15, max: 0.4 },
      { label: '0.40+', min: 0.4, max: 1e12 },
    ],
    avg_tx_amount: [
      { label: '< $120', min: 0, max: 120 },
      { label: '$120 - $280', min: 120, max: 280 },
      { label: '$280+', min: 280, max: 1e12 },
    ],
    account_tenure_days: [
      { label: '< 21d', min: 0, max: 21 },
      { label: '21d - 60d', min: 21, max: 60 },
      { label: '60d+', min: 60, max: 1e12 },
    ],
    days_since_last_event: [
      { label: '< 2d', min: 0, max: 2 },
      { label: '2d - 7d', min: 2, max: 7 },
      { label: '7d+', min: 7, max: 1e12 },
    ],
  };

  const out = {} as Record<keyof FeatureVector, FeatureBaselineBin[]>;
  const n = trainRows.length;

  for (const col of FEATURE_COLUMNS) {
    const defs = templates[col];
    const counts = new Array<number>(defs.length).fill(0);
    for (const row of trainRows) {
      const v = row.features[col];
      const idx = defs.findIndex((b, bIdx) =>
        bIdx === defs.length - 1 ? v >= b.min && v <= b.max : v >= b.min && v < b.max
      );
      counts[idx >= 0 ? idx : defs.length - 1] += 1;
    }
    out[col] = defs.map((b, idx) => ({
      label: b.label,
      min: b.min,
      max: b.max,
      expected_share: Math.max(0.01, Math.round((counts[idx] / n) * 10000) / 10000),
    }));
  }
  return out;
}

function main() {
  console.log('Generating Out-of-Time credit ledger dataset...');
  const allRows = generateRealisticCreditDataset();

  const trainEndMs = Date.parse('2026-09-01T00:00:00Z');
  const calEndMs = Date.parse('2026-09-20T00:00:00Z');

  const trainRows = allRows.filter((r) => r.anchorMs <= trainEndMs);
  const calRows = allRows.filter((r) => r.anchorMs > trainEndMs && r.anchorMs <= calEndMs);
  const ootRows = allRows.filter((r) => r.anchorMs > calEndMs);

  console.log(
    `Split sizes -> Train: ${trainRows.length}, Calibration: ${calRows.length}, OOT Holdout: ${ootRows.length}`
  );

  const posRate = trainRows.reduce((s, r) => s + r.label, 0) / trainRows.length;
  const baseScoreLogit = Math.round(Math.log(posRate / (1 - posRate)) * 1_000_000) / 1_000_000;

  const trainVectors = trainRows.map((r) => r.vector);
  const trainPreds = new Array<number>(trainRows.length).fill(baseScoreLogit);
  const allIndices = trainRows.map((_, i) => i);

  const numTrees = 40;
  const maxDepth = 3;
  const learningRate = 0.1;
  const lambdaL2 = 4.0;
  const minLeafCount = 25;

  const treeInfo: GbdtModelArtifact['tree_info'] = [];

  for (let m = 0; m < numTrees; m++) {
    const grads = new Array<number>(trainRows.length);
    const hessians = new Array<number>(trainRows.length);

    for (let i = 0; i < trainRows.length; i++) {
      const p = sigmoid(trainPreds[i]);
      grads[i] = p - trainRows[i].label;
      hessians[i] = Math.max(1e-6, p * (1 - p));
    }

    const built = buildTree(
      allIndices,
      trainVectors,
      grads,
      hessians,
      0,
      maxDepth,
      lambdaL2,
      minLeafCount,
      learningRate
    );

    for (let i = 0; i < trainRows.length; i++) {
      trainPreds[i] += predictSingleTree(built.node, trainVectors[i]);
    }

    treeInfo.push({
      tree_index: m,
      num_leaves: built.leaves,
      shrinkage: learningRate,
      tree_structure: built.node,
    });
  }

  // Fit Platt scaling strictly on calibration fold
  const calRawLogits = calRows.map((r) => {
    let margin = baseScoreLogit;
    for (const t of treeInfo) margin += predictSingleTree(t.tree_structure, r.vector);
    return margin;
  });
  const platt = fitPlattCalibration(
    calRawLogits,
    calRows.map((r) => r.label)
  );

  // Evaluate on unseen OOT holdout set
  const ootCalibratedProbs = ootRows.map((r) => {
    let margin = baseScoreLogit;
    for (const t of treeInfo) margin += predictSingleTree(t.tree_structure, r.vector);
    return sigmoid(platt.a * margin + platt.b);
  });

  const ootMetrics = computeMetrics(
    ootCalibratedProbs,
    ootRows.map((r) => r.label)
  );

  const modelArtifact: GbdtModelArtifact = {
    name: 'tree',
    version: 'gbdt-3.0.0-platt',
    num_class: 1,
    num_tree_per_iteration: 1,
    max_feature_idx: FEATURE_COLUMNS.length - 1,
    feature_names: [...FEATURE_COLUMNS],
    base_score_logit: baseScoreLogit,
    platt_a: platt.a,
    platt_b: platt.b,
    tree_info: treeInfo,
  };

  const artifactJson = JSON.stringify(modelArtifact, null, 2);
  const sha256 = crypto.createHash('sha256').update(artifactJson).digest('hex');

  const contract: FeatureContract = {
    contract_version: '2026.11.19',
    model_version: modelArtifact.version,
    model_format: 'gbdt_tree_json',
    tree_count: numTrees,
    max_depth: maxDepth,
    artifact_sha256: sha256,
    created_at_utc: new Date().toISOString(),
    feature_columns: [...FEATURE_COLUMNS],
    thresholds: {
      approve_max_prob: 0.35,
      manual_review_max_prob: 0.65,
    },
    validation_metrics: {
      split_strategy:
        'Out-of-Time (Train <= 2026-09-01, Cal <= 2026-09-20, OOT > 2026-09-20) · PIT-extracted',
      oot_roc_auc: ootMetrics.oot_roc_auc,
      pr_auc: ootMetrics.pr_auc,
      ks_statistic: ootMetrics.ks_statistic,
      brier_score: ootMetrics.brier_score,
      expected_calibration_error: ootMetrics.expected_calibration_error,
      training_samples: trainRows.length,
      oot_samples: ootRows.length,
    },
    calibration_bins: ootMetrics.calibration_bins,
    baseline_distributions: computeBaselineDistributions(trainRows),
  };

  const artifactsDir = path.resolve(__dirname, '..', 'server', 'artifacts');
  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(path.join(artifactsDir, 'gbdt_model.json'), artifactJson, 'utf-8');
  fs.writeFileSync(
    path.join(artifactsDir, 'feature_contract.json'),
    JSON.stringify(contract, null, 2),
    'utf-8'
  );

  console.log('Trained real 40-tree GBDT artifact & contract!');
  console.log('OOT Metrics:', JSON.stringify(contract.validation_metrics, null, 2));
}

main();
