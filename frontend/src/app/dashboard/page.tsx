"use client";

import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { fetchAPI } from "@/lib/api";
import { PLOTLY_DARK_LAYOUT, PLOTLY_CONFIG, CHART_COLORS } from "@/lib/plotly-theme";
import { BarChart3, Loader2, AlertCircle } from "lucide-react";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

function ChartCard({
  title,
  children,
  isLoading,
  error,
}: {
  title: string;
  children: React.ReactNode;
  isLoading: boolean;
  error: Error | null;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <h3 className="mb-3 text-sm font-semibold text-white">{title}</h3>
      {isLoading ? (
        <div className="flex h-72 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
        </div>
      ) : error ? (
        <div className="flex h-72 flex-col items-center justify-center gap-2 text-sm text-rose-400">
          <AlertCircle className="h-4 w-4" />
          <span className="text-center">{error?.message || "Failed to load"}</span>
        </div>
      ) : (
        children
      )}
    </div>
  );
}

function ChartDescription({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4 border-t border-slate-800 pt-3 text-[12px] leading-relaxed text-slate-400">
      {children}
    </p>
  );
}

export default function DashboardPage() {
  // Single timeseries fetch covers both the line chart and the histogram —
  // the histogram only needs target_wacmr which is already in the response.
  const {
    data: tsData,
    isLoading: tsLoading,
    error: tsError,
  } = useQuery({
    queryKey: ["timeseries"],
    queryFn: () =>
      fetchAPI(
        "/api/data/timeseries?columns=target_wacmr,rates_I7496_17,rates_I7496_20"
      ),
  });

  const {
    data: corrData,
    isLoading: corrLoading,
    error: corrError,
  } = useQuery({
    queryKey: ["correlation"],
    queryFn: () => fetchAPI("/api/analytics/correlation-top?n=15"),
  });

  const {
    data: regimeData,
    isLoading: regimeLoading,
    error: regimeError,
  } = useQuery({
    queryKey: ["regime-summary"],
    queryFn: () => fetchAPI("/api/analytics/regimes"),
  });

  const {
    data: pcaData,
    isLoading: pcaLoading,
    error: pcaError,
  } = useQuery({
    queryKey: ["pca-dashboard"],
    queryFn: () => fetchAPI("/api/analytics/pca"),
  });

  const {
    data: shapRegimeData,
    isLoading: shapRegimeLoading,
    error: shapRegimeError,
  } = useQuery({
    queryKey: ["shap-by-regime-dashboard"],
    queryFn: () => fetchAPI("/api/forecast/shap-by-regime?top_n=10"),
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
          <BarChart3 className="h-5 w-5 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Interactive Dashboard</h1>
          <p className="text-sm text-slate-400">
            Time series, correlations, distributions, and regime composition
          </p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Time Series */}
        <ChartCard
          title="WACMR & Repo Rate Time Series"
          isLoading={tsLoading}
          error={tsError as Error | null}
        >
          {tsData && (
            <Plot
              data={[
                {
                  x: tsData.series?.dates,
                  y: tsData.series?.target_wacmr,
                  name: "WACMR",
                  type: "scatter" as const,
                  mode: "lines" as const,
                  line: { color: CHART_COLORS[0], width: 1.5 },
                },
                {
                  x: tsData.series?.dates,
                  y: tsData.series?.rates_I7496_17,
                  name: "Repo Rate",
                  type: "scatter" as const,
                  mode: "lines" as const,
                  line: { color: CHART_COLORS[1], width: 1.5 },
                },
                {
                  x: tsData.series?.dates,
                  y: tsData.series?.rates_I7496_20,
                  name: "MSF Rate",
                  type: "scatter" as const,
                  mode: "lines" as const,
                  line: { color: CHART_COLORS[2], width: 1.5 },
                },
              ]}
              layout={{
                ...PLOTLY_DARK_LAYOUT,
                height: 350,
                showlegend: true,
                legend: { ...PLOTLY_DARK_LAYOUT.legend, orientation: "h" as const, y: -0.15 },
                xaxis: { ...PLOTLY_DARK_LAYOUT.xaxis, title: "Date" },
                yaxis: { ...PLOTLY_DARK_LAYOUT.yaxis, title: "Rate (%)" },
              }}
              config={PLOTLY_CONFIG}
              className="w-full"
            />
          )}
          <ChartDescription>
            <strong>Policy Transmission</strong>: Tracks the primary interbank target (WACMR) against the RBI's main policy corridors. Divergences indicate liquidity surplus or stress.
          </ChartDescription>
        </ChartCard>

        {/* Correlation Heatmap */}
        <ChartCard
          title="Top Feature Correlations"
          isLoading={corrLoading}
          error={corrError as Error | null}
        >
          {corrData && (
            <Plot
              data={[
                {
                  z: corrData.matrix || corrData.values,
                  x: corrData.labels || corrData.columns,
                  y: corrData.labels || corrData.columns,
                  type: "heatmap" as const,
                  colorscale: "RdBu" as const,
                  zmin: -1,
                  zmax: 1,
                  hovertemplate: "%{x}<br>%{y}<br>Corr: %{z:.3f}<extra></extra>",
                },
              ]}
              layout={{
                ...PLOTLY_DARK_LAYOUT,
                height: 350,
                xaxis: {
                  ...PLOTLY_DARK_LAYOUT.xaxis,
                  tickangle: -45,
                  tickfont: { size: 8, color: "#94a3b8" },
                },
                yaxis: {
                  ...PLOTLY_DARK_LAYOUT.yaxis,
                  tickfont: { size: 8, color: "#94a3b8" },
                },
                margin: { t: 20, r: 20, b: 100, l: 100 },
              }}
              config={PLOTLY_CONFIG}
              className="w-full"
            />
          )}
          <ChartDescription>
            <strong>Feature Linkage</strong>: Correlation matrix of top-ranked features. Deep red indicates strong positive linkage; deep blue indicates negative relationship.
          </ChartDescription>
        </ChartCard>

        {/* Distribution — derived from the same timeseries fetch above */}
        <ChartCard
          title="WACMR Distribution"
          isLoading={tsLoading}
          error={tsError as Error | null}
        >
          {tsData && (
            <Plot
              data={[
                {
                  x: tsData.series?.target_wacmr || [],
                  type: "histogram" as const,
                  marker: {
                    color: CHART_COLORS[0],
                    line: { color: CHART_COLORS[0], width: 0.5 },
                    opacity: 0.7,
                  },
                  hovertemplate: "Range: %{x}<br>Count: %{y}<extra></extra>",
                },
              ]}
              layout={{
                ...PLOTLY_DARK_LAYOUT,
                height: 350,
                xaxis: { ...PLOTLY_DARK_LAYOUT.xaxis, title: "WACMR (%)" },
                yaxis: { ...PLOTLY_DARK_LAYOUT.yaxis, title: "Frequency" },
                bargap: 0.05,
              }}
              config={PLOTLY_CONFIG}
              className="w-full"
            />
          )}
          <ChartDescription>
            <strong>Rate Volatility</strong>: Shows the frequency of WACMR levels over 545 weeks. Bimodal peaks often correspond to distinct interest rate regimes.
          </ChartDescription>
        </ChartCard>

        {/* Regime Donut */}
        <ChartCard
          title="Regime Composition"
          isLoading={regimeLoading}
          error={regimeError as Error | null}
        >
          {regimeData?.regimes && (
            <Plot
              data={[
                {
                  values: regimeData.regimes.map(
                    (r: { n_weeks: number }) => r.n_weeks
                  ),
                  labels: regimeData.regimes.map(
                    (r: { regime: number }) => `Regime ${r.regime}`
                  ),
                  type: "pie" as const,
                  hole: 0.5,
                  marker: {
                    colors: [CHART_COLORS[0], CHART_COLORS[1], CHART_COLORS[2]],
                  },
                  textinfo: "label+percent",
                  textfont: { color: "#e2e8f0", size: 12 },
                  hovertemplate: "%{label}<br>Count: %{value}<br>%{percent}<extra></extra>",
                },
              ]}
              layout={{
                ...PLOTLY_DARK_LAYOUT,
                height: 350,
                showlegend: true,
                legend: { ...PLOTLY_DARK_LAYOUT.legend, orientation: "h" as const, y: -0.1 },
              }}
              config={PLOTLY_CONFIG}
              className="w-full"
            />
          )}
          <ChartDescription>
            <strong>Market Mix</strong>: Proportional breakdown of total weeks spent in each discovered regime (e.g., Accommodation vs. Tightening).
          </ChartDescription>
        </ChartCard>

        {/* PCA 3D Scatter */}
        <ChartCard
          title="Market State Topology (3D PCA)"
          isLoading={pcaLoading}
          error={pcaError as Error | null}
        >
          {pcaData?.data && (
            <Plot
              data={[
                {
                  x: pcaData.data.map((d: any) => d.pc1),
                  y: pcaData.data.map((d: any) => d.pc2),
                  z: pcaData.data.map((d: any) => d.pc3),
                  mode: "markers",
                  type: "scatter3d",
                  marker: {
                    size: 4,
                    color: pcaData.data.map((d: any) => d.regime_label),
                    colorscale: "Viridis",
                    opacity: 0.8,
                    line: { width: 0.5, color: "rgba(255,255,255,0.2)" },
                  },
                  text: pcaData.data.map((d: any) => `${d.week_date}<br>WACMR: ${d.wacmr}%`),
                  hovertemplate: "%{text}<extra></extra>",
                },
              ]}
              layout={{
                ...PLOTLY_DARK_LAYOUT,
                height: 400,
                scene: {
                  xaxis: { title: { text: "PC1" }, gridcolor: "rgba(255,255,255,0.1)", zeroline: false },
                  yaxis: { title: { text: "PC2" }, gridcolor: "rgba(255,255,255,0.1)", zeroline: false },
                  zaxis: { title: { text: "PC3" }, gridcolor: "rgba(255,255,255,0.1)", zeroline: false },
                  bgcolor: "rgba(0,0,0,0)",
                },
                margin: { l: 0, r: 0, b: 0, t: 0 },
              } as any}
              config={PLOTLY_CONFIG}
              className="w-full"
            />
          )}
          <ChartDescription>
            <strong>Market DNA</strong>: A 3D projection of the 117-dimensional feature space. Clusters reveal how the "state" of the market fundamentally shifts over time.
          </ChartDescription>
        </ChartCard>

        {/* SHAP by Regime */}
        <ChartCard
          title="Regime Feature Sensitivity (SHAP)"
          isLoading={shapRegimeLoading}
          error={shapRegimeError as Error | null}
        >
          {shapRegimeData?.features && (
            <Plot
              data={shapRegimeData.regimes.map((regime: string, idx: number) => ({
                type: "bar" as const,
                orientation: "h" as const,
                name: `Regime ${regime}`,
                y: shapRegimeData.features.map((f: any) => f.label),
                x: shapRegimeData.features.map((f: any) => f[`regime_${regime}`]),
                marker: { color: CHART_COLORS[idx] },
              }))}
              layout={{
                ...PLOTLY_DARK_LAYOUT,
                height: 400,
                barmode: "group" as const,
                xaxis: { ...PLOTLY_DARK_LAYOUT.xaxis, title: { text: "Mean |SHAP| (Impact)" } },
                yaxis: {
                  ...PLOTLY_DARK_LAYOUT.yaxis,
                  tickfont: { size: 10 },
                  automargin: true,
                },
                legend: { ...PLOTLY_DARK_LAYOUT.legend, orientation: "h" as const, y: -0.15 },
                margin: { l: 150, r: 20, t: 30, b: 60 },
              } as any}
              config={PLOTLY_CONFIG}
              className="w-full"
            />
          )}
          <ChartDescription>
            <strong>Model Transparency</strong>: Ranks the top 10 factors by SHAP impact. Shows how feature importance changes depending on the current market regime.
          </ChartDescription>
        </ChartCard>
      </div>
    </div>
  );
}
