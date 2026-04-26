"""Backend configuration."""
from pathlib import Path
import os
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

PROJECT_ROOT = Path(__file__).parent.parent
DB_PATH = PROJECT_ROOT / "dsm_project.db"
CSV_PATH = PROJECT_ROOT / "data" / "processed" / "Weekly_Macro_Master.csv"
NLP_CSV_PATH = PROJECT_ROOT / "data" / "processed" / "Weekly_Macro_Master_NLP.csv"
EVENTS_JSON = PROJECT_ROOT / "backend" / "nlp" / "news_data" / "events.json"
SAVED_MODEL_DIR = Path(__file__).parent / "ml" / "saved_model"
REPORT_PATH = PROJECT_ROOT / "report.txt"
VIS_DIR = PROJECT_ROOT / "visualizations"

TABLE_NAME = "Weekly_Macro_Master"

# LLM — Gemini 2.5 Flash via Google AI Studio.
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
