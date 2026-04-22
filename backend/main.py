"""FastAPI application — DSM Project WACMR Analysis API."""
import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .routers import data, analytics, forecast, news, agent, simulate
from .config import VIS_DIR, REPORT_PATH

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-5s %(name)s: %(message)s",
)

app = FastAPI(
    title="DSM Project — WACMR Analysis API",
    description="API for India's Weighted Average Call Money Rate analysis dashboard",
    version="1.0.0",
)

# CORS — allow a comma-separated list of origins via CORS_ORIGINS env var.
# Defaults to localhost dev and any vercel.app subdomain so previews work
# out of the box. Set CORS_ORIGINS="*" to open up everything (not recommended).
_cors_env = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
if _cors_env.strip() == "*":
    _allow_origins = ["*"]
    _allow_origin_regex = None
else:
    _raw = [o.strip() for o in _cors_env.split(",") if o.strip()]
    _allow_origins = [o for o in _raw if "*" not in o]
    # Convert wildcard entries like https://*.vercel.app into a regex.
    _wildcard = [o for o in _raw if "*" in o]
    if _wildcard:
        import re as _re
        _allow_origin_regex = "|".join(_re.escape(o).replace(r"\*", r".*") for o in _wildcard)
    else:
        _allow_origin_regex = None

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allow_origins,
    allow_origin_regex=_allow_origin_regex,
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
app.include_router(simulate.router)

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
