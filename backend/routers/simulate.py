"""Policy counterfactual simulator — the headline interactive of the project.

Given a hypothetical RBI repo-rate change (in basis points), perturb the
relevant input features (Repo Rate itself, its lags, and the derived
wacmr-minus-repo / msf-minus-repo / cp-minus-repo spreads), re-run the
trained XGBoost model over the last 12 observed weeks, and return the
average predicted WACMR with a 90% confidence interval derived from the
walk-forward residual distribution.

The averaging smooths XGBoost's tree-quantisation noise so the policy
response curve is monotonic enough to interpret.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..agent.tools import _tool_run_counterfactual, ToolError
from ..database import get_dataframe
from ..config import SAVED_MODEL_DIR
from ..column_registry import COLUMN_REGISTRY

router = APIRouter(prefix="/api/simulate", tags=["simulate"])


class CounterfactualRequest(BaseModel):
    repo_rate_delta_bps: float = Field(..., ge=-200.0, le=200.0)
    base_week: str | None = None


class SweepRequest(BaseModel):
    min_bps: float = Field(-200.0, ge=-200.0, le=200.0)
    max_bps: float = Field(200.0, ge=-200.0, le=200.0)
    step_bps: float = Field(25.0, gt=0, le=100.0)
    base_week: str | None = None


@router.post("/counterfactual")
def counterfactual(req: CounterfactualRequest) -> dict[str, Any]:
    """Single-point counterfactual for a given delta."""
    try:
        result = _tool_run_counterfactual(
            repo_rate_delta_bps=req.repo_rate_delta_bps,
            base_week=req.base_week,
        )
    except ToolError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return result


@router.post("/sweep")
def sweep(req: SweepRequest) -> dict[str, Any]:
    """Sweep deltas across a range to render a policy-response curve."""
    if req.max_bps <= req.min_bps:
        raise HTTPException(status_code=400, detail="max_bps must exceed min_bps")

    points = []
    delta = req.min_bps
    while delta <= req.max_bps + 1e-6:
        try:
            r = _tool_run_counterfactual(repo_rate_delta_bps=float(delta), base_week=req.base_week)
        except ToolError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e
        points.append({
            "bps": round(float(delta), 2),
            "predicted": r["counterfactual_prediction"],
            "delta_pp": r["delta_pp"],
            "ci_lo": (r["confidence_interval_90"] or [None, None])[0],
            "ci_hi": (r["confidence_interval_90"] or [None, None])[1],
        })
        delta += req.step_bps

    base_pred = points[0]["predicted"] - points[0]["delta_pp"] if points else None
    return {
        "base_week": points[0].get("base_week") if points else None,
        "base_prediction": round(base_pred, 4) if base_pred is not None else None,
        "points": points,
    }


@router.get("/attribution")
def attribution(repo_rate_delta_bps: float, base_week: str | None = None) -> dict[str, Any]:
    """Return per-feature SHAP attribution for the counterfactual vs baseline.

    We take the latest observed week (or base_week), build the baseline vector,
    build the perturbed vector (repo + lags + spreads), compute SHAP for each,
    and return the difference — that's what drove the change.
    """
    try:
        import xgboost as xgb
        import shap
    except ImportError as e:
        raise HTTPException(status_code=500, detail=f"ml packages missing: {e}") from e

    features_path = SAVED_MODEL_DIR / "feature_names.json"
    model_path = SAVED_MODEL_DIR / "xgb_model.json"
    if not features_path.exists() or not model_path.exists():
        raise HTTPException(status_code=500, detail="Model artifacts missing. Run train_and_save.py first.")

    with open(features_path) as f:
        feature_names: list[str] = json.load(f)

    df = get_dataframe()
    dates = pd.to_datetime(df["week_date"]).dt.strftime("%Y-%m-%d").tolist()
    if base_week is None:
        idx = len(df) - 1
    else:
        try:
            target = pd.to_datetime(base_week).strftime("%Y-%m-%d")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid base_week: {e}") from e
        idx = dates.index(target) if target in dates else int(
            (pd.to_datetime(dates) - pd.to_datetime(target)).abs().argmin()
        )

    X_base = df[feature_names].iloc[[idx]].copy().fillna(df[feature_names].median())
    X_cf = X_base.copy()

    delta = repo_rate_delta_bps / 100.0
    for col in ("rates_I7496_17", "repo_lag1", "repo_lag2", "repo_lag4"):
        if col in X_cf.columns:
            X_cf[col] = X_cf[col] + delta
    for col in ("spread_wacmr_minus_repo", "spread_msf_minus_repo", "spread_cp_minus_repo"):
        if col in X_cf.columns:
            X_cf[col] = X_cf[col] - delta

    booster = xgb.XGBRegressor()
    booster.load_model(str(model_path))
    explainer = shap.TreeExplainer(booster)
    shap_base = explainer.shap_values(X_base.values.astype(np.float32))[0]
    shap_cf = explainer.shap_values(X_cf.values.astype(np.float32))[0]
    shap_delta = shap_cf - shap_base

    ranked = sorted(
        [
            (abs(float(v)), float(v), feature_names[i])
            for i, v in enumerate(shap_delta)
            if abs(float(v)) > 1e-6
        ],
        reverse=True,
    )[:10]

    attributions = []
    for _, signed, feat in ranked:
        attributions.append({
            "feature": feat,
            "label": COLUMN_REGISTRY.get(feat, {}).get("label", feat),
            "shap_delta": round(signed, 5),
        })

    return {
        "base_week": dates[idx],
        "repo_rate_delta_bps": repo_rate_delta_bps,
        "attributions": attributions,
    }
