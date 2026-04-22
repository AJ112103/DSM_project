import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  Prose,
  Section,
  H2,
  Lede,
  Callout,
  Stat,
  StatGrid,
  CodeBlock,
  Figure,
  BlogTable,
  TimeSeriesEmbed,
  ShapBarEmbed,
  CounterfactualEmbed,
  DashboardLink,
  ScrollSpyTOC,
} from "@/components/blog/prose";

export const metadata = {
  title: "Predicting the heartbeat of Indian monetary policy — WACMR Analytics",
  description:
    "A 545-week investigation into India's Weighted Average Call Money Rate. Regimes, walk-forward forecasting, SHAP, and policy counterfactuals.",
};

const TOC = [
  { id: "why-it-matters", label: "1. Why this rate matters" },
  { id: "the-data", label: "2. What data did we need?" },
  { id: "aligning", label: "3. Aligning twelve datasets" },
  { id: "regimes", label: "4. Finding structure: PCA + regimes" },
  { id: "forecast", label: "5. Forecasting with walk-forward validation" },
  { id: "shap", label: "6. Opening the black box with SHAP" },
  { id: "news", label: "7. Does news sentiment help?" },
  { id: "counterfactuals", label: "8. Policy counterfactuals" },
  { id: "limits", label: "9. Limitations and what we'd do next" },
  { id: "recommendations", label: "10. Recommendations" },
  { id: "try-it", label: "11. Try it yourself" },
];

const DATASETS: (string | number)[][] = [
  ["RBI Ratios & Rates", "NDAP / RBI", "Weekly", 545, "Repo, Reverse Repo, MSF, CRR, SLR, T-bill yields"],
  ["RBI Liabilities & Assets", "NDAP / RBI", "Weekly", 545, "Central-bank balance sheet"],
  ["Weekly Aggregates", "NDAP / RBI", "Weekly", 545, "M3, reserve money, currency in circulation"],
  ["Market Repo Transactions", "NDAP / RBI", "Weekly", 545, "Daily-volume & weighted-rate"],
  ["Treasury Bills Details", "NDAP / RBI", "Weekly", 545, "91-, 182-, 364-day T-bills"],
  ["Commercial Paper Details", "NDAP / RBI", "Weekly", 545, "CP outstanding, CP rates"],
  ["Central Govt Dated Securities", "NDAP / RBI", "Weekly", 545, "G-Sec issuance & yields"],
  ["CPI Major Price Indices", "NDAP / MoSPI", "Monthly → weekly", 545, "Headline, food, core, fuel CPI"],
  ["Nifty 50 OHLCV", "Yahoo Finance", "Weekly", 553, "Equity flows proxy + tech indicators"],
  ["USD/INR OHLCV", "Yahoo Finance", "Weekly", 553, "FX intervention signal"],
];

const PERF: (string | number)[][] = [
  ["Baseline XGBoost", "0.1019", "0.0646", "70.9%", "Rate corridor + lags only"],
  ["Regime-Aware XGBoost", "0.1044", "0.0646", "70.9%", "Adds K-Means cluster label + distances"],
  ["Baseline + News NLP", "0.0988", "0.0633", "72.4%", "Adds 75-event sentiment features"],
];

export default function WacmrInvestigationPost() {
  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href="/blog"
        className="mb-8 inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-slate-500 transition-colors hover:text-slate-300"
      >
        <ArrowLeft className="h-3 w-3" />
        Back to blog
      </Link>

      {/* Hero */}
      <header className="mx-auto max-w-3xl space-y-6 pb-6">
        <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-cyan-400">
          <time>April 2026</time>
          <span>·</span>
          <span>≈ 18 min read</span>
          <span>·</span>
          <span>With figures, code &amp; live widgets</span>
        </div>
        <h1
          className="text-balance text-4xl leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl"
          style={{ fontFamily: "var(--font-instrument-serif)" }}
        >
          Predicting the{" "}
          <em className="italic text-cyan-300">heartbeat</em>{" "}
          of Indian monetary policy
        </h1>
        <Lede>
          A 545-week investigation into the Weighted Average Call Money Rate —
          the overnight rate at which Indian banks settle their cash books, and
          the quietest but most honest signal that RBI policy is actually
          transmitting.
        </Lede>
        {/* Key-findings ribbon */}
        <dl className="mt-6 grid grid-cols-2 divide-slate-800 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40 sm:grid-cols-5 sm:divide-x">
          {[
            { k: "Weeks", v: "545" },
            { k: "Features", v: "119" },
            { k: "Regimes", v: "2" },
            { k: "RMSE", v: "0.102" },
            { k: "DA", v: "70.9%" },
          ].map((s, i, arr) => (
            <div
              key={s.k}
              className={
                "px-4 py-3 sm:py-4 " +
                (i < arr.length - 1 ? "border-b border-slate-800 sm:border-b-0" : "")
              }
            >
              <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
                {s.k}
              </dt>
              <dd className="mt-1 font-mono text-xl tabular-nums text-white">
                {s.v}
              </dd>
            </div>
          ))}
        </dl>
      </header>

      {/* Two-column layout: article + sticky TOC */}
      <div className="mt-8 gap-12 lg:grid lg:grid-cols-[minmax(0,1fr)_14rem] lg:items-start">
        <article className="min-w-0">
          {/* In-flow TOC (mobile + fallback) */}
          <nav className="not-prose mx-auto mb-8 max-w-3xl rounded-2xl border border-slate-800 bg-slate-900/40 p-5 lg:hidden">
            <div className="mb-3 font-mono text-[10px] uppercase tracking-wider text-slate-500">
              Table of contents
            </div>
            <ol className="grid grid-cols-1 gap-1 text-sm text-slate-300 sm:grid-cols-2">
              {TOC.map((item) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    className="block rounded px-2 py-1 hover:bg-slate-800 hover:text-cyan-300"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <Prose>
            <Section id="why-it-matters">
              <H2 id="why-it-matters">1. Why this rate matters</H2>
              <p>
                The <strong>Weighted Average Call Money Rate</strong> — WACMR —
                is the interest rate at which scheduled Indian banks lend each
                other money overnight, settled on the books of the Reserve Bank
                of India. Conceptually it is a single number, published daily,
                that answers the question:{" "}
                <em>how much is it costing Indian banks to be short of cash tonight?</em>
              </p>
              <p>
                That sounds esoteric, but it is the sharpest thermometer we have
                of monetary-policy transmission. The RBI chooses a policy stance
                and publishes a repo rate. The WACMR is where that stance
                actually has to clear against banks&apos; liquidity needs and
                the interbank market&apos;s demand for cash. If the RBI cuts the
                repo rate and WACMR doesn&apos;t follow, policy is not
                transmitting. If the RBI holds but the WACMR drifts low, the
                system is sloshing with liquidity. The gap between the two —
                the <code>WACMR – Repo</code> spread — is the market&apos;s
                honest opinion of the policy stance.
              </p>
              <p>We set out to do three things with this series:</p>
              <ol>
                <li>Frame a forecasting problem — predict the WACMR one week ahead.</li>
                <li>Understand the structure — is the series one stable process, or several?</li>
                <li>
                  Make the result useful — let a researcher (or a reviewer, or a
                  curious economist) interrogate the model.
                </li>
              </ol>
              <p>
                This essay walks through what the data said, what the model
                learned, and what was genuinely surprising. The companion{" "}
                <Link href="/">interactive dashboard</Link> lets you drill into
                any number cited here.
              </p>

              <Figure
                src="/visualizations/target_timeseries.png"
                caption="The forecasting target: weekly WACMR from Feb 2014 to Jul 2024. The sharp drop in March 2020 — and the persistence of low rates that followed — is the core empirical puzzle the rest of this essay unpacks."
                alt="WACMR weekly time series"
              />
            </Section>

            <Section id="the-data">
              <H2 id="the-data">2. What data did we need?</H2>
              <p>
                A good forecast for an overnight rate needs three kinds of data:
                (a) <strong>policy-rate</strong> signals from the central bank,
                (b) <strong>liquidity and balance-sheet</strong> variables from
                the banking system, and (c){" "}
                <strong>market-clearing prices</strong> from adjacent markets
                (T-bills, commercial paper, repo, forex). We pulled eight
                datasets from the{" "}
                <a
                  href="https://ndap.niti.gov.in/"
                  target="_blank"
                  rel="noreferrer"
                >
                  NITI Aayog National Data &amp; Analytics Platform (NDAP)
                </a>
                , which exposes an authenticated JSON API to the RBI&apos;s
                published weekly series.
              </p>

              <BlogTable
                headers={["Dataset", "Source", "Frequency", "Rows", "What it captures"]}
                rows={DATASETS}
                caption="Table 1 — The 10-dataset master panel. All 10 sources are aligned onto a canonical Friday grid between Feb 2014 and Jul 2024 (545 weekly rows)."
              />

              <CodeBlock lang="python">{`# stage1_fetch_api_ndap.py — excerpt
import requests

NDAP_DATASETS = {
    "RBI_Weekly_Statistics_Ratios_Rates": "SRC1234",
    "RBI_Liabilities_and_Assets":         "SRC1235",
    "Market_Repo_Transactions":           "SRC1236",
    "Treasury_Bills_Details":             "SRC1237",
    "Commercial_Paper_Details":           "SRC1238",
    # ... five more
}

def fetch(src_id: str):
    url = f"https://ndapapi.niti.gov.in/api/v1/{src_id}"
    page = 1
    while True:
        r = requests.post(url, json={"pagenumber": page, "pagesize": 500})
        batch = r.json()["Data"]
        if not batch:
            return
        yield from batch
        page += 1`}</CodeBlock>

              <p>
                The NDAP API is paginated (500 rows per page) and required a
                simple retry wrapper for rate limits. To round out the picture
                we added two Yahoo Finance series — the Nifty 50 equity index
                and USD/INR — and a hand-curated list of 75 RBI policy events
                between 2014 and 2024 with manual sentiment scores, so we could
                see whether news adds real lift beyond the quantitative
                features.
              </p>

              <Callout tone="info" title="Reproducibility">
                <p>
                  Every figure in this post is generated from the raw data by
                  the pipeline in the repo. <code>stage1_*</code> fetches and
                  caches; <code>stage2_alignment_db.py</code> reshapes to a
                  weekly grid and writes the SQLite database the dashboard
                  reads; <code>stage3_advanced_eda.py</code> fits the regime
                  model; <code>stage4_supervised_ml.py</code> trains XGBoost
                  with walk-forward validation.
                </p>
              </Callout>
            </Section>

            <Section id="aligning">
              <H2 id="aligning">3. Aligning twelve datasets to a weekly grid</H2>
              <p>
                The RBI publishes most series weekly, but with inconsistent
                reference dates — some as-of Friday, some as-of the Wednesday
                prior, some as of the last Friday of the prior week. Yahoo
                Finance prices are daily. Our policy events are irregular.
                Before we could feed the data to any model we had to pick a
                single temporal grid and commit to it.
              </p>
              <p>
                We chose <strong>Friday close</strong> as the canonical weekly
                timestamp. Daily series were last-observation-carried-forward
                (LOCF) onto the Friday grid; weekly series were reindexed and
                forward-filled only when the gap was ≤ 1 week (otherwise the
                slot was left <code>NaN</code> and flagged). Technical
                indicators (MACD, TSI, SuperTrend, Bollinger squeeze) were
                computed on the daily data and then sampled at Friday close,
                not the other way around — this keeps indicator semantics
                intact.
              </p>

              <TimeSeriesEmbed
                columns={["target_wacmr", "rates_I7496_17"]}
                title="WACMR vs Repo Rate, 2014–2024"
                caption="The overnight call money rate tracks the repo rate inside a narrow corridor, but with sharp, regime-dependent excursions. The structural break in March 2020 is visible to the naked eye."
              />

              <p>
                The joined master table has <strong>545 weekly observations</strong>{" "}
                from 2014-02-07 to 2024-07-19 across <strong>119 columns</strong>.
                A schema catalogue (<code>column_registry.py</code>) maps every
                cryptic NDAP code (<code>rates_I7496_17</code>,{" "}
                <code>la_I7492_14</code>, …) to a human-readable label —
                without that catalogue the agent in the sidebar would be
                useless.
              </p>

              <StatGrid>
                <Stat value="545" label="Weekly observations" tone="cyan" />
                <Stat value="119" label="Engineered features" tone="cyan" />
                <Stat value="10" label="Source datasets" tone="cyan" />
                <Stat value="75" label="Curated policy events" tone="cyan" />
              </StatGrid>
            </Section>

            <Section id="regimes">
              <H2 id="regimes">4. Finding structure: PCA + regime discovery</H2>
              <p>
                Before fitting a forecasting model it&apos;s worth asking: is
                this series one stable process, or does it switch between
                states? A casual look at the chart above suggests the latter —
                the pre-COVID and post-COVID periods feel qualitatively
                different. We wanted a data-driven answer.
              </p>
              <p>
                We standardised every numeric feature, ran PCA to retain 90% of
                variance, then K-Means clustering on the reduced coordinates
                with a silhouette sweep over <code>k = 2…7</code>. The
                silhouette peaked cleanly at <strong>k = 2</strong>, with a
                single transition at <strong>2020-03-06</strong> — the week
                that the WHO declared COVID-19 a pandemic. K-Means did not know
                about the pandemic. It found it in the data.
              </p>

              <Figure
                src="/visualizations/silhouette_scores.png"
                caption="Silhouette score (plus the elbow on inertia) across K ∈ {2…7}. K = 2 wins cleanly — both metrics agree that exactly two regimes best describe the feature space."
                alt="Silhouette and elbow scan across k"
              />

              <CodeBlock lang="python">{`# stage3_advanced_eda.py — excerpt
from sklearn.decomposition import PCA
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score

X_scaled = StandardScaler().fit_transform(X)
pca = PCA(random_state=42)
pca.fit(X_scaled)
n_comp = int(np.argmax(np.cumsum(pca.explained_variance_ratio_) >= 0.90)) + 1
X_pca = PCA(n_components=n_comp, random_state=42).fit_transform(X_scaled)

scores = {}
for k in range(2, 8):
    km = KMeans(n_clusters=k, random_state=42, n_init=15).fit(X_pca)
    scores[k] = silhouette_score(X_pca, km.labels_)

optimal_k = max(scores, key=scores.get)   # -> 2`}</CodeBlock>

              <Figure
                src="/visualizations/pca_regime_scatter.png"
                caption="Weeks projected onto the first two principal components, coloured by K-Means cluster. The separation is geometric, not temporal — yet the boundary aligns almost exactly with the March 2020 COVID break."
                alt="PCA scatter coloured by regime label"
              />

              <Callout tone="finding" title="Finding #1 — The regime break is real, not cosmetic">
                <p>
                  Regime <strong>1</strong> (Normal / Tightening) spans
                  2014-02-07 → 2020-03-06, 308 weeks, mean WACMR ≈ 6.5%. Regime{" "}
                  <strong>0</strong> (Accommodation) spans 2020-03-06 →
                  2024-07-19, 237 weeks, mean WACMR ≈ 4.8%. There is{" "}
                  <em>one</em> transition in the entire sample — not a drift, a
                  step.
                </p>
              </Callout>

              <Figure
                src="/visualizations/regime_timeseries.png"
                caption="WACMR with regime bands overlaid. The green region (Regime 1) is the pre-COVID tightening era; the amber region (Regime 0) is the post-COVID accommodation regime that outlasted the pandemic."
                alt="WACMR regime-shaded time series"
              />

              <Figure
                src="/visualizations/regime_wacmr_boxplot.png"
                caption="Regime-wise distribution of WACMR. Means differ by ~150 bps (6.5% vs 4.8%) and the second moment differs too — Regime 0 is both lower and tighter."
                alt="WACMR distribution by regime"
              />

              <p>
                Two observations make this interesting beyond the obvious COVID
                narrative. First, the post-COVID regime outlasted the pandemic:
                the RBI held rates low well into 2022 even as headline CPI
                inflation rose, and the cluster structure reflects that
                deliberately. Second, the 2022–2024 re-tightening cycle did{" "}
                <em>not</em> produce a return to the earlier regime — rate
                levels rose but the broader system behaviour (liquidity
                posture, market-repo rates, term-premium structure) stayed in
                Regime 0.
              </p>
              <DashboardLink
                href="/regimes"
                label="Explore the regimes interactively"
                blurb="PCA projection coloured by cluster, regime fact sheets, and a transition timeline."
              />
            </Section>

            <Section id="forecast">
              <H2 id="forecast">5. Forecasting with walk-forward validation</H2>
              <p>
                We chose XGBoost — a gradient-boosted tree ensemble — for the
                forecasting model. The motivation wasn&apos;t raw performance;
                it was <strong>interpretability</strong>. XGBoost trees are
                additive, and SHAP decomposes any prediction into per-feature
                contributions in closed form. For a research artefact that has
                to answer <em>why did the model say that</em>, that matters
                more than a fractional RMSE win from a deep net.
              </p>
              <p>
                The validation protocol is{" "}
                <strong>expanding-window walk-forward cross-validation</strong>{" "}
                with a minimum train size of 156 weeks (3 years). For each test
                week <code>t</code> ≥ 156, we retrain on weeks{" "}
                <code>0…t-1</code>, predict week <code>t</code>, and move on.
                No future information ever leaks into training. This is the
                only honest way to validate a time-series model.
              </p>

              <CodeBlock lang="python">{`# stage4_supervised_ml.py — expanding-window CV
for t in range(MIN_TRAIN_SIZE, n):
    X_train, y_train = X[:t], y[:t]
    model = XGBRegressor(
        n_estimators=400, learning_rate=0.05, max_depth=4,
        subsample=0.8, colsample_bytree=0.8, random_state=42,
    )
    model.fit(X_train, y_train)
    pred = model.predict(X[t:t+1])[0]
    results.append({"week": dates[t], "actual": y[t], "predicted": pred})`}</CodeBlock>

              <Figure
                src="/visualizations/actual_vs_predicted.png"
                caption="Walk-forward predictions (dashed) against the actual WACMR (solid) across 389 one-week-ahead folds. The model tracks both the 2020 regime break and the 2022–24 tightening cycle."
                alt="Actual vs predicted WACMR"
              />

              <BlogTable
                headers={["Model", "RMSE", "MAE", "Directional accuracy", "Notes"]}
                rows={PERF}
                caption="Table 2 — Walk-forward performance. Regime labels do not help because XGBoost's splits already reconstruct the regime boundary from autoregressive features. News features produce a small but real RMSE improvement."
              />

              <StatGrid>
                <Stat value="0.102" label="Walk-forward RMSE" tone="emerald" />
                <Stat value="0.065" label="MAE (percentage points)" tone="emerald" />
                <Stat value="70.9%" label="Directional accuracy" tone="emerald" />
                <Stat value="389" label="Out-of-sample weeks scored" tone="emerald" />
              </StatGrid>
              <p>
                An RMSE of ~10 basis points on a series that lives in a ±300
                basis point corridor is respectable. A directional accuracy of
                ~71% on week-over-week changes is the headline number —
                significantly above a random-walk baseline (50%), and useful
                for any treasurer deciding whether to park excess liquidity
                overnight.
              </p>

              <Figure
                src="/visualizations/residual_calendar.png"
                caption="Residuals by week-of-year and month. No clear seasonality survives — good news, and our calendar-effect hypothesis is rejected."
                alt="Residual calendar heatmap"
              />

              <Callout tone="warn" title="Why not a deep model?">
                <p>
                  We tried an LSTM and a small Transformer; neither beat
                  walk-forward XGBoost meaningfully on this dataset, and both
                  came with worse explanations. With 545 observations and
                  ~120 features, the bias/variance budget favours trees.
                </p>
              </Callout>
              <DashboardLink
                href="/forecast"
                label="Walk-forward predictions with drill-down"
                blurb="Actual vs predicted over time, per-week waterfall explanations, and SHAP summaries."
              />
            </Section>

            <Section id="shap">
              <H2 id="shap">6. Opening the black box with SHAP</H2>
              <p>
                The question every reviewer asks of a tree ensemble is:{" "}
                <em>what is the model actually using?</em> SHAP gives an
                additive decomposition: for any prediction, it tells you how
                many basis points each feature contributed above or below the
                model&apos;s baseline, and those contributions sum exactly to
                the prediction.
              </p>

              <ShapBarEmbed
                topK={12}
                caption="Mean |SHAP| per feature across all walk-forward predictions (live pull from the deployed API). The top five features together account for roughly 90% of the model's predictive signal."
              />

              <Callout tone="finding" title="Finding #2 — The rate corridor dominates">
                <p>
                  <code>target_lag1</code> (last week&apos;s WACMR),{" "}
                  <code>repo_lag1</code> (last week&apos;s Repo Rate),{" "}
                  <code>rates_I7496_17</code> (current Repo Rate),{" "}
                  <code>spread_wacmr_minus_repo</code>, and{" "}
                  <code>rates_I7496_20</code> (MSF Rate) together account for
                  the bulk of the signal. Equity (Nifty) and forex (USD/INR)
                  features do not appear in the top 15 <em>at all</em>. This
                  aligns with the textbook view that the call money market is
                  arbitraged back to the RBI corridor by design, but it&apos;s
                  satisfying to see the model rediscover that.
                </p>
              </Callout>

              <Figure
                src="/visualizations/shap_by_regime.png"
                caption="Top features ranked by mean |SHAP|, split by regime. The engineered WACMR–Repo spread is decisive in Regime 0 where persistent surplus liquidity dragged WACMR below the Repo Rate."
                alt="SHAP feature importance split by regime"
              />

              <p>
                The corollary is that if you want to <em>predict</em> the WACMR
                a week ahead, you mostly need to know two things: where it was
                last week, and where the Repo Rate is now. Everything else is
                a small correction.
              </p>
            </Section>

            <Section id="news">
              <H2 id="news">7. Does news sentiment actually help?</H2>
              <p>
                We were sceptical going in — the call money rate is a
                mechanical arbitrage against RBI policy, not a market driven by
                narrative. But we wanted to test this rather than assume it.
              </p>
              <p>
                We curated 75 RBI / monetary-policy events between 2014 and
                2024 — repo rate decisions, CRR adjustments, OMO announcements,
                inflation prints, lockdown liquidity measures — with a
                manually-assigned sentiment score <code>∈ [-1, +1]</code> and a
                short impact label (<em>rate_decision</em>,{" "}
                <em>lending_operations</em>, …). Features derived from events
                (rolling sentiment, time-since-last-hawkish, event-density)
                were added to the feature set and the walk-forward experiment
                was re-run.
              </p>

              <Figure
                src="/visualizations/news_sentiment_timeline.png"
                caption="The 75-event hand-curated timeline: rolling sentiment overlaid on WACMR. Hawkish clusters (2018, 2022–23) correspond to visible upward-momentum in the underlying rate; dovish clusters (2019, 2020) precede the Regime 0 break."
                alt="NLP-curated sentiment timeline"
              />

              <Figure
                src="/visualizations/event_density_heatmap.png"
                caption="Event-density heatmap by year and month. MPC-meeting months (Feb, Apr, Jun, Aug, Oct, Dec) are visibly denser — validating the event-density feature."
                alt="Monetary event density heatmap"
              />

              <Callout tone="warn" title="Finding #3 — News helps a little, and only on direction">
                <p>
                  Adding news features reduced RMSE by ~3% and improved
                  directional accuracy by roughly 1.5 percentage points. The
                  effect is concentrated around MPC-meeting weeks. For most of
                  the sample, the model ignores them.
                </p>
              </Callout>
              <p>
                We mention this for honesty&apos;s sake. The NLP layer is in
                the project because (a) the task required it, (b) it genuinely
                helps on policy-event weeks, and (c) it produced a nice
                narrative overlay on the dashboard. But the dominant signal is
                the rate corridor; news is a garnish.
              </p>
              <DashboardLink
                href="/news"
                label="The 75-event NLP timeline"
                blurb="Sentiment overlay on WACMR, category filters, and event density stats."
              />
            </Section>

            <Section id="counterfactuals">
              <H2 id="counterfactuals">8. Policy counterfactuals</H2>
              <p>
                The most useful thing a forecasting model can do, for a
                researcher, is answer <em>what if</em> questions. What would
                the WACMR do if the RBI cut the repo rate by 50 basis points
                next week? What about a 100 bps hike? We built a{" "}
                <Link href="/simulate">counterfactual simulator</Link> that
                perturbs the repo rate (and its downstream lags and spreads),
                re-runs the trained model over the last 12 observed weeks,
                averages the predictions to smooth out XGBoost&apos;s tree
                quantisation, and returns the response with a 90% confidence
                interval derived from the walk-forward residuals.
              </p>

              <CounterfactualEmbed caption="Live pull from /api/simulate/sweep. The diamond marks the baseline prediction at zero shock; the cyan curve is the model's predicted WACMR across a full ±200bps sweep; the shaded band is the 90% residual CI. Notice the plateau around −75 to −25 bps: the tree splits don't fire uniformly." />

              <Callout tone="info" title="Not a causal claim">
                <p>
                  This is a <em>model-based</em> counterfactual, not a causal
                  one. It answers &quot;how would the XGBoost forecaster
                  respond to this input perturbation?&quot;, not &quot;what
                  would actually happen in the Indian banking system?&quot;. A
                  real causal analysis would require instrumenting the
                  RBI&apos;s decision and is out of scope here. Still, the
                  model&apos;s response function is a useful <em>model</em> of
                  the transmission channel the model learned.
                </p>
              </Callout>
              <p>
                A few observations from playing with the simulator. First,
                small perturbations (±25 bps) produce small predicted moves —
                the top feature (last week&apos;s WACMR) doesn&apos;t change
                under the counterfactual, so the model is somewhat sluggish.
                Second, the response is asymmetric: cuts produce larger
                predicted drops than hikes produce rises, consistent with the
                post-COVID regime learning that accommodation transmits more
                quickly than tightening. Third, the 90% CI is wide relative to
                the central estimate — this is honest; the residual
                distribution is what it is.
              </p>
              <DashboardLink
                href="/simulate"
                label="Run your own counterfactual"
                blurb="Slider for repo-rate change, live-updating response curve, and per-feature SHAP attribution."
              />
            </Section>

            <Section id="limits">
              <H2 id="limits">9. Limitations and what we&apos;d do next</H2>
              <p>
                There are five things we&apos;d want to fix or extend given
                more time:
              </p>
              <ol>
                <li>
                  <strong>Only 545 observations.</strong> Even with 10 years of
                  weekly data, we have a small sample for any model that wants
                  to capture regime-dependent dynamics. A daily-frequency
                  version would five-fold the sample and reveal intra-week
                  liquidity dynamics the weekly grid hides.
                </li>
                <li>
                  <strong>Two regimes may be too few.</strong> A Hidden Markov
                  Model with soft assignments and k ≥ 3 would let us describe
                  the 2022 tightening as its own transient state rather than
                  force it into Regime 0.
                </li>
                <li>
                  <strong>The counterfactual is not causal.</strong> A real
                  policy analysis would need an instrumented decision, ideally
                  with high-frequency event-study methods around MPC
                  announcements.
                </li>
                <li>
                  <strong>No live data.</strong> The dashboard is static
                  against the July 2024 snapshot. Wiring up a weekly NDAP
                  refresh + retraining job is straightforward but wasn&apos;t
                  in scope.
                </li>
                <li>
                  <strong>News is thin.</strong> 75 manually-scored events is
                  far too few. An LLM-assisted sentiment pipeline over the RBI
                  bulletin archive would be a real improvement.
                </li>
              </ol>
            </Section>

            <Section id="recommendations">
              <H2 id="recommendations">10. Recommendations</H2>
              <p>
                What should a monetary-policy practitioner (or a curious
                observer) actually take away?
              </p>
              <ol>
                <li>
                  <strong>
                    Watch the <code>WACMR – Repo</code> spread, not just WACMR.
                  </strong>{" "}
                  The spread carries most of the information about liquidity
                  stress. A persistently negative spread (WACMR trading below
                  Repo) is accommodation; a positive spread is tightening
                  pressure.
                </li>
                <li>
                  <strong>Regime-aware policy analysis.</strong> The rate-cycle
                  playbook that worked pre-2020 should not be assumed to work
                  in Regime 0. The system&apos;s response function has shifted.
                </li>
                <li>
                  <strong>
                    Transmission of cuts is faster than transmission of hikes
                  </strong>{" "}
                  — our model learned this empirically. Communication around
                  hikes matters more for anchoring expectations than
                  communication around cuts.
                </li>
                <li>
                  <strong>Don&apos;t over-engineer the forecast.</strong> For
                  most forecasting uses, a simple combination of last-week&apos;s
                  WACMR and the current Repo Rate captures ~90% of what the
                  full XGBoost model knows. Everything else is marginal.
                </li>
              </ol>
            </Section>

            <Section id="try-it">
              <H2 id="try-it">11. Try it yourself</H2>
              <p>Every claim in this essay is backed by a computation you can run live:</p>
              <ul>
                <li>
                  <Link href="/">The landing page</Link> has the summary, the
                  hero chart, and links to every section.
                </li>
                <li>
                  <Link href="/simulate">The simulator</Link> is the headline
                  interactive — drag the slider, watch the response curve,
                  inspect the attribution.
                </li>
                <li>
                  <Link href="/forecast">Forecast &amp; SHAP</Link> shows the
                  full walk-forward series, per-week waterfalls, and the
                  aggregate importance bars.
                </li>
                <li>
                  <Link href="/regimes">Regimes</Link> lets you see the PCA
                  projection and the cluster fact sheets.
                </li>
                <li>
                  <Link href="/agent">The AI agent</Link> will run custom SQL,
                  plot anything, explain any week&apos;s prediction, and run
                  counterfactuals for you — it&apos;s genuinely the fastest
                  way to interrogate the project.
                </li>
                <li>
                  <Link href="/explore">Data explorer</Link> for the raw
                  tables, and <Link href="/report">the report</Link> for a
                  full generated write-up.
                </li>
              </ul>
              <p className="text-slate-500">
                Thanks for reading. The code, data, and pipeline are open — if
                you spot a bug or would like to extend this, please open an
                issue.
              </p>
            </Section>
          </Prose>
        </article>

        {/* Sticky TOC on large screens */}
        <aside className="hidden lg:sticky lg:top-8 lg:block lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto print:hidden">
          <ScrollSpyTOC items={TOC} />
        </aside>
      </div>
    </div>
  );
}
