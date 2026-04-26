"""
Train XGBoost model for WACMR prediction and save all artifacts
for the web API to serve.

Runnable as:
    cd /Users/dhruvjalan/Desktop/DSM_project && python -m backend.ml.train_and_save
    python backend/ml/train_and_save.py

Artifacts written to backend/ml/saved_model/:
    xgb_model.json          - trained XGBoost model (full dataset)
    feature_names.json      - ordered list of feature column names
    walkforward_results.csv - walk-forward CV predictions
    shap_values.npy         - full SHAP matrix (n_samples x n_features)
    shap_summary.csv        - mean |SHAP| per feature
    pca_coordinates.csv     - PCA coordinates with regime labels
    silhouette_scores.json  - silhouette scores for K=2..7
"""

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import xgboost as xgb
import shap
from sklearn.decomposition import PCA
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score, mean_squared_error, mean_absolute_error
from sklearn.preprocessing import StandardScaler

# ── Paths ─────────────────────────────────────────────────────────────────────
# Resolve project root relative to this file so the script works from any cwd.
_THIS_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = _THIS_DIR.parent.parent
CSV_PATH = PROJECT_ROOT / "data" / "processed" / "Weekly_Macro_Master.csv"
SAVE_DIR = _THIS_DIR / "saved_model"
SAVE_DIR.mkdir(parents=True, exist_ok=True)

# ── Constants (matching stage4_supervised_ml.py) ──────────────────────────────
TARGET_COL = "target_wacmr"
ALWAYS_EXCLUDE = {"week_date", TARGET_COL}
REGIME_COLS_PREFIX = ("regime_label", "cluster_dist_")
MIN_TRAIN_SIZE = 156  # 3 years of weekly data

XGB_PARAMS = dict(
    n_estimators=400,
    learning_rate=0.05,
    max_depth=4,
    subsample=0.8,
    colsample_bytree=0.8,
    reg_alpha=0.1,
    reg_lambda=1.0,
    random_state=42,
    n_jobs=-1,
)

# Columns excluded from PCA / clustering (matching stage3_advanced_eda.py)
PCA_EXCLUDE = {
    TARGET_COL,
    "target_lag1", "target_lag2", "target_lag4",
    "week_date",
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def load_data() -> pd.DataFrame:
    """Read the CSV backup, parse dates, sort chronologically."""
    print(f"[1] Reading data from {CSV_PATH} ...")
    if not CSV_PATH.exists():
        sys.exit(f"ERROR: CSV not found at {CSV_PATH}")
    df = pd.read_csv(CSV_PATH)
    df["week_date"] = pd.to_datetime(df["week_date"])
    df = df.sort_values("week_date").reset_index(drop=True)
    print(f"    Loaded {df.shape[0]} rows x {df.shape[1]} columns")
    return df


def build_feature_set(df: pd.DataFrame) -> tuple[list[str], pd.DataFrame, pd.Series]:
    """
    Build the baseline feature matrix exactly as stage4 does:
    - All numeric columns except ALWAYS_EXCLUDE and regime columns
    - NaN filled with column median
    Returns (baseline_cols, X, y).
    """
    print("[2] Building feature set ...")
    all_numeric = [
        c for c in df.columns
        if c not in ALWAYS_EXCLUDE and pd.api.types.is_numeric_dtype(df[c])
    ]
    # Exclude regime columns (they may or may not be present in the CSV)
    regime_specific = [
        c for c in all_numeric if c.startswith(REGIME_COLS_PREFIX)
    ]
    baseline_cols = [c for c in all_numeric if c not in regime_specific]

    X = df[baseline_cols].copy().fillna(df[baseline_cols].median())
    y = df[TARGET_COL].copy()

    print(f"    Baseline features: {len(baseline_cols)}")
    print(f"    Regime columns excluded: {len(regime_specific)}")
    print(f"    Target: {TARGET_COL}")
    return baseline_cols, X, y


def walk_forward_cv(
    X: pd.DataFrame,
    y: pd.Series,
    dates: pd.Series,
    min_train: int,
) -> pd.DataFrame:
    """
    Expanding-window walk-forward CV.
    Returns a DataFrame with columns: week_date, actual, predicted.
    """
    print(f"[3] Walk-forward CV (min_train={min_train}, "
          f"test steps={len(X) - min_train}) ...")
    n = len(X)
    X_arr = X.values.astype(np.float32)
    y_arr = y.values.astype(np.float32)

    records = []
    for t in range(min_train, n):
        model = xgb.XGBRegressor(**XGB_PARAMS, verbosity=0)
        model.fit(X_arr[:t], y_arr[:t])
        pred = float(model.predict(X_arr[t : t + 1])[0])
        records.append({
            "week_date": dates.iloc[t],
            "actual": float(y_arr[t]),
            "predicted": pred,
        })
        done = t - min_train + 1
        total = n - min_train
        if done % 50 == 0 or done == total:
            print(f"    step {done}/{total}")

    results = pd.DataFrame(records)

    rmse = float(np.sqrt(mean_squared_error(results["actual"], results["predicted"])))
    mae = float(mean_absolute_error(results["actual"], results["predicted"]))
    print(f"    Walk-forward RMSE={rmse:.4f}  MAE={mae:.4f}")
    return results


def train_final_model(X: pd.DataFrame, y: pd.Series, feature_names: list[str]):
    """Train on the full dataset and save model + feature names."""
    print("[4] Training final model on full dataset ...")
    X_arr = X.values.astype(np.float32)
    y_arr = y.values.astype(np.float32)

    model = xgb.XGBRegressor(**XGB_PARAMS, verbosity=0)
    model.fit(X_arr, y_arr)
    print(f"    Trained on {len(X_arr)} samples x {X_arr.shape[1]} features")

    # Save model
    model_path = SAVE_DIR / "xgb_model.json"
    model.save_model(str(model_path))
    print(f"    Saved model: {model_path}")

    # Save feature names
    feat_path = SAVE_DIR / "feature_names.json"
    with open(feat_path, "w") as f:
        json.dump(feature_names, f, indent=2)
    print(f"    Saved feature names: {feat_path}")

    return model, X_arr


def compute_shap(model, X_arr: np.ndarray, feature_names: list[str]):
    """Compute SHAP values and save matrix + summary."""
    print("[5] Computing SHAP values ...")
    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(X_arr)
    print(f"    SHAP matrix shape: {shap_values.shape}")

    # Save full SHAP matrix
    shap_path = SAVE_DIR / "shap_values.npy"
    np.save(str(shap_path), shap_values)
    print(f"    Saved SHAP matrix: {shap_path}")

    # Save SHAP summary (mean |SHAP| per feature)
    mean_abs_shap = np.abs(shap_values).mean(axis=0)
    summary_df = pd.DataFrame({
        "feature": feature_names,
        "mean_abs_shap": mean_abs_shap,
    }).sort_values("mean_abs_shap", ascending=False).reset_index(drop=True)

    summary_path = SAVE_DIR / "shap_summary.csv"
    summary_df.to_csv(summary_path, index=False)
    print(f"    Saved SHAP summary: {summary_path}")

    print("    Top 10 features by mean |SHAP|:")
    for _, row in summary_df.head(10).iterrows():
        print(f"      {row['feature']:<40} {row['mean_abs_shap']:.5f}")


def compute_pca_and_regimes(df: pd.DataFrame):
    """
    Re-run PCA + K-Means (matching stage3_advanced_eda.py) and save
    PCA coordinates, regime labels, and silhouette scores.
    """
    print("[6] Computing PCA + regime data ...")

    # Build the same feature set that stage3 uses for clustering
    feature_cols = [
        c for c in df.columns
        if c not in PCA_EXCLUDE
        and pd.api.types.is_numeric_dtype(df[c])
        and not c.startswith(REGIME_COLS_PREFIX)
    ]
    X_raw = df[feature_cols].copy().fillna(df[feature_cols].median())

    # StandardScaler -> PCA retaining 90% variance
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X_raw)

    pca_full = PCA(random_state=42)
    pca_full.fit(X_scaled)
    cumvar = np.cumsum(pca_full.explained_variance_ratio_)
    n_components = int(np.argmax(cumvar >= 0.90)) + 1
    print(f"    PCA components for 90% variance: {n_components}")

    pca = PCA(n_components=n_components, random_state=42)
    X_pca = pca.fit_transform(X_scaled)
    print(f"    Variance explained: {pca.explained_variance_ratio_.sum() * 100:.1f}%")

    # Silhouette scores for K=2..7
    print("    Silhouette sweep K=2..7:")
    k_range = range(2, 8)
    sil_scores = {}
    for k in k_range:
        km = KMeans(n_clusters=k, random_state=42, n_init=15, max_iter=500)
        labels = km.fit_predict(X_pca)
        sil = float(silhouette_score(X_pca, labels))
        sil_scores[k] = sil
        print(f"      K={k}  Silhouette={sil:.4f}")

    optimal_k = max(sil_scores, key=sil_scores.get)
    print(f"    Optimal K={optimal_k} (Silhouette={sil_scores[optimal_k]:.4f})")

    # Save silhouette scores (keys as strings for JSON)
    sil_path = SAVE_DIR / "silhouette_scores.json"
    with open(sil_path, "w") as f:
        json.dump({str(k): v for k, v in sil_scores.items()}, f, indent=2)
    print(f"    Saved silhouette scores: {sil_path}")

    # Fit final K-Means with optimal K
    km_final = KMeans(n_clusters=optimal_k, random_state=42, n_init=15, max_iter=500)
    regime_labels = km_final.fit_predict(X_pca)

    # Cluster-centroid distances
    centroids = km_final.cluster_centers_
    cluster_dists = {}
    for k_idx in range(optimal_k):
        diff = X_pca - centroids[k_idx]
        cluster_dists[f"cluster_dist_{k_idx}"] = np.linalg.norm(diff, axis=1)

    # Build PCA coordinates DataFrame
    # Ensure at least 3 PCs for output (pad with zeros if fewer)
    pca_coords = pd.DataFrame({
        "week_date": df["week_date"].values,
        "pc1": X_pca[:, 0],
        "pc2": X_pca[:, 1] if X_pca.shape[1] > 1 else 0.0,
        "pc3": X_pca[:, 2] if X_pca.shape[1] > 2 else 0.0,
        "regime_label": regime_labels,
    })
    for col_name, dists in cluster_dists.items():
        pca_coords[col_name] = dists

    pca_path = SAVE_DIR / "pca_coordinates.csv"
    pca_coords.to_csv(pca_path, index=False)
    print(f"    Saved PCA coordinates: {pca_path}")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("=" * 70)
    print("  TRAIN & SAVE — XGBoost WACMR Model + Artifacts")
    print("=" * 70)

    # Step 1: Load data
    df = load_data()

    # Step 2: Build feature set
    baseline_cols, X, y = build_feature_set(df)

    # Step 3: Walk-forward CV
    wf_results = walk_forward_cv(X, y, df["week_date"], MIN_TRAIN_SIZE)
    wf_path = SAVE_DIR / "walkforward_results.csv"
    wf_results.to_csv(wf_path, index=False)
    print(f"    Saved walk-forward results: {wf_path}")

    # Step 4: Train final model on full dataset
    model, X_arr = train_final_model(X, y, baseline_cols)

    # Step 5: SHAP values
    compute_shap(model, X_arr, baseline_cols)

    # Step 6: PCA + regimes
    compute_pca_and_regimes(df)

    print("\n" + "=" * 70)
    print("  ALL ARTIFACTS SAVED SUCCESSFULLY")
    print("=" * 70)
    print(f"  Output directory: {SAVE_DIR}")
    for p in sorted(SAVE_DIR.iterdir()):
        size_kb = p.stat().st_size / 1024
        print(f"    {p.name:<30} {size_kb:>8.1f} KB")
    print("=" * 70)


if __name__ == "__main__":
    main()
