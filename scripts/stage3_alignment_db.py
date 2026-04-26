"""
Stage 2: Data Alignment, EDA & Database Storage
================================================
Golden Window : 2014-01-10 (first Friday) → 2024-07-19 (last Friday before Jul-22)
Target        : 364-Day T-Bill Cut-Off Yield  (tb_I7504_10_364d → target_364d_yield)
Granularity   : Weekly (Friday)
Output        : dsm_project.db  →  table  Weekly_Macro_Master
                data/processed/Weekly_Macro_Master.csv  (backup only)
                visualizations/eda_distributions.png
"""

import pandas as pd
import sqlite3
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import warnings
from pathlib import Path

warnings.filterwarnings("ignore")

# ── Paths & Constants ─────────────────────────────────────────────────────────
DATA_DIR    = Path(__file__).resolve().parent.parent / "data/raw/ndap"
MASTER_DIR  = Path(__file__).resolve().parent.parent / "data/processed"
VIS_DIR     = Path(__file__).resolve().parent.parent / "visualizations"
DB_PATH     = Path(__file__).resolve().parent.parent / "dsm_project.db"
TABLE_NAME  = "Weekly_Macro_Master"
OHLC_PATH   = Path(__file__).resolve().parent.parent / "data/raw/ndap/master_ohlc.csv"   # Nifty50 + USD/INR + technical indicators

WINDOW_START = "2014-01-10"   # First Friday in Jan 2014
WINDOW_END   = "2024-07-19"   # Last full Friday before RBI-LA cutoff

# Columns that FAIL the 75 % density rule in the golden window → drop them
LA_FAIL    = {"I7492_11","I7492_17","I7492_24","I7492_26",
              "I7492_28","I7492_29","I7492_30","I7492_32",
              "I7492_33","I7492_34","I7492_35"}
RATES_FAIL = {"I7496_7","I7496_8","I7496_9","I7496_10",
              "I7496_11","I7496_12","I7496_13","I7496_14",
              "I7496_15","I7496_16","I7496_19"}
CPI_FAIL   = {"I7500_7","I7500_8"}    # WPI series — fail 75 % rule

# Key semantic column references (for feature engineering & plots)
REPO_RATE_COL  = "rates_I7496_17"   # RBI Repo Rate (%)
CP_RATE_COL    = "rates_I7496_30"   # Commercial Paper Rate (%)
MSF_RATE_COL   = "rates_I7496_20"   # Marginal Standing Facility Rate (upper corridor bound)
# TARGET: Weighted Average Call Money Rate (WACMR) — rates_I7496_26
# NOTE: I7504_10 in Treasury Bills is an outstanding AMOUNT (crore), not a yield.
#       The actual cut-off yield is not available in the downloaded CSVs.
#       WACMR is the primary short-term market rate reflecting policy transmission.
TARGET_RAW     = "rates_I7496_26"   # WACMR — becomes target after rename
TARGET_COL     = "target_wacmr"     # Weighted Average Call Money Rate (%)


# ── Helper: snap any date to the nearest FOLLOWING Friday ────────────────────
def snap_to_friday(dt: pd.Timestamp) -> pd.Timestamp:
    """Return the Friday on or immediately after dt."""
    if pd.isna(dt):
        return pd.NaT
    days_ahead = (4 - dt.weekday()) % 7   # Monday=0 … Friday=4
    return dt + pd.Timedelta(days=days_ahead)


# ── WeekCode parsers ──────────────────────────────────────────────────────────
def parse_weekcode_fy(wc) -> pd.Timestamp:
    """Financial-Year WeekCode (YYYYWW).  Year = FY start year, Week 1 = first week of April."""
    try:
        wc   = int(wc)
        year = wc // 100
        week = wc % 100
        base = pd.Timestamp(f"{year}-04-01")
        return snap_to_friday(base + pd.Timedelta(weeks=week - 1))
    except Exception:
        return pd.NaT


def parse_weekcode_cy(wc) -> pd.Timestamp:
    """Calendar-Year WeekCode (YYYYWW).  Week 1 = first week of January."""
    try:
        wc   = int(wc)
        year = wc // 100
        week = wc % 100
        base = pd.Timestamp(f"{year}-01-01")
        return snap_to_friday(base + pd.Timedelta(weeks=week - 1))
    except Exception:
        return pd.NaT


# ── Dataset loaders ───────────────────────────────────────────────────────────
def load_rbi_ratios_rates() -> pd.DataFrame:
    """
    RBI_Weekly_Statistics_Ratios_Rates.csv
    Temporal index : CalendarDay (actual date strings, weekly Fridays)
    Drops          : Dimension columns D7496_22-25, RATES_FAIL columns
    Prefix         : rates_
    """
    df = pd.read_csv(DATA_DIR / "RBI_Weekly_Statistics_Ratios_Rates.csv", low_memory=False)
    df["week_date"] = pd.to_datetime(df["CalendarDay"], errors="coerce")

    # Keep only the indicator columns that pass 75 % rule
    drop_cols = ({"Country","Year","Month","CalendarDay",
                  "D7496_22","D7496_23","D7496_24","D7496_25"} | RATES_FAIL)
    df = df.drop(columns=[c for c in drop_cols if c in df.columns], errors="ignore")
    df = df.dropna(subset=["week_date"])

    num_cols = [c for c in df.columns if c != "week_date"]
    df[num_cols] = df[num_cols].apply(pd.to_numeric, errors="coerce")

    df = df.set_index("week_date").sort_index()
    df = df.resample("W-FRI").last()          # snap to canonical Friday grid
    df = df.loc[WINDOW_START:WINDOW_END]
    return df.add_prefix("rates_")


def load_rbi_la() -> pd.DataFrame:
    """
    RBI_Liabilities_and_Assets.csv
    Temporal index : WeekCode (Financial-Year, YYYYWW)
    Drops          : LA_FAIL columns
    Prefix         : la_
    """
    df = pd.read_csv(DATA_DIR / "RBI_Liabilities_and_Assets.csv", low_memory=False)
    df["week_date"] = df["WeekCode"].apply(parse_weekcode_fy)

    drop_cols = ({"Country","Year","Quarter","Month","WeekCode","Week"} | LA_FAIL)
    df = df.drop(columns=[c for c in drop_cols if c in df.columns], errors="ignore")
    df = df.dropna(subset=["week_date"])

    num_cols = [c for c in df.columns if c != "week_date"]
    df[num_cols] = df[num_cols].apply(pd.to_numeric, errors="coerce")

    df = df.groupby("week_date")[num_cols].mean()   # collapse any duplicate dates
    df = df.resample("W-FRI").last()
    df = df.loc[WINDOW_START:WINDOW_END]
    return df.add_prefix("la_")


def load_rbi_weekly_aggs() -> pd.DataFrame:
    """
    RBI_Weekly_Statistics_Weekly_Aggregates.csv
    Temporal index : CalendarDay  (daily entries with repeated weekly values)
    Columns        : I7494_5 (M3), I7494_6 (M3 Growth Index), I7494_7 (Reserve Money)
    Prefix         : agg_
    """
    df = pd.read_csv(DATA_DIR / "RBI_Weekly_Statistics_Weekly_Aggregates.csv", low_memory=False)
    df["week_date"] = pd.to_datetime(df["CalendarDay"], errors="coerce")
    df = df.dropna(subset=["week_date"])

    keep = [c for c in ["I7494_5","I7494_6","I7494_7"] if c in df.columns]
    df = df[["week_date"] + keep].copy()
    df[keep] = df[keep].apply(pd.to_numeric, errors="coerce")

    # Multiple rows per day share the same value — take last per day, then resample weekly
    df = df.groupby("week_date")[keep].last()
    df = df.resample("W-FRI").last()
    df = df.loc[WINDOW_START:WINDOW_END]
    return df.add_prefix("agg_")


def load_commercial_paper() -> pd.DataFrame:
    """
    Commercial_Paper_Details.csv
    Temporal index : D7505_4 (date string like '06-Jan-2012')
    Prefix         : cp_
    """
    df = pd.read_csv(DATA_DIR / "Commercial_Paper_Details.csv", low_memory=False)
    df["week_date"] = pd.to_datetime(df["D7505_4"], dayfirst=True, errors="coerce")
    df["week_date"] = df["week_date"].apply(
        lambda d: snap_to_friday(d) if pd.notna(d) else pd.NaT
    )
    df = df.dropna(subset=["week_date"])

    num_cols = [c for c in ["I7505_5","I7505_6","I7505_7","I7505_8"] if c in df.columns]
    df = df[["week_date"] + num_cols].copy()
    df[num_cols] = df[num_cols].apply(pd.to_numeric, errors="coerce")

    df = df.groupby("week_date")[num_cols].mean()
    df = df.resample("W-FRI").last()
    df = df.loc[WINDOW_START:WINDOW_END]
    return df.add_prefix("cp_")


def load_treasury_bills() -> pd.DataFrame:
    """
    Treasury_Bills_Details.csv
    Temporal index : WeekCode (Calendar-Year, YYYYWW)
    Pivot          : One row per week × bill type (91D, 182D, 364D)
    Prefix         : tb_
    364D cut-off yield (tb_I7504_10_364d) becomes the TARGET variable.
    """
    df = pd.read_csv(DATA_DIR / "Treasury_Bills_Details.csv", low_memory=False)
    df["week_date"] = df["WeekCode"].apply(parse_weekcode_cy)
    df = df.dropna(subset=["week_date","D7504_6"])

    # Keep only the three main T-Bill maturities
    df = df[df["D7504_6"].isin(["91 Day","182 Day","364 Day"])].copy()
    df["bill_type"] = (
        df["D7504_6"]
        .str.replace(" ", "", regex=False)
        .str.replace("Day", "D", regex=False)
        .str.lower()
    )  # → '91d', '182d', '364d'

    val_cols = [c for c in ["I7504_7","I7504_8","I7504_9","I7504_10"] if c in df.columns]
    df[val_cols] = df[val_cols].apply(pd.to_numeric, errors="coerce")

    pivot = df.pivot_table(
        index="week_date", columns="bill_type",
        values=val_cols, aggfunc="mean"
    )
    # Flatten multi-index: ('I7504_10', '364d') → 'I7504_10_364d'
    pivot.columns = ["_".join(col).strip() for col in pivot.columns.values]
    pivot = pivot.resample("W-FRI").last()
    pivot = pivot.loc[WINDOW_START:WINDOW_END]
    return pivot.add_prefix("tb_")


def load_market_repo() -> pd.DataFrame:
    """
    Market_Repo_Transactions.csv
    Temporal index : WeekCode (Calendar-Year, YYYYWW)
    All 12 indicator columns pass 75 % rule.
    Prefix         : repo_
    """
    df = pd.read_csv(DATA_DIR / "Market_Repo_Transactions.csv", low_memory=False)
    df["week_date"] = df["WeekCode"].apply(parse_weekcode_cy)
    df = df.dropna(subset=["week_date"])

    num_cols = [c for c in df.columns
                if c.startswith("I7498_") and c != "week_date"]
    df[num_cols] = df[num_cols].apply(pd.to_numeric, errors="coerce")

    df = df.groupby("week_date")[num_cols].mean()
    df = df.resample("W-FRI").last()
    df = df.loc[WINDOW_START:WINDOW_END]
    return df.add_prefix("repo_")


def load_cg_securities() -> pd.DataFrame:
    """
    Central_Government_Dated_Securities.csv
    Temporal index : WeekCode (Calendar-Year, YYYYWW)
    All 5 indicator columns pass 75 % rule.
    Prefix         : gsec_
    """
    df = pd.read_csv(DATA_DIR / "Central_Government_Dated_Securities.csv", low_memory=False)
    df["week_date"] = df["WeekCode"].apply(parse_weekcode_cy)
    df = df.dropna(subset=["week_date"])

    num_cols = [c for c in df.columns
                if c.startswith("I7503_") and c != "week_date"]
    df[num_cols] = df[num_cols].apply(pd.to_numeric, errors="coerce")

    df = df.groupby("week_date")[num_cols].mean()
    df = df.resample("W-FRI").last()
    df = df.loc[WINDOW_START:WINDOW_END]
    return df.add_prefix("gsec_")


def load_major_price() -> pd.DataFrame:
    """
    Major_Price_Indices.csv
    Temporal index : Month string ('April, 2006')
    Drops          : CPI_FAIL (WPI series)
    Will be forward-filled (max 4 weeks) onto the weekly index later.
    Prefix         : cpi_
    """
    df = pd.read_csv(DATA_DIR / "Major_Price_Indices.csv", low_memory=False)
    df["month_date"] = pd.to_datetime(
        df["Month"].str.replace(r"(\w+),\s*(\d+)", r"\1 \2", regex=True),
        format="%B %Y", errors="coerce"
    )
    df = df.dropna(subset=["month_date"])
    drop_cols = {"Country","Year","Month"} | CPI_FAIL
    df = df.drop(columns=[c for c in drop_cols if c in df.columns], errors="ignore")

    num_cols = [c for c in df.columns if c != "month_date"]
    df[num_cols] = df[num_cols].apply(pd.to_numeric, errors="coerce")

    df = df.set_index("month_date").sort_index()
    df = df.resample("MS").mean()          # monthly start
    # Include one extra month before window so first forward-fill is valid
    df = df.loc["2013-12":WINDOW_END]
    return df.add_prefix("cpi_")


def load_ohlc() -> pd.DataFrame:
    """
    data/master_ohlc.csv — Nifty50 + USD/INR weekly OHLCV + 5 technical indicators
    Already on W-FRI dates and trimmed to the NDAP golden window by stage_1b.
    Prefix : columns already carry nifty_ / usdinr_ prefixes.
    """
    if not OHLC_PATH.exists():
        raise FileNotFoundError(
            f"'{OHLC_PATH}' not found.  Run stage_1_yfin.py then "
            "stage_1b_technical_indicators.py first."
        )
    df = pd.read_csv(OHLC_PATH, parse_dates=["Date"])
    df = df.set_index("Date").sort_index()
    df = df.resample("W-FRI").last()          # snap to canonical Friday grid
    df = df.loc[WINDOW_START:WINDOW_END]
    return df


# ── Master builder ────────────────────────────────────────────────────────────
def build_master() -> None:
    print("=" * 70)
    print("  STAGE 1: DATA ALIGNMENT, EDA & DATABASE STORAGE")
    print("=" * 70)

    # 1.1  Directory setup
    MASTER_DIR.mkdir(exist_ok=True)
    VIS_DIR.mkdir(exist_ok=True)
    print(f"\n[1.1] Directories ready: {MASTER_DIR}/  {VIS_DIR}/")

    # 1.2  Load & filter each dataset
    print("\n[1.2] Loading and filtering 8 NDAP datasets + 1 external OHLC dataset...")
    df_rates   = load_rbi_ratios_rates()
    df_la      = load_rbi_la()
    df_agg     = load_rbi_weekly_aggs()
    df_cp      = load_commercial_paper()
    df_tb      = load_treasury_bills()
    df_repo    = load_market_repo()
    df_gsec    = load_cg_securities()
    df_cpi_raw = load_major_price()
    df_ohlc    = load_ohlc()

    for name, df_x in [("Ratios & Rates",     df_rates),
                        ("RBI Liab/Assets",    df_la),
                        ("Weekly Aggregates",  df_agg),
                        ("Commercial Paper",   df_cp),
                        ("Treasury Bills",     df_tb),
                        ("Market Repo",        df_repo),
                        ("G-Sec",              df_gsec),
                        ("CPI (monthly)",      df_cpi_raw),
                        ("Nifty50+USDINR OHLC",df_ohlc)]:
        print(f"  {name:<22s}: {df_x.shape[0]:>5} rows × {df_x.shape[1]:>3} cols")

    # 1.3  Align on canonical weekly Friday index
    print(f"\n[1.3] Building master weekly index  {WINDOW_START} → {WINDOW_END} ...")
    weekly_idx = pd.date_range(start=WINDOW_START, end=WINDOW_END, freq="W-FRI")
    master = pd.DataFrame(index=weekly_idx)
    master.index.name = "week_date"

    for name, df_src in [("rates", df_rates), ("la",   df_la),
                          ("agg",   df_agg),   ("cp",   df_cp),
                          ("tb",    df_tb),    ("repo", df_repo),
                          ("gsec",  df_gsec)]:
        master = master.join(df_src, how="left")
        print(f"  Joined {name:<6s} → master {master.shape}")

    # Forward-fill CPI monthly values onto weekly index (max 4-week carry)
    cpi_weekly = df_cpi_raw.reindex(master.index, method="ffill", limit=4)
    master = master.join(cpi_weekly, how="left")
    print(f"  Joined cpi    → master {master.shape}")

    # Join external OHLC + technical indicators (Nifty50, USD/INR)
    # Already on W-FRI dates; reindex to master's Friday grid for alignment
    ohlc_aligned = df_ohlc.reindex(master.index)
    master = master.join(ohlc_aligned, how="left")
    print(f"  Joined ohlc   → master {master.shape}")

    # 1.4  Feature engineering
    print("\n[1.4] Feature engineering ...")

    # --- Rename target variable ---
    if TARGET_RAW in master.columns:
        master = master.rename(columns={TARGET_RAW: TARGET_COL})
        print(f"  Target column  : '{TARGET_RAW}' → '{TARGET_COL}'")
    else:
        raise RuntimeError(
            f"Cannot locate target column '{TARGET_RAW}'.\n"
            f"Columns present: {list(master.columns)}"
        )

    # --- Lag features for target (t-1, t-2, t-4 weeks) ---
    master["target_lag1"] = master[TARGET_COL].shift(1)
    master["target_lag2"] = master[TARGET_COL].shift(2)
    master["target_lag4"] = master[TARGET_COL].shift(4)

    # --- Lag features for Repo Rate (t-1, t-2, t-4 weeks) ---
    if REPO_RATE_COL in master.columns:
        master["repo_lag1"] = master[REPO_RATE_COL].shift(1)
        master["repo_lag2"] = master[REPO_RATE_COL].shift(2)
        master["repo_lag4"] = master[REPO_RATE_COL].shift(4)
    else:
        print(f"  WARNING: Repo Rate column '{REPO_RATE_COL}' not found")

    # --- Spread 1: WACMR − Repo Rate (policy corridor excess / deficit) ---
    if TARGET_COL in master.columns and REPO_RATE_COL in master.columns:
        master["spread_wacmr_minus_repo"] = master[TARGET_COL] - master[REPO_RATE_COL]

    # --- Spread 2: MSF Rate − Repo Rate (corridor width proxy) ---
    if MSF_RATE_COL in master.columns and REPO_RATE_COL in master.columns:
        master["spread_msf_minus_repo"] = master[MSF_RATE_COL] - master[REPO_RATE_COL]

    # --- Spread 3: CP Rate − Repo Rate (credit risk premium) ---
    if CP_RATE_COL in master.columns and REPO_RATE_COL in master.columns:
        master["spread_cp_minus_repo"] = master[CP_RATE_COL] - master[REPO_RATE_COL]

    # --- Drop rows where target is NaN ---
    n_before = len(master)
    master = master.dropna(subset=[TARGET_COL])
    print(f"  Dropped {n_before - len(master)} rows with NaN target "
          f"→ {len(master)} rows remain")

    # --- Drop rows where ANY lag/spread is NaN (first ~4 weeks) ---
    # Only enforce non-null on repo/target lag features (not the wacmr-minus-repo spread
    # since that's derived from the target itself and handled by the target dropna above)
    eng_cols = [c for c in master.columns
                if c.endswith(("_lag1","_lag2","_lag4"))
                or c in ("spread_msf_minus_repo","spread_cp_minus_repo")]
    n_before = len(master)
    master = master.dropna(subset=eng_cols)
    print(f"  Dropped {n_before - len(master)} rows with NaN lags/spreads "
          f"→ {len(master)} rows remain")

    # --- Missing value audit ---
    null_pct = master.isnull().mean() * 100
    cols_with_nulls = null_pct[null_pct > 0].sort_values(ascending=False)
    print(f"\n  Remaining columns with NaN > 0 % ({len(cols_with_nulls)}):")
    if len(cols_with_nulls) == 0:
        print("  ✓ None — master dataset is fully dense")
    else:
        print(cols_with_nulls.round(1).to_string())

    print(f"\n  ── Master DataFrame ──")
    print(f"  Shape       : {master.shape}")
    print(f"  Date range  : {master.index.min().date()}  →  {master.index.max().date()}")
    print(f"  Target non-null : {master[TARGET_COL].notna().sum()} / {len(master)}")

    # 1.5  EDA: Histograms
    print("\n[1.5] Generating EDA distribution plots ...")
    fig, axes = plt.subplots(1, 2, figsize=(14, 5))
    fig.suptitle(
        "Distribution of Key Financial Indicators\n"
        "Golden Window: Jan 2014 – Jul 2024",
        fontsize=14, fontweight="bold"
    )

    # Plot A – Target variable
    tgt_vals = master[TARGET_COL].dropna()
    axes[0].hist(tgt_vals, bins=35, color="steelblue", edgecolor="white", linewidth=0.4)
    axes[0].axvline(tgt_vals.mean(), color="crimson", linestyle="--", linewidth=1.5,
                    label=f"Mean: {tgt_vals.mean():.2f} %")
    axes[0].axvline(tgt_vals.median(), color="darkorange", linestyle=":", linewidth=1.5,
                    label=f"Median: {tgt_vals.median():.2f} %")
    axes[0].set_title("Weighted Avg Call Money Rate — WACMR (%)", fontsize=12, fontweight="bold")
    axes[0].set_xlabel("Yield (%)", fontsize=10)
    axes[0].set_ylabel("Frequency (weeks)", fontsize=10)
    axes[0].legend(fontsize=9)
    axes[0].grid(alpha=0.3)

    # Plot B – Repo Rate
    if REPO_RATE_COL in master.columns:
        repo_vals = master[REPO_RATE_COL].dropna()
        axes[1].hist(repo_vals, bins=20, color="darkorange", edgecolor="white", linewidth=0.4)
        axes[1].axvline(repo_vals.mean(), color="navy", linestyle="--", linewidth=1.5,
                        label=f"Mean: {repo_vals.mean():.2f} %")
        axes[1].axvline(repo_vals.median(), color="purple", linestyle=":", linewidth=1.5,
                        label=f"Median: {repo_vals.median():.2f} %")
        axes[1].set_title("RBI Repo Rate (%)", fontsize=12, fontweight="bold")
        axes[1].set_xlabel("Repo Rate (%)", fontsize=10)
        axes[1].set_ylabel("Frequency (weeks)", fontsize=10)
        axes[1].legend(fontsize=9)
        axes[1].grid(alpha=0.3)

    plt.tight_layout()
    eda_path = VIS_DIR / "eda_distributions.png"
    plt.savefig(eda_path, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"  Saved: {eda_path}")

    # Also save a time-series overview of the target
    fig2, ax = plt.subplots(figsize=(16, 5))
    ax.plot(master.index, master[TARGET_COL], color="steelblue", linewidth=1.2)
    ax.set_title("Weighted Avg Call Money Rate (WACMR) — Weekly Time Series\n"
                 "(Jan 2014 – Jul 2024)", fontsize=13, fontweight="bold")
    ax.set_xlabel("Date", fontsize=10)
    ax.set_ylabel("Yield (%)", fontsize=10)
    ax.grid(alpha=0.3)
    plt.tight_layout()
    ts_path = VIS_DIR / "target_timeseries.png"
    plt.savefig(ts_path, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"  Saved: {ts_path}")

    # 1.6  Database storage
    print(f"\n[1.6] Storing master table in SQLite → {DB_PATH} ...")
    master_db = master.copy().reset_index()
    master_db["week_date"] = master_db["week_date"].dt.strftime("%Y-%m-%d")

    conn = sqlite3.connect(DB_PATH)
    master_db.to_sql(TABLE_NAME, conn, if_exists="replace", index=False)
    row_count = pd.read_sql(f"SELECT COUNT(*) AS n FROM {TABLE_NAME}", conn).iloc[0, 0]
    col_count = len(pd.read_sql(f"SELECT * FROM {TABLE_NAME} LIMIT 1", conn).columns)
    print(f"  Table '{TABLE_NAME}': {row_count} rows × {col_count} columns  ✓")

    # 1.7  CSV backup
    csv_path = MASTER_DIR / "Weekly_Macro_Master.csv"
    master_db.to_csv(csv_path, index=False)
    print(f"\n[1.7] CSV backup → {csv_path}")
    print("  NOTE: All subsequent stages will read ONLY from the SQLite DB.")

    # 1.8  SQL query demonstrations
    print("\n[1.8] Sample SQL Query Demonstrations:")
    print("─" * 68)

    # Query 1 — Average yield & repo rate by calendar year
    q1 = f"""
SELECT strftime('%Y', week_date)          AS year,
       ROUND(AVG({TARGET_COL}), 3)        AS avg_364d_yield_pct,
       ROUND(AVG({REPO_RATE_COL}), 3)     AS avg_repo_rate_pct,
       COUNT(*)                            AS weeks
FROM   {TABLE_NAME}
GROUP  BY year
ORDER  BY year;
""".strip()
    print("\nQuery 1 — Average 364-Day T-Bill Yield & Repo Rate by Year:")
    print(q1)
    print()
    r1 = pd.read_sql(q1, conn)
    print(r1.to_string(index=False))

    # Query 2 — Extreme yield weeks
    q2 = f"""
SELECT week_date,
       ROUND({TARGET_COL}, 3)       AS yield_pct,
       ROUND({REPO_RATE_COL}, 3)    AS repo_rate_pct,
       'MAX' AS label
FROM   {TABLE_NAME}
WHERE  {TARGET_COL} = (SELECT MAX({TARGET_COL}) FROM {TABLE_NAME})
UNION ALL
SELECT week_date,
       ROUND({TARGET_COL}, 3),
       ROUND({REPO_RATE_COL}, 3),
       'MIN'
FROM   {TABLE_NAME}
WHERE  {TARGET_COL} = (SELECT MIN({TARGET_COL}) FROM {TABLE_NAME});
""".strip()
    print("\nQuery 2 — Weeks with Maximum and Minimum 364-Day T-Bill Yield:")
    print(q2)
    print()
    r2 = pd.read_sql(q2, conn)
    print(r2.to_string(index=False))

    # Query 3 — COVID-period yield-vs-repo spread
    q3 = f"""
SELECT week_date,
       ROUND({TARGET_COL}, 3)                                AS yield_364d,
       ROUND({REPO_RATE_COL}, 3)                             AS repo_rate,
       ROUND({TARGET_COL} - {REPO_RATE_COL}, 3)             AS yield_over_repo_spread
FROM   {TABLE_NAME}
WHERE  strftime('%Y', week_date) IN ('2020', '2021')
ORDER  BY week_date
LIMIT  12;
""".strip()
    print("\nQuery 3 — COVID Period (2020-2021): 364-Day Yield vs Repo Rate Spread:")
    print(q3)
    print()
    r3 = pd.read_sql(q3, conn)
    print(r3.to_string(index=False))

    conn.close()

    # ── CHECK-IN 1 Summary ────────────────────────────────────────────────────
    print("\n" + "=" * 70)
    print("  [CHECK-IN 1]  STAGE 1 COMPLETE")
    print("=" * 70)
    print(f"  Master DataFrame shape   : {master.shape[0]} rows × {master.shape[1]} cols")
    print(f"  Date range               : {master.index.min().date()}  →  {master.index.max().date()}")
    print(f"  Target column            : '{TARGET_COL}'  (100 % non-null)")
    print(f"  SQLite DB                : {DB_PATH.resolve()}")
    print(f"  Table                    : {TABLE_NAME}")
    print(f"  CSV backup               : {csv_path.resolve()}")
    print(f"  EDA distribution plot    : {eda_path.resolve()}")
    print(f"  Target time-series plot  : {ts_path.resolve()}")
    print("=" * 70)


if __name__ == "__main__":
    build_master()
