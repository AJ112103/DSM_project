"""Build a rich, compact schema context for the LLM's system prompt.

The Gemini model has a 1M context window, so we can afford to inject:
  - every column with its human label, category, and unit
  - a small sample of live statistics so the agent knows the shape of the data
  - a synonym map so the agent can resolve "inflation" -> CPI columns
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

from ..column_registry import COLUMN_REGISTRY, get_categories
from ..database import execute_query

_PROMPT_FILE = Path(__file__).parent / "system_prompt.md"


# Synonyms: human-terms -> list of column names. Used by semantic_column_search.
SYNONYMS: dict[str, list[str]] = {
    "inflation":         ["cpi_I7500_9", "cpi_I7500_11", "cpi_I7500_10", "cpi_I7500_12"],
    "cpi":               ["cpi_I7500_9", "cpi_I7500_11", "cpi_I7500_10", "cpi_I7500_12"],
    "prices":            ["cpi_I7500_9", "cpi_I7500_11", "cpi_I7500_10", "cpi_I7500_12"],
    "repo":              ["rates_I7496_17", "repo_lag1", "spread_wacmr_minus_repo"],
    "policy rate":       ["rates_I7496_17", "rates_I7496_18", "rates_I7496_20"],
    "rate corridor":     ["rates_I7496_17", "rates_I7496_18", "rates_I7496_20"],
    "liquidity":         ["repo_I7498_6", "repo_I7498_16", "repo_I7498_17", "la_I7492_8"],
    "reserves":          ["la_I7492_14", "la_I7492_13"],
    "money supply":      ["agg_I7494_5", "agg_I7494_6", "agg_I7494_7"],
    "forex":             ["usdinr_intc", "usdinr_into", "la_I7492_14"],
    "equity":            ["nifty_intc", "nifty_into", "nifty_TSI"],
    "treasury bills":    ["tb_I7504_10_91d", "tb_I7504_10_182d", "tb_I7504_10_364d"],
    "commercial paper":  ["cp_I7505_5", "cp_I7505_6", "rates_I7496_30"],
    "government bonds":  ["gsec_I7503_10", "gsec_I7503_6", "gsec_I7503_7"],
    "g-sec":             ["gsec_I7503_10", "gsec_I7503_6"],
    "wacmr":             ["target_wacmr", "target_lag1", "target_lag2", "target_lag4"],
    "call money":        ["target_wacmr", "rates_I7496_32"],
    "mibor":             ["rates_I7496_32", "rates_I7496_33", "rates_I7496_34", "rates_I7496_35"],
    "regime":            ["regime_label", "cluster_dist_0", "cluster_dist_1"],
    "covid":             ["regime_label"],
    "crr":               ["rates_I7496_5"],
    "slr":               ["rates_I7496_6"],
}


def load_system_prompt() -> str:
    """Load the markdown system prompt. Raises if the file is missing."""
    return _PROMPT_FILE.read_text(encoding="utf-8")


def _current_stats() -> dict[str, Any]:
    """Fetch tiny live statistics for grounding the prompt. Safe if DB is missing."""
    try:
        rows = execute_query(
            "SELECT COUNT(*) AS n, "
            "MIN(week_date) AS first_date, MAX(week_date) AS last_date, "
            "ROUND(AVG(target_wacmr), 3) AS avg_wacmr, "
            "ROUND(MIN(target_wacmr), 3) AS min_wacmr, "
            "ROUND(MAX(target_wacmr), 3) AS max_wacmr "
            "FROM Weekly_Macro_Master"
        )
        return rows[0] if rows else {}
    except Exception:
        return {}


def live_context_block() -> str:
    """A 4-line block appended to the system prompt so the agent has fresh stats."""
    stats = _current_stats()
    if not stats:
        return ""
    return (
        "\n\n## Current dataset snapshot\n"
        f"- Rows: {stats.get('n')}\n"
        f"- Range: {stats.get('first_date')} → {stats.get('last_date')}\n"
        f"- WACMR avg/min/max: {stats.get('avg_wacmr')}% / "
        f"{stats.get('min_wacmr')}% / {stats.get('max_wacmr')}%\n"
    )


def column_catalog_block() -> str:
    """All columns grouped by category, compact one-line-per-column format."""
    cats = get_categories()
    parts: list[str] = ["\n## Column catalog (grouped by category)\n"]
    for cat, cols in cats.items():
        parts.append(f"\n### {cat}")
        for c in cols:
            meta = COLUMN_REGISTRY[c]
            label = meta.get("label", c)
            unit = meta.get("unit", "")
            full = meta.get("full_name")
            extra = f" — {full}" if full and full != label else ""
            parts.append(f"- `{c}` → **{label}** ({unit}){extra}")
    return "\n".join(parts)


def full_system_prompt() -> str:
    """System prompt = markdown file + live stats + column catalog."""
    return load_system_prompt() + live_context_block() + column_catalog_block()


def search_columns(term: str, limit: int = 5) -> list[dict[str, Any]]:
    """Fuzzy match a human term to columns. Used by the semantic_column_search tool.

    Strategy (cheap, no embedding model needed):
      1. Synonym hit → return those columns at top
      2. Substring match on label or full_name (case-insensitive)
      3. Substring match on the column name itself
    """
    term_lower = term.lower().strip()
    if not term_lower:
        return []

    seen: set[str] = set()
    results: list[tuple[int, str]] = []  # (rank, column)

    for syn, cols in SYNONYMS.items():
        if syn in term_lower or term_lower in syn:
            for c in cols:
                if c not in seen:
                    seen.add(c)
                    results.append((0, c))

    for col, meta in COLUMN_REGISTRY.items():
        if col in seen:
            continue
        label = (meta.get("label") or "").lower()
        full = (meta.get("full_name") or "").lower()
        if term_lower in label or term_lower in full:
            seen.add(col)
            results.append((1, col))

    for col in COLUMN_REGISTRY:
        if col in seen:
            continue
        if term_lower in col.lower():
            seen.add(col)
            results.append((2, col))

    results.sort(key=lambda x: x[0])
    output: list[dict[str, Any]] = []
    for _, c in results[:limit]:
        meta = COLUMN_REGISTRY[c]
        output.append({
            "column": c,
            "label": meta.get("label", c),
            "full_name": meta.get("full_name", ""),
            "category": meta.get("category", ""),
            "unit": meta.get("unit", ""),
        })
    return output
