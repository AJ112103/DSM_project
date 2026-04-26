/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Info, AlertTriangle, Lightbulb, ArrowUpRight, ImageIcon, User, Clock, Calendar } from "lucide-react";
import { motion, useScroll, useSpring } from "framer-motion";
import { fetchAPI } from "@/lib/api";
import { PLOTLY_DARK_LAYOUT, PLOTLY_CONFIG, CHART_COLORS, darkLayout } from "@/lib/plotly-theme";
import { cn } from "@/lib/utils";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

// ─── Layout primitives ──────────────────────────────────────────────────────

export function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div className="prose prose-invert prose-lg mx-auto max-w-3xl text-slate-300 prose-headings:text-white prose-headings:font-normal prose-a:text-cyan-400 prose-strong:text-white prose-code:text-amber-300 prose-code:bg-slate-900 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-pre:bg-slate-950 prose-pre:border prose-pre:border-slate-800 prose-blockquote:border-l-cyan-500 prose-blockquote:text-slate-400">
      {children}
    </div>
  );
}

export function Section({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-8 space-y-4">
      {children}
    </section>
  );
}

export function H1({ children }: { children: React.ReactNode }) {
  return (
    <h1
      className="text-balance text-4xl leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl"
      style={{ fontFamily: "var(--font-instrument-serif)" }}
    >
      {children}
    </h1>
  );
}

export function H2({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <h2
      id={id}
      className="mt-12 scroll-mt-8 text-balance text-3xl leading-tight text-white lg:text-4xl"
      style={{ fontFamily: "var(--font-instrument-serif)" }}
    >
      {children}
    </h2>
  );
}

export function H3({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <h3 id={id} className="mt-8 scroll-mt-8 text-xl font-semibold text-white">
      {children}
    </h3>
  );
}

export function Lede({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-lg leading-relaxed text-slate-400 lg:text-xl">{children}</p>
  );
}

// ─── Callouts ───────────────────────────────────────────────────────────────

export function Callout({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "warn" | "finding";
  title?: string;
  children: React.ReactNode;
}) {
  const config = {
    info: { icon: Info, border: "border-cyan-500/30", bg: "bg-cyan-500/5", tint: "text-cyan-300" },
    warn: { icon: AlertTriangle, border: "border-amber-500/30", bg: "bg-amber-500/5", tint: "text-amber-300" },
    finding: { icon: Lightbulb, border: "border-emerald-500/30", bg: "bg-emerald-500/5", tint: "text-emerald-300" },
  }[tone];
  const Icon = config.icon;
  return (
    <aside className={cn("my-6 rounded-2xl border p-5", config.border, config.bg)}>
      <div className="flex items-start gap-3">
        <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", config.tint)} />
        <div className="flex-1 space-y-1">
          {title && <div className={cn("text-sm font-semibold", config.tint)}>{title}</div>}
          <div className="text-sm text-slate-300 [&>p:not(:last-child)]:mb-2">{children}</div>
        </div>
      </div>
    </aside>
  );
}

export function Stat({
  value,
  label,
  tone = "neutral",
}: {
  value: string;
  label: string;
  tone?: "neutral" | "cyan" | "emerald" | "amber";
}) {
  const tones: Record<string, string> = {
    neutral: "text-white",
    cyan: "text-cyan-300",
    emerald: "text-emerald-300",
    amber: "text-amber-300",
  };
  return (
    <div className="flex flex-col items-start">
      <div
        className={cn("font-mono text-4xl font-semibold tabular-nums", tones[tone])}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </div>
      <div className="mt-1 text-xs uppercase tracking-wider text-slate-500">{label}</div>
    </div>
  );
}

export function StatGrid({ children }: { children: React.ReactNode }) {
  return <div className="my-6 grid grid-cols-2 gap-6 sm:grid-cols-4">{children}</div>;
}

// ─── Editorial Elements ───────────────────────────────────────────────────

export function ReadingProgressBar() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  return (
    <motion.div
      className="fixed inset-x-0 top-0 z-[100] h-1 origin-left bg-cyan-400"
      style={{ scaleX }}
    />
  );
}

export function DropCap({ children }: { children: string }) {
  const firstLetter = children.charAt(0);
  const rest = children.slice(1);
  return (
    <p className="text-lg leading-relaxed text-slate-300 lg:text-xl">
      <span className="float-left mr-3 mt-1 font-serif text-7xl font-bold leading-[0.8] text-cyan-400" style={{ fontFamily: "var(--font-instrument-serif)" }}>
        {firstLetter}
      </span>
      {rest}
    </p>
  );
}

export function AuthorCard({ authors }: { authors: { name: string; role: string }[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="my-8 flex w-fit items-center gap-6 rounded-2xl border border-slate-800 bg-slate-900/40 p-4"
    >
      <div className="flex -space-x-2">
        {authors.map((_, i) => (
          <div key={i} className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-slate-950 bg-slate-800 overflow-hidden">
            <User size={18} className="text-slate-400" />
          </div>
        ))}
      </div>
      <div className="pr-2">
        <p className="text-[11px] font-bold uppercase tracking-widest text-white">
          {authors.map(a => a.name).join(" & ")}
        </p>
        <p className="text-[10px] font-mono text-slate-500">
          {authors[0].role} • Spring 2026
        </p>
      </div>
    </motion.div>
  );
}

export function EditorialHeader({
  title,
  subtitle,
  date,
  readTime,
}: {
  title: string;
  subtitle: string;
  date: string;
  readTime: string;
}) {
  return (
    <header className="mx-auto max-w-3xl space-y-8 pb-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="space-y-6"
      >
        <div className="flex items-center gap-4 font-mono text-[10px] uppercase tracking-[0.3em] text-slate-500">
          <span className="flex items-center gap-1.5 text-cyan-400">
            <div className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
            Project Narrative
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-3 w-3" />
            {readTime}
          </span>
          <span className="flex items-center gap-1.5">
            <Calendar className="h-3 w-3" />
            {date}
          </span>
        </div>

        <h1
          className="text-balance text-5xl font-bold tracking-tight text-white sm:text-7xl lg:text-8xl"
          style={{ lineHeight: "0.9" }}
        >
          {title.split(" ").map((word, i) => (
            <span key={i} className="inline-block mr-4">
              {i % 2 === 1 ? (
                <em className="italic font-normal text-cyan-300" style={{ fontFamily: "var(--font-instrument-serif)" }}>
                  {word}
                </em>
              ) : (
                word.toUpperCase()
              )}
            </span>
          ))}
        </h1>

        <p className="max-w-2xl text-lg leading-relaxed text-slate-400 sm:text-xl">
          {subtitle}
        </p>
      </motion.div>
    </header>
  );
}

// ─── Code block ─────────────────────────────────────────────────────────────

export function CodeBlock({
  lang = "python",
  children,
}: {
  lang?: string;
  children: string;
}) {
  return (
    <div className="my-6 overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2 text-[10px] uppercase tracking-wider text-slate-500">
        <span>{lang}</span>
      </div>
      <pre className="overflow-x-auto p-4 text-[12.5px] leading-relaxed text-slate-300">
        <code>{children}</code>
      </pre>
    </div>
  );
}

// ─── Figure with caption ────────────────────────────────────────────────────

let _figureCounter = 0;

export function Figure({
  src,
  caption,
  alt,
  number,
}: {
  src: string;
  caption?: string;
  alt?: string;
  number?: number;
}) {
  // Auto-number when no explicit number is provided. Safe here because
  // figures render in document order server-side → client-side.
  const fig = number ?? ++_figureCounter;
  return (
    <figure className="not-prose my-10 print:break-inside-avoid">
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-white shadow-[0_20px_40px_-20px_rgba(0,0,0,0.5)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt || caption || "Figure"} loading="lazy" className="block w-full" />
      </div>
      {caption && (
        <figcaption className="mt-4 flex items-start gap-3 text-[13px] leading-relaxed text-slate-400">
          <span className="mt-0.5 inline-flex shrink-0 items-center gap-1.5 rounded-md border border-slate-800 bg-slate-900/60 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-slate-400">
            <ImageIcon className="h-3 w-3 text-slate-500" />
            Figure {fig}
          </span>
          <span className="italic text-slate-300">{caption}</span>
        </figcaption>
      )}
    </figure>
  );
}

// ─── Table ───────────────────────────────────────────────────────────────────

export function BlogTable({
  headers,
  rows,
  caption,
}: {
  headers: string[];
  rows: (string | number | React.ReactNode)[][];
  caption?: string;
}) {
  return (
    <figure className="not-prose my-8">
      <div className="overflow-x-auto rounded-2xl border border-slate-800">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-900/60">
            <tr>
              {headers.map((h, i) => (
                <th
                  key={i}
                  className="whitespace-nowrap px-4 py-3 text-left font-mono text-[10px] uppercase tracking-wider text-slate-400"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-950/40">
            {rows.map((row, r) => (
              <tr key={r} className="hover:bg-slate-900/40">
                {row.map((cell, c) => (
                  <td
                    key={c}
                    className={cn(
                      "px-4 py-2.5 align-top text-slate-300",
                      c === 0 ? "font-medium text-white" : "font-mono tabular-nums"
                    )}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {caption && (
        <figcaption className="mt-3 text-xs italic text-slate-500">{caption}</figcaption>
      )}
    </figure>
  );
}

// ─── Live chart embed (pulls from the deployed backend) ─────────────────────

type TimeSeriesResponse = {
  series: Record<string, (number | null)[] | string[]>;
  columns: string[];
};

export function TimeSeriesEmbed({
  columns,
  title,
  caption,
}: {
  columns: string[];
  title: string;
  caption?: string;
}) {
  const { data } = useQuery<TimeSeriesResponse | null>({
    queryKey: ["blog-ts", columns.join(",")],
    queryFn: () =>
      fetchAPI(`/api/data/timeseries?columns=${columns.join(",")}`).catch(() => null),
    retry: false,
    staleTime: 60 * 60 * 1000,
  });

  const dates = (data?.series?.dates as string[] | undefined) || [];
  const traces = useMemo(
    () =>
      columns.map((col, i) => ({
        type: "scatter",
        mode: "lines",
        name: col,
        x: dates,
        y: (data?.series?.[col] as (number | null)[] | undefined) || [],
        line: { color: CHART_COLORS[i % CHART_COLORS.length], width: 1.8 },
      })),
    [columns, dates, data]
  );

  if (!dates.length) {
    return (
      <figure className="my-8 flex h-80 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/40 text-xs text-slate-600">
        Loading {title}…
      </figure>
    );
  }

  return (
    <figure className="my-8">
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40 p-2">
        <Plot
          data={traces as unknown as Plotly.Data[]}
          layout={
            {
              ...PLOTLY_DARK_LAYOUT,
              title: { text: title, font: { size: 13 } },
              height: 340,
              margin: { l: 50, r: 20, t: 40, b: 40 },
              legend: { orientation: "h", x: 0, y: -0.2, font: { size: 10 } },
              hovermode: "x unified",
            } as unknown as Partial<Plotly.Layout>
          }
          config={PLOTLY_CONFIG}
          useResizeHandler
          style={{ width: "100%" }}
        />
      </div>
      {caption && <figcaption className="mt-3 text-xs text-slate-500">{caption}</figcaption>}
    </figure>
  );
}

type SHAPFeature = { feature: string; label: string; mean_abs_shap: number };
type SHAPResponse = { features: SHAPFeature[] };

export function ShapBarEmbed({ topK = 12, caption }: { topK?: number; caption?: string }) {
  const { data, isLoading, isError } = useQuery<SHAPResponse | null>({
    queryKey: ["blog-shap", topK],
    queryFn: () => fetchAPI(`/api/forecast/shap-summary`).catch(() => null),
    retry: false,
    staleTime: 60 * 60 * 1000,
  });

  const valid = Array.isArray(data?.features)
    && data.features.length > 0
    && data.features.every((f) => Number.isFinite(f.mean_abs_shap));

  if (isLoading || !valid) {
    return (
      <figure className="my-8 flex h-80 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/40 text-xs text-slate-600">
        {isError
          ? "SHAP summary unavailable (backend may be cold-starting)…"
          : "Loading SHAP summary…"}
      </figure>
    );
  }

  const top = data!.features.slice(0, topK);
  // Plotly renders bottom-to-top for horizontal bars, so reverse so the
  // biggest feature appears at the top.
  const labels = [...top.map((f) => f.label || f.feature)].reverse();
  const shap = [...top.map((f) => f.mean_abs_shap)].reverse();
  const base = darkLayout();

  return (
    <figure className="my-8">
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40 p-2">
        <Plot
          data={
            [
              {
                type: "bar",
                orientation: "h",
                x: shap,
                y: labels,
                marker: { color: CHART_COLORS[2] },
                hovertemplate: "%{y}: %{x:.3f}<extra></extra>",
              },
            ] as unknown as Plotly.Data[]
          }
          layout={
            {
              ...base,
              title: { text: `Top ${topK} features by mean |SHAP|`, font: { size: 13 } },
              height: 40 + topK * 22,
              margin: { l: 180, r: 20, t: 40, b: 40 },
              // Explicit axis types — Plotly's auto-detect can otherwise treat
              // tiny numeric SHAP values as Unix-ms timestamps (epoch 1970).
              xaxis: {
                ...base.xaxis,
                type: "linear",
                title: { text: "Mean |SHAP|", font: { size: 11 } },
                rangemode: "tozero",
              },
              yaxis: {
                ...base.yaxis,
                type: "category",
                automargin: true,
              },
            } as unknown as Partial<Plotly.Layout>
          }
          config={PLOTLY_CONFIG}
          useResizeHandler
          style={{ width: "100%" }}
        />
      </div>
      {caption && <figcaption className="mt-3 text-xs text-slate-500">{caption}</figcaption>}
    </figure>
  );
}

// ─── Counterfactual simulator embed ─────────────────────────────────────────

type SweepPoint = { bps: number; predicted: number; delta_pp: number; ci_lo: number; ci_hi: number };
type SweepResponse = { base_week: string | null; base_prediction: number; points: SweepPoint[] };

export function CounterfactualEmbed({
  caption,
}: {
  caption?: string;
}) {
  const { data } = useQuery<SweepResponse | null>({
    queryKey: ["blog-cf-sweep"],
    queryFn: () =>
      fetchAPI(`/api/simulate/sweep`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          deltas_bps: Array.from({ length: 17 }, (_, i) => -200 + i * 25),
          base_week: null,
        }),
      }).catch(() => null),
    retry: false,
    staleTime: 60 * 60 * 1000,
  });

  if (!data?.points?.length) {
    return (
      <figure className="not-prose my-8 flex h-80 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/40 text-xs text-slate-600">
        Loading counterfactual response curve… (backend may be cold-starting)
      </figure>
    );
  }

  const xs = data.points.map((p) => p.bps);
  const ys = data.points.map((p) => p.predicted);
  const lo = data.points.map((p) => p.ci_lo);
  const hi = data.points.map((p) => p.ci_hi);

  const traces: unknown[] = [
    {
      type: "scatter",
      mode: "lines",
      name: "90% CI upper",
      x: xs,
      y: hi,
      line: { color: "rgba(6,182,212,0)" },
      showlegend: false,
      hoverinfo: "skip",
    },
    {
      type: "scatter",
      mode: "lines",
      name: "90% CI",
      x: xs,
      y: lo,
      fill: "tonexty",
      fillcolor: "rgba(6,182,212,0.12)",
      line: { color: "rgba(6,182,212,0)" },
      hoverinfo: "skip",
    },
    {
      type: "scatter",
      mode: "lines+markers",
      name: "Predicted WACMR",
      x: xs,
      y: ys,
      line: { color: CHART_COLORS[0], width: 2.5 },
      marker: { size: 6, color: CHART_COLORS[0] },
      hovertemplate: "Δ repo: %{x:+d} bps<br>Pred WACMR: %{y:.3f}%<extra></extra>",
    },
    {
      type: "scatter",
      mode: "markers",
      name: "Baseline",
      x: [0],
      y: [data.base_prediction],
      marker: { size: 10, color: "#f59e0b", symbol: "diamond" },
      hovertemplate: `Baseline: ${data.base_prediction.toFixed(3)}%<extra></extra>`,
    },
  ];

  return (
    <figure className="not-prose my-8">
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40 p-2">
        <Plot
          data={traces as unknown as Plotly.Data[]}
          layout={
            {
              ...PLOTLY_DARK_LAYOUT,
              title: {
                text: "Model counterfactual: predicted WACMR vs repo-rate shock (bps)",
                font: { size: 13 },
              },
              height: 360,
              margin: { l: 55, r: 20, t: 40, b: 55 },
              xaxis: {
                title: { text: "Repo-rate shock (basis points)", font: { size: 11 } },
                zeroline: true,
                zerolinecolor: "rgba(148,163,184,0.3)",
              },
              yaxis: {
                title: { text: "Predicted WACMR (%)", font: { size: 11 } },
              },
              hovermode: "x unified",
              legend: { orientation: "h", x: 0, y: -0.25, font: { size: 10 } },
            } as unknown as Partial<Plotly.Layout>
          }
          config={PLOTLY_CONFIG}
          useResizeHandler
          style={{ width: "100%" }}
        />
      </div>
      {caption && (
        <figcaption className="mt-3 text-xs italic text-slate-500">{caption}</figcaption>
      )}
    </figure>
  );
}

// ─── Interactive figure embeds (replace static PNGs) ────────────────────────

function EmbedShell({ caption, children }: { caption?: string; children: React.ReactNode }) {
  return (
    <motion.figure
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="not-prose my-10 print:break-inside-avoid"
    >
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 p-2 shadow-inner">
        {children}
      </div>
      {caption && (
        <figcaption className="mt-4 text-[13px] leading-relaxed italic text-slate-400">
          {caption}
        </figcaption>
      )}
    </motion.figure>
  );
}

function EmbedLoading({ label }: { label: string }) {
  return (
    <div className="flex h-80 items-center justify-center text-xs text-slate-600">
      Loading {label}…
    </div>
  );
}

export function WacmrTimeSeriesEmbed({ caption }: { caption?: string }) {
  const { data } = useQuery<{ series: Record<string, unknown[]> } | null>({
    queryKey: ["blog-wacmr-ts"],
    queryFn: () => fetchAPI("/api/data/timeseries?columns=target_wacmr").catch(() => null),
    retry: false, staleTime: 3600000,
  });
  const dates = (data?.series?.dates as string[]) || [];
  const wacmr = (data?.series?.target_wacmr as number[]) || [];
  if (!dates.length) return <EmbedShell caption={caption}><EmbedLoading label="WACMR time series" /></EmbedShell>;
  return (
    <EmbedShell caption={caption}>
      <Plot
        data={[{ type: "scatter", mode: "lines", x: dates, y: wacmr, name: "WACMR", line: { color: CHART_COLORS[0], width: 1.8 } }] as Plotly.Data[]}
        layout={{ ...PLOTLY_DARK_LAYOUT, height: 340, margin: { l: 50, r: 20, t: 30, b: 40 }, xaxis: { ...PLOTLY_DARK_LAYOUT.xaxis, title: { text: "Date", font: { size: 11 } } }, yaxis: { ...PLOTLY_DARK_LAYOUT.yaxis, title: { text: "WACMR (%)", font: { size: 11 } } }, hovermode: "x unified" } as Partial<Plotly.Layout>}
        config={PLOTLY_CONFIG} useResizeHandler style={{ width: "100%" }}
      />
    </EmbedShell>
  );
}

export function SilhouetteEmbed({ caption }: { caption?: string }) {
  const { data } = useQuery<{ scores: Record<string, number>; optimal_k: string } | null>({
    queryKey: ["blog-silhouette-v2"],
    queryFn: () => fetchAPI("/api/analytics/silhouette").catch(() => null),
    retry: false, staleTime: 3600000,
  });
  if (!data?.scores) return <EmbedShell caption={caption}><EmbedLoading label="silhouette scores" /></EmbedShell>;
  const ks = Object.keys(data.scores).map(Number);
  const scores = ks.map((k) => data.scores[String(k)]);
  return (
    <EmbedShell caption={caption}>
      <Plot
        data={[
          { type: "bar", x: ks, y: scores, name: "Silhouette", marker: { color: CHART_COLORS[0], opacity: 0.7 }, hovertemplate: "K=%{x}<br>Score: %{y:.4f}<extra></extra>" },
          { type: "scatter", mode: "lines+markers", x: ks, y: scores, name: "Silhouette (line)", yaxis: "y", line: { color: CHART_COLORS[5], width: 2 }, marker: { size: 7 }, showlegend: false },
        ] as unknown as Plotly.Data[]}
        layout={{ ...PLOTLY_DARK_LAYOUT, height: 320, margin: { l: 55, r: 20, t: 30, b: 50 }, xaxis: { ...PLOTLY_DARK_LAYOUT.xaxis, title: { text: "Number of clusters (K)", font: { size: 11 } }, dtick: 1 }, yaxis: { ...PLOTLY_DARK_LAYOUT.yaxis, title: { text: "Silhouette score", font: { size: 11 } } }, hovermode: "x unified", showlegend: false } as Partial<Plotly.Layout>}
        config={PLOTLY_CONFIG} useResizeHandler style={{ width: "100%" }}
      />
    </EmbedShell>
  );
}

export function PcaScatterEmbed({ caption }: { caption?: string }) {
  const { data } = useQuery<{ data: { pc1: number; pc2: number; regime_label: number; week_date: string; wacmr: number }[] } | null>({
    queryKey: ["blog-pca"],
    queryFn: () => fetchAPI("/api/analytics/pca").catch(() => null),
    retry: false, staleTime: 3600000,
  });
  if (!data?.data?.length) return <EmbedShell caption={caption}><EmbedLoading label="PCA scatter" /></EmbedShell>;
  const regimes = [...new Set(data.data.map((p) => p.regime_label))].sort();
  const regimeNames: Record<number, string> = { 0: "Regime 0 (Accommodation)", 1: "Regime 1 (Tightening)" };
  const traces = regimes.map((r, i) => {
    const pts = data.data.filter((p) => p.regime_label === r);
    return {
      type: "scatter", mode: "markers", name: regimeNames[r] || `Regime ${r}`,
      x: pts.map((p) => p.pc1), y: pts.map((p) => p.pc2),
      marker: { color: CHART_COLORS[i], size: 5, opacity: 0.7 },
      text: pts.map((p) => `${p.week_date}<br>WACMR: ${p.wacmr}`),
      hovertemplate: "%{text}<extra></extra>",
    };
  });
  return (
    <EmbedShell caption={caption}>
      <Plot
        data={traces as unknown as Plotly.Data[]}
        layout={{ ...PLOTLY_DARK_LAYOUT, height: 400, margin: { l: 55, r: 20, t: 30, b: 50 }, xaxis: { ...PLOTLY_DARK_LAYOUT.xaxis, title: { text: "PC1", font: { size: 11 } } }, yaxis: { ...PLOTLY_DARK_LAYOUT.yaxis, title: { text: "PC2", font: { size: 11 } } }, legend: { orientation: "h" as const, x: 0, y: -0.18, font: { size: 10, color: "#e2e8f0" } }, hovermode: "closest" } as Partial<Plotly.Layout>}
        config={PLOTLY_CONFIG} useResizeHandler style={{ width: "100%" }}
      />
    </EmbedShell>
  );
}

export function RegimeTimeSeriesEmbed({ caption }: { caption?: string }) {
  const { data: tsData } = useQuery<{ series: Record<string, unknown[]> } | null>({
    queryKey: ["blog-regime-ts-data"],
    queryFn: () => fetchAPI("/api/data/timeseries?columns=target_wacmr").catch(() => null),
    retry: false, staleTime: 3600000,
  });
  const { data: rtData } = useQuery<{ dates: string[]; regimes: number[] } | null>({
    queryKey: ["blog-regime-transitions"],
    queryFn: () => fetchAPI("/api/analytics/regime-transitions").catch(() => null),
    retry: false, staleTime: 3600000,
  });
  const dates = (tsData?.series?.dates as string[]) || [];
  const wacmr = (tsData?.series?.target_wacmr as number[]) || [];
  if (!dates.length) return <EmbedShell caption={caption}><EmbedLoading label="regime time series" /></EmbedShell>;

  // Build regime band shapes
  const shapes: Partial<Plotly.Shape>[] = [];
  if (rtData?.dates?.length) {
    const rd = rtData.dates; const rr = rtData.regimes;
    const colors: Record<number, string> = { 0: "rgba(16,185,129,0.10)", 1: "rgba(245,158,11,0.10)" };
    let start = 0;
    for (let i = 1; i <= rd.length; i++) {
      if (i === rd.length || rr[i] !== rr[start]) {
        shapes.push({ type: "rect", xref: "x", yref: "paper", x0: rd[start], x1: rd[i - 1], y0: 0, y1: 1, fillcolor: colors[rr[start]] || "rgba(100,100,100,0.08)", line: { width: 0 }, layer: "below" });
        start = i;
      }
    }
  }
  return (
    <EmbedShell caption={caption}>
      <Plot
        data={[{ type: "scatter", mode: "lines", x: dates, y: wacmr, name: "WACMR", line: { color: CHART_COLORS[0], width: 1.8 } }] as Plotly.Data[]}
        layout={{ ...PLOTLY_DARK_LAYOUT, height: 360, margin: { l: 50, r: 20, t: 30, b: 40 }, shapes, xaxis: { ...PLOTLY_DARK_LAYOUT.xaxis, title: { text: "Date", font: { size: 11 } } }, yaxis: { ...PLOTLY_DARK_LAYOUT.yaxis, title: { text: "WACMR (%)", font: { size: 11 } } }, hovermode: "x unified" } as Partial<Plotly.Layout>}
        config={PLOTLY_CONFIG} useResizeHandler style={{ width: "100%" }}
      />
    </EmbedShell>
  );
}

export function RegimeBoxplotEmbed({ caption }: { caption?: string }) {
  const { data: tsData } = useQuery<{ series: Record<string, unknown[]> } | null>({
    queryKey: ["blog-regime-ts-data"],
    queryFn: () => fetchAPI("/api/data/timeseries?columns=target_wacmr").catch(() => null),
    retry: false, staleTime: 3600000,
  });
  const { data: rtData } = useQuery<{ dates: string[]; regimes: number[] } | null>({
    queryKey: ["blog-regime-transitions"],
    queryFn: () => fetchAPI("/api/analytics/regime-transitions").catch(() => null),
    retry: false, staleTime: 3600000,
  });
  const wacmr = (tsData?.series?.target_wacmr as number[]) || [];
  const regimes = rtData?.regimes || [];
  if (!wacmr.length || !regimes.length) return <EmbedShell caption={caption}><EmbedLoading label="regime boxplot" /></EmbedShell>;

  const unique = [...new Set(regimes)].sort();
  const traces = unique.map((r, i) => {
    const vals = wacmr.filter((_, idx) => regimes[idx] === r);
    return { type: "box", y: vals, name: `Regime ${r}`, marker: { color: CHART_COLORS[i] }, boxmean: true };
  });
  return (
    <EmbedShell caption={caption}>
      <Plot
        data={traces as unknown as Plotly.Data[]}
        layout={{ ...PLOTLY_DARK_LAYOUT, height: 340, margin: { l: 55, r: 20, t: 30, b: 40 }, yaxis: { ...PLOTLY_DARK_LAYOUT.yaxis, title: { text: "WACMR (%)", font: { size: 11 } } }, showlegend: true, legend: { orientation: "h" as const, x: 0, y: -0.15, font: { size: 10, color: "#e2e8f0" } } } as Partial<Plotly.Layout>}
        config={PLOTLY_CONFIG} useResizeHandler style={{ width: "100%" }}
      />
    </EmbedShell>
  );
}

export function ActualVsPredictedEmbed({ caption }: { caption?: string }) {
  const { data } = useQuery<{ dates: string[]; actual: number[]; predicted: number[] } | null>({
    queryKey: ["blog-actual-vs-pred"],
    queryFn: () => fetchAPI("/api/forecast/walkforward?last_n_years=2").catch(() => null),
    retry: false, staleTime: 3600000,
  });
  if (!data?.dates) return <EmbedShell caption={caption}><EmbedLoading label="actual vs predicted" /></EmbedShell>;
  return (
    <EmbedShell caption={caption}>
      <Plot
        data={[
          { type: "scatter", mode: "lines", x: data.dates, y: data.actual, name: "Actual", line: { color: CHART_COLORS[0], width: 1.8 } },
          { type: "scatter", mode: "lines", x: data.dates, y: data.predicted, name: "Predicted", line: { color: CHART_COLORS[1], width: 1.8, dash: "dot" } },
        ] as Plotly.Data[]}
        layout={{ ...PLOTLY_DARK_LAYOUT, height: 360, margin: { l: 50, r: 20, t: 30, b: 40 }, xaxis: { ...PLOTLY_DARK_LAYOUT.xaxis, title: { text: "Date", font: { size: 11 } } }, yaxis: { ...PLOTLY_DARK_LAYOUT.yaxis, title: { text: "WACMR (%)", font: { size: 11 } } }, legend: { orientation: "h" as const, x: 0, y: -0.15, font: { size: 10 } }, hovermode: "x unified" } as Partial<Plotly.Layout>}
        config={PLOTLY_CONFIG} useResizeHandler style={{ width: "100%" }}
      />
    </EmbedShell>
  );
}

export function ResidualCalendarEmbed({ caption }: { caption?: string }) {
  const { data } = useQuery<{ dates: string[]; residuals: number[] } | null>({
    queryKey: ["blog-residuals"],
    queryFn: () => fetchAPI("/api/forecast/walkforward").catch(() => null),
    retry: false, staleTime: 3600000,
  });
  if (!data?.dates) return <EmbedShell caption={caption}><EmbedLoading label="residual calendar" /></EmbedShell>;

  // Pivot to Month (X) vs Year (Y) for a calendar-like heatmap
  const years: string[] = []; const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const z: (number | null)[][] = [];
  data.dates.forEach((d, i) => {
    const date = new Date(d); const y = String(date.getFullYear()); const m = date.getMonth();
    if (!years.includes(y)) { years.push(y); z.push(new Array(12).fill(null)); }
    const yi = years.indexOf(y); z[yi][m] = data.residuals[i];
  });

  return (
    <EmbedShell caption={caption}>
      <Plot
        data={[{ type: "heatmap", x: months, y: years, z: z, colorscale: "RdBu", zmid: 0, hovertemplate: "%{y} %{x}<br>Residual: %{z:.4f}<extra></extra>" }] as unknown as Plotly.Data[]}
        layout={{ ...PLOTLY_DARK_LAYOUT, height: 300, margin: { l: 60, r: 20, t: 30, b: 40 }, xaxis: { ...PLOTLY_DARK_LAYOUT.xaxis, title: { text: "Month", font: { size: 11 } } }, yaxis: { ...PLOTLY_DARK_LAYOUT.yaxis, title: { text: "Year", font: { size: 11 } } } } as Partial<Plotly.Layout>}
        config={PLOTLY_CONFIG} useResizeHandler style={{ width: "100%" }}
      />
    </EmbedShell>
  );
}

export function ShapByRegimeEmbed({ caption }: { caption?: string }) {
  const { data } = useQuery<{ features: Array<{ label: string } & Record<string, any>>; regimes: number[] } | null>({
    queryKey: ["blog-shap-by-regime"],
    queryFn: () => fetchAPI("/api/forecast/shap-by-regime?top_n=12").catch(() => null),
    retry: false, staleTime: 3600000,
  });
  if (!data?.features) return <EmbedShell caption={caption}><EmbedLoading label="SHAP by regime" /></EmbedShell>;

  const traces = data.regimes.map((r, i) => ({
    type: "bar", orientation: "h" as const, name: `Regime ${r}`,
    y: data.features.map(f => f.label).reverse(),
    x: data.features.map(f => f[`regime_${r}`]).reverse(),
    marker: { color: CHART_COLORS[i] }
  }));

  return (
    <EmbedShell caption={caption}>
      <Plot
        data={traces as unknown as Plotly.Data[]}
        layout={{ ...PLOTLY_DARK_LAYOUT, height: 420, barmode: "group", margin: { l: 180, r: 20, t: 30, b: 50 }, xaxis: { ...PLOTLY_DARK_LAYOUT.xaxis, title: { text: "Mean |SHAP|", font: { size: 11 } } }, yaxis: { ...PLOTLY_DARK_LAYOUT.yaxis, automargin: true }, legend: { orientation: "h" as const, x: 0, y: -0.15, font: { size: 10 } } } as Partial<Plotly.Layout>}
        config={PLOTLY_CONFIG} useResizeHandler style={{ width: "100%" }}
      />
    </EmbedShell>
  );
}

export function ShapSummaryEmbed({ caption }: { caption?: string }) {
  const { data } = useQuery<{ features: Array<{ label: string; overall: number }> } | null>({
    queryKey: ["blog-shap-summary"],
    queryFn: () => fetchAPI("/api/forecast/shap-summary?top_n=15").catch(() => null),
    retry: false, staleTime: 3600000,
  });
  if (!data?.features) return <EmbedShell caption={caption}><EmbedLoading label="SHAP summary" /></EmbedShell>;

  return (
    <EmbedShell caption={caption}>
      <Plot
        data={[{
          type: "bar", orientation: "h" as const,
          y: data.features.map(f => f.label).reverse(),
          x: data.features.map(f => f.overall).reverse(),
          marker: { color: CHART_COLORS[0] }
        }] as Plotly.Data[]}
        layout={{ ...PLOTLY_DARK_LAYOUT, height: 400, margin: { l: 180, r: 20, t: 30, b: 50 }, xaxis: { ...PLOTLY_DARK_LAYOUT.xaxis, title: { text: "Mean |SHAP| (Impact)", font: { size: 11 } } }, yaxis: { ...PLOTLY_DARK_LAYOUT.yaxis, automargin: true } } as Partial<Plotly.Layout>}
        config={PLOTLY_CONFIG} useResizeHandler style={{ width: "100%" }}
      />
    </EmbedShell>
  );
}

export function SentimentTimelineEmbed({ caption }: { caption?: string }) {
  const { data } = useQuery<{ series: any } | null>({
    queryKey: ["blog-sentiment-ts"],
    queryFn: () => fetchAPI("/api/news/sentiment").catch(() => null),
    retry: false, staleTime: 3600000,
  });
  const dates = data?.series?.dates || [];
  const wacmr = data?.series?.target_wacmr || [];
  const sentiment = data?.series?.news_sentiment || [];

  if (!dates.length) return <EmbedShell caption={caption}><EmbedLoading label="sentiment timeline" /></EmbedShell>;
  return (
    <EmbedShell caption={caption}>
      <Plot
        data={[
          { type: "scatter", mode: "lines", x: dates, y: wacmr, name: "WACMR", line: { color: CHART_COLORS[0], width: 1.5 } },
          { type: "scatter", mode: "lines", x: dates, y: sentiment, name: "Sentiment", yaxis: "y2", line: { color: CHART_COLORS[1], width: 1.5, opacity: 0.6 } },
        ] as Plotly.Data[]}
        layout={{ ...PLOTLY_DARK_LAYOUT, height: 400, margin: { l: 50, r: 50, t: 30, b: 50 }, xaxis: { ...PLOTLY_DARK_LAYOUT.xaxis, title: { text: "Date", font: { size: 11 } } }, yaxis: { ...PLOTLY_DARK_LAYOUT.yaxis, title: { text: "WACMR (%)", font: { size: 11 } } }, yaxis2: { title: { text: "Sentiment score", font: { size: 11 } }, overlaying: "y", side: "right", showgrid: false, zeroline: true, zerolinecolor: "rgba(148,163,184,0.3)" }, legend: { orientation: "h" as const, x: 0, y: -0.18, font: { size: 10 } }, hovermode: "x unified" } as Partial<Plotly.Layout>}
        config={PLOTLY_CONFIG} useResizeHandler style={{ width: "100%" }}
      />
    </EmbedShell>
  );
}

export function EventDensityEmbed({ caption }: { caption?: string }) {
  const { data } = useQuery<{ events: any[] } | null>({
    queryKey: ["blog-events-density"],
    queryFn: () => fetchAPI("/api/news/events").catch(() => null),
    retry: false, staleTime: 3600000,
  });
  if (!data?.events) return <EmbedShell caption={caption}><EmbedLoading label="event density" /></EmbedShell>;

  const years: string[] = []; const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const z: number[][] = [];
  data.events.forEach(e => {
    const d = new Date(e.date); const y = String(d.getFullYear()); const m = d.getMonth();
    if (!years.includes(y)) { years.push(y); z.push(new Array(12).fill(0)); }
    const yi = years.indexOf(y); z[yi][m] += 1;
  });

  return (
    <EmbedShell caption={caption}>
      <Plot
        data={[{ type: "heatmap", x: months, y: years, z: z, colorscale: "Viridis", hovertemplate: "%{y} %{x}<br>Events: %{z}<extra></extra>" }] as Plotly.Data[]}
        layout={{ ...PLOTLY_DARK_LAYOUT, height: 300, margin: { l: 60, r: 20, t: 30, b: 40 }, xaxis: { ...PLOTLY_DARK_LAYOUT.xaxis, title: { text: "Month", font: { size: 11 } } }, yaxis: { ...PLOTLY_DARK_LAYOUT.yaxis, title: { text: "Year", font: { size: 11 } } } } as Partial<Plotly.Layout>}
        config={PLOTLY_CONFIG} useResizeHandler style={{ width: "100%" }}
      />
    </EmbedShell>
  );
}

// ─── Sticky scroll-spy TOC ──────────────────────────────────────────────────

export function ScrollSpyTOC({ items }: { items: { id: string; label: string }[] }) {
  const [active, setActive] = useState("");
  useEffect(() => {
    if (!items.length) return;
    const els = items
      .map((i) => document.getElementById(i.id))
      .filter((el): el is HTMLElement => !!el);
    if (!els.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 }
    );
    els.forEach((e) => obs.observe(e));
    return () => obs.disconnect();
  }, [items]);

  return (
    <nav aria-label="Article outline" className="text-sm">
      <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.22em] text-slate-500">
        On this page
      </div>
      <ol className="space-y-1">
        {items.map((item) => {
          const isActive = active === item.id;
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                className={cn(
                  "block rounded py-1 text-[13px] leading-snug transition-colors",
                  isActive ? "text-cyan-300" : "text-slate-400 hover:text-slate-200"
                )}
              >
                {item.label}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// ─── Dashboard link  ────────────────────────────────────────────────────────

export function DashboardLink({
  href,
  label,
  blurb,
}: {
  href: string;
  label: string;
  blurb: string;
}) {
  return (
    <Link
      href={href}
      className="not-prose group my-6 flex items-start gap-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-5 transition-colors hover:border-cyan-500/40 hover:bg-slate-900/70"
    >
      <div className="flex-1">
        <div className="mb-1 text-xs uppercase tracking-wider text-cyan-400">
          Interactive
        </div>
        <div className="text-base font-semibold text-white">{label}</div>
        <p className="mt-1 text-sm text-slate-400">{blurb}</p>
      </div>
      <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-cyan-400" />
    </Link>
  );
}
