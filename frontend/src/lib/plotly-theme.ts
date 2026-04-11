/* eslint-disable @typescript-eslint/no-explicit-any */

export const PLOTLY_DARK_LAYOUT: Record<string, any> = {
  paper_bgcolor: "transparent",
  plot_bgcolor: "transparent",
  font: { color: "#e2e8f0", family: "Inter, system-ui, sans-serif" },
  xaxis: {
    gridcolor: "#334155",
    zerolinecolor: "#475569",
    tickfont: { color: "#94a3b8" },
  },
  yaxis: {
    gridcolor: "#334155",
    zerolinecolor: "#475569",
    tickfont: { color: "#94a3b8" },
  },
  legend: {
    font: { color: "#e2e8f0" },
    bgcolor: "transparent",
  },
  margin: { t: 40, r: 20, b: 40, l: 50 },
  hoverlabel: {
    bgcolor: "#1e293b",
    bordercolor: "#475569",
    font: { color: "#e2e8f0" },
  },
};

export const PLOTLY_CONFIG: Record<string, any> = {
  displaylogo: false,
  responsive: true,
  modeBarButtonsToRemove: ["lasso2d", "select2d"],
};

export const CHART_COLORS = [
  "#3b82f6", // blue-500
  "#10b981", // emerald-500
  "#f59e0b", // amber-500
  "#ef4444", // rose-500
  "#8b5cf6", // violet-500
  "#06b6d4", // cyan-500
  "#f97316", // orange-500
  "#ec4899", // pink-500
];
