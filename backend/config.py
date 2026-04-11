"""Backend configuration."""
from pathlib import Path
import os
from dotenv import load_dotenv

# Load .env from backend directory
load_dotenv(Path(__file__).parent / ".env")

# Paths
PROJECT_ROOT = Path(__file__).parent.parent
DB_PATH = PROJECT_ROOT / "dsm_project.db"
CSV_PATH = PROJECT_ROOT / "master_data" / "Weekly_Macro_Master.csv"
NLP_CSV_PATH = PROJECT_ROOT / "master_data" / "Weekly_Macro_Master_NLP.csv"
EVENTS_JSON = PROJECT_ROOT / "backend" / "nlp" / "news_data" / "events.json"
SAVED_MODEL_DIR = Path(__file__).parent / "ml" / "saved_model"
REPORT_PATH = PROJECT_ROOT / "report.txt"
VIS_DIR = PROJECT_ROOT / "visualizations"

# Table
TABLE_NAME = "Weekly_Macro_Master"

# LLM
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.1-70b-versatile")
