"""FastAPI application — DSM Project WACMR Analysis API."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from .routers import data, analytics, forecast, news, agent
from .config import VIS_DIR, REPORT_PATH

app = FastAPI(
    title="DSM Project — WACMR Analysis API",
    description="API for India's Weighted Average Call Money Rate analysis dashboard",
    version="1.0.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(data.router)
app.include_router(analytics.router)
app.include_router(forecast.router)
app.include_router(news.router)
app.include_router(agent.router)

# Serve static visualizations
if VIS_DIR.exists():
    app.mount("/visualizations", StaticFiles(directory=str(VIS_DIR)), name="visualizations")


@app.get("/")
def root():
    return {
        "project": "DSM Project — Predicting India's WACMR",
        "version": "1.0.0",
        "docs": "/docs",
        "endpoints": {
            "data": "/api/data/columns",
            "analytics": "/api/analytics/regimes",
            "forecast": "/api/forecast/metrics",
            "news": "/api/news/events",
            "agent": "/api/agent/status",
        },
    }


@app.get("/api/report")
def get_report():
    """Return the full report text."""
    if REPORT_PATH.exists():
        return {"content": REPORT_PATH.read_text(encoding="utf-8")}
    return {"content": "Report not generated yet. Run stage5_synthesis.py."}


@app.get("/api/health")
def health():
    return {"status": "ok"}
