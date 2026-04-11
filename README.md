# WACMR Analytics — DSM Final Project

Predicting India's Weighted Average Call Money Rate (WACMR) using regime clustering, XGBoost forecasting, SHAP interpretability, and NLP news analysis. Full-stack dashboard with AI-powered data agent.

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

### 4. (Optional) Enable AI Agent

The AI chat agent works with rule-based responses by default. To enable LLM-powered responses:

1. Get a free API key from [Groq Console](https://console.groq.com)
2. Create `backend/.env`:
   ```
   GROQ_API_KEY=your_key_here
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
│   ├── main.py                  # App entry point
│   ├── routers/                 # API endpoints (data, analytics, forecast, news, agent)
│   ├── column_registry.py       # Human-readable column names
│   └── ml/train_and_save.py     # Model artifact extraction
│
├── frontend/                    # Next.js 16 dashboard
│   └── src/app/                 # 8 pages: overview, explore, dashboard,
│                                #   regimes, forecast, news, agent, report
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
| Overview | `/` | KPI cards, project summary, navigation |
| Data Explorer | `/explore` | Filterable, sortable table of 545 weeks x 119 columns |
| Dashboard | `/dashboard` | Interactive Plotly charts: time series, correlations, distributions, regime composition |
| Regimes | `/regimes` | PCA scatter plot colored by regime, regime summary cards |
| Forecast & SHAP | `/forecast` | Actual vs predicted, SHAP feature importance, waterfall plots |
| News & NLP | `/news` | 75 curated events, sentiment timeline, category filters |
| AI Agent | `/agent` | Natural language queries against the dataset |
| Report | `/report` | Full research report with TOC, search, collapsible sections |

## Tech Stack

**Analysis:** Python, pandas, scikit-learn, XGBoost, SHAP, matplotlib, seaborn
**Backend:** FastAPI, SQLite, LangChain + Groq (LLM agent)
**Frontend:** Next.js 16, React, Tailwind CSS, Plotly.js, TanStack Table/Query
**Data:** 8 NDAP/RBI datasets + 2 Yahoo Finance datasets (545 weeks, 119 features)
