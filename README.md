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
# Stage 1: Fetch data from NDAP API + Yahoo Finance
python3 stage1_fetch_api_ndap.py
python3 stage_1_yfin.py
python3 stage_1b_technical_indicators.py

# Stage 2: Align data, build SQLite DB, EDA plots
python3 stage2_alignment_db.py

# Stage 3: PCA + K-Means regime discovery
python3 stage3_advanced_eda.py

# Stage 4: XGBoost walk-forward CV + SHAP analysis
python3 stage4_supervised_ml.py

# Stage 5: Generate report
python3 stage5_synthesis.py

# Stage 6: NLP news sentiment analysis
python3 stage6_news_nlp.py

# Save model artifacts for the web dashboard
python3 backend/ml/train_and_save.py
```

> **Note:** If you already have the CSV files in `data/` and `data_1/`, you can skip the Stage 1 fetch scripts and start from Stage 2.

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
├── stage1_fetch_api_ndap.py     # NDAP API data fetcher (8 RBI datasets)
├── stage_1_yfin.py              # Yahoo Finance data (Nifty 50, USD/INR)
├── stage_1b_technical_indicators.py  # Technical indicators (MACD, TSI, etc.)
├── stage2_alignment_db.py       # Data alignment + SQLite DB + EDA
├── stage3_advanced_eda.py       # PCA + K-Means regime discovery
├── stage4_supervised_ml.py      # XGBoost + SHAP analysis
├── stage5_synthesis.py          # Report generation
├── stage6_news_nlp.py           # NLP news sentiment pipeline
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
├── data/                        # Raw NDAP CSVs
├── data_1/                      # Yahoo Finance CSVs
├── master_data/                 # Merged master dataset
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
| Data Explorer | `/explore` | Sortable, filterable table of 545 weeks × 119 columns |
| News & NLP | `/news` | 75 curated policy events, sentiment timeline, category filters |
| Report | `/report` | Full generated research report with TOC |

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
`backend/ml/saved_model/` (≈ 1 MB) are committed to the repo so the Render
instance has everything it needs at boot. No extra mounts required.

### Frontend (Vercel, free tier)

1. `cd frontend && npx vercel --prod` — Vercel auto-detects Next.js.
2. In Vercel project settings, set environment variable `NEXT_PUBLIC_API_URL` to your Render URL.
3. Optional: add a custom domain.

The Next.js rewrite in `frontend/next.config.ts` proxies `/api/*` to
`NEXT_PUBLIC_API_URL`, so the browser never sees cross-origin requests to the
backend in production.

### Notes

- Render's free tier cold-starts in ~30s. The landing page includes a warmup health ping so the first interaction is fast.
- Gemini free tier is 5 req/min per project on `gemini-2.5-flash`. For a demo day with many concurrent users, either provision a second API project or switch `GEMINI_MODEL` to `gemini-2.5-flash-lite` for a looser quota.

## Tech Stack

**Analysis:** Python, pandas, scikit-learn, XGBoost, SHAP, matplotlib, seaborn
**Backend:** FastAPI, SQLite, Gemini 2.5 Flash with function-calling (7 typed tools incl. `run_sql`, `run_counterfactual`, `get_shap_contributions`)
**Frontend:** Next.js 16, React 19, Tailwind CSS, Plotly.js, TanStack Query, Instrument Serif
**Data:** 8 NDAP/RBI datasets + 2 Yahoo Finance datasets + 75 curated policy events (545 weeks, 119 features)
**Deploy:** Render (backend) + Vercel (frontend), both free tier
