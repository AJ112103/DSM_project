#!/usr/bin/env python
"""
Stage 1b — Technical Indicators → master_ohlc.csv
===================================================
Loads the two OHLCV CSVs from data_1/, applies all five custom indicators
to both Nifty 50 and USD/INR, then joins them into a single weekly master
file saved at data/master_ohlc.csv.

Column naming convention in output:
  nifty_{col}    — Nifty 50 OHLCV + indicator columns
  usdinr_{col}   — USD/INR OHLCV + indicator columns

Hyperparameters are fixed here. Do NOT change them between runs.

Run with the anaconda interpreter:
    python stage_1b_technical_indicators.py
"""

import sys
import warnings
import pandas as pd
from pathlib import Path

warnings.filterwarnings("ignore")

# ── Make sure project modules are importable ────────────────────────────────
PROJECT_DIR = Path(__file__).parent
sys.path.insert(0, str(PROJECT_DIR))

from technical_indicators.impulsemacd     import macd          as impulse_macd
from technical_indicators.supertrend      import SuperTrend
from technical_indicators.squeeze         import squeeze_index2
from technical_indicators.tsi             import tsi
from technical_indicators.velocity_indicator import calculate_float as velocity

# ── Paths ────────────────────────────────────────────────────────────────────
DATA1_DIR = PROJECT_DIR / "data_1"
OUT_DIR   = PROJECT_DIR / "data"
OUT_PATH  = OUT_DIR / "master_ohlc.csv"

# ── Window trim (matches NDAP master panel) ──────────────────────────────────
# Keep only rows within this range in the final master_ohlc.csv.
# Data is fetched from 2013-01-01 so all indicator warmup periods (≤49 bars)
# are satisfied before the first row that enters the master.
TRIM_START = pd.Timestamp("2014-01-10")   # NDAP WINDOW_START
TRIM_END   = pd.Timestamp("2024-08-02")   # one day past NDAP WINDOW_END

# ── Fixed Hyperparameters (set once — do not change) ─────────────────────────
#
# ImpulseMACD (Lazy Bear, weekly adaptation)
#   lengthMA=34   : SMMA / ZLEMA period; 34-week ≈ 8 months captures
#                   medium-term monetary cycle momentum
#   lengthSignal=9: Signal line SMA period; standard Impulse MACD default
IMPULSE_MA      = 34
IMPULSE_SIGNAL  = 9

# SuperTrend
#   period=7      : ATR look-back of 7 weeks (1.75 months); responsive
#                   enough to catch regime flips without over-fitting noise
#   multiplier=3.0: Standard multiplier; wider band on weekly bars is
#                   appropriate given larger per-bar price swings
ST_PERIOD       = 7
ST_MULTIPLIER   = 3.0

# Squeeze Index (squeeze_index2)
#   conv=50       : Running max/min smoothing divisor; 50 gives moderate
#                   decay, suitable for weekly volatility cycles
#   length=20     : Pearson-correlation window of 20 weeks (~5 months)
SQ_CONV         = 50
SQ_LENGTH       = 20

# TSI (True Strength Index)
#   fast=13       : Double-EMA fast period (13 weeks ≈ 1 quarter)
#   slow=25       : Double-EMA slow period (25 weeks ≈ 6 months)
#   signal=13     : Signal line EMA; symmetric with fast period
TSI_FAST        = 13
TSI_SLOW        = 25
TSI_SIGNAL      = 13

# Velocity Indicator
#   lookback=14   : Average velocity over 14 prior periods (~3.5 months)
#   ema_length=9  : EMA smoothing of 9 weeks; removes week-to-week noise
VEL_LOOKBACK    = 14
VEL_EMA         = 9

# ── Helper: rename yfinance columns → internal convention ────────────────────
def load_and_rename(csv_path: Path) -> pd.DataFrame:
    df = pd.read_csv(csv_path, index_col="Date", parse_dates=True)
    df = df.rename(columns={
        "Open":   "into",
        "High":   "inth",
        "Low":    "intl",
        "Close":  "intc",
        "Volume": "vol",
    })
    df = df.sort_index()

    # Resample to week-ending Friday to align with RBI/NDAP master panel.
    # OHLCV resample rules: Open=first, High=max, Low=min, Close=last, Vol=sum.
    df = df.resample("W-FRI").agg({
        "into": "first",
        "inth": "max",
        "intl": "min",
        "intc": "last",
        "vol":  "sum",
    }).dropna(how="all")

    df["time"] = df.index          # ImpulseMACD needs a 'time' column
    df = df.reset_index()          # keep Date as a column too
    return df

# ── Apply all indicators to one instrument dataframe ─────────────────────────
def apply_indicators(df: pd.DataFrame) -> pd.DataFrame:
    work = df.copy()

    # 1. ImpulseMACD -----------------------------------------------------------
    im = impulse_macd(work, lengthMA=IMPULSE_MA, lengthSignal=IMPULSE_SIGNAL)
    im = im.rename(columns={"open_time": "Date"})
    work = work.merge(im[["Date", "ImpulseMACD", "ImpulseHisto", "ImpulseMACDCDSignal"]],
                      on="Date", how="left")

    # 2. SuperTrend ------------------------------------------------------------
    st_out = SuperTrend(work, period=ST_PERIOD, multiplier=ST_MULTIPLIER)
    # STX: 'up' → 1, 'down' → -1, 0/NaN (no signal yet) → 0
    stx_raw = st_out["STX"].replace({"up": 1, "down": -1})
    stx_raw = pd.to_numeric(stx_raw, errors="coerce").fillna(0).astype(int)
    work["STX"] = stx_raw.values

    # 3. Squeeze ---------------------------------------------------------------
    sq_work = work.copy().reset_index(drop=True)
    sq_work = squeeze_index2(sq_work, conv=SQ_CONV, length=SQ_LENGTH, col="intc")
    work["psi"] = sq_work["psi"].values

    # 4. TSI -------------------------------------------------------------------
    tsi_out = tsi(work, fast=TSI_FAST, slow=TSI_SLOW, signal=TSI_SIGNAL)
    work["TSI"]  = tsi_out["TSI"].values
    work["TSIs"] = tsi_out["TSIs"].values

    # 5. Velocity --------------------------------------------------------------
    vel_work = work.copy()
    vel_work = velocity(vel_work, lookback=VEL_LOOKBACK, ema_length=VEL_EMA)
    work["velocity"]        = vel_work["velocity"].values
    work["smooth_velocity"] = vel_work["smooth_velocity"].values

    # Drop the internal 'time' helper column
    work = work.drop(columns=["time"], errors="ignore")

    return work

# ── Main ─────────────────────────────────────────────────────────────────────
def main():
    print("Loading OHLCV data ...")
    nifty_raw  = load_and_rename(DATA1_DIR / "Nifty50_Weekly_OHLCV.csv")
    usdinr_raw = load_and_rename(DATA1_DIR / "USDINR_Weekly_OHLCV.csv")

    print(f"  Nifty  : {nifty_raw.shape[0]} rows")
    print(f"  USD/INR: {usdinr_raw.shape[0]} rows")

    print("\nApplying indicators to Nifty 50 ...")
    nifty_ind  = apply_indicators(nifty_raw)

    print("Applying indicators to USD/INR ...")
    usdinr_ind = apply_indicators(usdinr_raw)

    # Prefix all non-Date columns with instrument name
    nifty_ind  = nifty_ind.rename(columns={c: f"nifty_{c}"  for c in nifty_ind.columns  if c != "Date"})
    usdinr_ind = usdinr_ind.rename(columns={c: f"usdinr_{c}" for c in usdinr_ind.columns if c != "Date"})

    # Merge on Date (inner join — both instruments must have a row for the week)
    print("\nMerging ...")
    master = pd.merge(nifty_ind, usdinr_ind, on="Date", how="inner")
    master = master.sort_values("Date").reset_index(drop=True)

    # ── Trim: drop warmup rows, then restrict to NDAP window ─────────────────
    # Drop any row where ANY indicator column is still NaN (warmup artefacts)
    indicator_cols = [c for c in master.columns if c != "Date"]
    before = len(master)
    master = master.dropna(subset=indicator_cols)
    print(f"  Dropped {before - len(master)} warmup rows with NaN indicators")

    # Restrict to NDAP golden window
    master = master[(master["Date"] >= TRIM_START) & (master["Date"] <= TRIM_END)]
    master = master.reset_index(drop=True)
    print(f"  Trimmed to NDAP window ({TRIM_START.date()} → {TRIM_END.date()}): {len(master)} rows remain")

    # Save
    OUT_DIR.mkdir(exist_ok=True)
    master.to_csv(OUT_PATH, index=False)

    print(f"\nSaved : {OUT_PATH}")
    print(f"Shape : {master.shape}")
    print(f"Window: {master['Date'].min()}  →  {master['Date'].max()}")
    print(f"\nColumns ({len(master.columns)}):")
    for col in master.columns:
        nn = master[col].notna().sum()
        print(f"  {col:<40}  {nn}/{len(master)} non-null")


if __name__ == "__main__":
    main()
