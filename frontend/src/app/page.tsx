"use client";

import Link from "next/link";
import {
  Table2,
  BarChart3,
  Layers,
  TrendingUp,
  Newspaper,
  Bot,
  FileText,
  ArrowRight,
  Database,
  Target,
  TrendingDown,
  Fingerprint,
} from "lucide-react";
import { cn } from "@/lib/utils";

const KPI_CARDS = [
  {
    label: "Weeks of Data",
    value: "545",
    icon: Database,
    color: "blue",
    description: "Historical observations",
  },
  {
    label: "RMSE",
    value: "0.1019",
    icon: Target,
    color: "emerald",
    description: "Prediction accuracy",
  },
  {
    label: "Directional Accuracy",
    value: "70.9%",
    icon: TrendingDown,
    color: "amber",
    description: "Direction correct",
  },
  {
    label: "Regimes Detected",
    value: "2",
    icon: Fingerprint,
    color: "violet",
    description: "Market states found",
  },
];

const NAV_CARDS = [
  {
    title: "Data Explorer",
    description: "Browse and filter the raw dataset with sortable tables and date range filters.",
    icon: Table2,
    href: "/explore",
    color: "blue",
  },
  {
    title: "Dashboard",
    description: "Interactive charts: time series, correlations, distributions, and regime composition.",
    icon: BarChart3,
    href: "/dashboard",
    color: "emerald",
  },
  {
    title: "Regimes",
    description: "PCA visualization and Hidden Markov Model regime analysis with transition patterns.",
    icon: Layers,
    href: "/regimes",
    color: "violet",
  },
  {
    title: "Forecast & SHAP",
    description: "Walk-forward predictions with SHAP explainability and model performance metrics.",
    icon: TrendingUp,
    href: "/forecast",
    color: "amber",
  },
  {
    title: "News & NLP",
    description: "Event timeline, sentiment analysis, and NLP-derived features overlaid on WACMR.",
    icon: Newspaper,
    href: "/news",
    color: "rose",
  },
  {
    title: "AI Agent",
    description: "Chat-based analytics agent. Ask questions in natural language, get SQL, charts, and insights.",
    icon: Bot,
    href: "/agent",
    color: "cyan",
  },
  {
    title: "Report",
    description: "Full project report with methodology, findings, and visualizations.",
    icon: FileText,
    href: "/report",
    color: "orange",
  },
];

const colorMap: Record<string, string> = {
  blue: "from-blue-500/20 to-blue-600/5 border-blue-500/30 text-blue-400",
  emerald: "from-emerald-500/20 to-emerald-600/5 border-emerald-500/30 text-emerald-400",
  amber: "from-amber-500/20 to-amber-600/5 border-amber-500/30 text-amber-400",
  violet: "from-violet-500/20 to-violet-600/5 border-violet-500/30 text-violet-400",
  rose: "from-rose-500/20 to-rose-600/5 border-rose-500/30 text-rose-400",
  cyan: "from-cyan-500/20 to-cyan-600/5 border-cyan-500/30 text-cyan-400",
  orange: "from-orange-500/20 to-orange-600/5 border-orange-500/30 text-orange-400",
};

const iconColorMap: Record<string, string> = {
  blue: "text-blue-400 bg-blue-500/10",
  emerald: "text-emerald-400 bg-emerald-500/10",
  amber: "text-amber-400 bg-amber-500/10",
  violet: "text-violet-400 bg-violet-500/10",
  rose: "text-rose-400 bg-rose-500/10",
  cyan: "text-cyan-400 bg-cyan-500/10",
  orange: "text-orange-400 bg-orange-500/10",
};

export default function OverviewPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-10">
      {/* Hero */}
      <section className="space-y-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-white lg:text-4xl">
            WACMR Analytics Dashboard
          </h1>
          <p className="max-w-2xl text-lg text-slate-400">
            Comprehensive analysis of India&apos;s Weighted Average Call Money Rate using
            machine learning, regime detection, NLP, and explainable AI.
          </p>
        </div>
      </section>

      {/* KPI Cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {KPI_CARDS.map((kpi, i) => (
          <div
            key={kpi.label}
            className="animate-fade-in rounded-xl border border-slate-800 bg-slate-900 p-5"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="flex items-center justify-between">
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-lg",
                  iconColorMap[kpi.color]
                )}
              >
                <kpi.icon className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4">
              <p className="text-2xl font-bold text-white">{kpi.value}</p>
              <p className="text-sm font-medium text-slate-400">{kpi.label}</p>
              <p className="mt-1 text-xs text-slate-500">{kpi.description}</p>
            </div>
          </div>
        ))}
      </section>

      {/* Project Description */}
      <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
        <h2 className="text-lg font-semibold text-white">About This Project</h2>
        <p className="mt-3 leading-relaxed text-slate-400">
          This dashboard presents a complete data science pipeline for analyzing and forecasting
          India&apos;s Weighted Average Call Money Rate (WACMR). The project integrates
          545 weeks of financial data with macroeconomic indicators, applies Hidden Markov Models
          for regime detection, uses gradient-boosted models with walk-forward validation for
          forecasting, and employs SHAP values for model explainability. Additionally, NLP
          techniques extract sentiment and event features from news data to enhance predictions.
        </p>
      </section>

      {/* Navigation Cards */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-white">Explore Sections</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {NAV_CARDS.map((card, i) => (
            <Link
              key={card.href}
              href={card.href}
              className={cn(
                "group animate-fade-in rounded-xl border bg-gradient-to-br p-5 transition-all hover:scale-[1.02] hover:shadow-lg",
                colorMap[card.color]
              )}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="flex items-start justify-between">
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-lg",
                    iconColorMap[card.color]
                  )}
                >
                  <card.icon className="h-5 w-5" />
                </div>
                <ArrowRight className="h-4 w-4 text-slate-500 transition-transform group-hover:translate-x-1 group-hover:text-slate-300" />
              </div>
              <h3 className="mt-4 font-semibold text-white">{card.title}</h3>
              <p className="mt-1 text-sm text-slate-400">{card.description}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
