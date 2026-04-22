"""Tool registry for the Gemini agent.

Each tool has:
  - a Gemini-compatible function declaration (name + description + params schema)
  - a Python handler that executes server-side with guardrails
  - a JSON-serialisable return value

Tools must NEVER silently swallow errors — raise TypedError so the agent loop
can surface the failure as a tool_result with error=..., letting the model
decide whether to retry or give up gracefully.
"""
from __future__ import annotations

import copy
import functools
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable

import numpy as np
import pandas as pd

from ..column_registry import COLUMN_REGISTRY
from ..database import execute_query, get_dataframe
from .schema_context import search_columns, SYNONYMS

SAVED_MODEL_DIR = Path(__file__).resolve().parent.parent / "ml" / "saved_model"

# Module-level singletons. These are immutable artifacts shipped with the
# repo, so loading them once at first use and reusing the in-memory copy
# turns counterfactual calls from ~26s (per-call xgboost JSON parse) into
# ~50ms (model.predict on 12 rows).
_BOOSTER = None
_FEATURE_NAMES: list[str] | None = None
_RESIDUALS: np.ndarray | None = None


def _get_booster():
    global _BOOSTER
    if _BOOSTER is None:
        import xgboost as xgb
        b = xgb.XGBRegressor()
        b.load_model(str(SAVED_MODEL_DIR / "xgb_model.json"))
        _BOOSTER = b
    return _BOOSTER


def _get_feature_names() -> list[str]:
    global _FEATURE_NAMES
    if _FEATURE_NAMES is None:
        with open(SAVED_MODEL_DIR / "feature_names.json") as f:
            _FEATURE_NAMES = json.load(f)
    return _FEATURE_NAMES


def _get_residuals() -> np.ndarray | None:
    global _RESIDUALS
    if _RESIDUALS is None:
        wf_path = SAVED_MODEL_DIR / "walkforward_results.csv"
        if not wf_path.exists():
            return None
        wf = pd.read_csv(wf_path)
        _RESIDUALS = (wf["actual"] - wf["predicted"]).to_numpy()
    return _RESIDUALS


class ToolError(Exception):
    """Raised when a tool call fails with a user-surfaceable reason."""


@dataclass
class Tool:
    name: str
    description: str
    parameters: dict[str, Any]           # JSON-schema for Gemini
    handler: Callable[..., Any]          # executes the tool

    def as_declaration(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "description": self.description,
            "parameters": self.parameters,
        }


# ─────────────────────────────────────────────────────────────────────────────
# Tool: run_sql
# ─────────────────────────────────────────────────────────────────────────────

_SELECT_RE = re.compile(r"^\s*SELECT\b", re.IGNORECASE)
_FORBIDDEN_RE = re.compile(r"\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|REPLACE|ATTACH|DETACH|PRAGMA)\b", re.IGNORECASE)


def _tool_run_sql(query: str) -> dict[str, Any]:
    if not _SELECT_RE.match(query):
        raise ToolError("Only SELECT queries are allowed.")
    if _FORBIDDEN_RE.search(query):
        raise ToolError("Query contains a forbidden keyword. Only read-only SELECT is allowed.")
    try:
        rows = execute_query(query)
    except Exception as e:
        raise ToolError(f"SQL error: {e}") from e
    truncated = len(rows) > 500
    return {
        "rows": rows[:500],
        "row_count": len(rows),
        "truncated": truncated,
        "query": query,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Tool: describe_schema
# ─────────────────────────────────────────────────────────────────────────────

def _tool_describe_schema(category: str | None = None) -> dict[str, Any]:
    out: list[dict[str, Any]] = []
    for col, meta in COLUMN_REGISTRY.items():
        if category and meta.get("category") != category:
            continue
        out.append({
            "column": col,
            "label": meta.get("label", col),
            "full_name": meta.get("full_name", ""),
            "category": meta.get("category", ""),
            "unit": meta.get("unit", ""),
        })
    return {"columns": out, "count": len(out)}


# ─────────────────────────────────────────────────────────────────────────────
# Tool: semantic_column_search
# ─────────────────────────────────────────────────────────────────────────────

def _tool_semantic_column_search(term: str, limit: int = 5) -> dict[str, Any]:
    matches = search_columns(term, limit=max(1, min(limit, 20)))
    return {"query": term, "matches": matches, "synonyms_available": sorted(SYNONYMS.keys())[:20]}


# ─────────────────────────────────────────────────────────────────────────────
# Tool: compare_regimes
# ─────────────────────────────────────────────────────────────────────────────

def _tool_compare_regimes(column: str) -> dict[str, Any]:
    if column not in COLUMN_REGISTRY:
        raise ToolError(f"Unknown column '{column}'. Call describe_schema or semantic_column_search first.")
    rows = execute_query(
        f"SELECT regime_label, "
        f"ROUND(AVG({column}), 4) AS mean, "
        f"ROUND(MIN({column}), 4) AS min, "
        f"ROUND(MAX({column}), 4) AS max, "
        f"COUNT(*) AS n "
        f"FROM Weekly_Macro_Master GROUP BY regime_label ORDER BY regime_label"
    )
    label = COLUMN_REGISTRY[column].get("label", column)
    unit = COLUMN_REGISTRY[column].get("unit", "")
    return {
        "column": column,
        "label": label,
        "unit": unit,
        "by_regime": rows,
        "interpretation_hint": (
            "Regime 1 = Normal/Tightening (pre-COVID, Feb 2014 → Mar 2020, 315 weeks, mean WACMR ~6.5%). "
            "Regime 0 = Accommodation (post-COVID, Mar 2020 → Jul 2024, 230 weeks, mean WACMR ~4.8%). "
            "The single regime change is at 2020-03-06."
        ),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Tool: get_shap_contributions
# ─────────────────────────────────────────────────────────────────────────────

def _load_shap_artifacts() -> dict[str, Any]:
    features_path = SAVED_MODEL_DIR / "feature_names.json"
    shap_path = SAVED_MODEL_DIR / "shap_values.npy"
    wf_path = SAVED_MODEL_DIR / "walkforward_results.csv"
    if not features_path.exists() or not shap_path.exists():
        raise ToolError(
            "SHAP artifacts are missing. Run `python -m backend.ml.train_and_save` first."
        )
    with open(features_path) as f:
        features = json.load(f)
    shap_values = np.load(shap_path)
    df = get_dataframe()
    return {"features": features, "shap_values": shap_values, "df": df, "wf_path": wf_path}


def _tool_get_shap_contributions(week_date: str, top_k: int = 10) -> dict[str, Any]:
    arts = _load_shap_artifacts()
    df = arts["df"]
    features: list[str] = arts["features"]
    shap_values: np.ndarray = arts["shap_values"]

    dates = pd.to_datetime(df["week_date"]).dt.strftime("%Y-%m-%d").tolist()
    try:
        target_date = pd.to_datetime(week_date).strftime("%Y-%m-%d")
    except Exception as e:
        raise ToolError(f"Invalid date format '{week_date}'. Use YYYY-MM-DD.") from e

    if target_date not in dates:
        nearest_idx = int((pd.to_datetime(dates) - pd.to_datetime(target_date)).abs().argmin())
        target_date = dates[nearest_idx]
    idx = dates.index(target_date)

    row_shap = shap_values[idx]
    ranked = sorted(
        [(abs(float(v)), float(v), features[i]) for i, v in enumerate(row_shap)],
        reverse=True,
    )[: max(1, min(top_k, 30))]

    contributions = []
    for _, signed, feat in ranked:
        label = COLUMN_REGISTRY.get(feat, {}).get("label", feat)
        value = df[feat].iloc[idx] if feat in df.columns else None
        contributions.append({
            "feature": feat,
            "label": label,
            "shap_value": round(signed, 5),
            "feature_value": None if value is None or pd.isna(value) else round(float(value), 5),
        })

    return {
        "week_date": target_date,
        "contributions": contributions,
        "note": "Positive SHAP pushed the WACMR prediction up for that week, negative pushed it down.",
    }


# ─────────────────────────────────────────────────────────────────────────────
# Tool: run_counterfactual
# ─────────────────────────────────────────────────────────────────────────────

@functools.lru_cache(maxsize=1024)
def _counterfactual_cached(repo_rate_delta_bps: float, base_week: str | None) -> dict[str, Any]:
    """Pure compute. Cached because the result is a deterministic function of inputs."""
    features_path = SAVED_MODEL_DIR / "feature_names.json"
    if not features_path.exists():
        raise ToolError("feature_names.json missing — train_and_save.py has not been run.")
    feature_names = _get_feature_names()

    df = get_dataframe()
    dates = pd.to_datetime(df["week_date"]).dt.strftime("%Y-%m-%d").tolist()
    if base_week is None:
        base_idx = len(df) - 1
    else:
        try:
            target = pd.to_datetime(base_week).strftime("%Y-%m-%d")
        except Exception as e:
            raise ToolError(f"Invalid base_week '{base_week}'.") from e
        if target not in dates:
            base_idx = int((pd.to_datetime(dates) - pd.to_datetime(target)).abs().argmin())
        else:
            base_idx = dates.index(target)
    base_date = dates[base_idx]

    # Average over a 12-week window ending at base_idx to smooth out XGBoost tree
    # quantisation (tree ensembles give step-function responses to small perturbations;
    # averaging across recent weeks produces a more meaningful policy-response curve).
    window = 12
    start_idx = max(0, base_idx - window + 1)
    window_slice = df[feature_names].iloc[start_idx : base_idx + 1].copy()
    window_slice = window_slice.fillna(df[feature_names].median())
    X_base = window_slice.copy()
    X_cf = window_slice.copy()

    delta = repo_rate_delta_bps / 100.0  # bps → %
    for col in ("rates_I7496_17", "repo_lag1", "repo_lag2", "repo_lag4"):
        if col in X_cf.columns:
            X_cf[col] = X_cf[col] + delta

    if "spread_wacmr_minus_repo" in X_cf.columns and "rates_I7496_17" in X_cf.columns:
        X_cf["spread_wacmr_minus_repo"] = X_cf["spread_wacmr_minus_repo"] - delta
    if "spread_msf_minus_repo" in X_cf.columns:
        X_cf["spread_msf_minus_repo"] = X_cf["spread_msf_minus_repo"] - delta
    if "spread_cp_minus_repo" in X_cf.columns:
        X_cf["spread_cp_minus_repo"] = X_cf["spread_cp_minus_repo"] - delta

    try:
        model = _get_booster()
    except ImportError as e:
        raise ToolError("xgboost is not installed in the backend env.") from e

    base_preds = model.predict(X_base.values.astype(np.float32))
    cf_preds = model.predict(X_cf.values.astype(np.float32))
    base_pred = float(np.mean(base_preds))
    cf_pred = float(np.mean(cf_preds))

    residuals = _get_residuals()
    ci_lo: float | None = None
    ci_hi: float | None = None
    if residuals is not None:
        ci_lo = float(cf_pred + np.quantile(residuals, 0.05))
        ci_hi = float(cf_pred + np.quantile(residuals, 0.95))

    return {
        "base_week": base_date,
        "repo_rate_delta_bps": repo_rate_delta_bps,
        "base_prediction": round(base_pred, 4),
        "counterfactual_prediction": round(cf_pred, 4),
        "delta_pp": round(cf_pred - base_pred, 4),
        "confidence_interval_90": (
            None if ci_lo is None else [round(ci_lo, 4), round(ci_hi, 4)]
        ),
        "interpretation_hint": (
            "The counterfactual perturbs the Repo Rate and its direct lags/spreads, then re-runs the "
            "trained XGBoost model. The CI reflects walk-forward residual spread, not causal uncertainty."
        ),
    }


def _tool_run_counterfactual(repo_rate_delta_bps: float, base_week: str | None = None) -> dict[str, Any]:
    if not -200.0 <= repo_rate_delta_bps <= 200.0:
        raise ToolError("repo_rate_delta_bps must be in [-200, 200].")
    # Defensive deepcopy: lru_cache returns the same dict object every time, and
    # downstream callers (sweep loop, response serialisation) shouldn't be able
    # to mutate the cached entry.
    return copy.deepcopy(_counterfactual_cached(float(repo_rate_delta_bps), base_week))


# ─────────────────────────────────────────────────────────────────────────────
# Tool: plot_chart
# ─────────────────────────────────────────────────────────────────────────────

_ALLOWED_CHART_TYPES = {"line", "bar", "scatter", "heatmap", "area"}


def _tool_plot_chart(
    chart_type: str,
    title: str,
    x: list[Any],
    y: dict[str, list[float]] | list[float],
    x_label: str = "",
    y_label: str = "",
) -> dict[str, Any]:
    if chart_type not in _ALLOWED_CHART_TYPES:
        raise ToolError(f"chart_type must be one of {sorted(_ALLOWED_CHART_TYPES)}")
    return {
        "chart_type": chart_type,
        "title": title,
        "x": x,
        "y": y,
        "labels": {"x": x_label, "y": y_label},
    }


# ─────────────────────────────────────────────────────────────────────────────
# Registry
# ─────────────────────────────────────────────────────────────────────────────

TOOLS: dict[str, Tool] = {
    "run_sql": Tool(
        name="run_sql",
        description=(
            "Execute a read-only SELECT against the `Weekly_Macro_Master` table. "
            "Returns up to 500 rows. Use this for any factual numeric question."
        ),
        parameters={
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "A SELECT statement against Weekly_Macro_Master.",
                }
            },
            "required": ["query"],
        },
        handler=_tool_run_sql,
    ),
    "describe_schema": Tool(
        name="describe_schema",
        description=(
            "Return the list of columns with human-readable labels, categories and units. "
            "Optionally filter by category (rates, balance_sheet, aggregates, commercial_paper, "
            "treasury_bills, market_repo, government_securities, prices, equity, forex, engineered, regime)."
        ),
        parameters={
            "type": "object",
            "properties": {
                "category": {
                    "type": "string",
                    "description": "Optional category filter.",
                }
            },
        },
        handler=_tool_describe_schema,
    ),
    "semantic_column_search": Tool(
        name="semantic_column_search",
        description=(
            "Find columns matching a human term like 'inflation', 'liquidity', 'policy rate'. "
            "Returns ranked matches. Call this before writing SQL if you don't already know the exact column name."
        ),
        parameters={
            "type": "object",
            "properties": {
                "term": {"type": "string", "description": "A word or phrase to search for."},
                "limit": {"type": "integer", "description": "Max matches to return (default 5)."},
            },
            "required": ["term"],
        },
        handler=_tool_semantic_column_search,
    ),
    "compare_regimes": Tool(
        name="compare_regimes",
        description=(
            "Return mean / min / max / count for a given column, split by regime_label. "
            "Regime 0 = pre-COVID normal, Regime 1 = post-COVID accommodation."
        ),
        parameters={
            "type": "object",
            "properties": {
                "column": {"type": "string", "description": "Column name to compare."},
            },
            "required": ["column"],
        },
        handler=_tool_compare_regimes,
    ),
    "get_shap_contributions": Tool(
        name="get_shap_contributions",
        description=(
            "Return the top-k SHAP contributions for a specific week. Use this to explain why the "
            "model predicted what it did for a given date."
        ),
        parameters={
            "type": "object",
            "properties": {
                "week_date": {"type": "string", "description": "Target week as YYYY-MM-DD."},
                "top_k": {"type": "integer", "description": "How many features to return (default 10)."},
            },
            "required": ["week_date"],
        },
        handler=_tool_get_shap_contributions,
    ),
    "run_counterfactual": Tool(
        name="run_counterfactual",
        description=(
            "Simulate a repo-rate change (in basis points, range [-200, 200]) and return the model's "
            "counterfactual WACMR forecast vs the base prediction, with a 90% confidence interval "
            "derived from walk-forward residuals. Use this for policy 'what-if' questions."
        ),
        parameters={
            "type": "object",
            "properties": {
                "repo_rate_delta_bps": {
                    "type": "number",
                    "description": "Change to the Repo Rate in basis points. Negative = cut, positive = hike.",
                },
                "base_week": {
                    "type": "string",
                    "description": "Optional anchor week (YYYY-MM-DD). Defaults to the latest available week.",
                },
            },
            "required": ["repo_rate_delta_bps"],
        },
        handler=_tool_run_counterfactual,
    ),
    "plot_chart": Tool(
        name="plot_chart",
        description=(
            "Render an inline chart in the user's reply. Provide chart_type (line|bar|scatter|heatmap|area), "
            "a title, the x-axis values, and y-axis values either as a flat list or as a dict of "
            "{series_name: [values]} for multi-series charts."
        ),
        parameters={
            "type": "object",
            "properties": {
                "chart_type": {"type": "string"},
                "title": {"type": "string"},
                "x": {"type": "array", "items": {"type": "string"}},
                "y": {"type": "object", "description": "Dict of series_name -> list of numbers."},
                "x_label": {"type": "string"},
                "y_label": {"type": "string"},
            },
            "required": ["chart_type", "title", "x", "y"],
        },
        handler=_tool_plot_chart,
    ),
}


def as_gemini_tool_declarations() -> list[dict[str, Any]]:
    """Return the tool declarations in the shape Gemini expects."""
    return [t.as_declaration() for t in TOOLS.values()]


def invoke(name: str, args: dict[str, Any]) -> dict[str, Any]:
    """Invoke a tool by name. Raises ToolError on failure (never silently swallowed)."""
    if name not in TOOLS:
        raise ToolError(f"Unknown tool '{name}'. Available: {sorted(TOOLS.keys())}")
    tool = TOOLS[name]
    try:
        return tool.handler(**(args or {}))
    except ToolError:
        raise
    except TypeError as e:
        raise ToolError(f"Bad arguments for {name}: {e}") from e
    except Exception as e:  # noqa: BLE001 — deliberately surface, not swallow
        raise ToolError(f"{name} failed: {e}") from e
