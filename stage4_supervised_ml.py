import pandas as pd
import numpy as np
import sqlite3
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
from pathlib import Path

# Paths
DB_PATH = Path("dsm_project.db")
VIS_DIR = Path("visualizations")
VIS_DIR.mkdir(exist_ok=True)

def run_stage4():
    print("=" * 70)
    print("  STAGE 4: SUPERVISED ML (RANDOM FOREST REGRESSION)")
    print("=" * 70)
    
    # ---------------------------------------------------------
    # 4.1 Database Integration
    # ---------------------------------------------------------
    print(f"📂 Accessing SQLite database {DB_PATH} for core Master Table...")
    conn = sqlite3.connect(DB_PATH)
    df = pd.read_sql("SELECT * FROM Macro_Financial_Master", conn)
    conn.close()
    
    # ---------------------------------------------------------
    # 4.2 Feature Engineering & Selection (PIVOT UPDATE)
    # ---------------------------------------------------------
    target_col = 'Credit_Deposit_Ratio'
    
    # 4.2.2 Time-Lag Feature Engineering (Shift by 3 months)
    df = df.sort_values(by="YearMonth").reset_index(drop=True)
    df['Call_Money_Rate_Lag3'] = df['Call_Money_Rate'].shift(3)
    df['WPI_Manufactured_Lag3'] = df['WPI_Manufactured_Products'].shift(3)
    df['CD_Max_Rate_Lag3'] = df['CD_Max_Rate'].shift(3)
    
    # Drop the first 3 months nullified by the temporal shift
    df = df.dropna().reset_index(drop=True)
    
    feature_cols = [
        'Macro_Regime_Cluster',         # from Stage 3
        'SLR', 
        'WPI_Manufactured_Products', 
        'Notes_In_Circulation', 
        'Call_Money_Rate',
        'CD_Max_Rate',
        'TBill_364D_Yield',
        'Call_Money_Rate_Lag3',
        'WPI_Manufactured_Lag3',
        'CD_Max_Rate_Lag3'
    ]
    
    # Isolate dataframe subset and one-hot encode the categorical regime
    model_df = df[feature_cols + [target_col]].copy()
    model_df = pd.get_dummies(model_df, columns=['Macro_Regime_Cluster'], drop_first=False)
    
    # Regenerate X feature list dynamically after OHE
    X = model_df.drop(columns=[target_col])
    y = model_df[target_col]
    
    print(f"\nTarget Variable (y): {target_col}")
    print(f"Feature Matrix (X): {len(X.columns)} explicitly encoded macro indicators")
    
    # ---------------------------------------------------------
    # 4.3 Train-Test Segmentation (Random Split)
    # ---------------------------------------------------------
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )
    
    print(f"Dataset split (random): Train={len(X_train)} months, Test={len(X_test)} months")
    
    # ---------------------------------------------------------
    # 4.4 Model Architecture & Training
    # ---------------------------------------------------------
    print("\nTraining RandomForestRegressor (n_estimators=100)...")
    rf_model = RandomForestRegressor(n_estimators=100, random_state=42, max_depth=10)
    rf_model.fit(X_train, y_train)
    
    # ---------------------------------------------------------
    # 4.5 Evaluation Metrics
    # ---------------------------------------------------------
    y_pred = rf_model.predict(X_test)
    
    mse = mean_squared_error(y_test, y_pred)
    rmse = np.sqrt(mse)
    mae = mean_absolute_error(y_test, y_pred)
    r2 = r2_score(y_test, y_pred)
    
    print("\n" + "-" * 50)
    print("  MODEL EVALUATION RESULTS (TEST SET)")
    print("-" * 50)
    print(f"Root Mean Squared Error (RMSE): {rmse:.4f}")
    print(f"Mean Absolute Error (MAE):      {mae:.4f}")
    print(f"R-Squared (R2) Score:           {r2:.4f}")
    
    # ---------------------------------------------------------
    # 4.6 Feature Importance Visualization (Graphic 1)
    # ---------------------------------------------------------
    print("\nGenerating Graphical Outputs...")
    plt.figure(figsize=(10, 6))
    
    importances = rf_model.feature_importances_
    indices = np.argsort(importances)[::-1]
    
    sorted_features = [X.columns[i] for i in indices]
    sorted_importances = importances[indices]
    
    sns.barplot(x=sorted_importances, y=sorted_features, hue=sorted_features, legend=False, palette="viridis")
    plt.title("Random Forest Gini Feature Importance\n(Drivers of Credit-Deposit Ratio)", fontsize=14, fontweight='bold', pad=15)
    plt.xlabel("Relative Importance Factor", fontsize=11, fontweight='bold')
    plt.ylabel("Macroeconomic Feature", fontsize=11, fontweight='bold')
    plt.grid(axis='x', alpha=0.3)
    
    fi_path = VIS_DIR / "rf_feature_importance.png"
    plt.savefig(fi_path, dpi=300, bbox_inches='tight')
    plt.close()
    print(f"✅ Exported Feature Importance graphic to: {fi_path}")
    
    # ---------------------------------------------------------
    # 4.7 Predictions vs Actuals Visualization (Graphic 2)
    # ---------------------------------------------------------
    plt.figure(figsize=(12, 5))
    
    test_indices = range(len(y_test))
    
    plt.plot(test_indices, y_test.values, label='Actual C-D Ratio', color='black', linewidth=2, marker='o', markersize=4)
    plt.plot(test_indices, y_pred, label='RF Predicted C-D Ratio', color='tab:red', linewidth=2, linestyle='dashed', marker='x', markersize=4)
    
    plt.title("Supervised ML Predictions vs Actual (Test Set Validation)", fontsize=14, fontweight='bold', pad=15)
    plt.xlabel("Test Sample Index", fontsize=11, fontweight='bold')
    plt.ylabel("Credit-Deposit Ratio", fontsize=11, fontweight='bold')
    plt.legend()
    plt.grid(True, alpha=0.3)
    
    pred_path = VIS_DIR / "rf_predictions_vs_actual.png"
    plt.savefig(pred_path, dpi=300, bbox_inches='tight')
    plt.close()
    print(f"✅ Exported Predictions vs Actual graphic to: {pred_path}")
    
    print("\n" + "=" * 70)
    print("  [CHECK-IN 4] STAGE 4 COMPLETE")
    print("=" * 70)

if __name__ == "__main__":
    run_stage4()
