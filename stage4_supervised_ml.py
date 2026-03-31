"""
Stage 4 (covers Proposal Stages 3 & 4):
    Phase 2 — Supervised ML + Walk-Forward CV  (Stage 3 in proposal)
    Interpretability — SHAP analysis           (Stage 4 in proposal)
==========================================================================
Reads  : dsm_project.db  →  Weekly_Macro_Master  (must contain regime_label
         and cluster_dist_K columns from stage3)
Target : target_364d_yield  (1-week-ahead prediction)
Models : Baseline XGBoost  vs  Regime-Aware XGBoost
CV     : Walk-forward expanding-window  (min 156 weeks training, 1-week ahead)
Metrics: RMSE, MAE, Directional Accuracy
Plots  : visualizations/actual_vs_predicted.png
         visualizations/shap_summary.png
"""

import numpy as np
import pandas as pd
import sqlite3
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from pathlib import Path

from sklearn.metrics import mean_squared_error, mean_absolute_error

import xgboost as xgb
import shap

# ── Config ────────────────────────────────────────────────────────────────────
DB_PATH    = Path("dsm_project.db")
TABLE_NAME = "Weekly_Macro_Master"
VIS_DIR    = Path("visualizations")
VIS_DIR.mkdir(exist_ok=True)

TARGET_COL     = "target_wacmr"     # Weighted Average Call Money Rate (%)
REPO_RATE_COL  = "rates_I7496_17"   # RBI Repo Rate (%)
MIN_TRAIN_SIZE = 156   # 3 years of weekly data before first prediction

# Columns that must NEVER enter any model as features
ALWAYS_EXCLUDE = {
    "week_date", TARGET_COL,
    "target_lag1", "target_lag2", "target_lag4",  # lag1 IS used as a feature; rest excluded
}
# Keep target_lag1 as a feature (autoregressive term) — remove from exclusion
ALWAYS_EXCLUDE.discard("target_lag1")
# Actually we use target_lag1 as a feature — only lag2 and lag4 are excluded to avoid
# look-ahead.  Actually all lags are valid features since they reference past values.
# We include ALL lag columns as features.
ALWAYS_EXCLUDE = {"week_date", TARGET_COL}

# Regime columns injected only in the regime-aware model
REGIME_COLS_PREFIX = ("regime_label", "cluster_dist_")


def load_data() -> pd.DataFrame:
    conn = sqlite3.connect(DB_PATH)
    df = pd.read_sql(f"SELECT * FROM {TABLE_NAME}", conn)
    conn.close()
    df["week_date"] = pd.to_datetime(df["week_date"])
    df = df.sort_values("week_date").reset_index(drop=True)
    return df


def get_feature_sets(df: pd.DataFrame):
    """
    Returns two column lists:
      baseline_cols   — all numeric features EXCEPT regime_label / cluster_dist_*
      regime_cols     — baseline_cols + one-hot regime_label + cluster_dist_* cols
    """
    all_numeric = [
        c for c in df.columns
        if c not in ALWAYS_EXCLUDE and pd.api.types.is_numeric_dtype(df[c])
    ]

    # Separate regime columns
    regime_specific = [
        c for c in all_numeric
        if c.startswith(REGIME_COLS_PREFIX)
    ]
    baseline_cols = [c for c in all_numeric if c not in regime_specific]

    # One-hot encode regime_label if present
    if "regime_label" in df.columns:
        ohe_df = pd.get_dummies(df["regime_label"], prefix="regime_ohe", dtype=float)
        ohe_names = list(ohe_df.columns)
    else:
        ohe_df    = pd.DataFrame()
        ohe_names = []

    return baseline_cols, regime_specific, ohe_df, ohe_names


def directional_accuracy(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    """% of steps where predicted and actual direction (up/down) agree."""
    true_dir = np.diff(y_true)
    pred_dir = np.diff(y_pred)
    return float(np.mean(np.sign(true_dir) == np.sign(pred_dir)) * 100)


def walk_forward_cv(
    X: pd.DataFrame,
    y: pd.Series,
    min_train: int,
    model_params: dict
) -> tuple[np.ndarray, np.ndarray]:
    """
    Expanding-window walk-forward CV.
    Trains on [0 … t-1], predicts on [t].
    Returns arrays of (actuals, predictions) for all test steps.
    """
    n         = len(X)
    actuals   = []
    preds     = []

    X_arr = X.values.astype(np.float32)
    y_arr = y.values.astype(np.float32)

    for t in range(min_train, n):
        X_train = X_arr[:t]
        y_train = y_arr[:t]
        X_test  = X_arr[t : t + 1]
        y_test  = y_arr[t]

        model = xgb.XGBRegressor(**model_params, verbosity=0)
        model.fit(X_train, y_train)

        pred = model.predict(X_test)[0]
        actuals.append(float(y_test))
        preds.append(float(pred))

        if (t - min_train) % 100 == 0:
            print(f"    step {t - min_train + 1}/{n - min_train} ...", flush=True)

    return np.array(actuals), np.array(preds)


def run_stage4() -> None:
    print("=" * 70)
    print("  STAGE 3: SUPERVISED ML — XGBoost WALK-FORWARD CV")
    print("=" * 70)

    # ── Load data ─────────────────────────────────────────────────────────────
    print(f"\n[3.0] Reading '{TABLE_NAME}' from {DB_PATH} ...")
    df = load_data()
    print(f"  Loaded: {df.shape[0]} rows × {df.shape[1]} cols")

    if "regime_label" not in df.columns:
        raise RuntimeError(
            "regime_label column not found.  Run stage3_advanced_eda.py first."
        )

    # ── Build feature sets ────────────────────────────────────────────────────
    print("\n[3.1] Building feature column sets ...")
    baseline_cols, regime_dist_cols, ohe_df, ohe_names = get_feature_sets(df)
    print(f"  Baseline features          : {len(baseline_cols)}")
    print(f"  Regime OHE columns         : {ohe_names}")
    print(f"  Cluster-distance columns   : {regime_dist_cols}")

    y = df[TARGET_COL].copy()

    # Baseline feature matrix
    X_base = df[baseline_cols].copy().fillna(df[baseline_cols].median())

    # Regime-aware feature matrix (baseline + OHE regime + centroid distances)
    if len(ohe_names):
        X_regime = pd.concat(
            [X_base, ohe_df.reset_index(drop=True),
             df[regime_dist_cols].reset_index(drop=True)],
            axis=1
        )
    else:
        X_regime = X_base.copy()
    X_regime = X_regime.fillna(X_regime.median())

    print(f"\n  Baseline X shape  : {X_base.shape}")
    print(f"  Regime-aware X    : {X_regime.shape}")

    # ── XGBoost hyperparameters (same for both models) ────────────────────────
    xgb_params = dict(
        n_estimators   = 400,
        learning_rate  = 0.05,
        max_depth      = 4,
        subsample      = 0.8,
        colsample_bytree = 0.8,
        reg_alpha      = 0.1,
        reg_lambda     = 1.0,
        random_state   = 42,
        n_jobs         = -1,
    )

    # ── 3.2  Walk-forward CV — Baseline model ─────────────────────────────────
    print(f"\n[3.2a] Walk-forward CV — BASELINE model "
          f"(min_train={MIN_TRAIN_SIZE} weeks) ...")
    act_base, pred_base = walk_forward_cv(X_base, y, MIN_TRAIN_SIZE, xgb_params)

    rmse_base = float(np.sqrt(mean_squared_error(act_base, pred_base)))
    mae_base  = float(mean_absolute_error(act_base, pred_base))
    da_base   = directional_accuracy(act_base, pred_base)

    print(f"  BASELINE   RMSE={rmse_base:.4f}  MAE={mae_base:.4f}  DA={da_base:.1f} %")

    # ── Walk-forward CV — Regime-Aware model ──────────────────────────────────
    print(f"\n[3.2b] Walk-forward CV — REGIME-AWARE model ...")
    act_reg, pred_reg = walk_forward_cv(X_regime, y, MIN_TRAIN_SIZE, xgb_params)

    rmse_reg = float(np.sqrt(mean_squared_error(act_reg, pred_reg)))
    mae_reg  = float(mean_absolute_error(act_reg, pred_reg))
    da_reg   = directional_accuracy(act_reg, pred_reg)

    print(f"  REGIME-AWARE RMSE={rmse_reg:.4f}  MAE={mae_reg:.4f}  DA={da_reg:.1f} %")

    # ── 3.3  Metrics comparison table ─────────────────────────────────────────
    rmse_improvement = (rmse_base - rmse_reg) / rmse_base * 100
    mae_improvement  = (mae_base  - mae_reg)  / mae_base  * 100
    da_improvement   = da_reg - da_base

    print("\n" + "─" * 68)
    print("  [CHECK-IN 3]  MODEL COMPARISON — ABLATION STUDY RESULTS")
    print("─" * 68)
    header = f"{'Metric':<28} {'Baseline':>12} {'Regime-Aware':>14} {'Improvement':>13}"
    print(header)
    print("─" * 68)
    print(f"  {'RMSE (lower is better)':<26} {rmse_base:>12.4f} {rmse_reg:>14.4f} "
          f"{rmse_improvement:>+11.1f} %")
    print(f"  {'MAE (lower is better)':<26} {mae_base:>12.4f} {mae_reg:>14.4f} "
          f"{mae_improvement:>+11.1f} %")
    print(f"  {'Directional Acc. (%)':<26} {da_base:>12.1f} {da_reg:>14.1f} "
          f"{da_improvement:>+11.1f} pp")
    print("─" * 68)
    winner = "REGIME-AWARE" if rmse_reg < rmse_base else "BASELINE"
    print(f"  Best model by RMSE : {winner}")
    print("─" * 68)

    # ── STAGE 4: SHAP on the best model trained on full data ──────────────────
    print("\n" + "=" * 70)
    print("  STAGE 4: INTERPRETABILITY — SHAP ANALYSIS")
    print("=" * 70)

    # Identify the best model's feature matrix
    best_X     = X_regime if winner == "REGIME-AWARE" else X_base
    best_preds = pred_reg  if winner == "REGIME-AWARE" else pred_base
    best_acts  = act_reg   if winner == "REGIME-AWARE" else act_base

    # ── 4.1  Train final model on ALL data for SHAP ───────────────────────────
    print("\n[4.1] Training final XGBoost on FULL dataset for SHAP analysis ...")
    X_full = best_X.values.astype(np.float32)
    y_full = y.values.astype(np.float32)

    final_model = xgb.XGBRegressor(**xgb_params, verbosity=0)
    final_model.fit(X_full, y_full)
    print(f"  Trained on {len(X_full)} samples × {X_full.shape[1]} features")

    # ── SHAP values ───────────────────────────────────────────────────────────
    print("  Computing SHAP values ...")
    explainer  = shap.TreeExplainer(final_model)
    shap_values = explainer.shap_values(X_full)

    # Mean absolute SHAP per feature — top 15
    mean_shap = np.abs(shap_values).mean(axis=0)
    feat_names = list(best_X.columns)
    shap_df = pd.DataFrame({"feature": feat_names, "mean_abs_shap": mean_shap})
    shap_df = shap_df.sort_values("mean_abs_shap", ascending=False).reset_index(drop=True)

    print("\n  Top 15 Features by Mean |SHAP|:")
    print("─" * 50)
    for i, row in shap_df.head(15).iterrows():
        print(f"  {i+1:>2}. {row['feature']:<38}  {row['mean_abs_shap']:.5f}")
    print("─" * 50)

    # ── 4.1  SHAP Summary Plot (top 15) ───────────────────────────────────────
    top15_idx   = shap_df.head(15).index.tolist()
    top15_names = [feat_names[i] for i in top15_idx]
    top15_shap  = shap_values[:, top15_idx]
    top15_X     = X_full[:, top15_idx]

    fig, ax = plt.subplots(figsize=(11, 8))
    shap.summary_plot(
        top15_shap, top15_X,
        feature_names=top15_names,
        plot_type="dot", show=False,
        max_display=15, color_bar=True
    )
    plt.title(
        f"SHAP Summary Plot — Top 15 Features\n"
        f"{winner} XGBoost Model  |  364-Day T-Bill Yield",
        fontsize=13, fontweight="bold", pad=10
    )
    plt.tight_layout()
    shap_path = VIS_DIR / "shap_summary.png"
    plt.savefig(shap_path, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"\n  Saved: {shap_path}")

    # ── 4.2  Actual vs Predicted — final 2 years of walk-forward results ──────
    dates_test = df["week_date"].iloc[MIN_TRAIN_SIZE:].reset_index(drop=True)

    # Keep only the last 2 years of test predictions
    cutoff_2yr = dates_test.max() - pd.DateOffset(years=2)
    mask_2yr   = dates_test >= cutoff_2yr
    dates_2yr  = dates_test[mask_2yr]
    act_2yr    = best_acts[mask_2yr.values]
    pred_2yr   = best_preds[mask_2yr.values]

    rmse_2yr = float(np.sqrt(mean_squared_error(act_2yr, pred_2yr)))
    mae_2yr  = float(mean_absolute_error(act_2yr, pred_2yr))

    fig, ax = plt.subplots(figsize=(16, 5))
    ax.plot(dates_2yr, act_2yr,  color="black",    linewidth=1.6, label="Actual 364-Day T-Bill Yield")
    ax.plot(dates_2yr, pred_2yr, color="crimson",  linewidth=1.2, linestyle="--",
            alpha=0.85, label=f"Predicted  (RMSE={rmse_2yr:.3f}, MAE={mae_2yr:.3f})")
    ax.fill_between(dates_2yr, act_2yr, pred_2yr, alpha=0.10, color="crimson")
    ax.set_title(
        f"Actual vs Predicted — 364-Day T-Bill Cut-Off Yield\n"
        f"Final 2 Years of Walk-Forward CV  |  {winner} Model",
        fontsize=13, fontweight="bold"
    )
    ax.set_xlabel("Date", fontsize=10)
    ax.set_ylabel("Yield (%)", fontsize=10)
    ax.legend(fontsize=10)
    ax.grid(alpha=0.3)
    plt.tight_layout()
    pred_path = VIS_DIR / "actual_vs_predicted.png"
    plt.savefig(pred_path, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"  Saved: {pred_path}")

    # ── CHECK-IN 4 Summary ────────────────────────────────────────────────────
    print("\n" + "=" * 70)
    print("  [CHECK-IN 4]  STAGE 4 COMPLETE — SHAP & INTERPRETABILITY")
    print("=" * 70)
    print(f"  Best model         : {winner}")
    print(f"  RMSE improvement   : {rmse_improvement:+.1f} %")
    print(f"  DA improvement     : {da_improvement:+.1f} pp")
    print(f"\n  Top 5 SHAP features:")
    for i, row in shap_df.head(5).iterrows():
        print(f"    {i+1}. {row['feature']:<40}  Mean |SHAP| = {row['mean_abs_shap']:.5f}")
    print(f"\n  Plots saved:")
    print(f"    {shap_path}")
    print(f"    {pred_path}")
    print("=" * 70)


if __name__ == "__main__":
    run_stage4()
