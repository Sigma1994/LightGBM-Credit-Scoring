"""
AegisCredit — Python LightGBM + FastAPI Inference Microservice
==============================================================
Runs real `lightgbm.Booster` inference with exact TreeSHAP (`pred_contrib=True`)
and Platt probability calibration. Connect to the Node/React BFF by setting:
  SCORING_API_URL=http://localhost:8000
"""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path
from typing import Any

import lightgbm as lgb
import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

BASE_DIR = Path(__file__).resolve().parent.parent
PY_MODEL_PATH = Path(__file__).resolve().parent / "artifacts" / "lightgbm_model.txt"
JSON_MODEL_PATH = BASE_DIR / "server" / "artifacts" / "gbdt_model.json"
CONTRACT_PATH = BASE_DIR / "server" / "artifacts" / "feature_contract.json"

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


def sigmoid(x: float) -> float:
    if x > 35:
        return 1.0 - 1e-15
    if x < -35:
        return 1e-15
    return 1.0 / (1.0 + math.exp(-x))


def format_condition(feat_name: str, op: str, threshold: float) -> str:
    if ("deposit" in feat_name or "withdrawal" in feat_name or "avg_tx" in feat_name) and feat_name != "has_zero_deposits":
        val_str = f"${round(threshold):,}"
    elif feat_name == "has_zero_deposits":
        val_str = str(threshold)
    else:
        val_str = f"{threshold:.2f}"
    return f"{feat_name} {op} {val_str}"


def load_artifacts() -> tuple[lgb.Booster, dict[str, Any], dict[str, Any]]:
    if not CONTRACT_PATH.exists() or not JSON_MODEL_PATH.exists():
        raise RuntimeError("Missing feature_contract.json or gbdt_model.json; run python/train_lightgbm.py first.")

    contract = json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))
    model_raw = JSON_MODEL_PATH.read_text(encoding="utf-8")
    actual_sha = hashlib.sha256(model_raw.encode("utf-8")).hexdigest()
    if actual_sha != contract.get("artifact_sha256"):
        raise RuntimeError("gbdt_model.json SHA-256 verification failed against feature_contract.json.")

    model_json = json.loads(model_raw)
    if PY_MODEL_PATH.exists():
        booster = lgb.Booster(model_file=str(PY_MODEL_PATH))
    else:
        raise RuntimeError("Missing python/artifacts/lightgbm_model.txt; run python/train_lightgbm.py first.")

    return booster, model_json, contract


booster, model_json, contract = load_artifacts()
feature_columns: list[str] = contract["feature_columns"]
platt_a = float(model_json.get("platt_a", 1.0))
platt_b = float(model_json.get("platt_b", 0.0))

app = FastAPI(title="AegisCredit Python LightGBM Service", version=str(contract.get("model_version", "lightgbm-4.0-platt")))


class ScorePayload(BaseModel):
    features: dict[str, float] = Field(..., description="Point-in-Time 10-feature vector")


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "READY",
        "engine": "python_lightgbm",
        "lightgbm_version": lgb.__version__,
        "model_version": contract["model_version"],
        "contract_version": contract["contract_version"],
        "tree_count": booster.num_trees(),
    }


@app.post("/score")
def score(payload: ScorePayload) -> dict[str, Any]:
    missing = [col for col in feature_columns if col not in payload.features]
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing required features: {missing}")

    vec = [float(payload.features[col]) for col in feature_columns]
    x_mat = np.array([vec], dtype=np.float64)

    raw_margin = float(booster.predict(x_mat, raw_score=True)[0])
    raw_score = round(sigmoid(raw_margin), 4)
    calibrated_prob = round(min(0.995, max(0.005, sigmoid(platt_a * raw_margin + platt_b))), 4)

    # Exact TreeSHAP attributions via LightGBM pred_contrib=True
    contribs = booster.predict(x_mat, pred_contrib=True)[0]
    attributions = []
    for idx, col in enumerate(feature_columns):
        c = round(float(contribs[idx]), 4)
        direction = "NEUTRAL" if abs(c) < 0.015 else ("INCREASES_RISK" if c > 0 else "REDUCES_RISK")
        attributions.append(
            {
                "feature": col,
                "label": FEATURE_LABELS.get(col, col),
                "value": vec[idx],
                "contribution_log_odds": c,
                "direction": direction,
            }
        )
    attributions.sort(key=lambda item: abs(item["contribution_log_odds"]), reverse=True)

    # Extract fired LightGBM decision tree paths from dumped tree_info
    rule_hits = []
    for tree in model_json.get("tree_info", []):
        node = tree["tree_structure"]
        conditions: list[str] = []
        while "split_feature" in node:
            feat_idx = int(node["split_feature"])
            feat_name = feature_columns[feat_idx]
            threshold = float(node["threshold"])
            if vec[feat_idx] <= threshold:
                conditions.append(format_condition(feat_name, "<=", threshold))
                node = node["left_child"]
            else:
                conditions.append(format_condition(feat_name, ">", threshold))
                node = node["right_child"]
        leaf_val = round(float(node["leaf_value"]), 4)
        direction = "NEUTRAL" if abs(leaf_val) < 0.008 else ("INCREASES_RISK" if leaf_val > 0 else "REDUCES_RISK")
        rule_hits.append(
            {
                "tree_index": int(tree["tree_index"]),
                "path_summary": " & ".join(conditions),
                "leaf_value": leaf_val,
                "direction": direction,
            }
        )
    rule_hits.sort(key=lambda item: abs(item["leaf_value"]), reverse=True)

    return {
        "engine": "python_lightgbm",
        "lightgbm_version": lgb.__version__,
        "model_version": contract["model_version"],
        "raw_score": raw_score,
        "raw_margin": round(raw_margin, 4),
        "calibrated_probability": calibrated_prob,
        "attributions": attributions,
        "top_tree_rules": rule_hits[:6],
    }
