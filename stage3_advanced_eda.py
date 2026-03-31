import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from pathlib import Path

import sqlite3

# Paths
DB_PATH = Path("dsm_project.db")
MASTER_CSV = Path("master_data/Macro_Financial_Master.csv")
VIS_DIR = Path("visualizations")
VIS_DIR.mkdir(exist_ok=True)

def run_stage3():
    print("=" * 70)
    print("  STAGE 3: ADVANCED EDA & K-MEANS CLUSTERING")
    print("=" * 70)
    
    # Load Master Data from Database
    print(f"📂 Accessing SQLite database {DB_PATH} directly instead of backup CSV...")
    conn = sqlite3.connect(DB_PATH)
    df = pd.read_sql("SELECT * FROM Macro_Financial_Master", conn)
    
    # ---------------------------------------------------------
    # 3.1 EDA Visuals (PIVOT UPDATE)
    # ---------------------------------------------------------
    print("Generating dual-axis visualization: Repo Rate vs Credit-Deposit Ratio...")
    fig, ax1 = plt.subplots(figsize=(12, 6))
    
    # Convert YearMonth for continuous plotting
    x_dates = pd.to_datetime(df['YearMonth'])
    
    # Axis 1 (Left)
    ax1.set_xlabel('Time (Months)', fontsize=11, fontweight='bold')
    ax1.set_ylabel('Policy Repo Rate (%)', color='tab:red', fontsize=11, fontweight='bold')
    ax1.plot(x_dates, df['Repo_Rate'], color='tab:red', linewidth=2.5, label='Repo Rate')
    ax1.tick_params(axis='y', labelcolor='tab:red')
    
    # Axis 2 (Right)
    ax2 = ax1.twinx()
    ax2.set_ylabel('Credit-Deposit Ratio', color='tab:blue', fontsize=11, fontweight='bold')
    ax2.plot(x_dates, df['Credit_Deposit_Ratio'], color='tab:blue', linewidth=2, linestyle='--', alpha=0.8, label='C-D Ratio')
    ax2.tick_params(axis='y', labelcolor='tab:blue')
    
    plt.title('Macroeconomic Response: Strict Monetary Tightening vs Credit-Deposit Ratio', fontsize=14, fontweight='bold', pad=15)
    plt.grid(axis='x', alpha=0.3)
    fig.tight_layout()
    
    plot_path = VIS_DIR / "repo_vs_cd_ratio.png"
    plt.savefig(plot_path, dpi=300, bbox_inches='tight')
    plt.close()
    print(f"✅ Saved plot to: {plot_path}")
    
    # ---------------------------------------------------------
    # 3.2 Clustering Feature Selection
    # ---------------------------------------------------------
    print("\nExecuting K-Means Clustering on Macroeconomic Features...")
    clustering_features = ['Repo_Rate', 'CRR', 'WPI_Overall', 'Call_Money_Rate']
    
    X = df[clustering_features].copy()
    
    # Structural Standardization for multidimensional Euclidean equivalency
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    # ---------------------------------------------------------
    # 3.3 K-Means Execution
    # ---------------------------------------------------------
    # k=3 regimes to partition historical timeline
    kmeans = KMeans(n_clusters=3, random_state=42, n_init=10)
    df['Macro_Regime_Cluster'] = kmeans.fit_predict(X_scaled)
    
    # ---------------------------------------------------------
    # 3.3.1 K-Means Cluster Visualization
    # ---------------------------------------------------------
    print("Generating K-Means Regime Scatter Plot visualization...")
    plt.figure(figsize=(10, 6))
    
    # We map colors manually to maintain consistency across runs if possible, or just use a palette
    palette = sns.color_palette("Set1", n_colors=3)
    sns.scatterplot(
        data=df, 
        x='Repo_Rate', 
        y='WPI_Overall', 
        hue='Macro_Regime_Cluster', 
        palette=palette,
        s=100,
        alpha=0.8,
        edgecolor='black'
    )
    
    plt.title("K-Means Macroeconomic Regimes (k=3)\nPolicy Repo Rate vs. Wholesale Inflation", fontsize=14, fontweight='bold', pad=15)
    plt.xlabel("Policy Repo Rate (%)", fontsize=11, fontweight='bold')
    plt.ylabel("WPI Overall (Inflation Benchmark)", fontsize=11, fontweight='bold')
    plt.grid(True, alpha=0.3)
    
    # Customizing the legend to imply theoretical labels
    handles, labels = plt.gca().get_legend_handles_labels()
    plt.legend(handles, ['Regime 0', 'Regime 1', 'Regime 2'], title="Macro Cluster")
    
    cluster_plot_path = VIS_DIR / "kmeans_macro_clusters.png"
    plt.savefig(cluster_plot_path, dpi=300, bbox_inches='tight')
    plt.close()
    print(f"✅ Saved K-Means scatter plot to: {cluster_plot_path}")
    
    # Save back to CSV for explicit Stage 4 RF modeling
    df.to_sql("Macro_Financial_Master", conn, if_exists="replace", index=False)
    df.to_csv(MASTER_CSV, index=False)
    print(f"✅ K-Means Model deployed. Overwrote SQLite DB and {MASTER_CSV} to include 'Macro_Regime_Cluster' numeric label.")
    
    # ---------------------------------------------------------
    # 3.4 Cluster Profiling
    # ---------------------------------------------------------
    print("\n" + "-" * 60)
    print("  MACROECONOMIC REGIME CLUSTER PROFILING")
    print("-" * 60)
    
    # Group by cluster and calculate mean of fundamental variables representing the thesis
    profile_features = clustering_features + ['Credit_Deposit_Ratio']
    
    # Append counting aggregation to understand regime duration lengths
    profiles = df.groupby('Macro_Regime_Cluster')[profile_features].mean()
    profiles['Total_Months'] = df['Macro_Regime_Cluster'].value_counts()
    
    # Sort for visual inspection primarily by monetary tightness (Repo Rate)
    profiles = profiles.sort_values(by='Repo_Rate', ascending=False).round(4)
    
    print(profiles.to_string())
    print("-" * 60)
    print("\n" + "=" * 70)
    print("  [CHECK-IN 3] STAGE 3 COMPLETE")
    print("=" * 70)
    
    conn.close()

if __name__ == "__main__":
    run_stage3()
