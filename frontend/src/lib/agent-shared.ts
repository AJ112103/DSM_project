/**
 * Shared types and helpers used by both the /agent page and the floating
 * AgentSheet. Keeps SSE handling, chart-spec conversion, and session
 * management in one place.
 */
import { PLOTLY_DARK_LAYOUT, CHART_COLORS } from "./plotly-theme";

export type AgentEvent =
  | { type: "text"; content: string }
  | { type: "tool_call"; name: string; args: Record<string, unknown> }
  | { type: "tool_result"; name: string; result: unknown }
  | { type: "tool_error"; name: string; error: string }
  | { type: "error"; content: string }
  | { type: "done" };

export type ToolPart = {
  kind: "tool";
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
  error?: string;
};

export type TextPart = { kind: "text"; content: string };
export type ErrorPart = { kind: "error"; content: string };
export type MessagePart = TextPart | ToolPart | ErrorPart;

export type ChatMessage = {
  role: "user" | "assistant";
  parts: MessagePart[];
  timestamp: Date;
};

export type AgentStatus = {
  configured: boolean;
  model?: string | null;
  message?: string;
};

export const VISUAL_TOOLS = new Set([
  "plot_chart",
  "run_counterfactual",
  "run_sql",
  "get_shap_contributions",
]);

export function newSessionId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export type ChartSpec = {
  chart_type: string;
  title: string;
  x: (string | number)[];
  y: number[] | Record<string, number[]>;
  labels?: { x?: string; y?: string };
};

export function specToPlotly(spec: ChartSpec) {
  const chartType = spec.chart_type || "line";
  const traces: Record<string, unknown>[] = [];

  if (spec.y && typeof spec.y === "object" && !Array.isArray(spec.y)) {
    Object.entries(spec.y).forEach(([name, values], idx) => {
      traces.push({
        type: chartType === "line" || chartType === "area" ? "scatter" : chartType,
        mode: chartType === "line" || chartType === "area" ? "lines" : undefined,
        fill: chartType === "area" ? "tozeroy" : undefined,
        name,
        x: spec.x,
        y: values,
        line: { color: CHART_COLORS[idx % CHART_COLORS.length], width: 2 },
        marker: { color: CHART_COLORS[idx % CHART_COLORS.length] },
      });
    });
  } else if (Array.isArray(spec.y)) {
    traces.push({
      type: chartType === "line" ? "scatter" : chartType,
      mode: chartType === "line" ? "lines" : undefined,
      x: spec.x,
      y: spec.y,
      line: { color: CHART_COLORS[0], width: 2 },
      marker: { color: CHART_COLORS[0] },
    });
  }

  return {
    data: traces,
    layout: {
      ...PLOTLY_DARK_LAYOUT,
      title: { text: spec.title, font: { size: 14 } },
      xaxis: { ...PLOTLY_DARK_LAYOUT.xaxis, title: { text: spec.labels?.x || "" } },
      yaxis: { ...PLOTLY_DARK_LAYOUT.yaxis, title: { text: spec.labels?.y || "" } },
      height: 320,
      margin: { l: 56, r: 24, t: 40, b: 48 },
    },
  };
}
