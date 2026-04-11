"""LLM Agent endpoint — chat with the dataset using natural language."""
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import json
import asyncio

from ..config import GROQ_API_KEY, GROQ_MODEL
from ..database import execute_query, get_dataframe
from ..column_registry import COLUMN_REGISTRY, get_label

router = APIRouter(prefix="/api/agent", tags=["agent"])


class ChatRequest(BaseModel):
    message: str
    session_id: str = "default"


# Column registry as a string for the system prompt
def _column_context() -> str:
    lines = []
    for col, meta in COLUMN_REGISTRY.items():
        label = meta.get("label", col)
        cat = meta.get("category", "")
        unit = meta.get("unit", "")
        lines.append(f"  {col} -> {label} ({cat}, {unit})")
    return "\n".join(lines)


SYSTEM_PROMPT = f"""You are a data analyst assistant for a project studying India's Weighted Average Call Money Rate (WACMR).
You have access to a SQLite database with a single table called 'Weekly_Macro_Master' containing 545 rows of weekly data from Feb 2014 to Jul 2024, with 119 columns.

IMPORTANT COLUMN MAPPINGS (column_name -> human_readable_name):
{_column_context()}

The target variable is 'target_wacmr' (WACMR %).
Key columns: rates_I7496_17 (Repo Rate), rates_I7496_18 (Reverse Repo), rates_I7496_20 (MSF Rate).
The data has two regimes: regime_label=0 (Normal/Tightening, pre-COVID) and regime_label=1 (Accommodation, post-COVID).

When the user asks a question:
1. Write and execute SQL queries to answer it
2. Always use human-readable names in your response, not column codes
3. When data would benefit from visualization, suggest what chart type would be best
4. Be concise and insightful

Respond in this JSON format for each step:
{{"type": "text", "content": "your explanation"}}
{{"type": "sql", "query": "SELECT ...", "results": [...]}}
{{"type": "chart", "spec": {{"chart_type": "line|bar|scatter", "title": "...", "x": [...], "y": [...], "labels": {{}}}}}}

Always wrap your response steps in a JSON array."""


def _try_query(sql: str) -> tuple[list[dict], str | None]:
    """Execute SQL and return (results, error)."""
    try:
        results = execute_query(sql)
        return results[:100], None  # Cap at 100 rows
    except Exception as e:
        return [], str(e)


def _build_response_without_llm(message: str) -> list[dict]:
    """Simple rule-based responses when no LLM API key is configured."""
    msg_lower = message.lower()
    steps = []

    if any(kw in msg_lower for kw in ["average", "mean", "avg"]):
        if "regime" in msg_lower or "each regime" in msg_lower:
            results, err = _try_query(
                "SELECT regime_label, ROUND(AVG(target_wacmr), 3) as avg_wacmr, "
                "ROUND(AVG(rates_I7496_17), 3) as avg_repo, COUNT(*) as weeks "
                "FROM Weekly_Macro_Master GROUP BY regime_label"
            )
            if not err:
                steps.append({"type": "sql", "query": "SELECT regime_label, AVG(target_wacmr), AVG(rates_I7496_17) FROM Weekly_Macro_Master GROUP BY regime_label", "results": results})
                steps.append({"type": "text", "content": f"Regime 0 (Normal/Tightening) had an average WACMR of {results[0]['avg_wacmr']}% vs Regime 1 (Accommodation) at {results[1]['avg_wacmr']}%."})
        else:
            year_match = None
            for y in range(2014, 2025):
                if str(y) in msg_lower:
                    year_match = str(y)
                    break
            if year_match:
                results, err = _try_query(
                    f"SELECT ROUND(AVG(target_wacmr), 3) as avg_wacmr, "
                    f"ROUND(AVG(rates_I7496_17), 3) as avg_repo "
                    f"FROM Weekly_Macro_Master WHERE strftime('%Y', week_date) = '{year_match}'"
                )
                if not err and results:
                    steps.append({"type": "sql", "query": f"SELECT AVG(target_wacmr) FROM ... WHERE year = {year_match}", "results": results})
                    steps.append({"type": "text", "content": f"In {year_match}, the average WACMR was {results[0]['avg_wacmr']}% and Repo Rate was {results[0]['avg_repo']}%."})
            else:
                results, err = _try_query(
                    "SELECT ROUND(AVG(target_wacmr), 3) as avg_wacmr, "
                    "ROUND(MIN(target_wacmr), 3) as min_wacmr, "
                    "ROUND(MAX(target_wacmr), 3) as max_wacmr "
                    "FROM Weekly_Macro_Master"
                )
                if not err:
                    steps.append({"type": "text", "content": f"Overall average WACMR: {results[0]['avg_wacmr']}% (range: {results[0]['min_wacmr']}% to {results[0]['max_wacmr']}%)."})

    elif any(kw in msg_lower for kw in ["trend", "chart", "plot", "show", "graph", "visualize"]):
        results, err = _try_query(
            "SELECT week_date, target_wacmr, rates_I7496_17 as repo_rate "
            "FROM Weekly_Macro_Master ORDER BY week_date"
        )
        if not err:
            dates = [r["week_date"] for r in results]
            wacmr = [r["target_wacmr"] for r in results]
            repo = [r["repo_rate"] for r in results]
            steps.append({"type": "chart", "spec": {
                "chart_type": "line", "title": "WACMR & Repo Rate Over Time",
                "x": dates, "y": {"WACMR (%)": wacmr, "Repo Rate (%)": repo},
                "labels": {"x": "Date", "y": "Rate (%)"}
            }})
            steps.append({"type": "text", "content": "Here's the WACMR and Repo Rate trend from 2014 to 2024. Notice the structural break around March 2020 (COVID) where rates dropped sharply."})

    elif any(kw in msg_lower for kw in ["highest", "maximum", "max", "peak", "spike"]):
        results, err = _try_query(
            "SELECT week_date, ROUND(target_wacmr, 3) as wacmr, "
            "ROUND(rates_I7496_17, 3) as repo_rate "
            "FROM Weekly_Macro_Master ORDER BY target_wacmr DESC LIMIT 5"
        )
        if not err:
            steps.append({"type": "sql", "query": "SELECT TOP 5 weeks by WACMR", "results": results})
            steps.append({"type": "text", "content": f"The highest WACMR was {results[0]['wacmr']}% on {results[0]['week_date']}, with a Repo Rate of {results[0]['repo_rate']}%."})

    elif any(kw in msg_lower for kw in ["covid", "pandemic", "2020", "lockdown"]):
        results, err = _try_query(
            "SELECT week_date, ROUND(target_wacmr, 3) as wacmr, "
            "ROUND(rates_I7496_17, 3) as repo_rate, regime_label "
            "FROM Weekly_Macro_Master "
            "WHERE week_date BETWEEN '2020-01-01' AND '2020-12-31' "
            "ORDER BY week_date"
        )
        if not err:
            dates = [r["week_date"] for r in results]
            wacmr = [r["wacmr"] for r in results]
            steps.append({"type": "chart", "spec": {
                "chart_type": "line", "title": "WACMR During COVID-19 (2020)",
                "x": dates, "y": {"WACMR (%)": wacmr},
                "labels": {"x": "Date", "y": "Rate (%)"}
            }})
            steps.append({"type": "text", "content": "During 2020, WACMR dropped sharply from ~5.1% to ~3.2% as RBI cut the repo rate from 5.15% to 4.0% and flooded the system with liquidity."})

    elif any(kw in msg_lower for kw in ["feature", "shap", "important", "driver"]):
        steps.append({"type": "text", "content": "The top 5 features driving WACMR prediction (by SHAP importance):\n\n1. **WACMR Lag 1W** (target_lag1) — 0.490\n2. **Repo Rate Lag 1W** (repo_lag1) — 0.211\n3. **Repo Rate** (rates_I7496_17) — 0.195\n4. **WACMR-Repo Spread** — 0.072\n5. **MSF Rate** (rates_I7496_20) — 0.058\n\nNotably, no equity (Nifty50) or forex (USD/INR) features appear in the top 15 — the call money market is entirely driven by the RBI rate corridor."})

    else:
        results, err = _try_query(
            "SELECT COUNT(*) as rows, MIN(week_date) as first_date, "
            "MAX(week_date) as last_date FROM Weekly_Macro_Master"
        )
        if not err:
            steps.append({"type": "text", "content": f"I have access to {results[0]['rows']} weeks of data from {results[0]['first_date']} to {results[0]['last_date']}. You can ask me about:\n- Average rates (by year, regime, or overall)\n- Trends and charts\n- COVID impact\n- SHAP feature importance\n- Maximum/minimum values\n\nTry: 'What was the average WACMR in 2020?' or 'Show me the trend of WACMR'"})

    if not steps:
        steps.append({"type": "text", "content": "I can help you explore the WACMR dataset. Try asking about averages, trends, regime comparisons, or SHAP feature importance."})

    return steps


async def _stream_llm_response(message: str):
    """Stream response from Groq LLM."""
    try:
        from groq import Groq
        client = Groq(api_key=GROQ_API_KEY)

        # First, get relevant data context
        df_info, _ = _try_query(
            "SELECT COUNT(*) as n, MIN(week_date) as start, MAX(week_date) as end, "
            "ROUND(AVG(target_wacmr),3) as avg_wacmr FROM Weekly_Macro_Master"
        )

        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": message},
        ]

        completion = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=messages,
            temperature=0.3,
            max_tokens=2000,
        )

        response_text = completion.choices[0].message.content

        # Try to parse as JSON array of steps
        try:
            steps = json.loads(response_text)
            if isinstance(steps, list):
                for step in steps:
                    if step.get("type") == "sql" and "query" in step:
                        results, err = _try_query(step["query"])
                        if not err:
                            step["results"] = results
                        else:
                            step["error"] = err
                    yield f"data: {json.dumps(step)}\n\n"
                    await asyncio.sleep(0.05)
            else:
                yield f"data: {json.dumps({'type': 'text', 'content': response_text})}\n\n"
        except json.JSONDecodeError:
            # LLM returned plain text
            yield f"data: {json.dumps({'type': 'text', 'content': response_text})}\n\n"

    except ImportError:
        # Groq not installed, use rule-based
        steps = _build_response_without_llm(message)
        for step in steps:
            yield f"data: {json.dumps(step)}\n\n"
            await asyncio.sleep(0.05)
    except Exception as e:
        # Any LLM error, fallback to rule-based
        steps = _build_response_without_llm(message)
        for step in steps:
            yield f"data: {json.dumps(step)}\n\n"
            await asyncio.sleep(0.05)

    yield "data: [DONE]\n\n"


@router.post("/chat")
async def chat(req: ChatRequest):
    """Chat endpoint with SSE streaming."""
    if not GROQ_API_KEY:
        # No API key — use rule-based responses
        steps = _build_response_without_llm(req.message)
        async def generate():
            for step in steps:
                yield f"data: {json.dumps(step)}\n\n"
                await asyncio.sleep(0.05)
            yield "data: [DONE]\n\n"

        return StreamingResponse(generate(), media_type="text/event-stream")

    return StreamingResponse(
        _stream_llm_response(req.message),
        media_type="text/event-stream",
    )


@router.get("/status")
def agent_status():
    """Check if LLM agent is configured."""
    return {
        "configured": bool(GROQ_API_KEY),
        "model": GROQ_MODEL if GROQ_API_KEY else None,
        "message": "Agent ready" if GROQ_API_KEY else "Add GROQ_API_KEY to backend/.env to enable AI assistant. The agent works with rule-based responses in the meantime.",
    }
