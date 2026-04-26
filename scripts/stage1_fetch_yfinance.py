"""
Stage 1 (Supplement) — Yahoo Finance OHLCV Fetcher
=====================================================
Fetches weekly OHLCV data for:
  - Nifty 50       (^NSEI)    — equity market sentiment
  - USD/INR        (USDINR=X) — forex / RBI FX intervention proxy

Window : 2014-01-01 → 2024-08-01  (matches master panel Feb 2014 – Jul 2024)
Output : data/raw/yfinance/Nifty50_Weekly_OHLCV.csv
         data/raw/yfinance/USDINR_Weekly_OHLCV.csv

After this step, add your technical indicators and save the enriched
files into data/ — then signal to proceed with stage 2 onwards.

Usage:
    python stage_1_yfin.py
"""

import pandas as pd
import yfinance as yf
from pathlib import Path

# ── Config ───────────────────────────────────────────────────────────────────

PROJECT_DIR = Path(__file__).resolve().parent.parent
OUT_DIR = PROJECT_DIR / "data/raw/yfinance"
OUT_DIR.mkdir(exist_ok=True)

START = "2013-01-01"   # 52-week buffer before window for indicator warmup
END   = "2024-08-01"

TICKERS = {
    "Nifty50_Weekly_OHLCV": "^NSEI",
    "USDINR_Weekly_OHLCV":  "USDINR=X",
}

# ── Fetch & Save ─────────────────────────────────────────────────────────────

for filename, ticker in TICKERS.items():
    print(f"Fetching {ticker} ...")
    df = yf.download(
        ticker,
        start=START,
        end=END,
        interval="1wk",
        progress=False,
        auto_adjust=True,   # adjusts for splits/dividends where applicable
    )

    # yfinance returns a MultiIndex column when auto_adjust=True; flatten it
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = [col[0] for col in df.columns]

    df.index.name = "Date"
    df = df[["Open", "High", "Low", "Close", "Volume"]]

    out_path = OUT_DIR / f"{filename}.csv"
    df.to_csv(out_path)

    print(f"  Saved : {out_path}")
    print(f"  Shape : {df.shape}  ({df.index.min().date()} → {df.index.max().date()})")
    print(f"  NaNs  : {df.isnull().sum().to_dict()}")
    print()

print("Done. Add technical indicators and copy enriched files to data/ when ready.")
