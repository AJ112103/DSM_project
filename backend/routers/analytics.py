"""Analytics endpoints — regimes, PCA, correlations."""
from fastapi import APIRouter
import pandas as pd
import numpy as np
import json
from pathlib import Path

from ..database import get_dataframe
from ..column_registry import get_label
from ..config import SAVED_MODEL_DIR

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/regimes")
def regime_summary():
    """Regime summary: count, date ranges, mean rates per regime."""
    df = get_dataframe()
    if "regime_label" not in df.columns:
        return {"error": "regime_label not found. Run stage3 first."}

    result = []
    for regime in sorted(df["regime_label"].unique()):
        sub = df[df["regime_label"] == regime]
        entry = {
            "regime": int(regime),
            "n_weeks": len(sub),
            "first_week": sub["week_date"].min().strftime("%Y-%m-%d"),
            "last_week": sub["week_date"].max().strftime("%Y-%m-%d"),
            "avg_wacmr": round(sub["target_wacmr"].mean(), 3),
            "avg_repo_rate": round(sub["rates_I7496_17"].mean(), 3) if "rates_I7496_17" in sub.columns else None,
            "avg_msf_rate": round(sub["rates_I7496_20"].mean(), 3) if "rates_I7496_20" in sub.columns else None,
            "std_wacmr": round(sub["target_wacmr"].std(), 3),
        }
        result.append(entry)

    return {"regimes": result}


@router.get("/regime-transitions")
def regime_transitions():
    """Week-by-week regime labels for timeline shading."""
    df = get_dataframe()
    if "regime_label" not in df.columns:
        return {"error": "regime_label not found."}

    return {
        "dates": df["week_date"].dt.strftime("%Y-%m-%d").tolist(),
        "regimes": df["regime_label"].astype(int).tolist(),
    }


@router.get("/pca")
def pca_coordinates():
    """PCA-transformed coordinates for scatter plot."""
    pca_path = SAVED_MODEL_DIR / "pca_coordinates.csv"
    if pca_path.exists():
        pca_df = pd.read_csv(pca_path)
        return {
            "data": pca_df.to_dict(orient="records"),
            "columns": list(pca_df.columns),
        }

    # Fallback: compute from master data
    df = get_dataframe()
    from sklearn.preprocessing import StandardScaler
    from sklearn.decomposition import PCA

    exclude = {"week_date", "target_wacmr", "target_lag1", "target_lag2", "target_lag4", "regime_label", "cluster_dist_0", "cluster_dist_1"}
    feature_cols = [c for c in df.columns if c not in exclude and pd.api.types.is_numeric_dtype(df[c])]
    X = df[feature_cols].fillna(df[feature_cols].median())

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    pca = PCA(n_components=3, random_state=42)
    X_pca = pca.fit_transform(X_scaled)

    result = pd.DataFrame({
        "week_date": df["week_date"].dt.strftime("%Y-%m-%d"),
        "pc1": X_pca[:, 0].round(4),
        "pc2": X_pca[:, 1].round(4),
        "pc3": X_pca[:, 2].round(4),
        "regime_label": df["regime_label"].astype(int) if "regime_label" in df.columns else pd.Series(0, index=df.index),
        "wacmr": df["target_wacmr"].round(3),
        "repo_rate": df.get("rates_I7496_17", pd.Series(dtype=float)).round(3),
    })

    return {
        "data": result.replace({np.nan: None}).to_dict(orient="records"),
        "explained_variance": [round(v, 4) for v in pca.explained_variance_ratio_],
    }


@router.get("/silhouette")
def silhouette_scores():
    """Silhouette scores for K=2..7."""
    sil_path = SAVED_MODEL_DIR / "silhouette_scores.json"
    if sil_path.exists():
        with open(sil_path) as f:
            return json.load(f)

    # Fallback: compute
    df = get_dataframe()
    from sklearn.preprocessing import StandardScaler
    from sklearn.decomposition import PCA
    from sklearn.cluster import KMeans
    from sklearn.metrics import silhouette_score

    exclude = {"week_date", "target_wacmr", "target_lag1", "target_lag2", "target_lag4"}
    feature_cols = [c for c in df.columns if c not in exclude and pd.api.types.is_numeric_dtype(df[c])]
    X = df[feature_cols].fillna(df[feature_cols].median())
    X_scaled = StandardScaler().fit_transform(X)

    pca = PCA(random_state=42)
    pca.fit(X_scaled)
    cumvar = np.cumsum(pca.explained_variance_ratio_)
    n_comp = int(np.argmax(cumvar >= 0.90)) + 1
    X_pca = PCA(n_components=n_comp, random_state=42).fit_transform(X_scaled)

    results = {}
    for k in range(2, 8):
        km = KMeans(n_clusters=k, random_state=42, n_init=15)
        labels = km.fit_predict(X_pca)
        results[str(k)] = round(silhouette_score(X_pca, labels), 4)

    return {"scores": results, "optimal_k": max(results, key=results.get)}


@router.get("/correlation-top")
def top_correlations(n: int = 20):
    """Correlation matrix for top N features by SHAP importance (or all numeric)."""
    df = get_dataframe()

    # Try to load SHAP summary for feature ranking
    shap_path = SAVED_MODEL_DIR / "shap_summary.csv"
    if shap_path.exists():
        shap_df = pd.read_csv(shap_path)
        top_cols = shap_df["feature"].head(n).tolist()
    else:
        num_cols = [c for c in df.columns if pd.api.types.is_numeric_dtype(df[c]) and c != "week_date"]
        top_cols = num_cols[:n]

    valid = [c for c in top_cols if c in df.columns]
    corr = df[valid].corr().round(4)

    return {
        "columns": [{"name": c, "label": get_label(c)} for c in valid],
        "matrix": corr.replace({np.nan: None}).values.tolist(),
        "labels": [get_label(c) for c in valid],
    }
