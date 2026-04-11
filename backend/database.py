"""Database layer — loads from CSV if SQLite DB doesn't exist."""
import sqlite3
import pandas as pd
from pathlib import Path
from .config import DB_PATH, CSV_PATH, TABLE_NAME

_df_cache: pd.DataFrame | None = None


def _ensure_db():
    """Create SQLite DB from CSV backup if it doesn't exist."""
    if DB_PATH.exists():
        return
    if not CSV_PATH.exists():
        raise FileNotFoundError(f"Neither {DB_PATH} nor {CSV_PATH} found.")
    df = pd.read_csv(CSV_PATH)
    conn = sqlite3.connect(DB_PATH)
    df.to_sql(TABLE_NAME, conn, if_exists="replace", index=False)
    conn.close()


def get_connection() -> sqlite3.Connection:
    _ensure_db()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def get_dataframe() -> pd.DataFrame:
    """Return cached master DataFrame."""
    global _df_cache
    if _df_cache is None:
        _ensure_db()
        conn = sqlite3.connect(DB_PATH)
        _df_cache = pd.read_sql(f"SELECT * FROM {TABLE_NAME}", conn)
        conn.close()
        if "week_date" in _df_cache.columns:
            _df_cache["week_date"] = pd.to_datetime(_df_cache["week_date"])
            _df_cache = _df_cache.sort_values("week_date").reset_index(drop=True)
    return _df_cache.copy()


def execute_query(sql: str) -> list[dict]:
    """Execute a read-only SQL query and return results as list of dicts."""
    sql_lower = sql.strip().lower()
    if not sql_lower.startswith("select"):
        raise ValueError("Only SELECT queries are allowed.")
    conn = get_connection()
    try:
        cursor = conn.execute(sql)
        columns = [desc[0] for desc in cursor.description]
        rows = cursor.fetchall()
        return [dict(zip(columns, row)) for row in rows]
    finally:
        conn.close()
