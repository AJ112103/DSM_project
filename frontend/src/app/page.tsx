"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowUpRight,
  Gauge,
  Layers,
  TrendingUp,
  Table2,
  Newspaper,
  Bot,
  FileText,
  BarChart3,
  LineChart,
  Database,
} from "lucide-react";
import { fetchAPI } from "@/lib/api";
import { PLOTLY_DARK_LAYOUT, PLOTLY_CONFIG, CHART_COLORS } from "@/lib/plotly-theme";
import { cn } from "@/lib/utils";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

// ─────────────────────────────────────────────────────────────────────────────
//   Hero mini-chart
// ─────────────────────────────────────────────────────────────────────────────

type TimeSeriesResponse = {
  series: Record<string, (number | null)[] | string[]>;
  columns: string[];
};

type RegimeTransitionsResponse = {
  dates: string[];
  regimes: number[];
};

function regimesToSegments(dates: string[], regimes: number[]) {
  if (dates.length === 0) return [] as Array<{ start: string; end: string; regime: number }>;
  const segments: Array<{ start: string; end: string; regime: number }> = [];
  let startIdx = 0;
  for (let i = 1; i <= regimes.length; i++) {
    if (i === regimes.length || regimes[i] !== regimes[startIdx]) {
      segments.push({
        start: dates[startIdx],
        end: dates[Math.min(i, dates.length - 1)],
        regime: regimes[startIdx],
      });
      startIdx = i;
    }
  }
  return segments;
}

function HeroChart() {
  const { data } = useQuery<TimeSeriesResponse | null>({
    queryKey: ["hero-timeseries"],
    queryFn: () =>
      fetchAPI("/api/data/timeseries?columns=target_wacmr,rates_I7496_17").catch(() => null),
    retry: false,
    staleTime: 60 * 60 * 1000,
  });

  const { data: transitions } = useQuery<RegimeTransitionsResponse | null>({
    queryKey: ["hero-transitions"],
    queryFn: () =>
      fetchAPI("/api/analytics/regime-transitions").catch(() => null),
    retry: false,
    staleTime: 60 * 60 * 1000,
  });

  const dates = (data?.series?.dates as string[] | undefined) || [];
  const wacmr = (data?.series?.target_wacmr as (number | null)[] | undefined) || [];
  const repo = (data?.series?.rates_I7496_17 as (number | null)[] | undefined) || [];

  if (!dates.length) {
    return (
      <div className="relative h-[280px] overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40">
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-slate-800/30 via-slate-900/10 to-slate-800/30" />
        <svg className="absolute inset-0 h-full w-full opacity-30" viewBox="0 0 400 280" preserveAspectRatio="none">
          <path
            d="M0,180 C40,160 80,200 120,170 C160,140 200,150 240,130 C280,110 320,140 360,120 L400,110 L400,280 L0,280 Z"
            fill="rgba(6, 182, 212, 0.06)"
          />
          <path
            d="M0,180 C40,160 80,200 120,170 C160,140 200,150 240,130 C280,110 320,140 360,120 L400,110"
            stroke="rgba(6, 182, 212, 0.25)"
            strokeWidth="1.5"
            fill="none"
          />
        </svg>
      </div>
    );
  }

  const segments = transitions
    ? regimesToSegments(transitions.dates, transitions.regimes)
    : [];

  const shapes = segments.map((seg) => ({
    type: "rect",
    xref: "x",
    yref: "paper",
    x0: seg.start,
    x1: seg.end,
    y0: 0,
    y1: 1,
    fillcolor:
      seg.regime === 1 ? "rgba(245, 158, 11, 0.06)" : "rgba(16, 185, 129, 0.06)",
    line: { width: 0 },
    layer: "below",
  }));

  const traces = [
    {
      type: "scatter",
      mode: "lines",
      name: "Repo Rate",
      x: dates,
      y: repo,
      line: { color: "#64748b", width: 1.2, dash: "dot" },
    },
    {
      type: "scatter",
      mode: "lines",
      name: "WACMR",
      x: dates,
      y: wacmr,
      line: { color: CHART_COLORS[5], width: 2 },
      fill: "tozeroy",
      fillcolor: "rgba(6, 182, 212, 0.08)",
    },
  ];

  return (
    <Plot
      data={traces as unknown as Plotly.Data[]}
      layout={
        {
          ...PLOTLY_DARK_LAYOUT,
          height: 280,
          margin: { l: 40, r: 16, t: 8, b: 32 },
          showlegend: true,
          legend: { orientation: "h", x: 0, y: 1.12, font: { size: 10 } },
          xaxis: {
            ...PLOTLY_DARK_LAYOUT.xaxis,
            showgrid: false,
            tickfont: { color: "#94a3b8", size: 9 },
          },
          yaxis: {
            ...PLOTLY_DARK_LAYOUT.yaxis,
            tickformat: ".1f",
            ticksuffix: "%",
            tickfont: { color: "#94a3b8", size: 9 },
          },
          shapes: shapes as unknown as Partial<Plotly.Shape>[],
        } as unknown as Partial<Plotly.Layout>
      }
      config={PLOTLY_CONFIG}
      useResizeHandler
      style={{ width: "100%" }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//   Static content
// ─────────────────────────────────────────────────────────────────────────────

const FINDINGS = [
  {
    label: "The rate corridor dominates",
    stat: "≈ 90%",
    prose:
      "Mean |SHAP| concentrates on the repo rate, its one-week lag, and the WACMR–repo spread. Equity and forex features do not appear in the top 15.",
    tone: "cyan",
  },
  {
    label: "COVID was a genuine break",
    stat: "2 regimes",
    prose:
      "PCA+K-Means on 90%-variance components splits the sample into a pre-COVID tightening regime and a post-COVID accommodation regime at a silhouette-optimal k=2.",
    tone: "emerald",
  },
  {
    label: "Walk-forward, not overfit",
    stat: "70.9%",
    prose:
      "Directional accuracy on one-week-ahead predictions using an expanding-window XGBoost with a 156-week minimum train set (RMSE 0.102, MAE 0.065).",
    tone: "amber",
  },
] as const;

const TONE_CLASSES: Record<string, string> = {
  cyan: "border-cyan-500/30 bg-cyan-500/5 text-cyan-300",
  emerald: "border-emerald-500/30 bg-emerald-500/5 text-emerald-300",
  amber: "border-amber-500/30 bg-amber-500/5 text-amber-300",
};

const METHOD_STEPS = [
  { icon: Database, label: "Ingest", detail: "8 RBI datasets + Yahoo Finance, aligned to a Friday weekly grid" },
  { icon: LineChart, label: "Engineer", detail: "Technical indicators, lags, spreads — 117 features" },
  { icon: Layers, label: "Regimes", detail: "PCA → K-Means (k=2) with silhouette validation" },
  { icon: TrendingUp, label: "Forecast", detail: "XGBoost, expanding-window walk-forward" },
  { icon: BarChart3, label: "Explain", detail: "SHAP TreeExplainer per week + aggregate" },
  { icon: Newspaper, label: "Narrate", detail: "75 curated policy events with manual sentiment" },
];

const EXPLORE = [
  {
    title: "Policy Counterfactual Simulator",
    description:
      "Drag a slider for a repo-rate change. See the model's predicted WACMR, the 90% walk-forward CI, and per-feature attribution.",
    icon: Gauge,
    href: "/simulate",
    badge: "Headline",
    color: "cyan",
  },
  {
    title: "AI Research Agent",
    description:
      "Chat with the dataset in natural language. The agent writes SQL, plots charts, explains SHAP, and runs counterfactuals.",
    icon: Bot,
    href: "/agent",
    badge: "New",
    color: "cyan",
  },
  {
    title: "Regimes",
    description:
      "PCA projection coloured by regime. Regime fact sheets, transition timeline, and comparative statistics.",
    icon: Layers,
    href: "/regimes",
    color: "emerald",
  },
  {
    title: "Forecast & SHAP",
    description:
      "Actual vs predicted, walk-forward metrics, SHAP summary, and per-week waterfall explanations.",
    icon: TrendingUp,
    href: "/forecast",
    color: "amber",
  },
  {
    title: "Dashboard",
    description:
      "Interactive time series, correlation heatmap, distribution, and regime composition.",
    icon: BarChart3,
    href: "/dashboard",
    color: "violet",
  },
  {
    title: "Data Explorer",
    description:
      "Browse every week and every column. Filter by date, regime, or search columns.",
    icon: Table2,
    href: "/explore",
    color: "blue",
  },
  {
    title: "News & NLP",
    description:
      "75 curated RBI policy events with sentiment. Timeline overlay on WACMR and correlation stats.",
    icon: Newspaper,
    href: "/news",
    color: "rose",
  },
  {
    title: "Full Report",
    description:
      "Long-form methodology, findings, and recommendations generated from the pipeline.",
    icon: FileText,
    href: "/report",
    color: "orange",
  },
];

const COLOR_ACCENT: Record<string, string> = {
  cyan: "border-cyan-500/30 bg-cyan-500/5 text-cyan-300",
  emerald: "border-emerald-500/30 bg-emerald-500/5 text-emerald-300",
  amber: "border-amber-500/30 bg-amber-500/5 text-amber-300",
  violet: "border-violet-500/30 bg-violet-500/5 text-violet-300",
  blue: "border-blue-500/30 bg-blue-500/5 text-blue-300",
  rose: "border-rose-500/30 bg-rose-500/5 text-rose-300",
  orange: "border-orange-500/30 bg-orange-500/5 text-orange-300",
};

// ─────────────────────────────────────────────────────────────────────────────
//   Page
// ─────────────────────────────────────────────────────────────────────────────

export default function OverviewPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-20">
      {/* HERO */}
      <section className="pt-6 lg:pt-10">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_480px] lg:items-center">
          <div className="space-y-6">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-cyan-400">
              <div className="h-px w-8 bg-cyan-400/50" />
              A data-science investigation · 2026
            </div>
            <h1
              className="text-balance text-4xl leading-[1.05] text-white sm:text-5xl lg:text-6xl"
              style={{ fontFamily: "var(--font-instrument-serif)" }}
            >
              Can we predict the{" "}
              <span className="italic text-cyan-300">heartbeat</span> of Indian
              monetary policy{" "}
              <span className="italic text-cyan-300">one week ahead?</span>
            </h1>
            <p className="max-w-2xl text-lg leading-relaxed text-slate-400">
              Ten years, 545 weeks, 117 features, two monetary-policy regimes, and
              one overnight rate — the WACMR — that quietly settles every bank&apos;s
              cash book. We combined NDAP RBI data with market prices and 75 curated
              policy events to build a forecasting model with{" "}
              <span className="font-semibold text-slate-200">70.9% directional accuracy</span>,
              explain it with SHAP, and let you interrogate it.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/simulate"
                className="group inline-flex items-center gap-2 rounded-full bg-cyan-500 px-5 py-2.5 text-sm font-medium text-slate-950 transition-all hover:bg-cyan-400"
              >
                Try the simulator
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/agent"
                className="group inline-flex items-center gap-2 rounded-full border border-slate-700 px-5 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:border-slate-500 hover:bg-slate-900"
              >
                Ask the research agent
                <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-3">
            <HeroChart />
            <div className="px-1 pt-2 text-[10px] text-slate-500">
              WACMR (cyan fill) vs Repo Rate (dashed). Amber bands are Regime 1 (Tightening era, 315 weeks); green bands are Regime 0 (Accommodation era, 230 weeks).
            </div>
          </div>
        </div>
      </section>

      {/* THE QUESTION */}
      <section className="grid gap-10 lg:grid-cols-[1fr_2fr]">
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
            Why it matters
          </div>
          <h2
            className="text-3xl leading-tight text-white"
            style={{ fontFamily: "var(--font-instrument-serif)" }}
          >
            The WACMR is the thermometer of Indian monetary policy.
          </h2>
        </div>
        <div className="space-y-4 text-slate-300">
          <p>
            The <span className="italic">Weighted Average Call Money Rate</span> is
            the interest rate at which scheduled Indian banks lend to each other{" "}
            <span className="italic">overnight</span>, settled on the books of the
            Reserve Bank of India. It&apos;s the point where the RBI&apos;s policy
            rate, the banking system&apos;s liquidity state, and market expectations
            all have to agree.
          </p>
          <p>
            If you want to know whether monetary policy is actually transmitting —
            whether the repo rate is biting — the WACMR is where you look. Forecasting
            it a week ahead is genuinely hard: the series lives inside a tight
            corridor, but with sharp, regime-dependent excursions around COVID, rate
            cycles, and liquidity operations.
          </p>
          <p className="text-slate-500">
            This project frames the problem, pulls together open data from NDAP and
            elsewhere, engineers a feature set, clusters the dataset into market
            regimes, trains a walk-forward-validated XGBoost forecaster, opens the
            model with SHAP, and turns the whole thing into an interactive artefact
            you can play with.
          </p>
        </div>
      </section>

      {/* KEY FINDINGS */}
      <section className="space-y-6">
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
            Three findings that shaped everything else
          </div>
          <h2
            className="text-3xl text-white"
            style={{ fontFamily: "var(--font-instrument-serif)" }}
          >
            What the data told us.
          </h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {FINDINGS.map((f) => (
            <div
              key={f.label}
              className={cn(
                "relative overflow-hidden rounded-2xl border p-6",
                TONE_CLASSES[f.tone]
              )}
            >
              <div className="text-xs font-medium uppercase tracking-wider opacity-70">
                {f.label}
              </div>
              <div
                className="mt-2 font-mono text-4xl font-semibold text-white"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {f.stat}
              </div>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                {f.prose}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* METHODOLOGY */}
      <section className="space-y-6">
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
            The pipeline
          </div>
          <h2
            className="text-3xl text-white"
            style={{ fontFamily: "var(--font-instrument-serif)" }}
          >
            Six stages, reproducibly.
          </h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {METHOD_STEPS.map((step, i) => (
            <div
              key={step.label}
              className="group relative rounded-xl border border-slate-800 bg-slate-900/40 p-4 transition-colors hover:border-slate-700"
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-slate-300">
                  <step.icon className="h-4 w-4" />
                </div>
                <span className="font-mono text-[10px] text-slate-600">0{i + 1}</span>
              </div>
              <div className="text-sm font-semibold text-white">{step.label}</div>
              <p className="mt-1 text-[11px] leading-snug text-slate-400">
                {step.detail}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* EXPLORE */}
      <section className="space-y-6">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
              Explore
            </div>
            <h2
              className="text-3xl text-white"
              style={{ fontFamily: "var(--font-instrument-serif)" }}
            >
              Where to go next.
            </h2>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {EXPLORE.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className={cn(
                "group relative overflow-hidden rounded-2xl border bg-slate-900/40 p-5 transition-all hover:-translate-y-0.5 hover:border-slate-600 hover:bg-slate-900/70",
                card.badge ? COLOR_ACCENT[card.color] : "border-slate-800"
              )}
            >
              <div className="mb-4 flex items-start justify-between">
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg",
                    card.badge ? "bg-current/10" : "bg-slate-800"
                  )}
                >
                  <card.icon className="h-5 w-5" />
                </div>
                {card.badge && (
                  <span className="rounded-full bg-current/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                    {card.badge}
                  </span>
                )}
              </div>
              <h3 className="text-base font-semibold text-white">{card.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-400">
                {card.description}
              </p>
              <div className="mt-4 flex items-center gap-1 text-xs font-medium opacity-70 group-hover:opacity-100">
                Open
                <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-800 pt-8 pb-4 text-xs text-slate-500">
        <p>
          Built for the DSM project, 2026. Data from the{" "}
          <a
            href="https://ndap.niti.gov.in/"
            target="_blank"
            rel="noreferrer"
            className="underline-offset-2 hover:text-slate-300 hover:underline"
          >
            NITI Aayog National Data & Analytics Platform
          </a>{" "}
          and Yahoo Finance. Model, regimes, and SHAP via open-source packages.
          The research agent is powered by Gemini 2.5 Flash with function-calling.
        </p>
      </footer>
    </div>
  );
}
