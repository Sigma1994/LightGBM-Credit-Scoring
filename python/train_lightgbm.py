"""
AegisCredit — Python LightGBM Out-of-Time Training & Artifact Export Pipeline
===========================================================================
Trains a genuine `lightgbm.LGBMClassifier` on Point-in-Time (PIT) ledger features,
fits Platt logistic calibration on a dedicated calibration fold, evaluates Out-of-Time
(OOT) holdout metrics, and exports:
  1. python/artifacts/lightgbm_model.txt  (native LightGBM Booster for FastAPI)
  2. server/artifacts/gbdt_model.json     (booster.dump_model() JSON for Node/Cloud Preview)
  3. server/artifacts/feature_contract.json (SHA-256 signed schema & policy contract)
"""

from __future__ import annotations

import datetime as dt
import hashlib
import json
import math
from pathlib import Path
from typing import Any

import lightgbm as lgb
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score, brier_score_loss, roc_auc_score

FEATURE_COLUMNS = [
    "total_deposits",
    "total_withdrawals",
    "wd_ratio",
    "has_zero_deposits",
    "tx_count",
    "repayment_count",
    "repayment_rate",
    "avg_tx_amount",
    "account_tenure_days",
    "days_since_last_event",
]

FEATURE_LABELS = {
    "total_deposits": "Total Settled Deposits ($)",
    "total_withdrawals": "Total Withdrawals ($)",
    "wd_ratio": "Withdrawal-to-Deposit Ratio",
    "has_zero_deposits": "Zero-Deposit Indicator",
    "tx_count": "Debit Transaction Count",
    "repayment_count": "Settled Repayment Count",
    "repayment_rate": "Repayment-to-Tx Ratio",
    "avg_tx_amount": "Mean Transaction Amount ($)",
    "account_tenure_days": "Account Tenure (Days)",
    "days_since_last_event": "Days Since Last Event",
}

BASE_DIR = Path(__file__).resolve().parent.parent
PY_ARTIFACTS_DIR = Path(__file__).resolve().parent / "artifacts"
SERVER_ARTIFACTS_DIR = BASE_DIR / "server" / "artifacts"


def sigmoid(x: float) -> float:
    x_clamped = max(-35.0, min(35.0, x))
    return 1.0 / (1.0 + math.exp(-x_clamped))


def generate_pit_dataset(n_samples: int = 4000, seed: int = 42) -> tuple[np.ndarray, np.ndarray, list[str]]:
    """Generate Point-in-Time credit ledger snapshots across 4 borrower archetypes."""
    rng = np.random.default_rng(seed)
    start_ts = dt.datetime(2026, 7, 15, tzinfo=dt.timezone.utc)
    end_ts = dt.datetime(2026, 10, 15, tzinfo=dt.timezone.utc)
    span_seconds = int((end_ts - start_ts).total_seconds())

    rows: list[list[float]] = []
    labels: list[int] = []
    dates: list[str] = []

    for i in range(n_samples):
        arch = i % 4
        if arch == 0:  # Prime Payroll
            total_deposits = float(rng.uniform(4200, 14500))
            wd_ratio = float(rng.uniform(0.18, 0.58))
            tx_count = int(rng.integers(5, 19))
            repayment_count = int(rng.integers(2, 7))
            tenure = float(rng.uniform(35, 130))
            recency = float(rng.uniform(0.5, 6.0))
        elif arch == 1:  # Thin-File Gig
            total_deposits = float(rng.uniform(550, 3200))
            wd_ratio = float(rng.uniform(0.45, 0.92))
            tx_count = int(rng.integers(2, 10))
            repayment_count = int(rng.integers(0, 3))
            tenure = float(rng.uniform(6, 42))
            recency = float(rng.uniform(1.0, 14.0))
        elif arch == 2:  # High-Utilization / Overextended
            total_deposits = float(rng.uniform(0 if rng.random() < 0.14 else 900, 4600))
            wd_ratio = 2.5 if total_deposits <= 0 else float(rng.uniform(0.84, 1.85))
            tx_count = int(rng.integers(4, 17))
            repayment_count = int(rng.integers(0, 2))
            tenure = float(rng.uniform(12, 85))
            recency = float(rng.uniform(0.5, 18.0))
        else:  # Seasonal Merchant
            total_deposits = float(rng.uniform(1600, 8800))
            wd_ratio = float(rng.uniform(0.30, 0.86))
            tx_count = int(rng.integers(3, 14))
            repayment_count = int(rng.integers(1, 5))
            tenure = float(rng.uniform(14, 95))
            recency = float(rng.uniform(0.8, 12.0))

        total_withdrawals = (
            float(rng.uniform(350, 1900)) if total_deposits <= 0 else total_deposits * wd_ratio
        )
        has_zero_deposits = 1.0 if total_deposits <= 0 else 0.0
        repayment_rate = min(3.0, repayment_count / max(1, tx_count))
        avg_tx_amount = (total_withdrawals + total_deposits * 0.2) / max(1, tx_count)

        # True latent default log-odds with non-linear interactions
        latent = (
            -1.05
            + 2.35 * max(0.0, wd_ratio - 0.68)
            + (1.45 if wd_ratio > 1.0 else 0.0)
            + 1.30 * has_zero_deposits
            - 0.72 * min(3, repayment_count)
            - 1.15 * min(1.0, repayment_rate)
            - 0.015 * min(60.0, tenure)
            + 0.065 * max(0.0, recency - 7.0)
            - 0.42 * min(1.0, total_deposits / 5000.0)
            + (0.85 if (wd_ratio > 0.85 and repayment_count == 0) else 0.0)
            + float(rng.normal(0.0, 0.45))
        )
        y = 1 if rng.random() < sigmoid(latent) else 0

        ts = start_ts + dt.timedelta(seconds=int(rng.integers(0, span_seconds)))
        dates.append(ts.strftime("%Y-%m-%dT%H:%M:%SZ"))
        rows.append(
            [
                round(total_deposits, 2),
                round(total_withdrawals, 2),
                round(wd_ratio, 4),
                has_zero_deposits,
                float(tx_count),
                float(repayment_count),
                round(repayment_rate, 4),
                round(avg_tx_amount, 2),
                round(tenure, 2),
                round(recency, 2),
            ]
        )
        labels.append(y)

    return np.array(rows, dtype=np.float64), np.array(labels, dtype=np.int32), dates


def compute_ks(y_true: np.ndarray, y_prob: np.ndarray) -> float:
    order = np.argsort(-y_prob)
    y_sorted = y_true[order]
    pos_total = max(1, int(y_sorted.sum()))
    neg_total = max(1, int((1 - y_sorted).sum()))
    cum_pos = np.cumsum(y_sorted) / pos_total
    cum_neg = np.cumsum(1 - y_sorted) / neg_total
    return float(np.max(np.abs(cum_pos - cum_neg)))


def compute_ece_and_bins(y_true: np.ndarray, y_prob: np.ndarray, n_bins: int = 5) -> tuple[float, list[dict[str, Any]]]:
    bins: list[dict[str, Any]] = []
    ece = 0.0
    n = max(1, len(y_true))
    for b in range(n_bins):
        lo, hi = b / n_bins, (b + 1) / n_bins
        mask = (y_prob >= lo) & (y_prob <= hi if b == n_bins - 1 else y_prob < hi)
        count = int(mask.sum())
        mean_pred = float(y_prob[mask].mean()) if count > 0 else (lo + hi) / 2.0
        obs_rate = float(y_true[mask].mean()) if count > 0 else 0.0
        ece += (count / n) * abs(mean_pred - obs_rate)
        bins.append(
            {
                "bin_label": f"{int(lo * 100)}%-{int(hi * 100)}%",
                "mean_predicted_prob": round(mean_pred, 4),
                "observed_default_rate": round(obs_rate, 4),
                "sample_count": count,
            }
        )
    return round(ece, 4), bins


def build_baseline_distributions(X_train: np.ndarray) -> dict[str, list[dict[str, Any]]]:
    specs: dict[str, list[tuple[str, float, float]]] = {
        "total_deposits": [("$0 - $1.5k", 0, 1500), ("$1.5k - $4k", 1500, 4000), ("$4k - $8k", 4000, 8000), ("$8k+", 8000, 1e9)],
        "total_withdrawals": [("$0 - $1.5k", 0, 1500), ("$1.5k - $3.5k", 1500, 3500), ("$3.5k - $6k", 3500, 6000), ("$6k+", 6000, 1e9)],
        "wd_ratio": [("0.0 - 0.45", 0, 0.45), ("0.45 - 0.85", 0.45, 0.85), ("0.85 - 1.25", 0.85, 1.25), ("1.25+", 1.25, 1e9)],
        "has_zero_deposits": [("Has Deposits (0)", 0, 0.5), ("Zero Deposits (1)", 0.5, 2.0)],
        "tx_count": [("0 - 3 tx", 0, 4), ("4 - 8 tx", 4, 9), ("9 - 14 tx", 9, 15), ("15+ tx", 15, 1e9)],
        "repayment_count": [("0 repayments", 0, 1), ("1 - 2", 1, 3), ("3 - 4", 3, 5), ("5+", 5, 1e9)],
        "repayment_rate": [("0.00 - 0.15", 0, 0.15), ("0.15 - 0.35", 0.15, 0.35), ("0.35 - 0.65", 0.35, 0.65), ("0.65+", 0.65, 1e9)],
        "avg_tx_amount": [("$0 - $250", 0, 250), ("$250 - $500", 250, 500), ("$500 - $900", 500, 900), ("$900+", 900, 1e9)],
        "account_tenure_days": [("0 - 15 days", 0, 15), ("15 - 45 days", 15, 45), ("45 - 90 days", 45, 90), ("90+ days", 90, 1e9)],
        "days_since_last_event": [("0 - 3 days", 0, 3), ("3 - 7 days", 3, 7), ("7 - 14 days", 7, 14), ("14+ days", 14, 1e9)],
    }
    n = max(1, len(X_train))
    result: dict[str, list[dict[str, Any]]] = {}
    for col_idx, col_name in enumerate(FEATURE_COLUMNS):
        col_vals = X_train[:, col_idx]
        col_bins = []
        for label, lo, hi in specs[col_name]:
            count = int(((col_vals >= lo) & (col_vals < hi)).sum())
            col_bins.append(
                {
                    "label": label,
                    "min": lo,
                    "max": hi,
                    "expected_share": round(max(0.01, count / n), 4),
                }
            )
        result[col_name] = col_bins
    return result


def main() -> None:
    X, y, dates = generate_pit_dataset(4000, seed=42)
    dates_arr = np.array(dates)

    train_mask = dates_arr <= "2026-09-01T00:00:00Z"
    cal_mask = (dates_arr > "2026-09-01T00:00:00Z") & (dates_arr <= "2026-09-20T00:00:00Z")
    oot_mask = dates_arr > "2026-09-20T00:00:00Z"

    X_train, y_train = X[train_mask], y[train_mask]
    X_cal, y_cal = X[cal_mask], y[cal_mask]
    X_oot, y_oot = X[oot_mask], y[oot_mask]

    clf = lgb.LGBMClassifier(
        objective="binary",
        n_estimators=40,
        max_depth=3,
        num_leaves=8,
        learning_rate=0.1,
        reg_lambda=4.0,
        min_child_samples=25,
        subsample_for_bin=2000,
        random_state=42,
        verbosity=-1,
    )
    clf.fit(X_train, y_train, feature_name=FEATURE_COLUMNS)
    booster = clf.booster_

    # Platt scaling on OOT calibration fold
    cal_raw_margin = booster.predict(X_cal, raw_score=True).reshape(-1, 1)
    platt = LogisticRegression(C=1e6, solver="lbfgs")
    platt.fit(cal_raw_margin, y_cal)
    platt_a = float(platt.coef_[0][0])
    platt_b = float(platt.intercept_[0])

    # Evaluate on strict OOT holdout fold
    oot_raw_margin = booster.predict(X_oot, raw_score=True)
    oot_probs = np.array([sigmoid(platt_a * m + platt_b) for m in oot_raw_margin], dtype=np.float64)

    roc_auc = round(float(roc_auc_score(y_oot, oot_probs)), 4)
    pr_auc = round(float(average_precision_score(y_oot, oot_probs)), 4)
    ks = round(compute_ks(y_oot, oot_probs), 4)
    brier = round(float(brier_score_loss(y_oot, oot_probs)), 4)
    ece, cal_bins = compute_ece_and_bins(y_oot, oot_probs)

    PY_ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    SERVER_ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)

    # 1. Save native LightGBM Booster text file
    lgb_txt_path = PY_ARTIFACTS_DIR / "lightgbm_model.txt"
    booster.save_model(str(lgb_txt_path))

    # 2. Export booster.dump_model() JSON for SHA-256 verified Node/FastAPI parity
    dumped = booster.dump_model()
    dumped["version"] = "lightgbm-4.0-platt"
    dumped["feature_names"] = FEATURE_COLUMNS
    dumped["base_score_logit"] = 0.0
    dumped["platt_a"] = round(platt_a, 4)
    dumped["platt_b"] = round(platt_b, 4)

    model_json_path = SERVER_ARTIFACTS_DIR / "gbdt_model.json"
    model_raw = json.dumps(dumped, indent=2)
    model_json_path.write_text(model_raw, encoding="utf-8")
    artifact_sha256 = hashlib.sha256(model_raw.encode("utf-8")).hexdigest()

    # 3. Write signed feature_contract.json
    contract = {
        "contract_version": "2026.11.04",
        "model_version": "lightgbm-4.0-platt",
        "model_format": "gbdt_tree_json",
        "tree_count": len(dumped["tree_info"]),
        "max_depth": 3,
        "artifact_sha256": artifact_sha256,
        "created_at_utc": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "feature_columns": FEATURE_COLUMNS,
        "thresholds": {
            "approve_max_prob": 0.35,
            "manual_review_max_prob": 0.65,
        },
        "validation_metrics": {
            "split_strategy": "Out-of-Time (Train <= 2026-09-01, Cal <= 2026-09-20, OOT Holdout > 2026-09-20)",
            "oot_roc_auc": roc_auc,
            "pr_auc": pr_auc,
            "ks_statistic": ks,
            "brier_score": brier,
            "expected_calibration_error": ece,
            "training_samples": int(len(X_train)),
            "oot_samples": int(len(X_oot)),
        },
        "calibration_bins": cal_bins,
        "baseline_distributions": build_baseline_distributions(X_train),
    }

    contract_path = SERVER_ARTIFACTS_DIR / "feature_contract.json"
    contract_path.write_text(json.dumps(contract, indent=2), encoding="utf-8")

    print(
        f"LightGBM training complete: trees={len(dumped['tree_info'])}, "
        f"OOT ROC-AUC={roc_auc}, PR-AUC={pr_auc}, KS={ks}, Brier={brier}, ECE={ece}"
    )
    print(f"Native LightGBM Booster saved to {lgb_txt_path}")
    print(f"Exported LightGBM tree JSON to {model_json_path} (SHA-256: {artifact_sha256[:12]}...)")


if __name__ == "__main__":
    main()
