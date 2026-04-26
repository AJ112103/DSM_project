"use client";

import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { fetchAPI } from "@/lib/api";
import { PLOTLY_DARK_LAYOUT, PLOTLY_CONFIG, CHART_COLORS } from "@/lib/plotly-theme";
import { Layers, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

export default function RegimesPage() {
  const {
    data: pcaData,
    isLoading: pcaLoading,
    error: pcaError,
  } = useQuery({
    queryKey: ["pca"],
    queryFn: () => fetchAPI("/api/analytics/pca"),
  });

  const {
    data: regimeData,
    isLoading: regimeLoading,
    error: regimeError,
  } = useQuery({
    queryKey: ["regimes"],
    queryFn: () => fetchAPI("/api/analytics/regimes"),
  });

  const regimeColors: Record<number, string> = {
    0: CHART_COLORS[0],
    1: CHART_COLORS[1],
    2: CHART_COLORS[2],
    3: CHART_COLORS[3],
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10">
          <Layers className="h-5 w-5 text-violet-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Regime Analysis</h1>
          <p className="text-sm text-slate-400">
            Hidden Markov Model regime detection and PCA visualization
          </p>
        </div>
      </div>

      {/* Regime Summary Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {regimeLoading ? (
          Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="skeleton h-40 rounded-xl border border-slate-800"
            />
          ))
        ) : regimeError ? (
          <div className="col-span-full flex flex-col items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 p-8 text-center">
            <AlertCircle className="h-5 w-5 text-amber-400" />
            <span className="text-sm text-amber-400">{regimeError instanceof Error ? regimeError.message : "Failed to load regime data"}</span>
            <span className="text-xs text-slate-500">Run the ML pipeline (stages 2-3) to generate regime labels</span>
          </div>
        ) : (
          (regimeData?.regimes || []).map(
            (regime: {
              regime: number;
              n_weeks: number;
              first_week: string;
              last_week: string;
              avg_wacmr: number;
              avg_repo_rate: number | null;
              avg_msf_rate: number | null;
              std_wacmr: number;
            }, i: number) => (
              <div
                key={i}
                className="rounded-xl border border-slate-800 bg-slate-900 p-5"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: regimeColors[i] || CHART_COLORS[i] }}
                  />
                  <h3 className="font-semibold text-white">
                    Regime {regime.regime}
                  </h3>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-slate-500">Weeks</p>
                    <p className="text-lg font-bold text-white">
                      {regime.n_weeks}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Avg WACMR</p>
                    <p className="text-lg font-bold text-white">
                      {regime.avg_wacmr.toFixed(3)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Std Dev</p>
                    <p className="text-sm text-slate-300">
                      {regime.std_wacmr.toFixed(3)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Period</p>
                    <p className="text-sm text-slate-300">
                      {regime.first_week} to {regime.last_week}
                    </p>
                  </div>
                </div>
              </div>
            )
          )
        )}
      </div>

      {/* PCA Scatter Plot */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <h3 className="mb-3 text-sm font-semibold text-white">
          PCA Scatter Plot (colored by regime)
        </h3>
        {pcaLoading ? (
          <div className="flex h-96 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
          </div>
        ) : pcaError ? (
          <div className="flex h-96 items-center justify-center gap-2 text-rose-400">
            <AlertCircle className="h-4 w-4" />
            <span>Failed to load PCA data</span>
          </div>
        ) : pcaData ? (
          <Plot
            data={(() => {
              const points = pcaData.data || [];
              if (!Array.isArray(points) || points.length === 0) return [];
              const regimes = [...new Set(points.map((p: { regime_label: number }) => p.regime_label))] as number[];
              return regimes.map((r: number) => {
                const filtered = points.filter(
                  (p: { regime_label: number }) => p.regime_label === r
                );
                return {
                  x: filtered.map((p: { pc1: number }) => p.pc1),
                  y: filtered.map((p: { pc2: number }) => p.pc2),
                  mode: "markers" as const,
                  type: "scatter" as const,
                  name: `Regime ${r}`,
                  marker: {
                    color: regimeColors[r] || CHART_COLORS[r],
                    size: 5,
                    opacity: 0.7,
                  },
                  text: filtered.map((p: { week_date: string; wacmr: number }) =>
                    `${p.week_date}<br>WACMR: ${p.wacmr}`
                  ),
                  hovertemplate: "%{text}<extra></extra>",
                };
              });
            })()}
            layout={{
              ...PLOTLY_DARK_LAYOUT,
              height: 450,
              xaxis: { ...PLOTLY_DARK_LAYOUT.xaxis, title: "PC1" },
              yaxis: { ...PLOTLY_DARK_LAYOUT.yaxis, title: "PC2" },
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

      {/* Regime Timeline Strip */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <h3 className="mb-3 text-sm font-semibold text-white">
          Regime Transition Timeline
        </h3>
        {pcaLoading ? (
          <div className="skeleton h-16 rounded-lg" />
        ) : pcaData ? (
          (() => {
            const points = pcaData.data || [];
            let dates: string[] = [];
            let regimes: number[] = [];

            if (Array.isArray(points) && points.length > 0) {
              dates = points.map((p: { week_date: string }) => p.week_date);
              regimes = points.map((p: { regime_label: number }) => p.regime_label);
            }

            if (regimes.length === 0) {
              return <p className="text-sm text-slate-500">No timeline data available</p>;
            }

            return (
              <div>
                <div className="flex h-8 w-full overflow-hidden rounded-lg">
                  {regimes.map((r, i) => (
                    <div
                      key={i}
                      className="h-full"
                      style={{
                        width: `${100 / regimes.length}%`,
                        backgroundColor: regimeColors[r] || CHART_COLORS[r] || "#475569",
                        opacity: 0.8,
                      }}
                      title={`${dates[i] || `Week ${i}`}: Regime ${r}`}
                    />
                  ))}
                </div>
                <div className="mt-2 flex justify-between text-xs text-slate-500">
                  <span>{dates[0] || "Start"}</span>
                  <span>{dates[dates.length - 1] || "End"}</span>
                </div>
                <div className="mt-2 flex gap-4">
                  {Object.entries(regimeColors)
                    .slice(0, [...new Set(regimes)].length)
                    .map(([r, color]) => (
                      <div key={r} className="flex items-center gap-1.5">
                        <div
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-xs text-slate-400">Regime {r}</span>
                      </div>
                    ))}
                </div>
              </div>
            );
          })()
        ) : null}
      </div>
    </div>
  );
}
