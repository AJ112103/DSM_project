"""
Stage 1.2 — NDAP API Data Fetcher (Auto-Paginating)

This script uses direct NDAP API URLs provided by the user to download 
the target datasets. It has been upgraded to automatically paginate through 
all available pages (pageno=1, 2, 3...) until no more data is returned,
then combines them and outputs flat CSVs.

Usage:
    python stage1_fetch_api_ndap.py
"""

import os
import re
import requests
import pandas as pd
from pathlib import Path

# ── Configuration ───────────────────────────────────────────────────────────
PROJECT_DIR = Path(__file__).parent
DOWNLOAD_DIR = PROJECT_DIR / "data"
DOWNLOAD_DIR.mkdir(exist_ok=True)

# The base API URLs provided by the user, we will strip `&pageno=X` and append it dynamically
API_ENDPOINTS = [
    # 
    {
        "name": "RBI_Liabilities_and_Assets",
        "url": "https://loadqa.ndapapi.com/v1/openapi?API_Key=gAAAAABpy2PI8oaNotaSPoGQuTgOEb_nbu0ITFRQkMAzmmVoSL2IVoIn2HMXLUJlrcPWl6Hday7qFZzdg5p6v3YxeIhYGRLx-pLr17T0sOThPlgThKMBNezKmRgcGDVg-dmeIz7bBPxMefBE0k6EFmnJ36n7yfqFml7kPUtReWMv4ggGu5-clUUjixesY1Ew2RmWxZ98P9Rv8ctBCK7fx2DPB8UXC1AMow==&ind=I7492_6,I7492_7,I7492_8,I7492_9,I7492_10,I7492_11,I7492_12,I7492_13,I7492_14,I7492_15,I7492_16,I7492_17,I7492_18,I7492_19,I7492_20,I7492_21,I7492_22,I7492_23,I7492_24,I7492_25,I7492_26,I7492_27,I7492_28,I7492_29,I7492_30,I7492_31,I7492_32,I7492_33,I7492_34,I7492_35,I7492_36,I7492_37,I7492_38&dim=Country,Year,Quarter,Month,WeekCode,Week"
    },
    # 
    # 
    {
        "name": "RBI_Weekly_Statistics_Ratios_Rates",
        "url": "https://loadqa.ndapapi.com/v1/openapi?API_Key=gAAAAABpy2QGRXF7QwGO5ONV9Q7iCNe9i6S6ysVl3h50Hbm9WOfssRoqbynUKxzUGCTqnk13MPYLPhUsG4MdyPQN9gcr0P-x9KCGZsM_3wWvn_jcd0NlJeaXLnPZ8F4agnq2jh0fOZbjOoyB_HLOHLRTVoR03sKEJVtaiGa9VVBjsG3uzBznyytjUfqk6grDUd50LQ9-hl5vEhKhzw-i93fLMtcD2CZt2g==&ind=I7496_5,I7496_6,I7496_7,I7496_8,I7496_9,I7496_10,I7496_11,I7496_12,I7496_13,I7496_14,I7496_15,I7496_16,I7496_17,I7496_18,I7496_19,I7496_20,I7496_21,I7496_26,I7496_27,I7496_28,I7496_29,I7496_30,I7496_31,I7496_32,I7496_33,I7496_34,I7496_35&dim=Country,Year,Month,CalendarDay,D7496_22,D7496_23,D7496_24,D7496_25"
    },
    # 
    # 
    {
        "name": "Bank_Credit_and_Investments",
        "url": "https://loadqa.ndapapi.com/v1/openapi?API_Key=gAAAAABpy2RDlCtsWCVfdZrQtqM2nOMi6XOvgrhqAyCkH6SsR0xLsWMeZ2T5FR75wE8hSCci2YUQ7P4lt5z8YdP8klpYlwUEKMXYiVseUorURgDpkymLpPfdChu435GrqRD0B3rhtWXcqZ-jFvzpLaOT0eb1jzu2Ml5Jk-dWfr9L2T_ByzFcjN0XlM1GZMMpZpUlHe-LIIQZZH13f8PO2yAR6J32pScsCw==&ind=I6725_5,I6725_6,I6725_7,I6725_8,I6725_9,I6725_10,I6725_11,I6725_12,I6725_13,I6725_14,I6725_15,I6725_16,I6725_17,I6725_18,I6725_19,I6725_20,I6725_21&dim=Country,Year,Month,D6725_4"
    },
    # 
    # 
    {
        "name": "Major_Price_Indices",
        "url": "https://loadqa.ndapapi.com/v1/openapi?API_Key=gAAAAABpy2hspL5YrgRlcuUIEdBepzkjyHYHoAflFZyXBGaCdn2qHboTJ4cEyiAAYp8A2lbUbEufsUyYudTwwk7j6mOVm3yHH5DYElEisNvJ2YbT2__PLgKFILFIZNN1GymSCOy3rNGglxSKQxOh2UvRTvdUZUkuJX_oU9YXxBfkwyROs4SOwyU_eAAkYc9a16ckiyFqK8-cRYYtrgGoVQaHRzRnyUdsow==&ind=I7500_4,I7500_5,I7500_6,I7500_7,I7500_8,I7500_9,I7500_10,I7500_11,I7500_12&dim=Country,Year,Month"
    },
    # 
    {
        "name": "Financial_Indicator_Monthly_4660",
        "url": "https://loadqa.ndapapi.com/v1/openapi?API_Key=gAAAAABpy2SCpA-5AWjHMEN-Ki5l72q3JObke7_10ktWDf2k7fbOog-AkjgSMTT4r0bcIO-yViEI0DAPVLXmGmy07pqelUPVVl2Hmw0i5NR5gSZEJHFnbfqwPDLLz49bfpPEjwqMGEodwpCicTeIG8bgmzXk-qvTQZV72GCmUVQdV3kj063Aqa8VWNv5JaobZYWEgbYUnyxWH1rgTfoA3xREE6d_im-1iw==&ind=I4660_13&dim=Country,Year,Month,D4660_4,D4660_5,D4660_6,D4660_7,D4660_8,D4660_9,D4660_10,D4660_11,D4660_12"
    },
    {
        "name": "Certificates_of_Deposit_Details",
        "url": "https://loadqa.ndapapi.com/v1/openapi?API_Key=gAAAAABpy2hhSzaOtw34cT1vb2XTO_al7MOUOLK34bMe4oGxHi5b122c4PAxVN42FX6IBtLXo-KaQbCx_KfH3yrXg45H8iRbt7ASXYr85v7OztR_00Krt99cOokyYKQ1gGWFUA9FNzvbOtvA3DOqwFBDfM3s_OMi9nGHv1jTrWNW56CyAenr9FVkGJgnPuYMUF_JqN1CeMiSq55jTQB6wK1VVkta5Tv5sw==&ind=I7501_6,I7501_7,I7501_8,I7501_9&dim=Country,Year,Quarter,Month,FortnightCode,Fortnight"
    },
    {
        "name": "Treasury_Bills_Details",
        "url": "https://loadqa.ndapapi.com/v1/openapi?API_Key=gAAAAABpy2hH98xgirlGFsLmFuHc06Jl45KJbYqcn2tYP6D_o2UqLXHn3KA7HmXF02cbem3d51W9GgbqPl3jU9i9gScYZyoJsHAoe_g1r23c1A3tkwHe1cmxQnETlfUOSUTfiKFX3Ckje8VlUdAqnOsCf5gQdepXl9vzlZJLgdpx22ycGw53WPtGUYkhACpC3VlSX67X4doDKS-9y5QpfFy9Z5nIP3d_MA==&ind=I7504_7,I7504_8,I7504_9,I7504_10&dim=Country,Year,Quarter,Month,WeekCode,Week,D7504_6"
    },
]

def clean_url(url):
    """Remove any `&pageno=X` from the URL string."""
    return re.sub(r"&pageno=\d+", "", url)

def fetch_all_data():
    print("=" * 60)
    print("  NDAP DATASET MATCHER (AUTO-PAGINATING API)")
    print("=" * 60)
    print(f"  Saving to: {DOWNLOAD_DIR.resolve()}")
    print("-" * 60)
    
    for item in API_ENDPOINTS:
        name = item["name"]
        base_url = clean_url(item["url"])
        
        print(f"\n📥 Fetching: {name}")
        
        all_rows = []
        page = 1
        while True:
            paginated_url = f"{base_url}&pageno={page}"
            try:
                response = requests.get(paginated_url, timeout=30)
                response.raise_for_status()
                data = response.json()
                
                # NDAP openAPI response has 'Data' array
                if "Data" in data and isinstance(data["Data"], list):
                    raw_data = data["Data"]
                elif "data" in data and isinstance(data["data"], list):
                    raw_data = data["data"]
                else:
                    raw_data = data
                
                if not raw_data:
                    break # No more data returned
                    
                all_rows.extend(raw_data)
                print(f"    ↳ Fetched Page {page} ({len(raw_data)} rows)")
                
                # If the returned rows are less than 1000, it's the last page
                if len(raw_data) < 1000:
                    break
                    
                page += 1
                
            except Exception as e:
                print(f"  ❌ Error fetching {name} Page {page}: {e}")
                break

        if not all_rows:
            print(f"  ⚠️  No data returned for {name}")
            continue
            
        df = pd.DataFrame(all_rows)
        
        # The API returns numeric columns as dicts: {'avg': X, 'max': Y, 'min': Z}
        # We must flatten these before saving. Usually, taking 'avg' or 'sum' makes sense.
        for col in df.columns:
            if df[col].apply(lambda x: isinstance(x, dict)).any():
                def extract_val(d):
                    if not isinstance(d, dict): return d
                    for k in ['avg', 'sum', 'value', 'max', 'min']:
                        if k in d: return d[k]
                    return list(d.values())[0] if d else None
                    
                df[col] = df[col].apply(extract_val)
            
        save_path = DOWNLOAD_DIR / f"{name}.csv"
        df.to_csv(save_path, index=False)
        
        size_kb = save_path.stat().st_size / 1024
        print(f"  ✅ Complete! Saved: {name}.csv ({size_kb:.1f} KB, Total: {len(df)} rows)")

    # Clean up any leftover _P2 files if they exist from previous runs
    old_p2 = DOWNLOAD_DIR / "RBI_Liabilities_and_Assets_P2.csv"
    if old_p2.exists():
        old_p2.unlink()
        
    print("\n" + "=" * 60)
    print("  🎉 AUTO-PAGINATING API FETCH COMPLETE")
    print("=" * 60)

if __name__ == "__main__":
    fetch_all_data()
