"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchAPI } from "@/lib/api";
import { PLOTLY_DARK_LAYOUT, PLOTLY_CONFIG, CHART_COLORS } from "@/lib/plotly-theme";
import { TrendingUp, Loader2, AlertCircle } from "lucide-react";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

export default function ForecastPage() {
  const [selectedWeek, setSelectedWeek] = useState<string>("");

  const { data: metricsData } = useQuery({
    queryKey: ["model-metrics"],
    queryFn: () => fetchAPI("/api/forecast/metrics"),
  });

  const {
    data: wfData,
    isLoading: wfLoading,
    error: wfError,
  } = useQuery({
    queryKey: ["walkforward"],
    queryFn: () => fetchAPI("/api/forecast/walkforward?last_n_years=2"),
  });

  const {
    data: shapData,
    isLoading: shapLoading,
    error: shapError,
  } = useQuery({
    queryKey: ["shap-summary"],
    queryFn: () => fetchAPI("/api/forecast/shap-summary"),
  });

  const {
    data: waterfallData,
    isLoading: waterfallLoading,
    error: waterfallError,
  } = useQuery({
    queryKey: ["shap-waterfall", selectedWeek],
    queryFn: () =>
      fetchAPI(`/api/forecast/shap-waterfall?week_date=${selectedWeek}`),
    enabled: !!selectedWeek,
  });

  // Extract available dates from walk-forward data
  const availableDates =
    wfData?.dates || wfData?.index || wfData?.predictions?.map?.((p: { date: string }) => p.date) || [];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
          <TrendingUp className="h-5 w-5 text-amber-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Forecast & SHAP</h1>
          <p className="text-sm text-slate-400">
            Walk-forward validation results with SHAP explainability
          </p>
        </div>
      </div>

      {/* Metrics Summary — always shows from /api/forecast/metrics (has hardcoded fallback) */}
      {metricsData && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          {[
            { label: "Baseline RMSE", value: metricsData.baseline?.rmse, fmt: 4 },
            { label: "Baseline MAE", value: metricsData.baseline?.mae, fmt: 4 },
            { label: "Directional Acc.", value: metricsData.baseline?.da, fmt: 1, suffix: "%" },
            { label: "Regime RMSE", value: metricsData.regime_aware?.rmse, fmt: 4 },
            { label: "Winner", value: metricsData.winner },
          ].map((m) => (
            <div
              key={m.label}
              className="rounded-xl border border-slate-800 bg-slate-900 p-4"
            >
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                {m.label}
              </p>
              <p className="mt-1 text-xl font-bold text-white">
                {typeof m.value === "number" ? m.value.toFixed(m.fmt ?? 4) : m.value}{m.suffix || ""}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Actual vs Predicted */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <h3 className="mb-3 text-sm font-semibold text-white">
          Actual vs Predicted WACMR
        </h3>
        {wfLoading ? (
          <div className="flex h-80 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
          </div>
        ) : wfError ? (
          <div className="flex h-80 items-center justify-center gap-2 text-rose-400">
            <AlertCircle className="h-4 w-4" />
            <span className="text-center text-sm">{wfError instanceof Error ? wfError.message : "Failed to load forecast data"}</span>
          </div>
        ) : wfData ? (
          <Plot
            data={(() => {
              const dates = wfData.dates || wfData.index || wfData.predictions?.map?.((p: { date: string }) => p.date) || [];
              const actual = wfData.actual || wfData.y_true || wfData.predictions?.map?.((p: { actual: number }) => p.actual) || [];
              const predicted = wfData.predicted || wfData.y_pred || wfData.predictions?.map?.((p: { predicted: number }) => p.predicted) || [];
              return [
                {
                  x: dates,
                  y: actual,
                  name: "Actual",
                  type: "scatter" as const,
                  mode: "lines" as const,
                  line: { color: CHART_COLORS[0], width: 2 },
                },
                {
                  x: dates,
                  y: predicted,
                  name: "Predicted",
                  type: "scatter" as const,
                  mode: "lines" as const,
                  line: { color: CHART_COLORS[1], width: 2, dash: "dot" as const },
                },
              ];
            })()}
            layout={{
              ...PLOTLY_DARK_LAYOUT,
              height: 400,
              xaxis: { ...PLOTLY_DARK_LAYOUT.xaxis, title: "Date" },
              yaxis: { ...PLOTLY_DARK_LAYOUT.yaxis, title: "WACMR" },
              legend: {
                ...PLOTLY_DARK_LAYOUT.legend,
                orientation: "h" as const,
                y: -0.15,
              },
            }}
            config={PLOTLY_CONFIG}
            className="w-full"
          />
        ) : null}
      </div>

      {/* SHAP Summary */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <h3 className="mb-3 text-sm font-semibold text-white">
            SHAP Feature Importance (Top 15)
          </h3>
          {shapLoading ? (
            <div className="flex h-80 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
            </div>
          ) : shapError ? (
            <div className="flex h-80 items-center justify-center gap-2 text-rose-400">
              <AlertCircle className="h-4 w-4" />
              <span className="text-center text-sm">{shapError instanceof Error ? shapError.message : "Failed to load SHAP data"}</span>
            </div>
          ) : shapData ? (
            <Plot
              data={[
                {
                  y: (shapData.features || []).slice(0, 15).reverse().map((f: { label: string }) => f.label),
                  x: (shapData.features || []).slice(0, 15).reverse().map((f: { mean_abs_shap: number }) => f.mean_abs_shap),
                  type: "bar" as const,
                  orientation: "h" as const,
                  marker: {
                    color: CHART_COLORS[0],
                    opacity: 0.8,
                  },
                  hovertemplate: "%{y}<br>Importance: %{x:.4f}<extra></extra>",
                },
              ]}
              layout={{
                ...PLOTLY_DARK_LAYOUT,
                height: 420,
                xaxis: {
                  ...PLOTLY_DARK_LAYOUT.xaxis,
                  title: "Mean |SHAP|",
                },
                yaxis: {
                  ...PLOTLY_DARK_LAYOUT.yaxis,
                  tickfont: { size: 10, color: "#94a3b8" },
                },
                margin: { t: 20, r: 20, b: 50, l: 180 },
              }}
              config={PLOTLY_CONFIG}
              className="w-full"
            />
          ) : null}
        </div>

        {/* SHAP Waterfall */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <h3 className="mb-3 text-sm font-semibold text-white">
            SHAP Waterfall for Selected Week
          </h3>
          <div className="mb-3">
            <select
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
            >
              <option value="">Select a week...</option>
              {availableDates.slice(-52).map((d: string) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          {!selectedWeek ? (
            <div className="flex h-72 items-center justify-center text-sm text-slate-500">
              Select a week to view SHAP waterfall
            </div>
          ) : waterfallLoading ? (
            <div className="flex h-72 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
            </div>
          ) : waterfallError ? (
            <div className="flex h-72 items-center justify-center gap-2 text-rose-400">
              <AlertCircle className="h-4 w-4" />
              <span>Failed to load waterfall data</span>
            </div>
          ) : waterfallData ? (
            <Plot
              data={[
                {
                  type: "bar" as const,
                  orientation: "h" as const,
                  y: (waterfallData.features || [])
                    .slice(0, 15)
                    .reverse()
                    .map((f: { label: string }) => f.label),
                  x: (waterfallData.features || [])
                    .slice(0, 15)
                    .reverse()
                    .map((f: { shap_value: number }) => f.shap_value),
                  marker: {
                    color: (waterfallData.features || [])
                      .slice(0, 15)
                      .reverse()
                      .map((f: { shap_value: number }) => (f.shap_value >= 0 ? CHART_COLORS[1] : CHART_COLORS[3])),
                  },
                  hovertemplate: "%{y}<br>SHAP: %{x:.4f}<extra></extra>",
                },
              ]}
              layout={{
                ...PLOTLY_DARK_LAYOUT,
                height: 350,
                margin: { t: 20, r: 20, b: 50, l: 180 },
                yaxis: {
                  ...PLOTLY_DARK_LAYOUT.yaxis,
                  tickfont: { size: 10, color: "#94a3b8" },
                },
                xaxis: {
                  ...PLOTLY_DARK_LAYOUT.xaxis,
                  title: "SHAP Value",
                },
              }}
              config={PLOTLY_CONFIG}
              className="w-full"
            />
          ) : null}
        </div>
      </div>

      {/* Model Metrics Table */}
      {wfData?.model_comparison && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <h3 className="mb-3 text-sm font-semibold text-white">
            Model Comparison
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">
                    Model
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">
                    RMSE
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">
                    MAE
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">
                    DA (%)
                  </th>
                </tr>
              </thead>
              <tbody>
                {wfData.model_comparison.map(
                  (m: { name: string; rmse: number; mae: number; da: number }, i: number) => (
                    <tr
                      key={m.name}
                      className={
                        i % 2 === 0
                          ? "bg-slate-950"
                          : "bg-slate-900/30"
                      }
                    >
                      <td className="px-4 py-2.5 font-medium text-white">
                        {m.name}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-slate-300">
                        {m.rmse?.toFixed(4)}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-slate-300">
                        {m.mae?.toFixed(4)}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-slate-300">
                        {m.da?.toFixed(1)}%
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
