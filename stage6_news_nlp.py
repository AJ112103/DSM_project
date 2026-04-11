"""
Stage 6: NLP News-Sentiment Analysis Pipeline
===============================================
Curated Indian monetary-policy event database (2014-2024) with sentiment
scoring, keyword analysis, and event-density metrics aligned to the weekly
Friday grid used by the DSM master data.

Target variable: Weighted Average Call Money Rate (WACMR)

Outputs
-------
- master_data/Weekly_Macro_Master_NLP.csv   (enriched master data)
- backend/nlp/news_data/events.json         (events database)
- visualizations/news_sentiment_timeline.png
- visualizations/event_density_heatmap.png
"""

import json
import os
import warnings
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
import numpy as np
import pandas as pd
import seaborn as sns

warnings.filterwarnings("ignore")

BASE_DIR = Path(__file__).resolve().parent

# ====================================================================
# 1. Curated Event Database  (~75 major Indian monetary-policy events)
# ====================================================================

EVENTS = [
    # --- 2014 ---
    dict(date="2014-01-28", title="RBI hikes repo rate to 8.00%",
         category="rate_decision",
         description="RBI raised the repo rate by 25 bps to 8.00% to combat persistent inflation pressures.",
         sentiment_score=0.6, impact="high"),
    dict(date="2014-06-03", title="RBI holds repo at 8.00%",
         category="rate_decision",
         description="RBI kept the repo rate unchanged at 8.00%, maintaining a cautious stance amid elevated CPI.",
         sentiment_score=0.1, impact="medium"),
    dict(date="2014-08-05", title="RBI holds repo at 8.00%",
         category="rate_decision",
         description="Policy rate unchanged; RBI noted moderation in inflation but flagged monsoon risks.",
         sentiment_score=0.1, impact="medium"),
    dict(date="2014-09-30", title="RBI holds repo at 8.00%",
         category="rate_decision",
         description="Repo rate kept at 8% in the fourth bi-monthly policy statement of 2014-15.",
         sentiment_score=0.1, impact="low"),

    # --- 2015 ---
    dict(date="2015-01-15", title="RBI surprise cut to 7.75%",
         category="rate_decision",
         description="Surprise inter-meeting 25 bps cut as CPI fell below RBI's target glide path.",
         sentiment_score=-0.7, impact="high"),
    dict(date="2015-02-03", title="Union Budget 2015 fiscal consolidation",
         category="fiscal",
         description="Budget projected 3.9% fiscal deficit for FY16 while increasing public capex.",
         sentiment_score=-0.2, impact="medium"),
    dict(date="2015-03-04", title="RBI cuts repo to 7.50%",
         category="rate_decision",
         description="Second 25 bps cut in 2015 as inflation continued to undershoot RBI's glide path.",
         sentiment_score=-0.6, impact="high"),
    dict(date="2015-06-02", title="RBI cuts repo to 7.25%",
         category="rate_decision",
         description="Third cut of 2015, citing benign inflation outlook and muted rural demand.",
         sentiment_score=-0.6, impact="high"),
    dict(date="2015-09-29", title="RBI cuts repo to 6.75%",
         category="rate_decision",
         description="Aggressive 50 bps cut as global commodity prices collapsed and inflation remained low.",
         sentiment_score=-0.8, impact="high"),

    # --- 2016 ---
    dict(date="2016-04-05", title="RBI cuts repo to 6.50%",
         category="rate_decision",
         description="25 bps cut; Rajan cited room for easing given benign inflation trajectory.",
         sentiment_score=-0.6, impact="high"),
    dict(date="2016-06-07", title="RBI holds repo at 6.50%",
         category="rate_decision",
         description="Rate held steady; RBI flagged upside risks from monsoon and pay commission.",
         sentiment_score=0.1, impact="medium"),
    dict(date="2016-08-09", title="RBI holds under new MPC framework",
         category="structural",
         description="First policy after MPC constitution; rate held at 6.50% pending further data.",
         sentiment_score=0.0, impact="medium"),
    dict(date="2016-10-04", title="MPC's first rate cut to 6.25%",
         category="rate_decision",
         description="Newly constituted MPC voted for a 25 bps cut as headline CPI eased to 5%.",
         sentiment_score=-0.5, impact="high"),
    dict(date="2016-11-08", title="Demonetization announced",
         category="crisis",
         description="PM Modi withdrew Rs 500 and Rs 1000 notes, causing a massive liquidity surge in the banking system and disrupting money markets.",
         sentiment_score=-0.9, impact="high"),
    dict(date="2016-11-28", title="Post-demonetization CRR hike",
         category="liquidity",
         description="RBI imposed temporary 100% incremental CRR to absorb demonetization-driven surplus liquidity.",
         sentiment_score=0.7, impact="high"),
    dict(date="2016-12-07", title="RBI holds repo at 6.25% post-demonetization",
         category="rate_decision",
         description="MPC paused amid demonetization uncertainty despite expectations of a cut.",
         sentiment_score=0.3, impact="high"),

    # --- 2017 ---
    dict(date="2017-02-08", title="RBI shifts to neutral stance, holds 6.25%",
         category="rate_decision",
         description="MPC changed stance from accommodative to neutral, signaling the end of the easing cycle.",
         sentiment_score=0.4, impact="high"),
    dict(date="2017-04-06", title="RBI holds repo at 6.25%",
         category="rate_decision",
         description="Rate unchanged; MPC noted lingering demonetization effects and remonetization progress.",
         sentiment_score=0.1, impact="medium"),
    dict(date="2017-06-07", title="RBI holds repo at 6.25%",
         category="rate_decision",
         description="Held steady ahead of GST rollout, flagging implementation risks.",
         sentiment_score=0.1, impact="medium"),
    dict(date="2017-07-01", title="GST rollout",
         category="structural",
         description="India launched the Goods and Services Tax, the largest indirect-tax reform in decades, causing transitory disruption to growth.",
         sentiment_score=-0.3, impact="high"),
    dict(date="2017-08-02", title="RBI cuts repo to 6.00%",
         category="rate_decision",
         description="25 bps cut as inflation fell sharply; MPC noted GST-related output disruption.",
         sentiment_score=-0.6, impact="high"),
    dict(date="2017-10-04", title="RBI holds repo at 6.00%",
         category="rate_decision",
         description="Rate held; MPC concerned about fiscal slippage and HRA-driven inflation.",
         sentiment_score=0.2, impact="medium"),
    dict(date="2017-12-06", title="RBI holds repo at 6.00%",
         category="rate_decision",
         description="Repo unchanged for the second straight meeting; inflation trending up.",
         sentiment_score=0.2, impact="medium"),

    # --- 2018 ---
    dict(date="2018-02-07", title="RBI holds repo at 6.00%",
         category="rate_decision",
         description="MPC held rates but warned about rising input costs and crude prices.",
         sentiment_score=0.3, impact="medium"),
    dict(date="2018-04-05", title="RBI holds repo at 6.00%",
         category="rate_decision",
         description="Neutral stance maintained; MPC flagged global trade war risks and oil price surge.",
         sentiment_score=0.2, impact="medium"),
    dict(date="2018-06-06", title="RBI hikes repo to 6.25%",
         category="rate_decision",
         description="First hike in 4.5 years as crude oil surged and CPI breached 5%. MPC voted 5-1 for hike.",
         sentiment_score=0.7, impact="high"),
    dict(date="2018-08-01", title="RBI hikes repo to 6.50%",
         category="rate_decision",
         description="Second consecutive hike to 6.50% amid rising inflation and rupee depreciation pressure.",
         sentiment_score=0.7, impact="high"),
    dict(date="2018-09-21", title="IL&FS defaults",
         category="crisis",
         description="IL&FS group defaulted on commercial paper and inter-corporate deposits, triggering a liquidity and confidence crisis in NBFCs and money markets.",
         sentiment_score=0.8, impact="high"),
    dict(date="2018-10-05", title="RBI holds repo at 6.50% amid NBFC stress",
         category="rate_decision",
         description="MPC held rates; RBI focused on financial stability measures for the NBFC sector post IL&FS.",
         sentiment_score=0.3, impact="high"),
    dict(date="2018-12-05", title="RBI holds repo at 6.50%",
         category="rate_decision",
         description="Repo unchanged; MPC shifted stance to calibrated tightening amid NBFC contagion fears.",
         sentiment_score=0.4, impact="medium"),

    # --- 2019 ---
    dict(date="2019-02-07", title="RBI cuts repo to 6.25%",
         category="rate_decision",
         description="New governor Shaktikanta Das voted for a 25 bps cut, shifting stance to neutral.",
         sentiment_score=-0.6, impact="high"),
    dict(date="2019-04-04", title="RBI cuts repo to 6.00%",
         category="rate_decision",
         description="Second consecutive cut as growth slowed and inflation remained below target.",
         sentiment_score=-0.6, impact="high"),
    dict(date="2019-06-06", title="RBI cuts repo to 5.75%",
         category="rate_decision",
         description="Third straight cut; stance changed to accommodative amid sharp GDP growth deceleration.",
         sentiment_score=-0.7, impact="high"),
    dict(date="2019-08-07", title="RBI cuts repo to 5.40%",
         category="rate_decision",
         description="Unconventional 35 bps cut as GDP growth fell to a 6-year low of 5%.",
         sentiment_score=-0.8, impact="high"),
    dict(date="2019-09-20", title="Corporate tax cut announcement",
         category="fiscal",
         description="Government slashed corporate tax rate to 22% from 30%, boosting market sentiment and fiscal stimulus expectations.",
         sentiment_score=-0.4, impact="high"),
    dict(date="2019-10-04", title="RBI cuts repo to 5.15%",
         category="rate_decision",
         description="Fifth cut of 2019; cumulative 135 bps easing in the cycle to support faltering growth.",
         sentiment_score=-0.7, impact="high"),
    dict(date="2019-12-05", title="RBI holds repo at 5.15%",
         category="rate_decision",
         description="MPC paused after five consecutive cuts; inflation had started rising on food prices.",
         sentiment_score=0.2, impact="medium"),

    # --- 2020 ---
    dict(date="2020-02-06", title="RBI holds repo at 5.15%",
         category="rate_decision",
         description="Repo unchanged; inflation at 7.6% well above target band. Union Budget announced.",
         sentiment_score=0.3, impact="medium"),
    dict(date="2020-03-05", title="Yes Bank moratorium",
         category="crisis",
         description="RBI imposed a moratorium on Yes Bank after governance and asset-quality failures, triggering depositor panic.",
         sentiment_score=0.7, impact="high"),
    dict(date="2020-03-24", title="COVID-19 national lockdown",
         category="pandemic",
         description="PM announced a 21-day nationwide lockdown to curb COVID-19 spread, bringing economic activity to a near halt.",
         sentiment_score=-0.9, impact="high"),
    dict(date="2020-03-27", title="RBI emergency rate cut to 4.40%",
         category="rate_decision",
         description="Emergency 75 bps cut and 3-month moratorium on term loans to provide pandemic relief.",
         sentiment_score=-0.9, impact="high"),
    dict(date="2020-04-17", title="RBI second COVID package",
         category="liquidity",
         description="RBI announced Rs 50,000 crore targeted LTRO, special refinance facility, and reverse repo cut to 3.75%.",
         sentiment_score=-0.8, impact="high"),
    dict(date="2020-05-22", title="RBI cuts repo to 4.00%",
         category="rate_decision",
         description="40 bps off-cycle cut, reducing repo to 4.00%. Moratorium extended by three months.",
         sentiment_score=-0.8, impact="high"),
    dict(date="2020-05-23", title="Reverse repo cut to 3.35%",
         category="liquidity",
         description="RBI cut reverse repo to 3.35% to disincentivize banks from parking funds with RBI and push lending.",
         sentiment_score=-0.7, impact="high"),
    dict(date="2020-08-06", title="RBI holds repo at 4.00%",
         category="rate_decision",
         description="MPC held rates; inflation above 6% but growth outlook bleak amid pandemic second wave fears.",
         sentiment_score=0.1, impact="medium"),
    dict(date="2020-10-09", title="RBI holds repo at 4.00%, on-tap TLTRO",
         category="rate_decision",
         description="Repo unchanged; RBI launched on-tap TLTRO to direct liquidity to stressed sectors.",
         sentiment_score=-0.3, impact="medium"),
    dict(date="2020-12-04", title="RBI holds repo at 4.00%",
         category="rate_decision",
         description="Accommodative stance maintained; GDP contracted 7.5% in Q2 FY21.",
         sentiment_score=-0.2, impact="medium"),

    # --- 2021 ---
    dict(date="2021-02-05", title="RBI holds repo at 4.00%, signals continuation",
         category="rate_decision",
         description="MPC unanimously held rates, pledging to maintain accommodative stance as long as necessary.",
         sentiment_score=-0.3, impact="medium"),
    dict(date="2021-04-07", title="RBI holds repo at 4.00% amid second COVID wave",
         category="rate_decision",
         description="Rate unchanged despite devastating second COVID wave. RBI announced G-SAP 1.0 bond purchases.",
         sentiment_score=-0.5, impact="high"),
    dict(date="2021-04-15", title="COVID second wave peaks",
         category="pandemic",
         description="India's daily cases surpassed 200,000 with health system under severe strain.",
         sentiment_score=-0.6, impact="high"),
    dict(date="2021-06-04", title="RBI holds repo at 4.00%, G-SAP 2.0",
         category="rate_decision",
         description="MPC maintained status quo; announced G-SAP 2.0 with Rs 1.2 lakh crore bond purchases.",
         sentiment_score=-0.4, impact="medium"),
    dict(date="2021-08-06", title="RBI holds repo at 4.00%",
         category="rate_decision",
         description="Accommodative stance retained. RBI raised GDP forecast for FY22 to 9.5%.",
         sentiment_score=-0.2, impact="medium"),
    dict(date="2021-10-08", title="RBI holds repo, begins VRRR normalization",
         category="liquidity",
         description="Repo at 4% but RBI initiated variable rate reverse repo auctions to gradually absorb pandemic-era surplus liquidity.",
         sentiment_score=0.4, impact="high"),
    dict(date="2021-12-08", title="RBI holds repo at 4.00%",
         category="rate_decision",
         description="MPC kept rates unchanged; signaled patience despite rising global inflation trends.",
         sentiment_score=-0.1, impact="medium"),

    # --- 2022 ---
    dict(date="2022-02-09", title="RBI holds repo at 4.00%, hawkish tilt",
         category="rate_decision",
         description="Repo held but MPC dropped accommodative forward guidance, signaling policy normalization ahead.",
         sentiment_score=0.4, impact="high"),
    dict(date="2022-02-24", title="Russia-Ukraine war begins",
         category="external",
         description="Russian invasion of Ukraine sparked commodity price surge, threatening India's inflation outlook and current account.",
         sentiment_score=0.5, impact="high"),
    dict(date="2022-04-08", title="RBI holds repo at 4.00%, introduces SDF",
         category="liquidity",
         description="RBI introduced the Standing Deposit Facility at 3.75%, effectively raising the floor rate by 40 bps and signaling tightening.",
         sentiment_score=0.6, impact="high"),
    dict(date="2022-05-04", title="RBI emergency hike to 4.40%",
         category="rate_decision",
         description="Off-cycle 40 bps hike as CPI breached 7%. Marked the start of the tightening cycle.",
         sentiment_score=0.8, impact="high"),
    dict(date="2022-06-08", title="RBI hikes repo to 4.90%",
         category="rate_decision",
         description="50 bps hike as inflation persisted above 7%. MPC stance shifted to withdrawal of accommodation.",
         sentiment_score=0.8, impact="high"),
    dict(date="2022-08-05", title="RBI hikes repo to 5.40%",
         category="rate_decision",
         description="Third straight hike of 50 bps amid elevated food and energy inflation.",
         sentiment_score=0.7, impact="high"),
    dict(date="2022-09-30", title="RBI hikes repo to 5.90%",
         category="rate_decision",
         description="50 bps hike; cumulative 190 bps since May. Rupee under pressure near 82/$.",
         sentiment_score=0.7, impact="high"),
    dict(date="2022-12-07", title="RBI hikes repo to 6.25%",
         category="rate_decision",
         description="35 bps hike, slowing the pace; CPI began moderating from peaks.",
         sentiment_score=0.5, impact="high"),

    # --- 2023 ---
    dict(date="2023-02-08", title="RBI hikes repo to 6.50%",
         category="rate_decision",
         description="25 bps terminal hike of the cycle; MPC voted 4-2. Cumulative 250 bps since May 2022.",
         sentiment_score=0.5, impact="high"),
    dict(date="2023-03-10", title="SVB collapse / global banking stress",
         category="external",
         description="Silicon Valley Bank failure triggered global banking concerns; Indian markets saw brief risk-off moves.",
         sentiment_score=0.3, impact="medium"),
    dict(date="2023-04-06", title="RBI pauses at 6.50%",
         category="rate_decision",
         description="Surprise pause after six consecutive hikes. MPC signaled data-dependent approach.",
         sentiment_score=-0.4, impact="high"),
    dict(date="2023-06-08", title="RBI holds repo at 6.50%",
         category="rate_decision",
         description="Second consecutive pause; inflation softened to 4.3%. MPC flagged monsoon and food-price risks.",
         sentiment_score=-0.2, impact="medium"),
    dict(date="2023-08-10", title="RBI holds repo at 6.50%, incremental CRR",
         category="rate_decision",
         description="Rate held; RBI imposed temporary incremental CRR of 10% to absorb Rs 2000 note withdrawal liquidity.",
         sentiment_score=0.5, impact="high"),
    dict(date="2023-10-06", title="RBI holds repo at 6.50%",
         category="rate_decision",
         description="MPC voted unanimously to hold. GDP growth upgraded to 6.5% for FY24.",
         sentiment_score=0.1, impact="medium"),
    dict(date="2023-12-08", title="RBI holds repo at 6.50%",
         category="rate_decision",
         description="Fifth consecutive hold; inflation within band but withdrawal of accommodation stance retained.",
         sentiment_score=0.1, impact="medium"),

    # --- 2024 ---
    dict(date="2024-02-08", title="RBI holds repo at 6.50%",
         category="rate_decision",
         description="MPC voted 5-1 to hold; Das warned of premature easing. GDP growth robust at 7%+.",
         sentiment_score=0.2, impact="medium"),
    dict(date="2024-04-05", title="RBI holds repo at 6.50%",
         category="rate_decision",
         description="Seventh consecutive hold; MPC flagged geopolitical risks but GDP outlook remained strong.",
         sentiment_score=0.1, impact="medium"),
    dict(date="2024-06-07", title="RBI holds repo at 6.50%",
         category="rate_decision",
         description="Status quo maintained; new MPC member appointment process underway.",
         sentiment_score=0.1, impact="medium"),
    dict(date="2024-08-08", title="RBI holds repo at 6.50%, stance change",
         category="rate_decision",
         description="Rate held but MPC changed stance to neutral from withdrawal of accommodation, opening door to future cuts.",
         sentiment_score=-0.3, impact="high"),
    dict(date="2024-10-09", title="RBI holds repo at 6.50%, neutral stance",
         category="rate_decision",
         description="Newly constituted MPC under governor Malhotra held rates; inflation within the 2-6% band.",
         sentiment_score=-0.1, impact="medium"),
    dict(date="2024-12-06", title="RBI cuts CRR by 50 bps",
         category="liquidity",
         description="RBI reduced CRR to 4% from 4.5%, infusing Rs 1.16 lakh crore of liquidity into the banking system.",
         sentiment_score=-0.6, impact="high"),
]


# ====================================================================
# 2. NLP Analysis Functions
# ====================================================================

IMPACT_WEIGHT = {"high": 3, "medium": 2, "low": 1}

HAWKISH_TERMS = [
    "tightening", "hike", "hiked", "inflation", "hawkish", "raised",
    "withdrawal", "CRR", "incremental", "tightening", "pressure",
    "elevated", "surge", "surged", "breach", "above target",
]
DOVISH_TERMS = [
    "cut", "cuts", "easing", "accommodation", "accommodative", "dovish",
    "slash", "reduced", "relief", "moratorium", "LTRO", "refinance",
    "support", "benign", "lowered", "soft",
]
CRISIS_TERMS = [
    "crisis", "stress", "default", "defaulted", "panic", "moratorium",
    "collapse", "failure", "lockdown", "pandemic", "contagion",
    "risk-off", "disruption",
]


def _snap_to_friday(date_str: str) -> pd.Timestamp:
    """Snap a date to the nearest following Friday (W-FRI grid)."""
    dt = pd.Timestamp(date_str)
    days_ahead = 4 - dt.weekday()  # Friday = 4
    if days_ahead <= 0:
        days_ahead += 7
    if dt.weekday() == 4:
        return dt  # already Friday
    return dt + pd.Timedelta(days=days_ahead)


def build_events_df() -> pd.DataFrame:
    """Convert the events list into a DataFrame with Friday-aligned dates."""
    df = pd.DataFrame(EVENTS)
    df["event_date"] = pd.to_datetime(df["date"])
    df["week_date"] = df["event_date"].apply(
        lambda d: _snap_to_friday(d.strftime("%Y-%m-%d"))
    )
    df["weight"] = df["impact"].map(IMPACT_WEIGHT)
    return df


def _count_terms(text: str, term_list: list[str]) -> int:
    text_lower = text.lower()
    return sum(1 for t in term_list if t.lower() in text_lower)


def compute_weekly_sentiment(events_df: pd.DataFrame,
                             date_index: pd.DatetimeIndex) -> pd.Series:
    """Weighted-average sentiment per week; 0 for empty weeks."""
    sentiment = pd.Series(0.0, index=date_index, name="news_sentiment")
    for wk, grp in events_df.groupby("week_date"):
        if wk in sentiment.index:
            weights = grp["weight"].values
            scores = grp["sentiment_score"].values
            sentiment.loc[wk] = np.average(scores, weights=weights)
    return sentiment


def compute_keyword_frequency(events_df: pd.DataFrame,
                              date_index: pd.DatetimeIndex) -> pd.DataFrame:
    """Count hawkish / dovish / crisis keywords per week."""
    cols = {"hawkish_score": HAWKISH_TERMS,
            "dovish_score": DOVISH_TERMS,
            "crisis_score": CRISIS_TERMS}
    result = pd.DataFrame(0, index=date_index, columns=list(cols.keys()))
    for wk, grp in events_df.groupby("week_date"):
        if wk not in result.index:
            continue
        combined = " ".join(grp["description"].tolist())
        for col, terms in cols.items():
            result.loc[wk, col] = _count_terms(combined, terms)
    return result


def compute_event_density(events_df: pd.DataFrame,
                          date_index: pd.DatetimeIndex) -> pd.DataFrame:
    """Rolling 4-week and 8-week event counts."""
    counts = pd.Series(0, index=date_index, name="event_count")
    for wk, grp in events_df.groupby("week_date"):
        if wk in counts.index:
            counts.loc[wk] = len(grp)
    density = pd.DataFrame(index=date_index)
    density["event_density_4w"] = counts.rolling(4, min_periods=1).sum()
    density["event_density_8w"] = counts.rolling(8, min_periods=1).sum()
    return density


def classify_event_periods(date_index: pd.DatetimeIndex) -> pd.Series:
    """Label each week with a broad event-regime name."""
    periods = pd.Series("normal", index=date_index, name="event_period")
    for dt in date_index:
        if dt < pd.Timestamp("2016-11-01"):
            periods.loc[dt] = "pre_demonetization"
        elif dt < pd.Timestamp("2017-03-01"):
            periods.loc[dt] = "demonetization_shock"
        elif dt < pd.Timestamp("2017-12-01"):
            periods.loc[dt] = "gst_transition"
        elif dt < pd.Timestamp("2019-03-01"):
            periods.loc[dt] = "ilfs_crisis"
        elif dt < pd.Timestamp("2020-03-01"):
            periods.loc[dt] = "pre_covid"
        elif dt < pd.Timestamp("2020-09-01"):
            periods.loc[dt] = "covid_shock"
        elif dt < pd.Timestamp("2022-05-01"):
            periods.loc[dt] = "recovery"
        elif dt < pd.Timestamp("2023-04-01"):
            periods.loc[dt] = "rate_hike_cycle"
        else:
            periods.loc[dt] = "rate_pause"
    return periods


# ====================================================================
# 3. Integration with master data
# ====================================================================

def integrate(master_path: str | Path) -> pd.DataFrame:
    """Read master data, attach NLP features, and return enriched DataFrame."""
    master = pd.read_csv(master_path, parse_dates=["week_date"])
    master = master.sort_values("week_date").reset_index(drop=True)
    date_idx = master["week_date"]

    events_df = build_events_df()

    sentiment = compute_weekly_sentiment(events_df, date_idx)
    keywords = compute_keyword_frequency(events_df, date_idx)
    density = compute_event_density(events_df, date_idx)
    periods = classify_event_periods(date_idx)

    master["news_sentiment"] = sentiment.values
    for col in keywords.columns:
        master[col] = keywords[col].values
    for col in density.columns:
        master[col] = density[col].values
    master["event_period"] = periods.values
    return master


# ====================================================================
# 4. Visualizations
# ====================================================================

def plot_sentiment_timeline(master: pd.DataFrame, events_df: pd.DataFrame,
                            out_dir: Path) -> None:
    """Dual-axis: WACMR line + sentiment bars + major event annotations."""
    fig, ax1 = plt.subplots(figsize=(18, 7))

    color_wacmr = "#1a5276"
    ax1.plot(master["week_date"], master["target_wacmr"],
             color=color_wacmr, linewidth=1.2, label="WACMR")
    ax1.set_ylabel("WACMR (%)", color=color_wacmr, fontsize=12)
    ax1.tick_params(axis="y", labelcolor=color_wacmr)

    ax2 = ax1.twinx()
    colors = master["news_sentiment"].apply(
        lambda x: "#27ae60" if x < 0 else ("#e74c3c" if x > 0 else "#bdc3c7")
    )
    ax2.bar(master["week_date"], master["news_sentiment"],
            width=5, alpha=0.55, color=colors, label="Sentiment")
    ax2.set_ylabel("News Sentiment (dovish - / hawkish +)", fontsize=12)
    ax2.set_ylim(-1.2, 1.2)

    # Annotate top events
    high_events = events_df[events_df["impact"] == "high"].copy()
    # Pick a subset to avoid clutter (every other high event)
    annotated = high_events.iloc[::3]
    for _, row in annotated.iterrows():
        ax1.axvline(row["event_date"], color="grey", linestyle="--",
                     alpha=0.35, linewidth=0.7)
        ax1.annotate(
            row["title"][:35],
            xy=(row["event_date"],
                master.loc[master["week_date"] == row["week_date"],
                           "target_wacmr"].values[0]
                if len(master.loc[master["week_date"] == row["week_date"],
                                  "target_wacmr"].values) > 0
                else master["target_wacmr"].median()),
            fontsize=6.5, rotation=40, alpha=0.8,
            ha="left", va="bottom",
        )

    ax1.xaxis.set_major_locator(mdates.YearLocator())
    ax1.xaxis.set_major_formatter(mdates.DateFormatter("%Y"))
    ax1.set_xlabel("Date")
    ax1.set_title("WACMR and News Sentiment Timeline (2014-2024)", fontsize=14)
    fig.tight_layout()
    fig.savefig(out_dir / "news_sentiment_timeline.png", dpi=180)
    plt.close(fig)
    print(f"  Saved {out_dir / 'news_sentiment_timeline.png'}")


def plot_event_density_heatmap(events_df: pd.DataFrame, out_dir: Path) -> None:
    """Heatmap of event categories by year."""
    events_df = events_df.copy()
    events_df["year"] = events_df["event_date"].dt.year
    pivot = events_df.groupby(["year", "category"]).size().unstack(fill_value=0)

    fig, ax = plt.subplots(figsize=(12, 6))
    sns.heatmap(pivot, annot=True, fmt="d", cmap="YlOrRd",
                linewidths=0.5, ax=ax)
    ax.set_title("Event Categories by Year", fontsize=14)
    ax.set_ylabel("Year")
    ax.set_xlabel("Category")
    fig.tight_layout()
    fig.savefig(out_dir / "event_density_heatmap.png", dpi=180)
    plt.close(fig)
    print(f"  Saved {out_dir / 'event_density_heatmap.png'}")


# ====================================================================
# 5. Summary
# ====================================================================

def print_summary(master: pd.DataFrame, events_df: pd.DataFrame) -> None:
    print("\n" + "=" * 65)
    print(" STAGE 6 -- NLP News Sentiment Analysis Summary")
    print("=" * 65)

    # Events by category
    print("\n--- Events by category ---")
    cat_counts = events_df["category"].value_counts()
    for cat, cnt in cat_counts.items():
        print(f"  {cat:20s}: {cnt}")
    print(f"  {'TOTAL':20s}: {len(events_df)}")

    # Correlations
    print("\n--- Correlations with news_sentiment ---")
    fin_cols = ["target_wacmr", "rates_I7496_17", "spread_wacmr_minus_repo"]
    for col in fin_cols:
        if col in master.columns:
            valid = master[["news_sentiment", col]].dropna()
            if len(valid) > 10:
                corr = valid["news_sentiment"].corr(valid[col])
                print(f"  Corr(news_sentiment, {col:30s}) = {corr:+.4f}")

    # Top-5 highest-impact weeks
    print("\n--- Top 5 highest-impact weeks ---")
    ranked = master[master["news_sentiment"] != 0].copy()
    ranked["abs_sentiment"] = ranked["news_sentiment"].abs()
    ranked = ranked.nlargest(5, "abs_sentiment")
    for _, row in ranked.iterrows():
        wacmr = row.get("target_wacmr", float("nan"))
        print(f"  {str(row['week_date'].date()):12s}  sentiment={row['news_sentiment']:+.3f}"
              f"  WACMR={wacmr:.2f}  period={row['event_period']}")

    print("\n" + "=" * 65 + "\n")


# ====================================================================
# main
# ====================================================================

def main() -> None:
    master_csv = BASE_DIR / "master_data" / "Weekly_Macro_Master.csv"
    nlp_csv = BASE_DIR / "master_data" / "Weekly_Macro_Master_NLP.csv"
    events_json_dir = BASE_DIR / "backend" / "nlp" / "news_data"
    vis_dir = BASE_DIR / "visualizations"

    # Ensure output directories exist
    os.makedirs(events_json_dir, exist_ok=True)
    os.makedirs(vis_dir, exist_ok=True)

    # Build events DataFrame
    events_df = build_events_df()

    # Save events JSON
    events_json_path = events_json_dir / "events.json"
    with open(events_json_path, "w") as f:
        json.dump(EVENTS, f, indent=2)
    print(f"[+] Saved {len(EVENTS)} events to {events_json_path}")

    # Integrate with master data
    print("[+] Integrating NLP features with master data ...")
    master = integrate(master_csv)
    master.to_csv(nlp_csv, index=False)
    print(f"[+] Saved enriched data to {nlp_csv}")

    # Visualizations
    print("[+] Generating visualizations ...")
    plot_sentiment_timeline(master, events_df, vis_dir)
    plot_event_density_heatmap(events_df, vis_dir)

    # Summary
    print_summary(master, events_df)


if __name__ == "__main__":
    main()
