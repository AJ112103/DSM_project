"""
Regenerate shap_by_regime.png from cached artefacts with a corrected subtitle.

The original subtitle on this figure ("Proving mechanical MSF-dominance (tight)
vs Reverse-Repo-dominance (surplus)") described an a-priori hypothesis that the
underlying data does not actually support: in the cached SHAP matrix the
Reverse Repo Rate sits higher in the SHAP ranking inside the tightening
regime (rank 9) than inside the accommodation regime (rank 12), and all SHAP
magnitudes are roughly twice as large inside Accommodation due to
autoregressive dominance.

This regenerator reads the cached SHAP values, regime labels, and feature
names, and re-emits the same plot with a subtitle that matches what the data
shows. Run with: `python3 scripts/regen_shap_by_regime.py`.
"""
from pathlib import Path
import json
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

ROOT = Path("/Users/dhruvjalan/Desktop/DSM_project")
SAVED = ROOT / "backend" / "ml" / "saved_model"
MASTER_CSV = ROOT / "data" / "processed" / "Weekly_Macro_Master.csv"

shap_values = np.load(SAVED / "shap_values.npy")
with open(SAVED / "feature_names.json") as f:
    feat_names = json.load(f)
pca = pd.read_csv(SAVED / "pca_coordinates.csv")
master = pd.read_csv(MASTER_CSV)

merged = pd.merge(
    master[["week_date"]].reset_index(),
    pca[["week_date", "regime_label"]],
    on="week_date",
    how="left",
).sort_values("index")
assert merged["regime_label"].isna().sum() == 0, "regime label join failed"
regime_labels = merged["regime_label"].values

assert shap_values.shape == (545, 117), f"unexpected SHAP shape {shap_values.shape}"
assert len(feat_names) == 117, f"unexpected feature count {len(feat_names)}"

fig, axes = plt.subplots(1, 2, figsize=(18, 8))
fig.suptitle(
    "Regime-Specific SHAP — Top 12 Features per Monetary Regime\n"
    "Autoregressive dominance in Accommodation (target_lag1: 0.69); "
    "uniform corridor reliance in Tightening (target_lag1: 0.34)",
    fontsize=13,
    fontweight="bold",
)

regime_top12_results = {}
for ax, (regime_id, label, color) in zip(
    axes,
    [(0, "Regime 0\n(Accommodation)", "#2166ac"),
     (1, "Regime 1\n(Normal/Tightening)", "#d6604d")],
):
    mask = regime_labels == regime_id
    sv = shap_values[mask]
    n = int(mask.sum())

    mean_abs = np.abs(sv).mean(axis=0)
    r_df = (
        pd.DataFrame({"feature": feat_names, "mean_abs_shap": mean_abs})
        .sort_values("mean_abs_shap", ascending=False)
        .head(12)
        .reset_index(drop=True)
    )
    regime_top12_results[regime_id] = r_df

    ax.barh(r_df["feature"][::-1], r_df["mean_abs_shap"][::-1], color=color, alpha=0.80)
    ax.set_title(f"{label}\n({n} weeks)", fontsize=11, fontweight="bold", color=color)
    ax.set_xlabel("Mean |SHAP value|", fontsize=10)
    ax.grid(axis="x", alpha=0.3)
    for j, val in enumerate(r_df["mean_abs_shap"][::-1]):
        ax.text(val * 1.01, j, f"{val:.4f}", va="center", fontsize=8)

plt.tight_layout()

OUT_PATHS = [
    ROOT / "visualizations" / "shap_by_regime.png",
    ROOT / "final" / "visualizations" / "shap_by_regime.png",
    ROOT / "report" / "figures" / "shap_by_regime.png",
]
for p in OUT_PATHS:
    p.parent.mkdir(parents=True, exist_ok=True)
    plt.savefig(p, dpi=300, bbox_inches="tight")
    print(f"Saved: {p}")
plt.close()

rrr_rank = lambda rid: next(
    (i + 1 for i, f in enumerate(regime_top12_results[rid]["feature"]) if "I7496_18" in f),
    "outside top 12",
)
msf_rank = lambda rid: next(
    (i + 1 for i, f in enumerate(regime_top12_results[rid]["feature"]) if "I7496_20" in f),
    "outside top 12",
)
print()
print(f"Reverse Repo rank — Regime 0 (Accommodation): #{rrr_rank(0)} | Regime 1 (Tightening): #{rrr_rank(1)}")
print(f"MSF Rate rank     — Regime 0 (Accommodation): #{msf_rank(0)} | Regime 1 (Tightening): #{msf_rank(1)}")
