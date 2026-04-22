"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Gauge,
  TrendingDown,
  TrendingUp,
  Minus,
  Info,
  AlertTriangle,
} from "lucide-react";
import { apiBase, postAPI } from "@/lib/api";
import { PLOTLY_DARK_LAYOUT, PLOTLY_CONFIG, CHART_COLORS } from "@/lib/plotly-theme";
import { cn } from "@/lib/utils";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

type SweepPoint = {
  bps: number;
  predicted: number;
  delta_pp: number;
  ci_lo: number | null;
  ci_hi: number | null;
};

type SweepResponse = {
  base_week: string | null;
  base_prediction: number | null;
  points: SweepPoint[];
};

type CounterfactualResponse = {
  base_week: string;
  repo_rate_delta_bps: number;
  base_prediction: number;
  counterfactual_prediction: number;
  delta_pp: number;
  confidence_interval_90: [number, number] | null;
};

type Attribution = { feature: string; label: string; shap_delta: number };

type AttributionResponse = {
  base_week: string;
  repo_rate_delta_bps: number;
  attributions: Attribution[];
};

const DELTA_PRESETS = [-100, -50, -25, 0, 25, 50, 100];

// 200ms debounce: the slider thumb (bound to `bps`) updates instantly so the
// UI feels responsive, but `queryBps` only catches up after the user pauses.
// useDeferredValue alone doesn't help here — every value change still produces
// a new React Query key, so we need an actual timer-based gate.
function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function SimulatePage() {
  const [bps, setBps] = useState<number>(-25);
  const queryBps = useDebounced(bps, 200);

  const { data: sweep, isLoading: loadingSweep, error: sweepError } = useQuery<SweepResponse>({
    queryKey: ["simulate-sweep"],
    queryFn: () =>
      postAPI("/api/simulate/sweep", { min_bps: -200, max_bps: 200, step_bps: 25 }),
    staleTime: Infinity,
  });

  const { data: point, isLoading: loadingPoint } = useQuery<CounterfactualResponse>({
    queryKey: ["simulate-cf", queryBps],
    queryFn: () => postAPI("/api/simulate/counterfactual", { repo_rate_delta_bps: queryBps }),
    staleTime: Infinity,
  });

  const { data: attribution } = useQuery<AttributionResponse>({
    queryKey: ["simulate-attribution", queryBps],
    queryFn: () =>
      fetch(
        `${apiBase}/api/simulate/attribution?repo_rate_delta_bps=${queryBps}`
      ).then((r) => r.json()),
    staleTime: Infinity,
    enabled: queryBps !== 0,
  });

  const curveData = useMemo(() => {
    if (!sweep?.points?.length) return null;
    const xs = sweep.points.map((p) => p.bps);
    const ys = sweep.points.map((p) => p.predicted);
    const ciLo = sweep.points.map((p) => p.ci_lo).filter((v) => v != null) as number[];
    const ciHi = sweep.points.map((p) => p.ci_hi).filter((v) => v != null) as number[];
    const hasCI = ciLo.length === xs.length && ciHi.length === xs.length;

    const traces: Record<string, unknown>[] = [];
    if (hasCI) {
      traces.push({
        type: "scatter",
        mode: "lines",
        x: [...xs, ...[...xs].reverse()],
        y: [...ciHi, ...[...ciLo].reverse()],
        fill: "toself",
        fillcolor: "rgba(6, 182, 212, 0.12)",
        line: { width: 0 },
        showlegend: false,
        hoverinfo: "skip",
        name: "90% CI",
      });
    }
    traces.push({
      type: "scatter",
      mode: "lines+markers",
      x: xs,
      y: ys,
      line: { color: CHART_COLORS[5], width: 2.5 },
      marker: { color: CHART_COLORS[5], size: 6 },
      name: "Predicted WACMR",
      hovertemplate: "%{x:+.0f} bps → %{y:.3f}%<extra></extra>",
    });
    if (sweep.base_prediction != null) {
      traces.push({
        type: "scatter",
        mode: "lines",
        x: [xs[0], xs[xs.length - 1]],
        y: [sweep.base_prediction, sweep.base_prediction],
        line: { color: "#64748b", width: 1, dash: "dot" },
        name: `Baseline (${sweep.base_prediction.toFixed(3)}%)`,
        hoverinfo: "skip",
      });
    }
    return { data: traces, base: sweep.base_prediction };
  }, [sweep]);

  const curveLayout = useMemo(() => {
    const annotations: Record<string, unknown>[] = [];
    if (point && sweep?.base_prediction != null) {
      annotations.push({
        x: bps,
        y: point.counterfactual_prediction,
        xref: "x",
        yref: "y",
        text: `${bps >= 0 ? "+" : ""}${bps} bps`,
        showarrow: true,
        arrowhead: 2,
        ax: 0,
        ay: -30,
        font: { color: "#f8fafc", size: 11 },
        bgcolor: "#0891b2",
        bordercolor: "#0891b2",
        borderpad: 3,
      });
    }
    return {
      ...PLOTLY_DARK_LAYOUT,
      title: {
        text: "How WACMR responds to a repo-rate change",
        font: { size: 13 },
      },
      xaxis: {
        ...PLOTLY_DARK_LAYOUT.xaxis,
        title: { text: "Repo-rate change (basis points)" },
        zeroline: true,
      },
      yaxis: {
        ...PLOTLY_DARK_LAYOUT.yaxis,
        title: { text: "Predicted WACMR (%)" },
      },
      height: 360,
      margin: { l: 60, r: 24, t: 48, b: 52 },
      annotations,
      hovermode: "x unified",
    };
  }, [sweep, point, bps]);

  const sign = bps === 0 ? "" : bps > 0 ? "+" : "";
  const direction = !point
    ? null
    : point.delta_pp > 0.005
      ? "rise"
      : point.delta_pp < -0.005
        ? "fall"
        : "barely move";

  return (
    <div className="mx-auto max-w-6xl space-y-8" data-slider-version="v2-debounce-200ms">
      <header className="space-y-3">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-cyan-400">
          <Gauge className="h-3.5 w-3.5" />
          Policy counterfactual simulator
        </div>
        <h1
          className="text-3xl font-normal tracking-tight text-white lg:text-5xl"
          style={{ fontFamily: "var(--font-instrument-serif)" }}
        >
          What if the RBI moved the repo rate today?
        </h1>
        <p className="max-w-3xl text-slate-400">
          Drag the slider below to simulate a hypothetical repo-rate change. The trained
          XGBoost model re-runs over the last 12 observed weeks, perturbing the repo rate
          and its downstream lagged and spread features. The shaded band is the 90%
          confidence interval derived from walk-forward residuals.
        </p>
      </header>

      {/* Slider + headline metrics */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 lg:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-500">
              Hypothetical change
            </div>
            <div
              className="font-mono text-4xl font-semibold text-cyan-300 lg:text-5xl"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {sign}
              {bps} bps
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {DELTA_PRESETS.map((d) => (
              <button
                key={d}
                onClick={() => setBps(d)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  bps === d
                    ? "border-cyan-400 bg-cyan-500/15 text-cyan-300"
                    : "border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600 hover:text-slate-200"
                )}
              >
                {d >= 0 ? "+" : ""}
                {d}
              </button>
            ))}
          </div>
        </div>
        <div className="relative">
          <input
            type="range"
            min={-200}
            max={200}
            step={5}
            value={bps}
            onChange={(e) => setBps(Number(e.target.value))}
            className="w-full accent-cyan-500"
          />
          <div className="mt-1 flex justify-between text-[10px] uppercase tracking-wider text-slate-500">
            <span>–200 bps (aggressive cut)</span>
            <span>0</span>
            <span>+200 bps (aggressive hike)</span>
          </div>
        </div>

        {/* Metrics grid */}
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MetricCard
            label="Baseline WACMR"
            value={point ? `${point.base_prediction.toFixed(3)}%` : loadingPoint ? "…" : "—"}
            helper={point ? `As of ${point.base_week}` : ""}
            tone="neutral"
            icon={<Minus className="h-3.5 w-3.5" />}
          />
          <MetricCard
            label={`After ${sign}${bps} bps`}
            value={
              point ? `${point.counterfactual_prediction.toFixed(3)}%` : loadingPoint ? "…" : "—"
            }
            helper={
              point?.confidence_interval_90
                ? `90% CI [${point.confidence_interval_90[0].toFixed(2)}, ${point.confidence_interval_90[1].toFixed(2)}]`
                : ""
            }
            tone="neutral"
            icon={<Gauge className="h-3.5 w-3.5" />}
          />
          <MetricCard
            label="Δ WACMR"
            value={point ? `${point.delta_pp > 0 ? "+" : ""}${point.delta_pp.toFixed(3)} pp` : "—"}
            helper={
              direction
                ? direction === "rise"
                  ? "Model predicts WACMR would rise"
                  : direction === "fall"
                    ? "Model predicts WACMR would fall"
                    : "Net effect is inside the noise band"
                : ""
            }
            tone={
              !point || Math.abs(point.delta_pp) < 0.005
                ? "neutral"
                : point.delta_pp > 0
                  ? "warn"
                  : "good"
            }
            icon={
              !point || Math.abs(point.delta_pp) < 0.005 ? (
                <Minus className="h-3.5 w-3.5" />
              ) : point.delta_pp > 0 ? (
                <TrendingUp className="h-3.5 w-3.5" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5" />
              )
            }
          />
        </div>
      </section>

      {/* Response curve */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 lg:p-6">
        {sweepError && (
          <div className="mb-3 flex items-start gap-2 rounded-md border border-rose-500/30 bg-rose-500/5 p-3 text-sm text-rose-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Failed to load the policy-response curve. Check the backend.</span>
          </div>
        )}
        {loadingSweep && !curveData && (
          <div className="relative h-[360px] overflow-hidden rounded-md border border-slate-800/50 bg-slate-900/30">
            <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-slate-800/40 via-slate-900/20 to-slate-800/40" />
            <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-500">
              Sweeping –200 to +200 bps…
            </div>
          </div>
        )}
        {curveData && (
          <Plot
            data={curveData.data as unknown as Plotly.Data[]}
            layout={curveLayout as unknown as Partial<Plotly.Layout>}
            config={PLOTLY_CONFIG}
            className="w-full"
            useResizeHandler
            style={{ width: "100%" }}
          />
        )}
      </section>

      {/* Attribution */}
      {attribution && attribution.attributions.length > 0 && (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 lg:p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-white">
                What drove the Δ
              </h2>
              <p className="text-xs text-slate-400">
                Per-feature change in SHAP contribution when we perturb the repo rate.
                Positive bars pushed the prediction up; negative pushed it down.
              </p>
            </div>
          </div>
          <AttributionBars items={attribution.attributions} />
        </section>
      )}

      {/* Editorial interpretation */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 lg:p-8">
        <div className="flex items-start gap-3">
          <Info className="mt-1 h-5 w-5 shrink-0 text-cyan-400" />
          <div className="space-y-3 text-sm leading-relaxed text-slate-300">
            <p className="text-slate-400">
              <span className="font-semibold text-slate-200">How to read this.</span>{" "}
              Because WACMR tracks the RBI rate corridor tightly, a +/-25 bps move often
              shows a small net effect here — the model&apos;s top feature is last
              week&apos;s WACMR (<span className="font-mono">target_lag1</span>, mean
              |SHAP| ≈ 0.49), which does not change under the counterfactual. Larger
              moves (±100 bps, ±200 bps) show the rate-corridor channel more clearly.
              The asymmetry between hikes and cuts reflects the tree model&apos;s learned
              response across the two monetary-policy regimes.
            </p>
            <p className="text-slate-500">
              This is a <span className="italic">model-based</span> counterfactual,
              not a causal one. It answers &quot;how would the XGBoost forecast respond?&quot;,
              not &quot;what would actually happen in the economy?&quot;.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  helper,
  tone,
  icon,
}: {
  label: string;
  value: string;
  helper: string;
  tone: "neutral" | "good" | "warn";
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <div className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-500">
        {icon}
        {label}
      </div>
      <div
        className={cn(
          "font-mono text-2xl font-semibold tabular-nums",
          tone === "neutral" && "text-slate-100",
          tone === "good" && "text-emerald-400",
          tone === "warn" && "text-amber-400"
        )}
      >
        {value}
      </div>
      {helper && <div className="mt-1 text-[11px] text-slate-500">{helper}</div>}
    </div>
  );
}

function AttributionBars({ items }: { items: Attribution[] }) {
  const maxAbs = Math.max(...items.map((i) => Math.abs(i.shap_delta)), 0.001);
  return (
    <div className="space-y-1.5">
      {items.map((item) => {
        const pct = (Math.abs(item.shap_delta) / maxAbs) * 100;
        const positive = item.shap_delta >= 0;
        return (
          <div
            key={item.feature}
            className="grid grid-cols-[10rem_1fr_5rem] items-center gap-3 text-xs"
          >
            <div className="truncate text-slate-300">{item.label}</div>
            <div className="relative h-2.5 rounded bg-slate-800">
              <div
                className={cn(
                  "absolute top-0 h-2.5 rounded",
                  positive ? "left-1/2 bg-amber-500/70" : "right-1/2 bg-emerald-500/70"
                )}
                style={{ width: `${pct / 2}%` }}
              />
              <div className="absolute left-1/2 top-0 h-2.5 w-px bg-slate-600" />
            </div>
            <div
              className={cn(
                "text-right font-mono tabular-nums",
                positive ? "text-amber-400" : "text-emerald-400"
              )}
            >
              {positive ? "+" : ""}
              {item.shap_delta.toFixed(4)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

