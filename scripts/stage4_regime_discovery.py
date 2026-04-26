"""
Stage 3: Unsupervised ML — Monetary Regime Discovery
=====================================================
Reads   : dsm_project.db  →  Weekly_Macro_Master
Method  : StandardScaler → PCA (90 % variance) → K-Means (optimal K via Silhouette)
Output  : regime_label + cluster_dist_K columns written back to DB
Plots   : visualizations/pca_regime_scatter.png
          visualizations/regime_timeseries.png
          visualizations/silhouette_scores.png
"""

import numpy as np
import pandas as pd
import sqlite3
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from pathlib import Path
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score

# ── Config ────────────────────────────────────────────────────────────────────
DB_PATH    = Path(__file__).resolve().parent.parent / "dsm_project.db"
TABLE_NAME = "Weekly_Macro_Master"
VIS_DIR    = Path(__file__).resolve().parent.parent / "visualizations"
VIS_DIR.mkdir(exist_ok=True)

TARGET_COL    = "target_wacmr"    # Weighted Average Call Money Rate (%)
REPO_RATE_COL = "rates_I7496_17"  # RBI Repo Rate (%)

# Columns to EXCLUDE from clustering feature set
# (target + engineered lag/spread cols that incorporate target)
EXCLUDE_FROM_FEATURES = {
    TARGET_COL,
    "target_lag1", "target_lag2", "target_lag4",
    "week_date",
}


def run_stage3() -> None:
    print("=" * 70)
    print("  STAGE 2: UNSUPERVISED ML — MONETARY REGIME DISCOVERY")
    print("=" * 70)

    # ── Load from SQLite ──────────────────────────────────────────────────────
    print(f"\n[2.0] Reading '{TABLE_NAME}' from {DB_PATH} ...")
    conn = sqlite3.connect(DB_PATH)
    df = pd.read_sql(f"SELECT * FROM {TABLE_NAME}", conn)
    df["week_date"] = pd.to_datetime(df["week_date"])
    df = df.sort_values("week_date").reset_index(drop=True)
    print(f"  Loaded: {df.shape[0]} rows × {df.shape[1]} cols")

    # ── 2.1  Feature matrix for clustering ───────────────────────────────────
    print("\n[2.1] Isolating feature columns for clustering ...")
    feature_cols = [
        c for c in df.columns
        if c not in EXCLUDE_FROM_FEATURES
        and pd.api.types.is_numeric_dtype(df[c])
    ]
    print(f"  Feature columns  : {len(feature_cols)}")

    X_raw = df[feature_cols].copy()

    # Impute any residual NaN with column median (should be near-zero given the 75 % rule)
    null_counts = X_raw.isnull().sum()
    cols_with_nulls = null_counts[null_counts > 0]
    if len(cols_with_nulls):
        print(f"  Imputing medians for {len(cols_with_nulls)} columns with residual NaN")
        X_raw = X_raw.fillna(X_raw.median())

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X_raw)

    # ── PCA — retain 90 % of variance ────────────────────────────────────────
    pca_full = PCA(random_state=42)
    pca_full.fit(X_scaled)
    cumvar = np.cumsum(pca_full.explained_variance_ratio_)
    n_components = int(np.argmax(cumvar >= 0.90)) + 1
    print(f"  PCA components to retain 90 % variance : {n_components}")

    pca = PCA(n_components=n_components, random_state=42)
    X_pca = pca.fit_transform(X_scaled)
    print(f"  Variance explained by {n_components} PCs : "
          f"{pca.explained_variance_ratio_.sum() * 100:.1f} %")

    # ── 2.2  K-Means — Silhouette-score sweep for K = 2 … 7 ─────────────────
    print("\n[2.2] K-Means silhouette sweep (K = 2 to 7) ...")
    k_range      = range(2, 8)
    sil_scores   = {}
    inertias     = {}

    for k in k_range:
        km = KMeans(n_clusters=k, random_state=42, n_init=15, max_iter=500)
        labels = km.fit_predict(X_pca)
        sil    = silhouette_score(X_pca, labels)
        sil_scores[k] = sil
        inertias[k]   = km.inertia_
        print(f"  K={k}  Silhouette={sil:.4f}  Inertia={km.inertia_:,.0f}")

    optimal_k = max(sil_scores, key=sil_scores.get)
    print(f"\n  ★ Optimal K = {optimal_k}  "
          f"(Silhouette = {sil_scores[optimal_k]:.4f})")

    # ── Save silhouette plot ──────────────────────────────────────────────────
    fig, ax1 = plt.subplots(figsize=(9, 5))
    ks    = list(k_range)
    svals = [sil_scores[k] for k in ks]
    ivals = [inertias[k]   for k in ks]

    ax1.bar(ks, svals, color="steelblue", alpha=0.75, label="Silhouette Score")
    ax1.axvline(optimal_k, color="crimson", linestyle="--", linewidth=1.5,
                label=f"Optimal K = {optimal_k}")
    ax1.set_xlabel("Number of Clusters (K)", fontsize=11, fontweight="bold")
    ax1.set_ylabel("Silhouette Score", color="steelblue", fontsize=11)
    ax1.tick_params(axis="y", labelcolor="steelblue")

    ax2 = ax1.twinx()
    ax2.plot(ks, ivals, color="darkorange", marker="o", linewidth=2,
             linestyle="--", label="Inertia (Elbow)")
    ax2.set_ylabel("Inertia", color="darkorange", fontsize=11)
    ax2.tick_params(axis="y", labelcolor="darkorange")

    ax1.set_title(f"K-Means Cluster Selection — Silhouette & Elbow\n"
                  f"Optimal K = {optimal_k}", fontsize=13, fontweight="bold")
    lines1, lbs1 = ax1.get_legend_handles_labels()
    lines2, lbs2 = ax2.get_legend_handles_labels()
    ax1.legend(lines1 + lines2, lbs1 + lbs2, fontsize=9)
    plt.tight_layout()
    sil_path = VIS_DIR / "silhouette_scores.png"
    plt.savefig(sil_path, dpi=300, bbox_inches="tight")
    plt.close()
    print(f"  Saved: {sil_path}")

    # ── Fit final K-Means with optimal K ─────────────────────────────────────
    km_final = KMeans(n_clusters=optimal_k, random_state=42, n_init=15, max_iter=500)
    df["regime_label"] = km_final.fit_predict(X_pca)

    # ── 2.3  Cluster-centroid distances (soft membership features) ───────────
    print("\n[2.3] Computing cluster-centroid distances ...")
    centroids      = km_final.cluster_centers_    # shape (K, n_pca_components)
    pca_df         = pd.DataFrame(X_pca)
    for k_idx in range(optimal_k):
        diff = pca_df.values - centroids[k_idx]
        df[f"cluster_dist_{k_idx}"] = np.linalg.norm(diff, axis=1)
    dist_cols = [f"cluster_dist_{k}" for k in range(optimal_k)]
    print(f"  Added columns: {dist_cols}")

    # ── Regime profiling ──────────────────────────────────────────────────────
    profile_cols = [REPO_RATE_COL, TARGET_COL, "rates_I7496_5", "rates_I7496_26"]
    profile_cols = [c for c in profile_cols if c in df.columns]
    profiles = df.groupby("regime_label")[profile_cols + [TARGET_COL]].agg(
        ["mean", "std"]
    ).round(3)
    profiles.columns = ["_".join(c) for c in profiles.columns]
    profiles["n_weeks"] = df.groupby("regime_label").size()
    profiles["date_range"] = df.groupby("regime_label")["week_date"].apply(
        lambda s: f"{s.min().date()} – {s.max().date()}"
    )
    print("\n  Regime Profiles:")
    print(profiles.to_string())

    # ── 2.4  Plot 1: PCA scatter coloured by regime label ────────────────────
    print("\n[2.4] Generating visualizations ...")
    palette = plt.cm.get_cmap("tab10", optimal_k)
    regime_colors = {k: palette(k) for k in range(optimal_k)}

    fig, ax = plt.subplots(figsize=(10, 7))
    for regime in sorted(df["regime_label"].unique()):
        mask = df["regime_label"] == regime
        ax.scatter(
            X_pca[mask, 0], X_pca[mask, 1],
            c=[regime_colors[regime]], s=30, alpha=0.65,
            edgecolors="none", label=f"Regime {regime}"
        )
    # Mark centroids
    ax.scatter(
        centroids[:, 0], centroids[:, 1],
        c="black", s=180, marker="X", zorder=5, label="Centroids"
    )
    ax.set_title(
        f"PCA Feature Space — K-Means Regimes (K={optimal_k})\n"
        f"PC1 vs PC2  |  Golden Window: Jan 2014 – Jul 2024",
        fontsize=13, fontweight="bold"
    )
    ax.set_xlabel(f"PC1  ({pca.explained_variance_ratio_[0]*100:.1f} % var)", fontsize=11)
    ax.set_ylabel(f"PC2  ({pca.explained_variance_ratio_[1]*100:.1f} % var)", fontsize=11)
    ax.legend(fontsize=10)
    ax.grid(alpha=0.3)
    plt.tight_layout()
    scatter_path = VIS_DIR / "pca_regime_scatter.png"
    plt.savefig(scatter_path, dpi=300, bbox_inches="tight")
    plt.close()
    print(f"  Saved: {scatter_path}")

    # ── Plot 2: Repo Rate time-series shaded by regime ────────────────────────
    fig, ax = plt.subplots(figsize=(16, 5))

    if REPO_RATE_COL in df.columns:
        ax.plot(df["week_date"], df[REPO_RATE_COL],
                color="black", linewidth=1.4, zorder=3, label="Repo Rate (%)")
    ax.plot(df["week_date"], df[TARGET_COL],
            color="steelblue", linewidth=1.0, alpha=0.8, zorder=2,
            label="WACMR (%)")

    # Shade regime backgrounds
    legend_patches = []
    prev_regime = df.iloc[0]["regime_label"]
    seg_start   = df.iloc[0]["week_date"]

    def shade_segment(ax, start, end, color):
        ax.axvspan(start, end, color=color, alpha=0.18, zorder=1)

    for i, row in df.iterrows():
        if row["regime_label"] != prev_regime or i == len(df) - 1:
            shade_segment(ax, seg_start, row["week_date"],
                          regime_colors[prev_regime])
            seg_start   = row["week_date"]
            prev_regime = row["regime_label"]

    for regime in range(optimal_k):
        legend_patches.append(
            mpatches.Patch(color=regime_colors[regime], alpha=0.4,
                           label=f"Regime {regime}")
        )

    ax.set_title(
        f"RBI Repo Rate & WACMR — Background Shaded by Regime\n"
        f"K-Means K={optimal_k}  |  Jan 2014 – Jul 2024",
        fontsize=13, fontweight="bold"
    )
    ax.set_xlabel("Date", fontsize=10)
    ax.set_ylabel("Rate / Yield (%)", fontsize=10)
    ax.grid(alpha=0.3)

    line_handles, line_labels = ax.get_legend_handles_labels()
    ax.legend(
        line_handles + legend_patches,
        line_labels  + [p.get_label() for p in legend_patches],
        fontsize=9, loc="upper right", ncol=2
    )
    plt.tight_layout()
    ts_path = VIS_DIR / "regime_timeseries.png"
    plt.savefig(ts_path, dpi=300, bbox_inches="tight")
    plt.close()
    print(f"  Saved: {ts_path}")

    # ── Write enriched data back to SQLite ───────────────────────────────────
    print(f"\n[2.5] Writing enriched data (regime_label + {dist_cols}) back to DB ...")
    df_out = df.copy()
    df_out["week_date"] = df_out["week_date"].dt.strftime("%Y-%m-%d")
    df_out.to_sql(TABLE_NAME, conn, if_exists="replace", index=False)
    conn.close()
    print(f"  Table '{TABLE_NAME}' updated.  ✓")

    # ── CHECK-IN 2 Summary ────────────────────────────────────────────────────
    print("\n" + "=" * 70)
    print("  [CHECK-IN 2]  STAGE 2 COMPLETE — REGIME DISCOVERY")
    print("=" * 70)
    print(f"  Optimal K          : {optimal_k}")
    print(f"  Silhouette Score   : {sil_scores[optimal_k]:.4f}")
    print(f"  PCA components     : {n_components}  (≥90 % variance)")

    # Describe regimes based on mean repo rate and yield
    if REPO_RATE_COL in df.columns:
        repo_mean = df.groupby("regime_label")[REPO_RATE_COL].mean().sort_values()
        yield_mean = df.groupby("regime_label")[TARGET_COL].mean()
        print(f"\n  Regime Characterisation (sorted by Repo Rate):")
        for r in repo_mean.index:
            n = (df["regime_label"] == r).sum()
            print(f"    Regime {r}:  Avg Repo Rate = {repo_mean[r]:.2f} %  |  "
                  f"Avg WACMR = {yield_mean[r]:.2f} %  |  {n} weeks")

    print(f"\n  Plots saved:")
    print(f"    {sil_path}")
    print(f"    {scatter_path}")
    print(f"    {ts_path}")
    print("=" * 70)


if __name__ == "__main__":
    run_stage3()
