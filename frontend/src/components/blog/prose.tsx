"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Info, AlertTriangle, Lightbulb, ArrowUpRight } from "lucide-react";
import { fetchAPI } from "@/lib/api";
import { PLOTLY_DARK_LAYOUT, PLOTLY_CONFIG, CHART_COLORS } from "@/lib/plotly-theme";
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

export function Figure({
  src,
  caption,
  credit,
}: {
  src: string;
  caption?: string;
  credit?: string;
}) {
  return (
    <figure className="my-8">
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={caption || "Figure"} className="w-full" />
      </div>
      {(caption || credit) && (
        <figcaption className="mt-3 text-xs text-slate-500">
          {caption}
          {credit && <span className="ml-2 text-slate-600">— {credit}</span>}
        </figcaption>
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
  const { data } = useQuery<SHAPResponse | null>({
    queryKey: ["blog-shap", topK],
    queryFn: () => fetchAPI(`/api/forecast/shap-summary`).catch(() => null),
    retry: false,
    staleTime: 60 * 60 * 1000,
  });

  if (!data?.features?.length) {
    return (
      <figure className="my-8 flex h-80 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/40 text-xs text-slate-600">
        Loading SHAP summary…
      </figure>
    );
  }

  const top = data.features.slice(0, topK);
  // Plotly renders bottom-to-top for horizontal bars, so reverse so the
  // biggest feature appears at the top.
  const labels = [...top.map((f) => f.label || f.feature)].reverse();
  const shap = [...top.map((f) => f.mean_abs_shap)].reverse();

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
              ...PLOTLY_DARK_LAYOUT,
              title: { text: `Top ${topK} features by mean |SHAP|`, font: { size: 13 } },
              height: 40 + topK * 22,
              margin: { l: 160, r: 20, t: 40, b: 40 },
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
