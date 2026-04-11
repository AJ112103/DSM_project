"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchAPI } from "@/lib/api";
import {
  FileText,
  Loader2,
  AlertCircle,
  ChevronRight,
  Clock,
  BookOpen,
  Search,
  X,
  Link2,
  ChevronDown,
  Printer,
  ArrowUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────
interface TOCItem {
  id: string;
  text: string;
  level: number;
  sectionNumber?: string;
}

interface ParsedSection {
  id: string;
  type: "hero" | "major" | "sub" | "checkin";
  title: string;
  sectionNumber?: string;
  content: string; // pre-rendered HTML
}

// ── Plain Text → Structured Sections Parser ──────────────────────────
function parseReport(raw: string): ParsedSection[] {
  const lines = raw.split("\n");
  const sections: ParsedSection[] = [];
  let currentSection: ParsedSection | null = null;
  let contentLines: string[] = [];
  let sectionIdx = 0;

  const flushSection = () => {
    if (currentSection) {
      currentSection.content = renderContentLines(contentLines);
      sections.push(currentSection);
      contentLines = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip pure separator lines
    if (/^[═=]{5,}$/.test(trimmed)) continue;
    if (/^[─-]{60,}$/.test(trimmed)) continue;

    // Major section: text between ═══ lines
    const prevIsSep = i > 0 && /^[═=]{5,}$/.test(lines[i - 1]?.trim() || "");
    const nextIsSep = i < lines.length - 1 && /^[═=]{5,}$/.test(lines[i + 1]?.trim() || "");

    if (prevIsSep && nextIsSep && trimmed.length > 0) {
      flushSection();
      const numMatch = trimmed.match(/^\s*(\d+)\.\s+/);
      currentSection = {
        id: `section-${sectionIdx++}`,
        type: sectionIdx === 1 ? "hero" : "major",
        title: trimmed.replace(/^\s+/, ""),
        sectionNumber: numMatch ? numMatch[1] : undefined,
      content: "",
      };
      continue;
    }

    // Subsection: lines starting with ──
    if (/^──\s+/.test(trimmed)) {
      flushSection();
      const title = trimmed.replace(/^──\s+/, "").replace(/\s+──+$/, "").trim();
      const numMatch = title.match(/^(\d+\.\d+)\s+/);
      currentSection = {
        id: `section-${sectionIdx++}`,
        type: "sub",
        title,
        sectionNumber: numMatch ? numMatch[1] : undefined,
        content: "",
      };
      continue;
    }

    // CHECK-IN headers
    if (/^\[CHECK-IN/.test(trimmed)) {
      flushSection();
      currentSection = {
        id: `section-${sectionIdx++}`,
        type: "checkin",
        title: trimmed,
        content: "",
      };
      continue;
    }

    // Content lines
    contentLines.push(line);
  }
  flushSection();
  return sections;
}

// ── Content Line Renderer ────────────────────────────────────────────
function renderContentLines(lines: string[]): string {
  const html: string[] = [];
  let inTable = false;
  let tableLines: string[] = [];

  const flushTable = () => {
    if (tableLines.length > 0) {
      html.push(`<div class="report-table"><pre>${tableLines.join("\n")}</pre></div>`);
      tableLines = [];
    }
    inTable = false;
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // ASCII table detection
    if (/[┌┐┤├└┘│─┼]/.test(trimmed) || (inTable && /^\s*│/.test(line))) {
      inTable = true;
      tableLines.push(escapeHtml(line));
      continue;
    }
    if (inTable && trimmed.length === 0) {
      flushTable();
      continue;
    }
    if (inTable) {
      flushTable();
    }

    if (trimmed.length === 0) {
      html.push("");
      continue;
    }

    // Key Finding callout
    if (/^Key Finding \d+/i.test(trimmed)) {
      html.push(`<div class="callout callout-finding">${escapeHtml(trimmed)}</div>`);
      continue;
    }

    // RESULT callout
    if (/^RESULT/i.test(trimmed)) {
      html.push(`<div class="callout callout-result">${escapeHtml(trimmed)}</div>`);
      continue;
    }

    // Hypothesis
    if (/^Hypothesis/i.test(trimmed)) {
      html.push(`<div class="callout callout-hypothesis">${escapeHtml(trimmed)}</div>`);
      continue;
    }

    // Mechanistic Finding
    if (/Mechanistic Finding/i.test(trimmed)) {
      html.push(`<div class="callout callout-finding">${escapeHtml(trimmed)}</div>`);
      continue;
    }

    // Star-marked features (★)
    if (/★/.test(trimmed)) {
      html.push(`<p class="star-line">${escapeHtml(trimmed).replace(/★/g, '<span class="star">★</span>')}</p>`);
      continue;
    }

    // Bullet points
    if (/^\s*[•▸]\s/.test(line)) {
      html.push(`<li>${escapeHtml(trimmed.replace(/^[•▸]\s*/, ""))}</li>`);
      continue;
    }

    // Numbered items like (a), (b), 1., 2.
    if (/^\s+\([a-z]\)\s/.test(line) || /^\s+\d+\.\s/.test(line)) {
      html.push(`<li>${escapeHtml(trimmed)}</li>`);
      continue;
    }

    // Metric/stat lines with colons (e.g., "RMSE : 0.1019")
    if (/^\s{2,}\S.*:\s+\S/.test(line) && trimmed.length < 120) {
      html.push(`<p class="metric-line">${escapeHtml(trimmed)}</p>`);
      continue;
    }

    // Regular paragraph
    html.push(`<p>${escapeHtml(trimmed)}</p>`);
  }

  flushTable();
  return html.join("\n");
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ── Reading Time ─────────────────────────────────────────────────────
function estimateReadingTime(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.ceil(words / 220);
}

// ── Main Component ───────────────────────────────────────────────────
export default function ReportPage() {
  const [activeSection, setActiveSection] = useState("");
  const [scrollProgress, setScrollProgress] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [showBackToTop, setShowBackToTop] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { data: reportData, isLoading, error } = useQuery({
    queryKey: ["report"],
    queryFn: () => fetchAPI("/api/report"),
  });

  const rawText = useMemo(() => {
    if (!reportData) return "";
    return reportData.content || reportData.html || reportData.report || "";
  }, [reportData]);

  const sections = useMemo(() => parseReport(rawText), [rawText]);
  const readingTime = useMemo(() => estimateReadingTime(rawText), [rawText]);
  const wordCount = useMemo(() => rawText.split(/\s+/).filter(Boolean).length, [rawText]);

  const toc = useMemo<TOCItem[]>(() => {
    return sections
      .filter((s) => s.type !== "hero")
      .map((s) => ({
        id: s.id,
        text: s.title,
        level: s.type === "major" || s.type === "checkin" ? 1 : 2,
        sectionNumber: s.sectionNumber,
      }));
  }, [sections]);

  // Scroll progress bar
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(docHeight > 0 ? (scrollTop / docHeight) * 100 : 0);
      setShowBackToTop(scrollTop > 600);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Intersection observer for active TOC tracking
  useEffect(() => {
    if (!contentRef.current) return;
    const headings = contentRef.current.querySelectorAll("[data-section-id]");
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = (entry.target as HTMLElement).dataset.sectionId || "";
            setActiveSection(id);
            history.replaceState(null, "", `#${id}`);
          }
        }
      },
      { rootMargin: "-80px 0px -70% 0px" }
    );

    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [sections]);

  // Keyboard shortcut for search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        // Only intercept if not in an input
        if (document.activeElement?.tagName !== "INPUT") {
          e.preventDefault();
          setSearchOpen(true);
          setTimeout(() => searchInputRef.current?.focus(), 100);
        }
      }
      if (e.key === "Escape") setSearchOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const scrollToSection = useCallback((id: string) => {
    const el = document.querySelector(`[data-section-id="${id}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveSection(id);
    }
  }, []);

  const toggleSection = useCallback((id: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const copyLink = useCallback((id: string) => {
    const url = `${window.location.origin}${window.location.pathname}#${id}`;
    navigator.clipboard.writeText(url);
  }, []);

  // Search highlighting
  const highlightedSections = useMemo(() => {
    if (!searchQuery || searchQuery.length < 2) return new Set<string>();
    const q = searchQuery.toLowerCase();
    const matches = new Set<string>();
    for (const s of sections) {
      if (s.title.toLowerCase().includes(q) || s.content.toLowerCase().includes(q)) {
        matches.add(s.id);
      }
    }
    return matches;
  }, [searchQuery, sections]);

  const searchResultCount = highlightedSections.size;

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="relative mx-auto max-w-[90rem]">
      {/* Reading Progress Bar */}
      <div className="fixed left-0 top-0 z-50 h-[3px] w-full bg-slate-900/50 print:hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-500 via-violet-500 to-purple-500 transition-[width] duration-150"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>

      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-500/20">
            <FileText className="h-6 w-6 text-orange-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Project Report</h1>
            <div className="mt-1 flex items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {readingTime} min read
              </span>
              <span className="flex items-center gap-1">
                <BookOpen className="h-3 w-3" />
                {wordCount.toLocaleString()} words
              </span>
              <span>{sections.length} sections</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          {/* Search Toggle */}
          <button
            onClick={() => {
              setSearchOpen(!searchOpen);
              if (!searchOpen) setTimeout(() => searchInputRef.current?.focus(), 100);
            }}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-400 transition hover:bg-slate-700 hover:text-white"
            title="Search (Ctrl+F)"
          >
            <Search className="h-4 w-4" />
          </button>
          {/* Print */}
          <button
            onClick={() => window.print()}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-400 transition hover:bg-slate-700 hover:text-white"
            title="Print / Save as PDF"
          >
            <Printer className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      {searchOpen && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 print:hidden">
          <Search className="h-4 w-4 shrink-0 text-slate-500" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search within report..."
            className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 outline-none"
            autoFocus
          />
          {searchQuery && (
            <span className="shrink-0 text-xs text-slate-500">
              {searchResultCount} {searchResultCount === 1 ? "match" : "matches"}
            </span>
          )}
          <button onClick={() => { setSearchQuery(""); setSearchOpen(false); }} className="text-slate-500 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="flex h-96 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
        </div>
      ) : error ? (
        <div className="flex h-96 flex-col items-center justify-center gap-3">
          <AlertCircle className="h-8 w-8 text-rose-400" />
          <p className="text-rose-400">{error instanceof Error ? error.message : "Failed to load report"}</p>
        </div>
      ) : (
        <div className="flex gap-8">
          {/* ── Sticky TOC Sidebar ─────────────────────────────────── */}
          <aside className="hidden w-64 shrink-0 xl:block print:hidden">
            <div className="sticky top-8 max-h-[calc(100vh-4rem)] overflow-y-auto scrollbar-thin">
              <h3 className="mb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">
                Table of Contents
              </h3>
              <nav className="space-y-0.5">
                {toc.map((item) => {
                  const isActive = activeSection === item.id;
                  const isSearchMatch = highlightedSections.has(item.id);
                  return (
                    <button
                      key={item.id}
                      onClick={() => scrollToSection(item.id)}
                      className={cn(
                        "group flex w-full items-start gap-1.5 rounded-md px-2 py-1.5 text-left text-[11px] leading-snug transition-all duration-200",
                        isActive
                          ? "bg-blue-500/10 text-blue-400 font-medium"
                          : isSearchMatch
                            ? "bg-amber-500/10 text-amber-300"
                            : "text-slate-500 hover:bg-slate-800/60 hover:text-slate-300",
                        item.level === 2 && "ml-3 border-l border-slate-800 pl-3",
                      )}
                    >
                      {item.level === 1 && (
                        <span className={cn(
                          "mt-px inline-block h-1.5 w-1.5 shrink-0 rounded-full transition-colors",
                          isActive ? "bg-blue-400" : "bg-slate-700 group-hover:bg-slate-500"
                        )} />
                      )}
                      <span className="truncate">{item.text.replace(/^\d+\.\d*\s*/, "").replace(/\(Part.*?\)/, "").trim()}</span>
                    </button>
                  );
                })}
              </nav>

              {/* Visualization Gallery Link */}
              <div className="mt-6 rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">Visualizations</p>
                <div className="mt-2 grid grid-cols-2 gap-1">
                  {["eda_distributions", "pca_regime_scatter", "shap_summary", "actual_vs_predicted"].map((name) => (
                    <img
                      key={name}
                      src={`/visualizations/${name}.png`}
                      alt={name}
                      className="h-12 w-full rounded border border-slate-800 object-cover opacity-70 transition hover:opacity-100 cursor-pointer"
                      onClick={() => {
                        const el = document.getElementById("viz-gallery");
                        el?.scrollIntoView({ behavior: "smooth" });
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </aside>

          {/* ── Report Content ─────────────────────────────────────── */}
          <div ref={contentRef} className="min-w-0 flex-1 space-y-1 pb-20">
            {sections.map((section) => {
              const isCollapsed = collapsedSections.has(section.id);
              const isSearchMatch = searchQuery.length >= 2 && highlightedSections.has(section.id);

              if (section.type === "hero") {
                return (
                  <div
                    key={section.id}
                    data-section-id={section.id}
                    className="mb-8 rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950/30 p-8"
                  >
                    <h2 className="text-2xl font-bold text-white">{section.title}</h2>
                    <div
                      className="report-content mt-4 text-sm leading-relaxed text-slate-400"
                      dangerouslySetInnerHTML={{ __html: section.content }}
                    />
                  </div>
                );
              }

              if (section.type === "major") {
                return (
                  <div
                    key={section.id}
                    data-section-id={section.id}
                    className={cn(
                      "rounded-xl border bg-slate-900 transition-colors",
                      isSearchMatch ? "border-amber-500/40 ring-1 ring-amber-500/20" : "border-slate-800"
                    )}
                  >
                    {/* Collapsible header */}
                    <div
                      onClick={() => toggleSection(section.id)}
                      className="flex w-full cursor-pointer items-center justify-between px-6 py-5 text-left group"
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") toggleSection(section.id); }}
                    >
                      <div className="flex items-center gap-3">
                        {section.sectionNumber && (
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-sm font-bold text-blue-400">
                            {section.sectionNumber}
                          </span>
                        )}
                        <h2 className="text-lg font-bold text-white">
                          {section.title.replace(/^\s*\d+\.\s*/, "")}
                        </h2>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); copyLink(section.id); }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-slate-800"
                          title="Copy link to section"
                        >
                          <Link2 className="h-3.5 w-3.5 text-slate-500" />
                        </button>
                        <ChevronDown className={cn(
                          "h-5 w-5 text-slate-600 transition-transform",
                          isCollapsed && "-rotate-90"
                        )} />
                      </div>
                    </div>
                    {!isCollapsed && (
                      <div className="border-t border-slate-800/50 px-6 pb-6 pt-4">
                        <div
                          className="report-content text-sm leading-[1.8] text-slate-300"
                          dangerouslySetInnerHTML={{ __html: section.content }}
                        />
                      </div>
                    )}
                  </div>
                );
              }

              if (section.type === "checkin") {
                return (
                  <div
                    key={section.id}
                    data-section-id={section.id}
                    className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 px-6 py-4"
                  >
                    <h3 className="flex items-center gap-2 text-sm font-bold text-emerald-400">
                      <span className="flex h-5 w-5 items-center justify-center rounded bg-emerald-500/20 text-[10px]">✓</span>
                      {section.title}
                    </h3>
                    <div
                      className="report-content mt-3 text-sm leading-[1.7] text-slate-400"
                      dangerouslySetInnerHTML={{ __html: section.content }}
                    />
                  </div>
                );
              }

              // Subsection
              return (
                <div
                  key={section.id}
                  data-section-id={section.id}
                  className={cn(
                    "rounded-xl border bg-slate-900/50 px-6 py-5 transition-colors",
                    isSearchMatch ? "border-amber-500/40 ring-1 ring-amber-500/20" : "border-slate-800/50"
                  )}
                >
                  <h3 className="group flex items-center gap-2 text-base font-semibold text-slate-200">
                    {section.sectionNumber && (
                      <span className="text-xs font-mono text-slate-600">{section.sectionNumber}</span>
                    )}
                    {section.title.replace(/^\d+\.\d+\s*/, "")}
                    <button
                      onClick={() => copyLink(section.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-slate-800"
                      title="Copy link"
                    >
                      <Link2 className="h-3 w-3 text-slate-600" />
                    </button>
                  </h3>
                  <div
                    className="report-content mt-3 text-sm leading-[1.8] text-slate-400"
                    dangerouslySetInnerHTML={{ __html: section.content }}
                  />
                </div>
              );
            })}

            {/* ── Visualization Gallery ─────────────────────────────── */}
            <div id="viz-gallery" className="rounded-xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="mb-4 text-lg font-bold text-white">Visualizations</h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {[
                  { file: "eda_distributions.png", title: "EDA: WACMR & Repo Rate Distributions" },
                  { file: "target_timeseries.png", title: "WACMR Weekly Time Series" },
                  { file: "silhouette_scores.png", title: "K-Means Silhouette Scores" },
                  { file: "pca_regime_scatter.png", title: "PCA Regime Scatter (K=2)" },
                  { file: "regime_timeseries.png", title: "Regime-Shaded Rate Timeline" },
                  { file: "shap_summary.png", title: "SHAP Feature Importance (Top 15)" },
                  { file: "actual_vs_predicted.png", title: "Actual vs Predicted WACMR" },
                  { file: "shap_by_regime.png", title: "Regime-Specific SHAP Analysis" },
                  { file: "residual_calendar.png", title: "Residual & Calendar Effects" },
                  { file: "regime_wacmr_boxplot.png", title: "WACMR Distribution by Regime" },
                  { file: "news_sentiment_timeline.png", title: "News Sentiment vs WACMR" },
                  { file: "event_density_heatmap.png", title: "Event Density Heatmap" },
                ].map((img) => (
                  <figure key={img.file} className="group overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
                    <div className="bg-slate-900 px-3 py-2">
                      <figcaption className="text-xs font-medium text-slate-400">{img.title}</figcaption>
                    </div>
                    <img
                      src={`/visualizations/${img.file}`}
                      alt={img.title}
                      className="w-full transition-transform duration-300 group-hover:scale-[1.02]"
                      loading="lazy"
                    />
                  </figure>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Back to Top FAB */}
      {showBackToTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-6 right-6 z-40 flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition hover:bg-blue-500 print:hidden"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      )}

      {/* ── Inline Styles for Report Content ────────────────────────── */}
      <style jsx global>{`
        .report-content p {
          margin-bottom: 0.5rem;
        }
        .report-content li {
          margin-left: 1.5rem;
          list-style-type: disc;
          margin-bottom: 0.25rem;
          color: #cbd5e1;
        }
        .report-table {
          overflow-x: auto;
          margin: 1rem 0;
          border-radius: 0.5rem;
          border: 1px solid #1e293b;
          background: #0f172a;
        }
        .report-table pre {
          padding: 1rem;
          font-size: 0.7rem;
          line-height: 1.5;
          color: #94a3b8;
          white-space: pre;
          font-family: ui-monospace, monospace;
        }
        .callout {
          border-left: 3px solid;
          padding: 0.75rem 1rem;
          margin: 0.75rem 0;
          border-radius: 0 0.5rem 0.5rem 0;
          font-size: 0.8125rem;
          line-height: 1.6;
        }
        .callout-finding {
          border-color: #3b82f6;
          background: rgba(59, 130, 246, 0.08);
          color: #93c5fd;
        }
        .callout-result {
          border-color: #a855f7;
          background: rgba(168, 85, 247, 0.08);
          color: #c4b5fd;
        }
        .callout-hypothesis {
          border-color: #f59e0b;
          background: rgba(245, 158, 11, 0.08);
          color: #fcd34d;
        }
        .star-line .star {
          color: #fbbf24;
          font-size: 1em;
        }
        .star-line {
          background: rgba(251, 191, 36, 0.05);
          border-radius: 0.25rem;
          padding: 0.25rem 0.5rem;
        }
        .metric-line {
          font-family: ui-monospace, monospace;
          font-size: 0.75rem;
          color: #94a3b8;
          padding: 0.125rem 0;
        }
        .scrollbar-thin::-webkit-scrollbar {
          width: 4px;
        }
        .scrollbar-thin::-webkit-scrollbar-track {
          background: transparent;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb {
          background: #334155;
          border-radius: 2px;
        }
        @media print {
          .report-content { color: #1e293b !important; }
          .callout { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
}
