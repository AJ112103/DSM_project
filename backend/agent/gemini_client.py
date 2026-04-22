"""Gemini 2.5 Flash function-calling loop.

Public entry point: `stream_agent_response(session_id, user_message)` — an async
generator yielding SSE-ready dicts. Each yielded dict is one of:

    {"type": "text",         "content": "..."}            # streamed prose chunk
    {"type": "tool_call",    "name": "...", "args": {}}   # agent invoked a tool
    {"type": "tool_result",  "name": "...", "result": {}} # tool returned successfully
    {"type": "tool_error",   "name": "...", "error": "..."}
    {"type": "error",        "content": "..."}            # fatal agent-level error
    {"type": "done"}                                       # end of stream

The loop:
  1. Build the contents list = prior history + new user message
  2. Call Gemini with tools configured
  3. If the response contains function_calls, execute them, append function_responses,
     loop (max iterations=6)
  4. If the response contains text, stream it token-by-token
  5. Persist the final user+model turn to history

All errors surface as `error` events — nothing is silently swallowed.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any, AsyncGenerator

from ..config import GEMINI_API_KEY, GEMINI_MODEL
from . import tools as tools_module
from .history import store as history_store
from .schema_context import full_system_prompt

logger = logging.getLogger("agent.gemini")

MAX_TOOL_ITERATIONS = 6


class GeminiUnavailable(RuntimeError):
    pass


def _build_tool_config():
    from google.genai import types
    declarations = [
        types.FunctionDeclaration(**d) for d in tools_module.as_gemini_tool_declarations()
    ]
    return (
        [types.Tool(function_declarations=declarations)],
        types.ToolConfig(
            function_calling_config=types.FunctionCallingConfig(mode="AUTO"),
        ),
    )


def _build_client():
    if not GEMINI_API_KEY:
        raise GeminiUnavailable(
            "GEMINI_API_KEY is not set. Get a free key from aistudio.google.com "
            "and add `GEMINI_API_KEY=...` to backend/.env."
        )
    try:
        from google import genai
    except ImportError as e:
        raise GeminiUnavailable(
            "google-genai is not installed. Run `pip install google-genai`."
        ) from e
    return genai.Client(api_key=GEMINI_API_KEY)


def _part_to_jsonable_args(args: Any) -> dict[str, Any]:
    """Gemini's function_call.args is a proto MessageMap; coerce to plain dict."""
    if args is None:
        return {}
    try:
        return dict(args)
    except Exception:
        return {}


async def stream_agent_response(
    session_id: str,
    user_message: str,
) -> AsyncGenerator[dict[str, Any], None]:
    """Run one user turn through the Gemini function-calling loop."""
    try:
        client = _build_client()
    except GeminiUnavailable as e:
        yield {"type": "error", "content": str(e)}
        yield {"type": "done"}
        return

    from google.genai import types

    tools, tool_config = _build_tool_config()
    config = types.GenerateContentConfig(
        system_instruction=full_system_prompt(),
        tools=tools,
        tool_config=tool_config,
        temperature=0.2,
        max_output_tokens=2500,
    )

    history = history_store.get(session_id)
    contents: list[Any] = []
    for entry in history:
        contents.append(entry)
    contents.append(
        types.Content(role="user", parts=[types.Part.from_text(text=user_message)])
    )

    new_turn_entries: list[Any] = [
        types.Content(role="user", parts=[types.Part.from_text(text=user_message)])
    ]

    iteration = 0
    final_text_accumulator = ""
    while iteration < MAX_TOOL_ITERATIONS:
        iteration += 1
        try:
            response = await asyncio.to_thread(
                client.models.generate_content,
                model=GEMINI_MODEL,
                contents=contents,
                config=config,
            )
        except Exception as e:
            logger.exception("Gemini API call failed")
            yield {"type": "error", "content": f"Gemini API error: {e}"}
            break

        candidate = (response.candidates or [None])[0]
        if candidate is None or candidate.content is None:
            yield {"type": "error", "content": "Gemini returned no candidates."}
            break

        parts = candidate.content.parts or []
        function_calls = [p.function_call for p in parts if getattr(p, "function_call", None)]
        text_parts = [p.text for p in parts if getattr(p, "text", None)]

        if function_calls:
            model_parts = []
            for p in parts:
                if getattr(p, "function_call", None) or getattr(p, "text", None):
                    model_parts.append(p)
            contents.append(types.Content(role="model", parts=model_parts))
            new_turn_entries.append(types.Content(role="model", parts=model_parts))

            tool_response_parts = []
            for fc in function_calls:
                name = fc.name
                args = _part_to_jsonable_args(fc.args)
                yield {"type": "tool_call", "name": name, "args": args}
                try:
                    result = await asyncio.to_thread(tools_module.invoke, name, args)
                    yield {"type": "tool_result", "name": name, "result": result}
                    tool_response_parts.append(
                        types.Part.from_function_response(name=name, response={"result": result})
                    )
                except tools_module.ToolError as e:
                    err = str(e)
                    logger.warning("Tool %s failed: %s", name, err)
                    yield {"type": "tool_error", "name": name, "error": err}
                    tool_response_parts.append(
                        types.Part.from_function_response(name=name, response={"error": err})
                    )

            contents.append(types.Content(role="user", parts=tool_response_parts))
            new_turn_entries.append(types.Content(role="user", parts=tool_response_parts))
            continue

        if text_parts:
            joined = "".join(text_parts)
            final_text_accumulator = joined
            for chunk in _chunk_text(joined, size=60):
                yield {"type": "text", "content": chunk}
                await asyncio.sleep(0.01)

            model_parts = [types.Part.from_text(text=joined)]
            contents.append(types.Content(role="model", parts=model_parts))
            new_turn_entries.append(types.Content(role="model", parts=model_parts))
            break

        yield {"type": "error", "content": "Empty response from model."}
        break

    if iteration >= MAX_TOOL_ITERATIONS and not final_text_accumulator:
        yield {
            "type": "error",
            "content": (
                f"Agent exceeded {MAX_TOOL_ITERATIONS} tool-call iterations without converging. "
                "Try rephrasing the question."
            ),
        }

    history_store.append(session_id, *new_turn_entries)
    yield {"type": "done"}


def _chunk_text(text: str, size: int = 60):
    """Yield the text in size-ish chunks while keeping word boundaries when possible."""
    if not text:
        return
    i = 0
    n = len(text)
    while i < n:
        end = min(i + size, n)
        if end < n:
            j = text.rfind(" ", i, end)
            if j > i:
                end = j + 1
        yield text[i:end]
        i = end


async def health_check() -> dict[str, Any]:
    """Lightweight reachability check for the status badge."""
    if not GEMINI_API_KEY:
        return {
            "configured": False,
            "reachable": False,
            "model": None,
            "error": "GEMINI_API_KEY not set",
        }
    try:
        client = _build_client()
        from google.genai import types as _t
        await asyncio.to_thread(
            client.models.generate_content,
            model=GEMINI_MODEL,
            contents=[_t.Content(role="user", parts=[_t.Part.from_text(text="ping")])],
            config=_t.GenerateContentConfig(max_output_tokens=4),
        )
        return {"configured": True, "reachable": True, "model": GEMINI_MODEL, "error": None}
    except Exception as e:
        return {
            "configured": True,
            "reachable": False,
            "model": GEMINI_MODEL,
            "error": str(e),
        }
