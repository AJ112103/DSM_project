"""In-memory per-session conversation history for the agent.

Gemini wants content in the shape:
    [
        {"role": "user",  "parts": [{"text": "..."}]},
        {"role": "model", "parts": [{"text": "..."}]},
        ...
    ]

We store that shape directly. Function calls / function responses are also
stored so the model has full context of what tools it already ran.
"""
from __future__ import annotations

import threading
import time
from typing import Any

MAX_TURNS = 20  # user+model turns kept; older pairs are dropped
TTL_SECONDS = 60 * 60  # purge sessions idle for an hour


class SessionStore:
    def __init__(self) -> None:
        self._data: dict[str, list[dict[str, Any]]] = {}
        self._last_touch: dict[str, float] = {}
        self._lock = threading.Lock()

    def _gc(self) -> None:
        """Drop stale sessions. Called on every access — cheap enough."""
        now = time.time()
        stale = [sid for sid, t in self._last_touch.items() if now - t > TTL_SECONDS]
        for sid in stale:
            self._data.pop(sid, None)
            self._last_touch.pop(sid, None)

    def get(self, session_id: str) -> list[dict[str, Any]]:
        with self._lock:
            self._gc()
            self._last_touch[session_id] = time.time()
            return list(self._data.get(session_id, []))

    def append(self, session_id: str, *entries: dict[str, Any]) -> None:
        with self._lock:
            self._gc()
            history = self._data.setdefault(session_id, [])
            history.extend(entries)
            # Trim — keep last MAX_TURNS * 2 entries (user + model pairs)
            # Tool call rounds can inflate so we cap by entry count, not turn count.
            max_entries = MAX_TURNS * 4
            if len(history) > max_entries:
                del history[: len(history) - max_entries]
            self._last_touch[session_id] = time.time()

    def clear(self, session_id: str) -> None:
        with self._lock:
            self._data.pop(session_id, None)
            self._last_touch.pop(session_id, None)


# Module-level singleton. Good enough for a single-process FastAPI deploy.
store = SessionStore()
