"""Data endpoints — table queries, column metadata, time series."""
from fastapi import APIRouter, Query
from typing import Optional
import pandas as pd
import numpy as np

from ..database import get_dataframe, execute_query
from ..column_registry import get_columns_metadata, get_categories, get_label

router = APIRouter(prefix="/api/data", tags=["data"])


@router.get("/columns")
def columns_metadata():
    """Return metadata for all columns with human-readable labels."""
    return {
        "columns": get_columns_metadata(),
        "categories": get_categories(),
    }


@router.get("/table")
def table_data(
    columns: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    regime: Optional[int] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    sort_by: Optional[str] = None,
    sort_dir: str = Query("asc", pattern="^(asc|desc)$"),
):
    """Paginated table data with optional filters."""
    df = get_dataframe()

    if start_date:
        df = df[df["week_date"] >= pd.to_datetime(start_date)]
    if end_date:
        df = df[df["week_date"] <= pd.to_datetime(end_date)]
    if regime is not None and "regime_label" in df.columns:
        df = df[df["regime_label"] == regime]

    if columns:
        col_list = [c.strip() for c in columns.split(",")]
        col_list = ["week_date"] + [c for c in col_list if c != "week_date" and c in df.columns]
        df = df[col_list]

    if sort_by and sort_by in df.columns:
        df = df.sort_values(sort_by, ascending=(sort_dir == "asc"))

    total = len(df)
    start = (page - 1) * page_size
    end = start + page_size
    page_df = df.iloc[start:end].copy()
    page_df["week_date"] = page_df["week_date"].dt.strftime("%Y-%m-%d")

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
        "columns": [{"name": c, "label": get_label(c)} for c in page_df.columns],
        "data": page_df.replace({np.nan: None}).to_dict(orient="records"),
    }


@router.get("/timeseries")
def timeseries(
    columns: str = Query(..., description="Comma-separated column names"),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
):
    """Time-indexed JSON for charting."""
    df = get_dataframe()
    col_list = [c.strip() for c in columns.split(",")]
    col_list = [c for c in col_list if c in df.columns]

    if start_date:
        df = df[df["week_date"] >= pd.to_datetime(start_date)]
    if end_date:
        df = df[df["week_date"] <= pd.to_datetime(end_date)]

    result = {"dates": df["week_date"].dt.strftime("%Y-%m-%d").tolist()}
    for col in col_list:
        vals = df[col].tolist()
        result[col] = [None if pd.isna(v) else v for v in vals]

    return {
        "series": result,
        "columns": [{"name": c, "label": get_label(c)} for c in col_list],
    }


@router.get("/statistics")
def statistics(
    columns: Optional[str] = None,
    group_by_regime: bool = False,
):
    """Descriptive statistics for selected columns."""
    df = get_dataframe()
    num_cols = [c for c in df.columns if pd.api.types.is_numeric_dtype(df[c])]

    if columns:
        col_list = [c.strip() for c in columns.split(",")]
        num_cols = [c for c in col_list if c in num_cols]

    if group_by_regime and "regime_label" in df.columns:
        stats = {}
        for regime in sorted(df["regime_label"].unique()):
            sub = df[df["regime_label"] == regime][num_cols]
            stats[f"regime_{int(regime)}"] = sub.describe().round(4).to_dict()
        return {"grouped": True, "statistics": stats}

    stats = df[num_cols].describe().round(4).to_dict()
    return {"grouped": False, "statistics": stats}


@router.post("/correlation")
def correlation(columns: list[str]):
    """Correlation matrix for given columns."""
    df = get_dataframe()
    valid = [c for c in columns if c in df.columns and pd.api.types.is_numeric_dtype(df[c])]
    corr = df[valid].corr().round(4)
    return {
        "columns": [{"name": c, "label": get_label(c)} for c in valid],
        "matrix": corr.replace({np.nan: None}).to_dict(),
    }


@router.post("/sql")
def run_sql(query: str):
    """Execute a read-only SQL query."""
    results = execute_query(query)
    return {"results": results, "count": len(results)}
