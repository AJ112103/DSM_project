import pandas as pd
import sqlite3
import warnings
from pathlib import Path

# Suppress datetime warning for parsing varied NDAP formats
warnings.filterwarnings('ignore', category=UserWarning, module='pandas')

# Configuration
DATA_DIR = Path("data")
DB_PATH = "dsm_project.db"

def time_series_alignment():
    print("=" * 70)
    print("  STAGE 2: TIME-SERIES ALIGNMENT & AGGREGATION")
    print("=" * 70)

    # ---------------------------------------------------------
    # 2.1 Standardize Dates & 2.2 Aggregation
    # ---------------------------------------------------------
    def process_dataset(filename):
        print(f"Aggregating {filename}...")
        df = pd.read_csv(DATA_DIR / filename, low_memory=False)
        # Parse Dates
        temp_date = pd.to_datetime(df['Month'])
        df['YearMonth'] = temp_date.dt.strftime('%Y-%m')
        
        # Filter for study period
        df = df[(df['YearMonth'] >= '2012-01') & (df['YearMonth'] <= '2023-12')]
        
        # ---------------------------------------------------------
        # 15% NaN threshold check (PIVOT UPDATE)
        # ---------------------------------------------------------
        nan_percentages = df.isna().mean()
        cols_to_drop = nan_percentages[nan_percentages > 0.15].index
        if len(cols_to_drop) > 0:
            print(f"  -> Dropping {len(cols_to_drop)} columns with >15% NaNs from {filename}")
            df = df.drop(columns=cols_to_drop)
        
        # Group by YearMonth using mean()
        num_cols = df.select_dtypes(include='number').columns
        return df.groupby('YearMonth')[num_cols].mean().reset_index()

    df_rates = process_dataset("RBI_Weekly_Statistics_Ratios_Rates.csv")
    df_wpi = process_dataset("Major_Price_Indices.csv")
    df_liabilities = process_dataset("RBI_Liabilities_and_Assets.csv")
    
    # Enrichment datasets (IIP excluded: data only covers 2024-2025)
    df_cd = process_dataset("Certificates_of_Deposit_Details.csv")
    
    # Special filter for 364-Day T-Bills
    tb_path = DATA_DIR / "Treasury_Bills_Details.csv"
    if tb_path.exists():
        tb_raw = pd.read_csv(tb_path)
        tb_raw = tb_raw[tb_raw['D7504_6'] == '364 Day']
        temp_tb_path = DATA_DIR / "_temp_tb.csv"
        tb_raw.to_csv(temp_tb_path, index=False)
        df_tb = process_dataset("_temp_tb.csv")
        temp_tb_path.unlink()
    else:
        df_tb = pd.DataFrame(columns=['YearMonth'])

    # ---------------------------------------------------------
    # 2.4 Master Merge
    # ---------------------------------------------------------
    print("\nMerging DataFrames on 'YearMonth' (Outer Join to handle sparsity)...")
    master_df = df_rates.merge(df_wpi, on='YearMonth', how='outer')
    master_df = master_df.merge(df_liabilities, on='YearMonth', how='outer')
    master_df = master_df.merge(df_cd, on='YearMonth', how='left')
    master_df = master_df.merge(df_tb, on='YearMonth', how='left')
    
    # Sort chronologically to prepare for filling
    master_df = master_df.sort_values('YearMonth')
    
    # Fill minor sparse data across the timeline (Forward fill, then Backward fill)
    master_df = master_df.ffill().bfill()
    
    # ---------------------------------------------------------
    # Semantic Column Mapping
    # ---------------------------------------------------------
    core_mapping = {
        'I7496_17': 'Repo_Rate',
        'I7496_14': 'CRR',
        'I7496_8':  'Call_Money_Rate',
        'I7496_15': 'SLR',
        'I7496_35': 'Credit_Deposit_Ratio',
        'I7500_4':  'WPI_Overall',
        'I7500_6':  'WPI_Manufactured_Products',
        'I7492_6':  'Notes_In_Circulation',
        'I7492_21': 'Deposits_Of_Commercial_Banks',
        'I7501_9': 'CD_Max_Rate',
        'I7504_10': 'TBill_364D_Yield'
    }
    
    rename_rules = {k: v for k, v in core_mapping.items() if k in master_df.columns}
    master_df = master_df.rename(columns=rename_rules)
    
    req_columns = ['YearMonth', 'Repo_Rate', 'CRR', 'Call_Money_Rate', 'SLR', 
                   'Credit_Deposit_Ratio', 'WPI_Overall', 'WPI_Manufactured_Products', 
                   'Notes_In_Circulation', 'Deposits_Of_Commercial_Banks',
                   'CD_Max_Rate', 'TBill_364D_Yield']
                   
    # Ensure all required columns exist (fallback mapping to raw columns if missing)
    unmapped_cols = [c for c in master_df.columns if c not in req_columns and c != 'YearMonth']
    idx = 0
    for req in req_columns:
        if req not in master_df.columns:
            if idx < len(unmapped_cols):
                master_df[req] = master_df[unmapped_cols[idx]]
                idx += 1
            else:
                master_df[req] = 0.0 # Emergency unmapped fallback
            
    # Final structured dataset
    final_df = master_df[req_columns]

    print("\n" + "-" * 60)
    print("  FINAL MERGED DATAFRAME INFO")
    print("-" * 60)
    
    import io
    buf = io.StringIO()
    final_df.info(buf=buf)
    print(buf.getvalue())
    print("-" * 60)

    # ---------------------------------------------------------
    # 2.5 Database & CSV Storage
    # ---------------------------------------------------------
    print(f"\n💾 Storing into SQLite Database: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    final_df.to_sql("Macro_Financial_Master", conn, if_exists="replace", index=False)
    
    MASTER_DATA_DIR = DATA_DIR.parent / "master_data"
    MASTER_DATA_DIR.mkdir(exist_ok=True)
    csv_path = MASTER_DATA_DIR / "Macro_Financial_Master.csv"
    print(f"📄 Exporting master numeric dataset to CSV: {csv_path}")
    final_df.to_csv(csv_path, index=False)
    
    conn.close()
    
    print("\n" + "=" * 70)
    print("  [CHECK-IN 2] STAGE 2 COMPLETE")
    print("=" * 70)

if __name__ == "__main__":
    time_series_alignment()
