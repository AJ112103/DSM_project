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
PROJECT_DIR = Path(__file__).resolve().parent.parent
DOWNLOAD_DIR = PROJECT_DIR / "data/raw/ndap"
DOWNLOAD_DIR.mkdir(exist_ok=True)

# The base API URLs provided by the user, we will strip `&pageno=X` and append it dynamically
API_ENDPOINTS = [
    {
        "name": "RBI_Weekly_Statistics_Weekly_Aggregates",
        "url": "https://loadqa.ndapapi.com/v1/openapi?API_Key=gAAAAABpy2PW9Orcet0i2dTV34X8oFhD31-dMIxGbDiy3IisQRLKPdEWn9yUOEEHI-8JyJsne2Dj5P-XAqhGKyXl2EUr57_pTkWxS4y_8E3xw_m2DUSk6K3aPLiloelG76zrB6ONN7Qgmp2jgksXbV9xLBl8WdkIcIbzol8gPXKtR7rMy3lWgiHTiQpHBLhYJKHpfq301K56u3bJW6x4HmtWYWN-hFV6gA==&ind=I7494_5,I7494_6,I7494_7&dim=Country,Year,Month,CalendarDay"
    },
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
        "name": "Commercial_Paper_Details",
        "url": "https://loadqa.ndapapi.com/v1/openapi?API_Key=gAAAAABpy2gy-Vbb6mfUuVgE7sVs40Y8hscxX6c6u7O9RQu4wwhBHfqHsKtW0f0wLLgtsegGA0LDnNCK-yRWFs0VELt6Eb3fELAvcaAoaed3_Eg9I0ZMO3ybUPkE6Yhw7nqkyKUorx-8y3zzoBUtf1y1q9pgR2eHOffaNw19jRXot3RcOslAGdYKuX7YS97OmVc4hJaPAMPv1oNmisqngoKrFGrLuYD8mQ==&ind=I7505_5,I7505_6,I7505_7,I7505_8&dim=Country,Year,Month,D7505_4"
    },
    # 
    # 
    {
        "name": "Treasury_Bills_Details",
        "url": "https://loadqa.ndapapi.com/v1/openapi?API_Key=gAAAAABpy2hH98xgirlGFsLmFuHc06Jl45KJbYqcn2tYP6D_o2UqLXHn3KA7HmXF02cbem3d51W9GgbqPl3jU9i9gScYZyoJsHAoe_g1r23c1A3tkwHe1cmxQnETlfUOSUTfiKFX3Ckje8VlUdAqnOsCf5gQdepXl9vzlZJLgdpx22ycGw53WPtGUYkhACpC3VlSX67X4doDKS-9y5QpfFy9Z5nIP3d_MA==&ind=I7504_7,I7504_8,I7504_9,I7504_10&dim=Country,Year,Quarter,Month,WeekCode,Week,D7504_6"
    },
    # 
    # 
    {
        "name": "Central_Government_Dated_Securities",
        "url": "https://loadqa.ndapapi.com/v1/openapi?API_Key=gAAAAABpy2hYrDSLLgyIKv3GU4vYl6CEB65teOFCjEdXFJErYmIzqAwwExO1-hbE6I-9j1kgVaONoKvytK5d_sv4fJfVcV5R8UnQt3WTvr7IXyK4Z8icqhAa8mc0t9UllSNVEDUFpYDO9S-uC3sdtUpzvh8kI__dT7vDtvWJemj8VYs4RmSJGf21_gEiaA6GUh4ejDhKhSFFcqFNq66oVwfE6z4c5jIccw==&ind=I7503_6,I7503_7,I7503_8,I7503_9,I7503_10&dim=Country,Year,Quarter,Month,WeekCode,Week"
    },
    # 
    # 
    {
        "name": "Major_Price_Indices",
        "url": "https://loadqa.ndapapi.com/v1/openapi?API_Key=gAAAAABpy2hspL5YrgRlcuUIEdBepzkjyHYHoAflFZyXBGaCdn2qHboTJ4cEyiAAYp8A2lbUbEufsUyYudTwwk7j6mOVm3yHH5DYElEisNvJ2YbT2__PLgKFILFIZNN1GymSCOy3rNGglxSKQxOh2UvRTvdUZUkuJX_oU9YXxBfkwyROs4SOwyU_eAAkYc9a16ckiyFqK8-cRYYtrgGoVQaHRzRnyUdsow==&ind=I7500_4,I7500_5,I7500_6,I7500_7,I7500_8,I7500_9,I7500_10,I7500_11,I7500_12&dim=Country,Year,Month"
    },
    # 
    # 
    {
        "name": "Market_Repo_Transactions",
        "url": "https://loadqa.ndapapi.com/v1/openapi?API_Key=gAAAAABpy2h10dj2Z1gmBvzFOI_IoAdDPl5yjRZl_ZERs8t4qv5sI7YCJZHucV1kD9n1Kn41K0guNxtpLsMZMAO3b46EUxOvuud7nrw6UdYO4bnsBJUAtXFYtxZC70hzB1mOwmXrdUhfT__ZIo4wOYiTUQfDKdvUwsJLHdpoy4XX04q4KsgOoU8mePdPZrLWogLNEc_Nv2th5lz1HJ9Cm9o0MPZBnRx4lQ==&ind=I7498_6,I7498_7,I7498_8,I7498_9,I7498_10,I7498_11,I7498_12,I7498_13,I7498_14,I7498_15,I7498_16,I7498_17&dim=Country,Year,Quarter,Month,WeekCode,Week"
    }
    # 
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
