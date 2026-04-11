"""News & NLP endpoints — events, sentiment, topics."""
from fastapi import APIRouter
import pandas as pd
import json
from pathlib import Path

from ..config import EVENTS_JSON, NLP_CSV_PATH
from ..column_registry import get_label

router = APIRouter(prefix="/api/news", tags=["news"])


def _load_events() -> list[dict]:
    if EVENTS_JSON.exists():
        with open(EVENTS_JSON) as f:
            return json.load(f)
    return []


def _load_nlp_data() -> pd.DataFrame | None:
    if NLP_CSV_PATH.exists():
        df = pd.read_csv(NLP_CSV_PATH, parse_dates=["week_date"])
        return df.sort_values("week_date").reset_index(drop=True)
    return None


@router.get("/events")
def get_events(category: str | None = None, impact: str | None = None):
    """Curated event timeline."""
    events = _load_events()
    if category:
        events = [e for e in events if e.get("category") == category]
    if impact:
        events = [e for e in events if e.get("impact") == impact]
    return {
        "events": events,
        "total": len(events),
        "categories": list(set(e.get("category", "") for e in _load_events())),
    }


@router.get("/sentiment")
def sentiment_timeseries():
    """Weekly sentiment time series."""
    df = _load_nlp_data()
    if df is None:
        return {"error": "NLP data not found. Run stage6_news_nlp.py first."}

    cols = ["news_sentiment", "event_density_4w", "event_density_8w",
            "hawkish_score", "dovish_score", "crisis_score"]
    available = [c for c in cols if c in df.columns]

    result = {"dates": df["week_date"].dt.strftime("%Y-%m-%d").tolist()}
    for c in available:
        result[c] = [None if pd.isna(v) else round(v, 4) for v in df[c]]

    # Also include WACMR and repo rate for overlay
    for c in ["target_wacmr", "rates_I7496_17"]:
        if c in df.columns:
            result[c] = [None if pd.isna(v) else round(v, 4) for v in df[c]]

    return {
        "series": result,
        "columns": [{"name": c, "label": get_label(c) if c in ["target_wacmr", "rates_I7496_17"] else c.replace("_", " ").title()} for c in available],
    }


@router.get("/event-periods")
def event_periods():
    """Event period classifications for each week."""
    df = _load_nlp_data()
    if df is None:
        return {"error": "NLP data not found."}

    if "event_period" not in df.columns:
        return {"error": "event_period column not found."}

    return {
        "dates": df["week_date"].dt.strftime("%Y-%m-%d").tolist(),
        "periods": df["event_period"].tolist(),
        "unique_periods": df["event_period"].unique().tolist(),
    }


@router.get("/correlations")
def news_correlations():
    """Correlations between news sentiment and financial indicators."""
    df = _load_nlp_data()
    if df is None:
        return {"error": "NLP data not found."}

    sentiment_cols = ["news_sentiment", "hawkish_score", "dovish_score", "crisis_score"]
    financial_cols = ["target_wacmr", "rates_I7496_17", "spread_wacmr_minus_repo"]

    available_s = [c for c in sentiment_cols if c in df.columns]
    available_f = [c for c in financial_cols if c in df.columns]

    corrs = {}
    for sc in available_s:
        corrs[sc] = {}
        for fc in available_f:
            valid = df[[sc, fc]].dropna()
            if len(valid) > 10:
                corrs[sc][fc] = round(valid[sc].corr(valid[fc]), 4)

    return {"correlations": corrs}
