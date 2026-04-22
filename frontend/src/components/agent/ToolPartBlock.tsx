"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import {
  Wrench,
  AlertCircle,
  ChevronDown,
  Loader2,
} from "lucide-react";
import {
  ChartSpec,
  specToPlotly,
  ToolPart,
  VISUAL_TOOLS,
} from "@/lib/agent-shared";
import { PLOTLY_CONFIG } from "@/lib/plotly-theme";
import { cn } from "@/lib/utils";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

function ToolCallHeader({
  name,
  args,
  status,
}: {
  name: string;
  args: Record<string, unknown>;
  status: "running" | "ok" | "error";
}) {
  return (
    <div className="flex items-center gap-2 text-xs text-slate-400">
      <Wrench className="h-3 w-3" />
      <span className="font-mono">{name}</span>
      <span className="truncate opacity-70">({Object.keys(args).join(", ") || "—"})</span>
      <span
        className={cn(
          "ml-auto rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
          status === "running" && "bg-slate-700 text-slate-300",
          status === "ok" && "bg-emerald-500/15 text-emerald-400",
          status === "error" && "bg-rose-500/15 text-rose-400"
        )}
      >
        {status}
      </span>
    </div>
  );
}

function RunSqlResult({ result }: { result: Record<string, unknown> }) {
  const rows = (result.rows as Record<string, unknown>[]) || [];
  if (rows.length === 0) return <div className="text-xs text-slate-500">No rows.</div>;
  const cols = Object.keys(rows[0]);
  const preview = rows.slice(0, 10);
  const truncated = (result.row_count as number) > preview.length;
  return (
    <div className="space-y-2">
      <details className="group rounded bg-slate-950/50 p-2">
        <summary className="cursor-pointer text-[11px] text-slate-500">
          <code>{String(result.query || "")}</code>
        </summary>
      </details>
      <div className="overflow-x-auto rounded bg-slate-950/50">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-slate-800">
              {cols.map((c) => (
                <th key={c} className="px-2 py-1.5 text-left font-medium text-slate-400">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.map((row, ri) => (
              <tr key={ri} className="border-b border-slate-800/50">
                {cols.map((c) => (
                  <td key={c} className="px-2 py-1 font-mono text-slate-300">
                    {typeof row[c] === "number"
                      ? Number(row[c]).toLocaleString(undefined, { maximumFractionDigits: 4 })
                      : String(row[c] ?? "—")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-[10px] text-slate-500">
        {rows.length} row{rows.length === 1 ? "" : "s"} shown
        {truncated && ` (of ${String(result.row_count)} total)`}
      </div>
    </div>
  );
}

function PlotChartResult({ spec }: { spec: ChartSpec }) {
  const { data, layout } = useMemo(() => specToPlotly(spec), [spec]);
  return (
    <div className="overflow-hidden rounded-lg bg-slate-950/30">
      <Plot
        data={data as unknown as Plotly.Data[]}
        layout={layout as unknown as Partial<Plotly.Layout>}
        config={PLOTLY_CONFIG}
        className="w-full"
        useResizeHandler
        style={{ width: "100%" }}
      />
    </div>
  );
}

function CounterfactualResult({ result }: { result: Record<string, unknown> }) {
  const base = Number(result.base_prediction);
  const cf = Number(result.counterfactual_prediction);
  const delta = Number(result.delta_pp);
  const bps = Number(result.repo_rate_delta_bps);
  const ci = result.confidence_interval_90 as [number, number] | null;
  const up = delta >= 0;
  return (
    <div className="grid grid-cols-3 gap-2 rounded-lg bg-slate-950/40 p-3">
      <div>
        <div className="text-[10px] uppercase tracking-wider text-slate-500">Baseline</div>
        <div className="font-mono text-base text-slate-200">{base.toFixed(3)}%</div>
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-wider text-slate-500">
          After {bps >= 0 ? "+" : ""}{bps} bps
        </div>
        <div className="font-mono text-base text-slate-200">{cf.toFixed(3)}%</div>
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-wider text-slate-500">Δ WACMR</div>
        <div className={cn("font-mono text-base", up ? "text-amber-400" : "text-emerald-400")}>
          {up ? "+" : ""}{delta.toFixed(3)} pp
        </div>
      </div>
      {ci && (
        <div className="col-span-3 text-[10px] text-slate-500">
          90% walk-forward CI: [{ci[0].toFixed(3)}, {ci[1].toFixed(3)}]%
        </div>
      )}
    </div>
  );
}

function ShapContributionsResult({ result }: { result: Record<string, unknown> }) {
  const contributions =
    (result.contributions as Array<{
      label: string;
      feature: string;
      shap_value: number;
      feature_value: number | null;
    }>) || [];
  const maxAbs = Math.max(...contributions.map((c) => Math.abs(c.shap_value)), 0.001);
  return (
    <div className="space-y-1 rounded-lg bg-slate-950/40 p-3">
      <div className="mb-2 text-[10px] uppercase tracking-wider text-slate-500">
        Top drivers on {String(result.week_date)}
      </div>
      {contributions.map((c) => {
        const pct = (Math.abs(c.shap_value) / maxAbs) * 100;
        const positive = c.shap_value >= 0;
        return (
          <div
            key={c.feature}
            className="grid grid-cols-[8rem_1fr_4rem] items-center gap-2 text-[11px]"
          >
            <div className="truncate text-slate-300">{c.label}</div>
            <div className="relative h-2 rounded bg-slate-800">
              <div
                className={cn(
                  "absolute top-0 h-2 rounded",
                  positive ? "right-1/2 bg-amber-500/70" : "left-1/2 bg-emerald-500/70"
                )}
                style={{ width: `${pct / 2}%` }}
              />
              <div className="absolute left-1/2 top-0 h-2 w-px bg-slate-600" />
            </div>
            <div
              className={cn(
                "text-right font-mono",
                positive ? "text-amber-400" : "text-emerald-400"
              )}
            >
              {positive ? "+" : ""}{c.shap_value.toFixed(4)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ToolPartBlock({ part }: { part: ToolPart }) {
  const [collapsed, setCollapsed] = useState<boolean>(!VISUAL_TOOLS.has(part.name));
  const status: "running" | "ok" | "error" =
    part.error ? "error" : part.result ? "ok" : "running";

  return (
    <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/60 p-3">
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="flex w-full items-center gap-2 text-left"
      >
        <ToolCallHeader name={part.name} args={part.args} status={status} />
        <ChevronDown
          className={cn(
            "h-3 w-3 shrink-0 text-slate-500 transition-transform",
            !collapsed && "rotate-180"
          )}
        />
      </button>
      {!collapsed && (
        <div>
          {part.error && (
            <div className="flex items-start gap-2 text-xs text-rose-400">
              <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
              <span>{part.error}</span>
            </div>
          )}
          {!part.error && part.result != null && (
            <>
              {part.name === "run_sql" && (
                <RunSqlResult result={part.result as Record<string, unknown>} />
              )}
              {part.name === "plot_chart" && (
                <PlotChartResult spec={part.result as ChartSpec} />
              )}
              {part.name === "run_counterfactual" && (
                <CounterfactualResult result={part.result as Record<string, unknown>} />
              )}
              {part.name === "get_shap_contributions" && (
                <ShapContributionsResult result={part.result as Record<string, unknown>} />
              )}
              {!VISUAL_TOOLS.has(part.name) && (
                <pre className="max-h-48 overflow-auto rounded bg-slate-950/50 p-2 text-[11px] text-slate-400">
                  {JSON.stringify(part.result, null, 2)}
                </pre>
              )}
            </>
          )}
          {!part.error && part.result == null && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Loader2 className="h-3 w-3 animate-spin" />
              Running…
            </div>
          )}
        </div>
      )}
    </div>
  );
}
