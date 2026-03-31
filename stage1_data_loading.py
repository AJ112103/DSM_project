import pandas as pd
import numpy as np
from pathlib import Path

# Configuration
DATA_DIR = Path("data")

# The 4 requested datasets
TARGET_FILES = [
    "RBI_Weekly_Statistics_Ratios_Rates.csv",
    "Major_Price_Indices.csv",
    "Bank_Credit_and_Investments.csv",
    "RBI_Liabilities_and_Assets.csv"
]

def load_and_filter():
    print("=" * 70)
    print("  STAGE 1: DATA LOADING & SEMANTIC COLUMN MAPPING")
    print("=" * 70)

    for filename in TARGET_FILES:
        filepath = DATA_DIR / filename
        if not filepath.exists():
            print(f"❌ File missing: {filename}")
            continue
            
        print(f"\n📂 Loading {filename} ...")
        
        # Load CSV
        df = pd.read_csv(filepath, low_memory=False)
        original_shape = df.shape
        
        # We need a robust way to extract the date to filter between 2012 and 2023.
        # Most NDAP datasets have a 'Month' column with format "Jan, 2018" or "January, 2018"
        # Others might have 'Year' column like "Calendar Year (Jan - Dec), 2018"
        
        if 'Month' in df.columns:
            # Parse 'Month' column to datetime. 
            # E.g., "August, 2020" -> 2020-08-01
            try:
                temp_date = pd.to_datetime(df['Month'])
                # Filter between Jan 2012 and Dec 2023
                mask = (temp_date >= '2012-01-01') & (temp_date <= '2023-12-31')
                df = df[mask].copy()
                filter_method = "Filtered via 'Month' column (2012-2023)"
            except Exception as e:
                filter_method = f"Failed to parse 'Month' dates: {e}"
        elif 'Year' in df.columns:
            # Try to extract the 4-digit year from the string
            try:
                extracted_year = df['Year'].astype(str).str.extract(r'(\d{4})')[0].astype(float)
                mask = (extracted_year >= 2012) & (extracted_year <= 2023)
                df = df[mask].copy()
                filter_method = "Filtered via 'Year' column extraction (2012-2023)"
            except Exception as e:
                filter_method = f"Failed to parse 'Year': {e}"
        else:
            filter_method = "No recognized date column to filter."
        
        print(f"  ↳ Initial Shape: {original_shape}")
        print(f"  ↳ {filter_method}")
        print(f"  ↳ Filtered Shape: {df.shape}")
        
        print("-" * 50)
        print("  EXACT COLUMN NAMES (For Semantic Mapping):")
        cols = df.columns.tolist()
        for idx, col in enumerate(cols):
            print(f"    {idx+1}. {col}")
            
    print("\n" + "=" * 70)
    print("  [CHECK-IN 1] STAGE 1 COMPLETE")
    print("=" * 70)

if __name__ == "__main__":
    load_and_filter()
