/* eslint-disable @typescript-eslint/no-explicit-any */

// Plotly mutates the layout object after render to record auto-detected axis
// types, ranges, etc. If multiple charts share the same axis sub-object, the
// mutation leaks: a time-series chart sets xaxis.type = 'date' on the shared
// object, then a bar chart that spreads the same layout inherits 'date' and
// renders its numeric x-values as 1970 timestamps.
//
// `darkLayout()` returns a fresh, deeply-independent object on every call.

export function darkLayout(): Record<string, any> {
  return {
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
}

// Backwards-compat alias: every property read returns a freshly-built sub-tree
// so `...PLOTLY_DARK_LAYOUT` and `PLOTLY_DARK_LAYOUT.xaxis` never hand out a
// shared reference that Plotly could mutate across charts.
export const PLOTLY_DARK_LAYOUT: Record<string, any> = new Proxy(
  {},
  {
    get(_t, prop: string | symbol) {
      const fresh = darkLayout();
      return (fresh as Record<string | symbol, unknown>)[prop as string];
    },
    has(_t, prop) {
      return prop in darkLayout();
    },
    ownKeys() {
      return Reflect.ownKeys(darkLayout());
    },
    getOwnPropertyDescriptor(_t, prop) {
      const fresh = darkLayout();
      const value = (fresh as Record<string | symbol, unknown>)[prop as string];
      if (value === undefined) return undefined;
      return { enumerable: true, configurable: true, writable: true, value };
    },
  }
);

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
