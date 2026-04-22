"""Agent router — Gemini 2.5 Flash with real function-calling."""
from __future__ import annotations

import json
import logging
from typing import Any

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from ..agent.gemini_client import (
    GeminiUnavailable,
    health_check,
    stream_agent_response,
)
from ..agent.history import store as history_store
from ..config import GEMINI_API_KEY, GEMINI_MODEL

logger = logging.getLogger("agent.router")

router = APIRouter(prefix="/api/agent", tags=["agent"])


class ChatRequest(BaseModel):
    message: str
    session_id: str = "default"


class ResetRequest(BaseModel):
    session_id: str = "default"


def _to_sse(payload: dict[str, Any]) -> str:
    return f"data: {json.dumps(payload, default=str)}\n\n"


@router.post("/chat")
async def chat(req: ChatRequest):
    """Stream the agent's response as Server-Sent Events."""
    async def generate():
        try:
            async for event in stream_agent_response(req.session_id, req.message):
                yield _to_sse(event)
        except GeminiUnavailable as e:
            yield _to_sse({"type": "error", "content": str(e)})
            yield _to_sse({"type": "done"})
        except Exception as e:
            logger.exception("Unhandled error in agent stream")
            yield _to_sse({"type": "error", "content": f"Agent error: {e}"})
            yield _to_sse({"type": "done"})
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/status")
def status():
    """Lightweight configuration check (does not call the LLM)."""
    return {
        "configured": bool(GEMINI_API_KEY),
        "model": GEMINI_MODEL if GEMINI_API_KEY else None,
        "message": (
            "Agent ready" if GEMINI_API_KEY
            else "Add GEMINI_API_KEY to backend/.env to enable the AI agent. "
                 "Get a free key at https://aistudio.google.com/"
        ),
    }


@router.get("/health")
async def health():
    """Live reachability check — actually calls Gemini to verify credentials."""
    return await health_check()


@router.post("/reset")
def reset(req: ResetRequest):
    """Clear the agent's memory of a session."""
    history_store.clear(req.session_id)
    return {"ok": True, "session_id": req.session_id}
