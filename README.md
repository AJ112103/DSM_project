# WACMR Analytics — DSM Final Project

Predicting India's Weighted Average Call Money Rate (WACMR) using regime clustering, XGBoost forecasting, SHAP interpretability, and NLP news analysis. Full-stack dashboard with AI-powered data agent.

## Live Deployment

| Surface | URL |
| --- | --- |
| Dashboard, simulator & blog (frontend) | **https://dsm-project-phi.vercel.app** |
| API (backend) | **https://wacmr-api.onrender.com** |
| Technical blog | https://dsm-project-phi.vercel.app/blog/wacmr-investigation |
| Policy counterfactual simulator | https://dsm-project-phi.vercel.app/simulate |
| Gemini-powered data agent | https://dsm-project-phi.vercel.app/agent |
| Research report (with all figures) | https://dsm-project-phi.vercel.app/report |

> Render's free tier cold-starts in ~30s — the first request after a period of inactivity may take a moment.

## Quick Start

### Prerequisites

- **Python 3.11+** with pip
- **Node.js 20+** with npm
- Git

### 1. Clone & Install

```bash
git clone https://github.com/Arnavgoyal10/DSM_project.git
cd DSM_project

# Python dependencies
pip install -r requirements.txt
pip install -r backend/requirements.txt

# Frontend dependencies
cd frontend && npm install && cd ..
```

### 2. Run the ML Pipeline

These steps build the database, train models, and generate all artifacts. Run them in order:

```bash
# Stage 1: Fetch data from Yahoo Finance + NDAP API
python3 scripts/stage1_fetch_yfinance.py
python3 scripts/stage1b_fetch_ndap.py

# Stage 2: Technical indicators
python3 scripts/stage2_technical_indicators.py

# Stage 3: Alignment, SQLite DB & EDA
python3 scripts/stage3_alignment_db.py

# Stage 4: Regime discovery (PCA + K-Means)
python3 scripts/stage4_regime_discovery.py

# Stage 5: Supervised ML (XGBoost + SHAP)
python3 scripts/stage5_supervised_ml.py

# Stage 6: NLP News Sentiment
python3 scripts/stage6_news_nlp.py

# Save model artifacts for the web dashboard
python3 backend/ml/train_and_save.py
```

> **Note:** If you already have the CSV files in `data/raw/ndap/` and `data/raw/yfinance/`, you can skip the Stage 1 fetch scripts and start from Stage 2.

### 3. Start the App

```bash
chmod +x start.sh && ./start.sh
```

Or start each server manually:

```bash
# Terminal 1 — Backend (port 8000)
PYTHONPATH=. uvicorn backend.main:app --reload --port 8000

# Terminal 2 — Frontend (port 3000)
cd frontend && npm run dev
```

Open **http://localhost:3000** in your browser.

### 4. Configure the AI Agent

The agent uses **Gemini 2.5 Flash** (Google AI Studio free tier — 1,500 req/day) with real function-calling against the dataset.

1. Get a free API key at [aistudio.google.com](https://aistudio.google.com/)
2. Create `backend/.env`:
   ```
   GEMINI_API_KEY=your_key_here
   GEMINI_MODEL=gemini-2.5-flash
   ```
3. Restart the backend

---

## Project Structure

```
DSM_project/
├── scripts/                     # 7-stage ML pipeline
│   ├── stage1_fetch_yfinance.py
│   ├── stage1_scrape_ndap.py
│   ├── stage1b_fetch_ndap.py
│   ├── stage2_technical_indicators.py
│   ├── stage3_alignment_db.py
│   ├── stage4_regime_discovery.py
│   ├── stage5_supervised_ml.py
│   └── stage6_news_nlp.py
│
├── backend/                     # FastAPI REST API
│   ├── main.py                  # App entry point (CORS via env var)
│   ├── routers/                 # data, analytics, forecast, news, agent, simulate
│   ├── agent/                   # Gemini function-calling loop + tool registry
│   │   ├── tools.py             # run_sql, run_counterfactual, get_shap_contributions, …
│   │   ├── gemini_client.py     # function-calling agent loop
│   │   ├── schema_context.py    # synonym map + column catalog builder
│   │   ├── history.py           # in-memory per-session chat history
│   │   └── system_prompt.md     # editorial WACMR research identity
│   ├── column_registry.py       # Human-readable column names
│   └── ml/                      # train_and_save.py + saved_model/ (committed)
│
├── frontend/                    # Next.js 16 dashboard + blog
│   └── src/
│       ├── app/                 # 10 pages: overview, explore, dashboard, regimes,
│       │                        # forecast, simulate, news, agent, blog, report
│       ├── components/
│       │   ├── AgentSheet.tsx   # Floating global agent slide-over
│       │   ├── agent/           # AgentChat + ToolPartBlock
│       │   └── blog/            # Prose components (Callout, Stat, ChartEmbed, …)
│       └── lib/                 # api.ts, agent-shared.ts, plotly-theme.ts
│
├── render.yaml                  # Backend deployment blueprint (Render)
├── frontend/vercel.json         # Frontend deployment config (Vercel)
│
├── data/
│   ├── raw/ndap/                # Raw NDAP/RBI CSVs
│   ├── raw/yfinance/            # Nifty 50 and USD/INR weekly OHLCV
│   └── processed/               # Merged weekly master datasets
├── final/                       # Final report source, diagrams, and PDF
├── visualizations/              # Generated plots (12 PNGs)
├── dsm_project.db               # SQLite database (generated)
└── report.txt                   # Full research report (generated)
```

## Dashboard Pages

| Page | URL | Description |
|------|-----|-------------|
| Overview | `/` | Editorial landing page with live hero chart |
| Simulator | `/simulate` | **Headline** — policy counterfactual slider with response curve, CI, and SHAP attribution |
| AI Agent | `/agent` | Gemini 2.5 Flash with function-calling tools over the dataset |
| Blog | `/blog` | Long-form technical write-up on the investigation |
| Regimes | `/regimes` | PCA projection + regime fact sheets |
| Forecast & SHAP | `/forecast` | Walk-forward actual vs predicted, SHAP importance, waterfalls |
| Dashboard | `/dashboard` | Interactive time series, correlation heatmap, distributions |
| Data Explorer | `/explore` | Sortable, filterable table of 545 weeks x 122 database columns |
| News & NLP | `/news` | 75 curated policy events, sentiment timeline, category filters |
| Report | `/report` | Full generated research report with TOC |

## DSM Guidelines Coverage

This project was structured against the DSM project expectations in `DSM Project - Guidelines and Expectations.pdf`.

| Guideline area | How this project addresses it |
| --- | --- |
| Problem statement | Studies whether India's Weighted Average Call Money Rate (WACMR), the overnight interbank funding rate, can be understood and forecast one week ahead from monetary policy, liquidity, market, and event data. The objective is to explain transmission of RBI policy into actual overnight funding conditions and produce evidence-backed operational insights. |
| Dataset identification | Uses 8 RBI/NDAP public datasets, Yahoo Finance weekly Nifty 50 and USD/INR series, and 75 curated public policy/news events. Raw sources are kept in `data/raw/ndap/` and `data/raw/yfinance/`; aligned analysis datasets are in `data/processed/`. |
| Data exploration | The pipeline computes distributions, time-series plots, PCA projections, regime plots, event density, sentiment timeline, residual calendar, and SHAP visualizations. Generated figures live in `visualizations/` and are rendered in the dashboard/report. |
| Missing values and anomalies | The stage pipeline aligns all sources to a weekly Friday grid, handles lagged and engineered features, and surfaces structural breaks through PCA/K-Means regimes and residual analysis. |
| Database storage | The processed weekly master dataset is stored in SQLite as `dsm_project.db` with table `Weekly_Macro_Master` containing 545 weeks and 122 columns. The FastAPI backend exposes managed query endpoints plus a read-only SQL endpoint. |
| Analysis techniques | Applies PCA, K-Means clustering, silhouette validation, XGBoost walk-forward forecasting, SHAP model explanations, sentiment/event overlays, correlation analysis, and counterfactual simulation. |
| Current-state insights | The analysis identifies two monetary-policy regimes, shows that repo-rate corridor variables dominate WACMR behavior, and reports walk-forward forecast performance with 70.9% directional accuracy. |
| Recommendations | The report and `/report` page translate findings into practical recommendations around regime-aware monitoring, rate-corridor interpretation, counterfactual policy analysis, and using WACMR as a transmission diagnostic. |
| Bonus: dashboard/UI | The Next.js app provides interactive pages for exploration, forecasting, regimes, news, simulation, and the final report. |
| Bonus: agentic system | The Gemini-powered agent can query the database, run read-only SQL, generate charts, compare regimes, explain SHAP contributions, and run WACMR counterfactuals through typed backend tools. |

The full evidence trail is available in the live app at `/report`, with the PDF-ready report source and diagrams under `final/`.

## Deployment

The stack splits cleanly: **backend on Render**, **frontend on Vercel**.

### Backend (Render, free tier)

The `render.yaml` in the repo root defines a `web` service that installs
`backend/requirements.txt`, starts `uvicorn`, and points the health check at
`/api/health`.

1. Connect the repo to Render, select "Blueprint", and Render will pick up `render.yaml`.
2. In the Render service dashboard, set the `GEMINI_API_KEY` environment variable (marked `sync: false` in the blueprint so it must be set manually).
3. After first deploy, copy the Render service URL (e.g. `https://wacmr-api.onrender.com`).
4. Update the `CORS_ORIGINS` env var with your Vercel domain(s) — comma-separated, wildcards allowed (`https://*.vercel.app,https://your-domain.com`).

The SQLite database (`dsm_project.db`, 577 KB) and model artifacts in
`backend/ml/saved_model/` (about 1 MB) are committed to the repo so the Render
instance has everything it needs at boot. No extra mounts required.

### Frontend (Vercel, free tier)

1. `cd frontend && npx vercel --prod` - Vercel auto-detects Next.js.
2. In Vercel project settings, set environment variable `NEXT_PUBLIC_API_URL` to your Render URL.
3. Optional: add a custom domain.

The browser calls `NEXT_PUBLIC_API_URL` directly for API requests. If the
environment variable is missing in production, `frontend/src/lib/api.ts` falls
back to `https://wacmr-api.onrender.com`. `frontend/next.config.ts` only keeps a
rewrite for `/visualizations/*`, so image tags can load backend-hosted generated
figures from a relative path.

### Notes

- Render's free tier cold-starts in ~30s. The landing page includes a warmup health ping so the first interaction is fast.
- Gemini free tier is 5 req/min per project on `gemini-2.5-flash`. For a demo day with many concurrent users, either provision a second API project or switch `GEMINI_MODEL` to `gemini-2.5-flash-lite` for a looser quota.

## Tech Stack

**Analysis:** Python, pandas, scikit-learn, XGBoost, SHAP, matplotlib, seaborn
**Backend:** FastAPI, SQLite, Gemini 2.5 Flash with function-calling (7 typed tools incl. `run_sql`, `run_counterfactual`, `get_shap_contributions`)
**Frontend:** Next.js 16, React 19, Tailwind CSS, Plotly.js, TanStack Query, Instrument Serif
**Data:** 8 NDAP/RBI datasets + 2 Yahoo Finance datasets + 75 curated policy events (545 weeks, 117 model features, 122 database columns)
**Deploy:** Render (backend) + Vercel (frontend), both free tier
