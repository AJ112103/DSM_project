"""Precompute counterfactual responses for the slider and the default sweep.

The /api/simulate/counterfactual endpoint is deterministic for a given
(repo_rate_delta_bps, base_week). The simulator slider only moves in 5 bps
steps over [-200, 200] for the latest week, so all 81 possible answers can be
computed once and shipped as a static JSON artifact. The router serves them
out of memory in microseconds, even on a fresh process.

Runnable as:
    python -m backend.ml.precompute_simulator
    python backend/ml/precompute_simulator.py

Writes to backend/ml/saved_model/:
    simulate_slider.json         - {"base_week", "points": {"-200": {...}, ..., "200": {...}}}
    simulate_sweep_default.json  - the /sweep response shape for min=-200,max=200,step=25
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

# Allow `python backend/ml/precompute_simulator.py` from the repo root.
ROOT = Path(__file__).resolve().parent.parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.agent.tools import _tool_run_counterfactual  # noqa: E402
from backend.config import SAVED_MODEL_DIR  # noqa: E402

SLIDER_STEP_BPS = 5
SLIDER_RANGE = range(-200, 201, SLIDER_STEP_BPS)

SWEEP_MIN = -200
SWEEP_MAX = 200
SWEEP_STEP = 25


def _compute_slider() -> dict:
    points: dict[str, dict] = {}
    base_week: str | None = None
    base_prediction: float | None = None
    for bps in SLIDER_RANGE:
        result = _tool_run_counterfactual(repo_rate_delta_bps=float(bps), base_week=None)
        if base_week is None:
            base_week = result["base_week"]
            base_prediction = result["base_prediction"]
        points[str(bps)] = result
    return {
        "base_week": base_week,
        "base_prediction": base_prediction,
        "step_bps": SLIDER_STEP_BPS,
        "points": points,
    }


def _compute_sweep_default() -> dict:
    points = []
    base_week: str | None = None
    base_prediction: float | None = None
    bps = SWEEP_MIN
    while bps <= SWEEP_MAX:
        r = _tool_run_counterfactual(repo_rate_delta_bps=float(bps), base_week=None)
        if base_week is None:
            base_week = r["base_week"]
            base_prediction = r["base_prediction"]
        points.append({
            "bps": float(bps),
            "predicted": r["counterfactual_prediction"],
            "delta_pp": r["delta_pp"],
            "ci_lo": (r["confidence_interval_90"] or [None, None])[0],
            "ci_hi": (r["confidence_interval_90"] or [None, None])[1],
        })
        bps += SWEEP_STEP
    return {
        "base_week": base_week,
        "base_prediction": round(base_prediction, 4) if base_prediction is not None else None,
        "points": points,
    }


def main() -> int:
    SAVED_MODEL_DIR.mkdir(parents=True, exist_ok=True)

    print(f"Precomputing slider ({len(list(SLIDER_RANGE))} points)…")
    t0 = time.time()
    slider = _compute_slider()
    slider_path = SAVED_MODEL_DIR / "simulate_slider.json"
    slider_path.write_text(json.dumps(slider, indent=2))
    print(f"  wrote {slider_path} ({slider_path.stat().st_size / 1024:.1f} KB) in {time.time() - t0:.1f}s")

    print(f"Precomputing default sweep…")
    t0 = time.time()
    sweep = _compute_sweep_default()
    sweep_path = SAVED_MODEL_DIR / "simulate_sweep_default.json"
    sweep_path.write_text(json.dumps(sweep, indent=2))
    print(f"  wrote {sweep_path} ({sweep_path.stat().st_size / 1024:.1f} KB) in {time.time() - t0:.1f}s")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
