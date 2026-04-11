"""Human-readable names and metadata for all 119 master dataset columns."""

COLUMN_REGISTRY = {
    # ── Target ────────────────────────────────────────────────────────────────
    "week_date":    {"label": "Week Date", "category": "index", "unit": "date", "source": "Computed"},
    "target_wacmr": {"label": "WACMR", "full_name": "Weighted Average Call Money Rate", "category": "target", "unit": "%", "source": "RBI Ratios & Rates"},

    # ── RBI Rates ─────────────────────────────────────────────────────────────
    "rates_I7496_5":  {"label": "CRR", "full_name": "Cash Reserve Ratio", "category": "rates", "unit": "%", "source": "RBI Ratios & Rates"},
    "rates_I7496_6":  {"label": "SLR", "full_name": "Statutory Liquidity Ratio", "category": "rates", "unit": "%", "source": "RBI Ratios & Rates"},
    "rates_I7496_17": {"label": "Repo Rate", "full_name": "RBI Repo Rate", "category": "rates", "unit": "%", "source": "RBI Ratios & Rates"},
    "rates_I7496_18": {"label": "Reverse Repo Rate", "full_name": "RBI Reverse Repo Rate", "category": "rates", "unit": "%", "source": "RBI Ratios & Rates"},
    "rates_I7496_20": {"label": "MSF Rate", "full_name": "Marginal Standing Facility Rate", "category": "rates", "unit": "%", "source": "RBI Ratios & Rates"},
    "rates_I7496_21": {"label": "Bank Rate", "full_name": "RBI Bank Rate", "category": "rates", "unit": "%", "source": "RBI Ratios & Rates"},
    "rates_I7496_27": {"label": "CBLO/TREPS Rate", "full_name": "CBLO / Tri-Party Repo Rate", "category": "rates", "unit": "%", "source": "RBI Ratios & Rates"},
    "rates_I7496_28": {"label": "Market Repo Rate", "full_name": "Market Repo Rate", "category": "rates", "unit": "%", "source": "RBI Ratios & Rates"},
    "rates_I7496_29": {"label": "Term Repo Rate", "full_name": "Term Repo Rate", "category": "rates", "unit": "%", "source": "RBI Ratios & Rates"},
    "rates_I7496_30": {"label": "CP Rate", "full_name": "Commercial Paper Rate", "category": "rates", "unit": "%", "source": "RBI Ratios & Rates"},
    "rates_I7496_31": {"label": "CD Rate", "full_name": "Certificate of Deposit Rate", "category": "rates", "unit": "%", "source": "RBI Ratios & Rates"},
    "rates_I7496_32": {"label": "MIBOR O/N", "full_name": "Mumbai Interbank Offer Rate (Overnight)", "category": "rates", "unit": "%", "source": "RBI Ratios & Rates"},
    "rates_I7496_33": {"label": "MIBOR 14D", "full_name": "Mumbai Interbank Offer Rate (14-Day)", "category": "rates", "unit": "%", "source": "RBI Ratios & Rates"},
    "rates_I7496_34": {"label": "MIBOR 1M", "full_name": "Mumbai Interbank Offer Rate (1-Month)", "category": "rates", "unit": "%", "source": "RBI Ratios & Rates"},
    "rates_I7496_35": {"label": "MIBOR 3M", "full_name": "Mumbai Interbank Offer Rate (3-Month)", "category": "rates", "unit": "%", "source": "RBI Ratios & Rates"},

    # ── RBI Balance Sheet (Liabilities & Assets) ─────────────────────────────
    "la_I7492_6":  {"label": "Notes in Circulation", "category": "balance_sheet", "unit": "Cr", "source": "RBI Liabilities & Assets"},
    "la_I7492_7":  {"label": "Deposits - Govt", "full_name": "Government Deposits with RBI", "category": "balance_sheet", "unit": "Cr", "source": "RBI Liabilities & Assets"},
    "la_I7492_8":  {"label": "Deposits - Banks", "full_name": "Bank Deposits with RBI", "category": "balance_sheet", "unit": "Cr", "source": "RBI Liabilities & Assets"},
    "la_I7492_9":  {"label": "Deposits - Others", "full_name": "Other Deposits with RBI", "category": "balance_sheet", "unit": "Cr", "source": "RBI Liabilities & Assets"},
    "la_I7492_10": {"label": "Other Liabilities", "category": "balance_sheet", "unit": "Cr", "source": "RBI Liabilities & Assets"},
    "la_I7492_12": {"label": "Total Liabilities", "category": "balance_sheet", "unit": "Cr", "source": "RBI Liabilities & Assets"},
    "la_I7492_13": {"label": "Gold Coin & Bullion", "category": "balance_sheet", "unit": "Cr", "source": "RBI Liabilities & Assets"},
    "la_I7492_14": {"label": "Forex Reserves", "full_name": "Foreign Currency Assets", "category": "balance_sheet", "unit": "Cr", "source": "RBI Liabilities & Assets"},
    "la_I7492_15": {"label": "Rupee Securities", "full_name": "Rupee Securities held by RBI", "category": "balance_sheet", "unit": "Cr", "source": "RBI Liabilities & Assets"},
    "la_I7492_16": {"label": "Govt Securities", "full_name": "Government Securities held by RBI", "category": "balance_sheet", "unit": "Cr", "source": "RBI Liabilities & Assets"},
    "la_I7492_18": {"label": "Loans to Govt", "full_name": "Loans and Advances to Government", "category": "balance_sheet", "unit": "Cr", "source": "RBI Liabilities & Assets"},
    "la_I7492_19": {"label": "Loans to Banks", "full_name": "Loans and Advances to Banks", "category": "balance_sheet", "unit": "Cr", "source": "RBI Liabilities & Assets"},
    "la_I7492_20": {"label": "Loans to NABARD", "full_name": "Loans to NABARD", "category": "balance_sheet", "unit": "Cr", "source": "RBI Liabilities & Assets"},
    "la_I7492_21": {"label": "Bills Purchased", "category": "balance_sheet", "unit": "Cr", "source": "RBI Liabilities & Assets"},
    "la_I7492_22": {"label": "Investments", "full_name": "RBI Investments", "category": "balance_sheet", "unit": "Cr", "source": "RBI Liabilities & Assets"},
    "la_I7492_23": {"label": "Other Assets", "category": "balance_sheet", "unit": "Cr", "source": "RBI Liabilities & Assets"},
    "la_I7492_25": {"label": "Total Assets", "category": "balance_sheet", "unit": "Cr", "source": "RBI Liabilities & Assets"},
    "la_I7492_27": {"label": "SDR Holdings", "full_name": "Special Drawing Rights", "category": "balance_sheet", "unit": "Cr", "source": "RBI Liabilities & Assets"},
    "la_I7492_31": {"label": "Banking Dept Deposits", "category": "balance_sheet", "unit": "Cr", "source": "RBI Liabilities & Assets"},
    "la_I7492_36": {"label": "Reserve Fund", "category": "balance_sheet", "unit": "Cr", "source": "RBI Liabilities & Assets"},
    "la_I7492_37": {"label": "NSSF Securities", "full_name": "National Small Savings Fund Securities", "category": "balance_sheet", "unit": "Cr", "source": "RBI Liabilities & Assets"},
    "la_I7492_38": {"label": "Other Approved Securities", "category": "balance_sheet", "unit": "Cr", "source": "RBI Liabilities & Assets"},

    # ── Weekly Aggregates ─────────────────────────────────────────────────────
    "agg_I7494_5": {"label": "M3 Money Supply", "full_name": "Broad Money (M3)", "category": "aggregates", "unit": "Cr", "source": "RBI Weekly Aggregates"},
    "agg_I7494_6": {"label": "M3 Growth Index", "category": "aggregates", "unit": "index", "source": "RBI Weekly Aggregates"},
    "agg_I7494_7": {"label": "Reserve Money", "category": "aggregates", "unit": "Cr", "source": "RBI Weekly Aggregates"},

    # ── Commercial Paper ──────────────────────────────────────────────────────
    "cp_I7505_5": {"label": "CP Outstanding", "full_name": "Commercial Paper Outstanding", "category": "commercial_paper", "unit": "Cr", "source": "RBI Commercial Paper"},
    "cp_I7505_6": {"label": "CP Issued", "full_name": "Commercial Paper Issued", "category": "commercial_paper", "unit": "Cr", "source": "RBI Commercial Paper"},
    "cp_I7505_7": {"label": "CP Subscribed", "full_name": "Commercial Paper Subscribed", "category": "commercial_paper", "unit": "Cr", "source": "RBI Commercial Paper"},
    "cp_I7505_8": {"label": "CP Matured", "full_name": "Commercial Paper Matured", "category": "commercial_paper", "unit": "Cr", "source": "RBI Commercial Paper"},

    # ── Treasury Bills ────────────────────────────────────────────────────────
    "tb_I7504_10_182d": {"label": "T-Bill 182D Outstanding", "category": "treasury_bills", "unit": "Cr", "source": "RBI Treasury Bills"},
    "tb_I7504_10_364d": {"label": "T-Bill 364D Outstanding", "category": "treasury_bills", "unit": "Cr", "source": "RBI Treasury Bills"},
    "tb_I7504_10_91d":  {"label": "T-Bill 91D Outstanding", "category": "treasury_bills", "unit": "Cr", "source": "RBI Treasury Bills"},
    "tb_I7504_7_182d":  {"label": "T-Bill 182D Notified", "category": "treasury_bills", "unit": "Cr", "source": "RBI Treasury Bills"},
    "tb_I7504_7_364d":  {"label": "T-Bill 364D Notified", "category": "treasury_bills", "unit": "Cr", "source": "RBI Treasury Bills"},
    "tb_I7504_7_91d":   {"label": "T-Bill 91D Notified", "category": "treasury_bills", "unit": "Cr", "source": "RBI Treasury Bills"},
    "tb_I7504_8_182d":  {"label": "T-Bill 182D Accepted", "category": "treasury_bills", "unit": "Cr", "source": "RBI Treasury Bills"},
    "tb_I7504_8_364d":  {"label": "T-Bill 364D Accepted", "category": "treasury_bills", "unit": "Cr", "source": "RBI Treasury Bills"},
    "tb_I7504_8_91d":   {"label": "T-Bill 91D Accepted", "category": "treasury_bills", "unit": "Cr", "source": "RBI Treasury Bills"},
    "tb_I7504_9_182d":  {"label": "T-Bill 182D Subscribed", "category": "treasury_bills", "unit": "Cr", "source": "RBI Treasury Bills"},
    "tb_I7504_9_364d":  {"label": "T-Bill 364D Subscribed", "category": "treasury_bills", "unit": "Cr", "source": "RBI Treasury Bills"},
    "tb_I7504_9_91d":   {"label": "T-Bill 91D Subscribed", "category": "treasury_bills", "unit": "Cr", "source": "RBI Treasury Bills"},

    # ── Market Repo ───────────────────────────────────────────────────────────
    "repo_I7498_6":  {"label": "Mkt Repo Volume", "full_name": "Market Repo Transaction Volume", "category": "market_repo", "unit": "Cr", "source": "RBI Market Repo"},
    "repo_I7498_7":  {"label": "Mkt Repo O/N Vol", "category": "market_repo", "unit": "Cr", "source": "RBI Market Repo"},
    "repo_I7498_8":  {"label": "Mkt Repo 2-7D Vol", "category": "market_repo", "unit": "Cr", "source": "RBI Market Repo"},
    "repo_I7498_9":  {"label": "Mkt Repo 8-14D Vol", "category": "market_repo", "unit": "Cr", "source": "RBI Market Repo"},
    "repo_I7498_10": {"label": "Mkt Repo >14D Vol", "category": "market_repo", "unit": "Cr", "source": "RBI Market Repo"},
    "repo_I7498_11": {"label": "Mkt Repo Wtd Rate", "full_name": "Market Repo Weighted Average Rate", "category": "market_repo", "unit": "%", "source": "RBI Market Repo"},
    "repo_I7498_12": {"label": "Mkt Repo O/N Rate", "category": "market_repo", "unit": "%", "source": "RBI Market Repo"},
    "repo_I7498_13": {"label": "Mkt Repo 2-7D Rate", "category": "market_repo", "unit": "%", "source": "RBI Market Repo"},
    "repo_I7498_14": {"label": "Mkt Repo 8-14D Rate", "category": "market_repo", "unit": "%", "source": "RBI Market Repo"},
    "repo_I7498_15": {"label": "Mkt Repo >14D Rate", "category": "market_repo", "unit": "%", "source": "RBI Market Repo"},
    "repo_I7498_16": {"label": "Mkt Repo Net Lending", "category": "market_repo", "unit": "Cr", "source": "RBI Market Repo"},
    "repo_I7498_17": {"label": "Mkt Repo Net Borrowing", "category": "market_repo", "unit": "Cr", "source": "RBI Market Repo"},

    # ── Government Securities ─────────────────────────────────────────────────
    "gsec_I7503_6":  {"label": "G-Sec Notified", "category": "government_securities", "unit": "Cr", "source": "RBI G-Sec"},
    "gsec_I7503_7":  {"label": "G-Sec Accepted", "category": "government_securities", "unit": "Cr", "source": "RBI G-Sec"},
    "gsec_I7503_8":  {"label": "G-Sec Outstanding", "category": "government_securities", "unit": "Cr", "source": "RBI G-Sec"},
    "gsec_I7503_9":  {"label": "G-Sec Maturity Amt", "category": "government_securities", "unit": "Cr", "source": "RBI G-Sec"},
    "gsec_I7503_10": {"label": "G-Sec Cut-off Yield", "category": "government_securities", "unit": "%", "source": "RBI G-Sec"},

    # ── CPI / Price Indices ───────────────────────────────────────────────────
    "cpi_I7500_4":  {"label": "CPI Industrial Workers", "category": "prices", "unit": "index", "source": "Major Price Indices"},
    "cpi_I7500_5":  {"label": "CPI Agricultural Labour", "category": "prices", "unit": "index", "source": "Major Price Indices"},
    "cpi_I7500_6":  {"label": "CPI Rural Labour", "category": "prices", "unit": "index", "source": "Major Price Indices"},
    "cpi_I7500_9":  {"label": "CPI Combined", "full_name": "CPI Combined (Urban+Rural)", "category": "prices", "unit": "index", "source": "Major Price Indices"},
    "cpi_I7500_10": {"label": "CPI Food", "category": "prices", "unit": "index", "source": "Major Price Indices"},
    "cpi_I7500_11": {"label": "CPI Core", "full_name": "CPI Core (excl. Food & Fuel)", "category": "prices", "unit": "index", "source": "Major Price Indices"},
    "cpi_I7500_12": {"label": "CPI Fuel", "category": "prices", "unit": "index", "source": "Major Price Indices"},

    # ── Nifty 50 ──────────────────────────────────────────────────────────────
    "nifty_into":   {"label": "Nifty Open", "category": "equity", "unit": "pts", "source": "Yahoo Finance"},
    "nifty_inth":   {"label": "Nifty High", "category": "equity", "unit": "pts", "source": "Yahoo Finance"},
    "nifty_intl":   {"label": "Nifty Low", "category": "equity", "unit": "pts", "source": "Yahoo Finance"},
    "nifty_intc":   {"label": "Nifty Close", "category": "equity", "unit": "pts", "source": "Yahoo Finance"},
    "nifty_vol":    {"label": "Nifty Volume", "category": "equity", "unit": "shares", "source": "Yahoo Finance"},
    "nifty_ImpulseMACD":        {"label": "Nifty Impulse MACD", "category": "equity_indicator", "unit": "pts", "source": "Computed"},
    "nifty_ImpulseHisto":       {"label": "Nifty Impulse Histogram", "category": "equity_indicator", "unit": "pts", "source": "Computed"},
    "nifty_ImpulseMACDCDSignal":{"label": "Nifty Impulse Signal", "category": "equity_indicator", "unit": "pts", "source": "Computed"},
    "nifty_STX":    {"label": "Nifty SuperTrend", "category": "equity_indicator", "unit": "signal", "source": "Computed"},
    "nifty_psi":    {"label": "Nifty Squeeze Index", "category": "equity_indicator", "unit": "index", "source": "Computed"},
    "nifty_TSI":    {"label": "Nifty TSI", "full_name": "Nifty True Strength Index", "category": "equity_indicator", "unit": "index", "source": "Computed"},
    "nifty_TSIs":   {"label": "Nifty TSI Signal", "category": "equity_indicator", "unit": "index", "source": "Computed"},
    "nifty_velocity":        {"label": "Nifty Velocity", "category": "equity_indicator", "unit": "pts/wk", "source": "Computed"},
    "nifty_smooth_velocity": {"label": "Nifty Smooth Velocity", "category": "equity_indicator", "unit": "pts/wk", "source": "Computed"},

    # ── USD/INR ───────────────────────────────────────────────────────────────
    "usdinr_into":  {"label": "USD/INR Open", "category": "forex", "unit": "INR", "source": "Yahoo Finance"},
    "usdinr_inth":  {"label": "USD/INR High", "category": "forex", "unit": "INR", "source": "Yahoo Finance"},
    "usdinr_intl":  {"label": "USD/INR Low", "category": "forex", "unit": "INR", "source": "Yahoo Finance"},
    "usdinr_intc":  {"label": "USD/INR Close", "category": "forex", "unit": "INR", "source": "Yahoo Finance"},
    "usdinr_vol":   {"label": "USD/INR Volume", "category": "forex", "unit": "contracts", "source": "Yahoo Finance"},
    "usdinr_ImpulseMACD":        {"label": "USD/INR Impulse MACD", "category": "forex_indicator", "unit": "pts", "source": "Computed"},
    "usdinr_ImpulseHisto":       {"label": "USD/INR Impulse Histogram", "category": "forex_indicator", "unit": "pts", "source": "Computed"},
    "usdinr_ImpulseMACDCDSignal":{"label": "USD/INR Impulse Signal", "category": "forex_indicator", "unit": "pts", "source": "Computed"},
    "usdinr_STX":   {"label": "USD/INR SuperTrend", "category": "forex_indicator", "unit": "signal", "source": "Computed"},
    "usdinr_psi":   {"label": "USD/INR Squeeze Index", "category": "forex_indicator", "unit": "index", "source": "Computed"},
    "usdinr_TSI":   {"label": "USD/INR TSI", "full_name": "USD/INR True Strength Index", "category": "forex_indicator", "unit": "index", "source": "Computed"},
    "usdinr_TSIs":  {"label": "USD/INR TSI Signal", "category": "forex_indicator", "unit": "index", "source": "Computed"},
    "usdinr_velocity":        {"label": "USD/INR Velocity", "category": "forex_indicator", "unit": "pts/wk", "source": "Computed"},
    "usdinr_smooth_velocity": {"label": "USD/INR Smooth Velocity", "category": "forex_indicator", "unit": "pts/wk", "source": "Computed"},

    # ── Engineered Features ───────────────────────────────────────────────────
    "target_lag1":  {"label": "WACMR Lag 1W", "category": "engineered", "unit": "%", "source": "Computed"},
    "target_lag2":  {"label": "WACMR Lag 2W", "category": "engineered", "unit": "%", "source": "Computed"},
    "target_lag4":  {"label": "WACMR Lag 4W", "category": "engineered", "unit": "%", "source": "Computed"},
    "repo_lag1":    {"label": "Repo Rate Lag 1W", "category": "engineered", "unit": "%", "source": "Computed"},
    "repo_lag2":    {"label": "Repo Rate Lag 2W", "category": "engineered", "unit": "%", "source": "Computed"},
    "repo_lag4":    {"label": "Repo Rate Lag 4W", "category": "engineered", "unit": "%", "source": "Computed"},
    "spread_wacmr_minus_repo": {"label": "WACMR-Repo Spread", "category": "engineered", "unit": "%", "source": "Computed"},
    "spread_msf_minus_repo":   {"label": "MSF-Repo Spread", "category": "engineered", "unit": "%", "source": "Computed"},
    "spread_cp_minus_repo":    {"label": "CP-Repo Spread", "category": "engineered", "unit": "%", "source": "Computed"},

    # ── Regime (from Stage 3) ─────────────────────────────────────────────────
    "regime_label":    {"label": "Regime", "category": "regime", "unit": "int", "source": "K-Means Clustering"},
    "cluster_dist_0":  {"label": "Distance to Regime 0", "category": "regime", "unit": "euclidean", "source": "K-Means Clustering"},
    "cluster_dist_1":  {"label": "Distance to Regime 1", "category": "regime", "unit": "euclidean", "source": "K-Means Clustering"},
}


def get_label(col: str) -> str:
    """Return human-readable label for a column, or the column name itself."""
    entry = COLUMN_REGISTRY.get(col)
    return entry["label"] if entry else col


def get_columns_metadata() -> list[dict]:
    """Return metadata for all columns in the registry."""
    return [
        {"column": col, **meta}
        for col, meta in COLUMN_REGISTRY.items()
    ]


def get_categories() -> dict[str, list[str]]:
    """Return columns grouped by category."""
    cats: dict[str, list[str]] = {}
    for col, meta in COLUMN_REGISTRY.items():
        cat = meta.get("category", "other")
        cats.setdefault(cat, []).append(col)
    return cats
