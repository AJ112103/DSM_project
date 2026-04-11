"use client";

import dynamic from "next/dynamic";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchAPI } from "@/lib/api";
import { PLOTLY_DARK_LAYOUT, PLOTLY_CONFIG, CHART_COLORS } from "@/lib/plotly-theme";
import { Newspaper, Loader2, AlertCircle, Filter, Calendar, Tag } from "lucide-react";
import { cn } from "@/lib/utils";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

interface NewsEvent {
  date: string;
  title: string;
  category?: string;
  impact?: string;
  description?: string;
  sentiment?: number;
}

export default function NewsPage() {
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [impactFilter, setImpactFilter] = useState<string>("all");

  const {
    data: eventsData,
    isLoading: eventsLoading,
    error: eventsError,
  } = useQuery({
    queryKey: ["events"],
    queryFn: () => fetchAPI("/api/news/events"),
  });

  const {
    data: sentimentData,
    isLoading: sentimentLoading,
    error: sentimentError,
  } = useQuery({
    queryKey: ["sentiment"],
    queryFn: () => fetchAPI("/api/news/sentiment"),
  });

  const events: NewsEvent[] = useMemo(() => {
    const raw = eventsData?.events || eventsData || [];
    if (!Array.isArray(raw)) return [];
    return raw;
  }, [eventsData]);

  const categories = useMemo(() => {
    const cats = new Set(events.map((e) => e.category).filter(Boolean));
    return ["all", ...Array.from(cats)];
  }, [events]);

  const impacts = useMemo(() => {
    const imps = new Set(events.map((e) => e.impact).filter(Boolean));
    return ["all", ...Array.from(imps)];
  }, [events]);

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (categoryFilter !== "all" && e.category !== categoryFilter) return false;
      if (impactFilter !== "all" && e.impact !== impactFilter) return false;
      return true;
    });
  }, [events, categoryFilter, impactFilter]);

  const impactColor: Record<string, string> = {
    high: "border-rose-500/50 bg-rose-500/10 text-rose-400",
    medium: "border-amber-500/50 bg-amber-500/10 text-amber-400",
    low: "border-emerald-500/50 bg-emerald-500/10 text-emerald-400",
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-500/10">
          <Newspaper className="h-5 w-5 text-rose-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">News & NLP Analysis</h1>
          <p className="text-sm text-slate-400">
            Event timeline, sentiment analysis, and NLP-derived features
          </p>
        </div>
      </div>

      {/* Sentiment Chart */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <h3 className="mb-3 text-sm font-semibold text-white">
          Sentiment Score vs WACMR
        </h3>
        {sentimentLoading ? (
          <div className="flex h-80 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
          </div>
        ) : sentimentError ? (
          <div className="flex h-80 items-center justify-center gap-2 text-rose-400">
            <AlertCircle className="h-4 w-4" />
            <span>Failed to load sentiment data</span>
          </div>
        ) : sentimentData ? (
          <Plot
            data={[
              {
                x: sentimentData.series?.dates || [],
                y: sentimentData.series?.target_wacmr || [],
                name: "WACMR",
                type: "scatter" as const,
                mode: "lines" as const,
                line: { color: CHART_COLORS[0], width: 1.5 },
                yaxis: "y",
              },
              {
                x: sentimentData.series?.dates || [],
                y: sentimentData.series?.news_sentiment || [],
                name: "Sentiment",
                type: "scatter" as const,
                mode: "lines" as const,
                line: { color: CHART_COLORS[1], width: 1.5 },
                yaxis: "y2",
              },
            ]}
            layout={{
              ...PLOTLY_DARK_LAYOUT,
              height: 400,
              xaxis: { ...PLOTLY_DARK_LAYOUT.xaxis, title: "Date" },
              yaxis: {
                ...PLOTLY_DARK_LAYOUT.yaxis,
                title: "WACMR",
                side: "left" as const,
              },
              yaxis2: {
                title: { text: "Sentiment" },
                overlaying: "y" as const,
                side: "right" as const,
                gridcolor: "transparent",
                tickfont: { color: "#94a3b8" },
              },
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

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-800 bg-slate-900 p-4">
        <Filter className="h-4 w-4 text-slate-400" />
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">
            Category
          </label>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c === "all" ? "All Categories" : c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">
            Impact
          </label>
          <select
            value={impactFilter}
            onChange={(e) => setImpactFilter(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
          >
            {impacts.map((imp) => (
              <option key={imp} value={imp}>
                {imp === "all" ? "All Impacts" : imp}
              </option>
            ))}
          </select>
        </div>
        <p className="ml-auto text-xs text-slate-500">
          Showing {filteredEvents.length} of {events.length} events
        </p>
      </div>

      {/* Event Cards */}
      {eventsLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="skeleton h-32 rounded-xl border border-slate-800"
            />
          ))}
        </div>
      ) : eventsError ? (
        <div className="flex h-40 items-center justify-center gap-2 text-rose-400">
          <AlertCircle className="h-4 w-4" />
          <span>Failed to load events data</span>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Timeline */}
          <div className="relative space-y-0">
            {filteredEvents.map((event, i) => (
              <div key={i} className="flex gap-4">
                {/* Timeline line */}
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      "h-3 w-3 rounded-full border-2",
                      event.impact
                        ? impactColor[event.impact.toLowerCase()] || "border-slate-600 bg-slate-800"
                        : "border-slate-600 bg-slate-800"
                    )}
                  />
                  {i < filteredEvents.length - 1 && (
                    <div className="w-px flex-1 bg-slate-800" />
                  )}
                </div>

                {/* Event Card */}
                <div className="mb-4 flex-1 rounded-xl border border-slate-800 bg-slate-900 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <Calendar className="h-3 w-3" />
                      {event.date}
                    </div>
                    {event.category && (
                      <span className="flex items-center gap-1 rounded-full border border-slate-700 bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
                        <Tag className="h-3 w-3" />
                        {event.category}
                      </span>
                    )}
                    {event.impact && (
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-xs font-medium",
                          impactColor[event.impact.toLowerCase()] ||
                            "border-slate-600 text-slate-400"
                        )}
                      >
                        {event.impact}
                      </span>
                    )}
                  </div>
                  <h4 className="mt-2 font-medium text-white">{event.title}</h4>
                  {event.description && (
                    <p className="mt-1 text-sm text-slate-400">
                      {event.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
          {filteredEvents.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-500">
              No events match the selected filters
            </p>
          )}
        </div>
      )}
    </div>
  );
}
