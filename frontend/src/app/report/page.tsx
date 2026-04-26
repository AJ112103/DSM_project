"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  BookOpen,
  ArrowUp,
  Printer,
  Loader2,
  Info,
  Lightbulb,
  CheckCircle2,
  HelpCircle,
  ImageIcon,
} from "lucide-react";

import { fetchAPI } from "@/lib/api";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────────────────────

type Block =
  | { kind: "p"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "callout"; tone: "finding" | "result" | "hypothesis" | "info"; text: string }
  | { kind: "metric"; label: string; value: string }
  | { kind: "table"; raw: string }
  | { kind: "code"; raw: string };

interface Figure {
  src: string;
  caption: string;
  alt: string;
}

interface Subsection {
  id: string;
  number?: string;
  title: string;
  blocks: Block[];
  figures: Figure[];
}

interface Section {
  id: string;
  number?: string;
  title: string;
  intro: Block[];
  introFigures: Figure[];
  subsections: Subsection[];
}

interface ParsedReport {
  title: string;
  subtitle?: string;
  meta: Record<string, string>;
  sections: Section[];
  raw: string;
}

// ─── Figure catalog ─────────────────────────────────────────────────────────
// Maps section number → figures. Figures are served by FastAPI at
// /visualizations/*.png and proxied through Next.js (see next.config.ts).

const FIGURES_BY_KEY: Record<string, Figure[]> = {
  // Section 0 — Problem statement & initial data exploration
  "0.7": [
    {
      src: "/visualizations/target_timeseries.png",
      alt: "WACMR weekly time series, Feb 2014 – Jul 2024",
      caption:
        "WACMR across 545 weeks. The sharp regime shift around March 2020 is visible to the eye — the first empirical clue motivating a regime-aware model.",
    },
    {
      src: "/visualizations/eda_distributions.png",
      alt: "Distribution of WACMR and key rate-corridor features",
      caption:
        "Distributions of WACMR and the RBI rate-corridor features. WACMR is visibly bimodal, echoing the pre- vs post-COVID regime split.",
    },
  ],

  // Section 3 — Dataset characterisation
  "3.3": [
    {
      src: "/visualizations/target_timeseries.png",
      alt: "WACMR target variable",
      caption:
        "The forecasting target: weekly WACMR from February 2014 to July 2024 (545 weeks).",
    },
  ],
  "3.4": [
    {
      src: "/visualizations/eda_distributions.png",
      alt: "Feature distributions",
      caption:
        "Distributions of the most-used features after the 75% density filter (91 survivors from 109 raw NDAP columns).",
    },
  ],

  // Section 4 — Modelling approach
  "4.1": [
    {
      src: "/visualizations/silhouette_scores.png",
      alt: "Silhouette scores for K = 2 through K = 7",
      caption:
        "Silhouette scores across K ∈ {2,…,7}. K = 2 maximises cohesion (0.464), corroborating the two-regime hypothesis suggested by WACMR's bimodal distribution.",
    },
    {
      src: "/visualizations/pca_regime_scatter.png",
      alt: "PCA scatter plot coloured by K-Means regime label",
      caption:
        "Weeks projected onto the first two principal components and coloured by K-Means label. Clusters are cleanly separable, with the boundary aligned to March 2020.",
    },
  ],
  "4.2": [
    {
      src: "/visualizations/regime_timeseries.png",
      alt: "Time series of WACMR with regime shading",
      caption:
        "WACMR with regimes overlaid. Regime 1 (pre-COVID tightening, green) dominates 2014–2020; Regime 0 (post-COVID accommodation, amber) takes over from March 2020.",
    },
    {
      src: "/visualizations/regime_wacmr_boxplot.png",
      alt: "WACMR distribution by regime",
      caption:
        "Regime-wise WACMR distribution. Means differ by roughly 150 basis points (6.62% vs 5.12%), and variance structure differs too.",
    },
  ],

  // Section 5 — Results
  "5.1": [
    {
      src: "/visualizations/actual_vs_predicted.png",
      alt: "Actual vs predicted WACMR across the walk-forward test horizon",
      caption:
        "Walk-forward predictions against actual WACMR across 389 one-week-ahead folds. RMSE = 0.1019; Directional Accuracy = 70.9%.",
    },
  ],
  "5.2": [
    {
      src: "/visualizations/shap_summary.png",
      alt: "SHAP summary plot showing top features by mean absolute SHAP value",
      caption:
        "SHAP summary. The top 5 features are all rate-corridor variables. None of the 28 equity/forex features make the top 15 — WACMR is LAF-corridor-bound.",
    },
  ],
  "5.3": [
    {
      src: "/visualizations/shap_by_regime.png",
      alt: "SHAP feature importance split by regime",
      caption:
        "Feature importance by regime. The WACMR-Repo spread (engineered) is more decisive in Regime 0, where persistent surplus liquidity dragged WACMR below the Repo Rate.",
    },
  ],
  "5.4": [
    {
      src: "/visualizations/residual_calendar.png",
      alt: "Residuals by week-of-year and month-of-year",
      caption:
        "Residual heatmaps by calendar position. No clear seasonality survives — the calendar-effect hypothesis is rejected.",
    },
  ],
};

function figuresForSection(number?: string): Figure[] {
  if (!number) return [];
  return FIGURES_BY_KEY[number] || [];
}

// ─── Parser ─────────────────────────────────────────────────────────────────

const SEP_EQUALS = /^[═=]{5,}$/;
const SEP_DASHES = /^[─-]{40,}$/;
const SUBSECTION = /^──\s+(.+?)\s*─{2,}?\s*$/;
const MAJOR_NUM = /^\s*(\d+)\.\s+(.+?)(?:\s*\(.*\))?\s*$/;
const SUB_NUM = /^(\d+\.\d+)\s+(.+?)$/;
const METRIC_LINE = /^\s{2,}([A-Za-z][A-Za-z0-9 ./\-_]+?)\s*[:=]\s+([^\s].*)$/;
// Column-aligned file/description pairs, e.g.:
//   "    stage1_fetch_api_ndap.py          Data collection from NDAP API"
// Indented 4+ spaces, then a word, then 3+ spaces of alignment padding,
// then more text. Used to render section-7 file listings as code blocks.
const TABULAR_LINE = /^\s{4,}\S+\s{3,}\S/;
const BULLET = /^\s*[•▸]\s+(.+)$/;
const LETTERED = /^\s*\(([a-z])\)\s+(.+)$/;
const NUMBERED = /^\s+\d+\.\s+(.+)$/;
const CHECKIN = /^\[CHECK-IN/i;

const SMALL_WORDS = new Set([
  "a", "an", "and", "as", "at", "but", "by", "for", "in", "of", "on", "or",
  "the", "to", "via", "with", "vs",
]);

const ACRONYMS = new Set([
  "RBI", "NDAP", "WACMR", "SHAP", "PCA", "CRR", "SLR", "CPI", "MSF", "OMO",
  "USD", "INR", "CBLO", "TREPS", "MIBOR", "MPC", "ETF", "FX", "GDP", "NPA",
  "REER", "NEER", "CPR", "LAF", "MSS", "NSSF", "SDR", "NABARD", "CP", "CD",
  "IIP", "IDE", "API", "SQL", "ML", "AI", "UI", "UX", "OHLCV", "XGBoost",
]);

function smartTitleCase(text: string): string {
  const words = text.split(/(\s+|[—–/,:()]+)/);
  return words
    .map((w, i) => {
      if (!/[A-Za-z]/.test(w)) return w;
      const bare = w.replace(/[^A-Za-z]/g, "");
      if (bare.length < 2) return w;
      const upperBare = bare.toUpperCase();
      if (ACRONYMS.has(upperBare)) return w.replace(bare, upperBare);
      if (bare === upperBare) {
        const low = w.toLowerCase();
        if (i > 0 && SMALL_WORDS.has(low)) return low;
        return low.replace(/[a-z]/, (c) => c.toUpperCase());
      }
      return w;
    })
    .join("");
}

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);
}

function parseReport(raw: string): ParsedReport {
  const out: ParsedReport = {
    title: "Full research report",
    meta: {},
    sections: [],
    raw,
  };
  if (!raw) return out;

  const lines = raw.split("\n");

  // Pass 1 — header/meta
  let i = 0;
  let lastKey: string | null = null;
  while (i < lines.length) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (SEP_EQUALS.test(trimmed)) {
      const next = lines[i + 1]?.trim() || "";
      if (/^\d+\.\s/.test(next)) break;
      i++; lastKey = null; continue;
    }

    if (!trimmed) { lastKey = null; i++; continue; }

    if (/^DSM PROJECT/i.test(trimmed)) {
      out.title = smartTitleCase(
        trimmed.replace(/^DSM PROJECT\s*[—\-]\s*/i, "")
      );
      lastKey = null;
      i++; continue;
    }

    const m = trimmed.match(/^([A-Za-z][A-Za-z0-9 /]*?)\s*:\s+(.+)$/);
    if (m && !/^\d/.test(m[1])) {
      lastKey = m[1].trim();
      out.meta[lastKey] = m[2].trim();
    } else if (lastKey && /^\s+/.test(rawLine)) {
      out.meta[lastKey] = `${out.meta[lastKey]} ${trimmed}`;
    } else if (!out.subtitle && trimmed.length > 10 && !/^[─-]+$/.test(trimmed)) {
      out.subtitle = trimmed;
      lastKey = null;
    }
    i++;
  }

  // Pass 2 — section body
  let currentSection: Section | null = null;
  let currentSub: Subsection | null = null;
  const startNewSection = (title: string, number?: string) => {
    currentSub = null;
    currentSection = {
      id: slug(number ? `${number}-${title}` : title),
      number,
      title,
      intro: [],
      introFigures: [],
      subsections: [],
    };
    out.sections.push(currentSection);
  };
  const startNewSubsection = (title: string, number?: string) => {
    if (!currentSection) startNewSection("Overview");
    currentSub = {
      id: slug(number ? `${number}-${title}` : title),
      number,
      title,
      blocks: [],
      figures: number ? figuresForSection(number) : [],
    };
    currentSection!.subsections.push(currentSub);
  };
  const blocksTarget = (): Block[] => {
    if (!currentSection) startNewSection("Overview");
    if (currentSub) return currentSub.blocks;
    return currentSection!.intro;
  };

  let listBuf: string[] = [];
  let listKind: "ul" | "ol" | null = null;
  const flushList = () => {
    if (listBuf.length && listKind) {
      blocksTarget().push({ kind: listKind, items: listBuf.slice() });
    }
    listBuf = [];
    listKind = null;
  };

  let tableBuf: string[] = [];
  const flushTable = () => {
    if (tableBuf.length) {
      blocksTarget().push({ kind: "table", raw: tableBuf.join("\n") });
    }
    tableBuf = [];
  };

  let codeBuf: string[] = [];
  const flushCode = () => {
    if (codeBuf.length) {
      blocksTarget().push({ kind: "code", raw: codeBuf.join("\n") });
    }
    codeBuf = [];
  };

  // Coalesce consecutive prose lines into a single paragraph block. The
  // source report wraps hard at ~68 cols, so each "line" is a visual line,
  // not a semantic paragraph. We join runs of prose lines (broken only by
  // blank lines or structural blocks) into single <p> elements.
  let paraBuf: string[] = [];
  const flushPara = () => {
    if (paraBuf.length) {
      const joined = paraBuf.join(" ").replace(/\s+/g, " ").trim();
      if (joined) blocksTarget().push({ kind: "p", text: joined });
      paraBuf = [];
    }
  };
  const flushAll = () => {
    flushPara();
    flushList();
    flushTable();
    flushCode();
  };

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trimEnd();
    const trimmed = line.trim();

    if (SEP_EQUALS.test(trimmed) || SEP_DASHES.test(trimmed)) {
      flushPara();
      i++; continue;
    }

    // Detect subsection BEFORE the table check — subsection markers contain
    // horizontal box-drawing characters (─) but aren't actually tables.
    const earlySubMatch = trimmed.match(SUBSECTION);

    // A real box-drawing table contains vertical/corner characters, not just
    // horizontal ones. Narrowing the regex here prevents subsection markers
    // (which contain only ─) from being mis-classified as tables.
    if (!earlySubMatch && /[┌┐┤├└┘│┼]/.test(trimmed)) {
      flushPara(); flushList();
      tableBuf.push(line);
      i++; continue;
    } else if (tableBuf.length) {
      flushTable();
    }

    const prevSep = i > 0 && SEP_EQUALS.test(lines[i - 1].trim());
    const nextSep = i + 1 < lines.length && SEP_EQUALS.test(lines[i + 1].trim());
    if (prevSep && nextSep && trimmed.length > 0) {
      flushAll();
      const m = trimmed.match(MAJOR_NUM);
      if (m) startNewSection(smartTitleCase(m[2].trim()), m[1]);
      else startNewSection(smartTitleCase(trimmed));
      const sec = out.sections[out.sections.length - 1];
      if (sec && m) sec.introFigures = figuresForSection(m[1]);
      i++; continue;
    }
    if (prevSep && !nextSep && trimmed.length > 0 && /^\d+\.\s/.test(trimmed)) {
      flushAll();
      const m = trimmed.match(MAJOR_NUM);
      if (m) startNewSection(smartTitleCase(m[2].trim()), m[1]);
      else startNewSection(smartTitleCase(trimmed));
      const sec = out.sections[out.sections.length - 1];
      let j = i + 1;
      while (j < lines.length && /^\s+\S/.test(lines[j]) && lines[j].trim().length) {
        if (sec) sec.title += " " + smartTitleCase(lines[j].trim());
        j++;
      }
      if (sec && m) sec.introFigures = figuresForSection(m[1]);
      i = j; continue;
    }

    const subMatch = trimmed.match(SUBSECTION);
    if (subMatch) {
      flushAll();
      const innerTitle = subMatch[1].trim();
      const nm = innerTitle.match(SUB_NUM);
      startNewSubsection(
        smartTitleCase(nm ? nm[2] : innerTitle),
        nm ? nm[1] : undefined
      );
      i++; continue;
    }

    if (CHECKIN.test(trimmed)) {
      flushAll();
      blocksTarget().push({ kind: "callout", tone: "info", text: trimmed });
      i++; continue;
    }

    if (/^Key Finding\b/i.test(trimmed) || /^Mechanistic Finding\b/i.test(trimmed)) {
      flushAll();
      blocksTarget().push({ kind: "callout", tone: "finding", text: trimmed });
      i++; continue;
    }
    if (/^RESULT\b/i.test(trimmed)) {
      flushAll();
      blocksTarget().push({ kind: "callout", tone: "result", text: trimmed });
      i++; continue;
    }
    if (/^Hypothesis\b/i.test(trimmed)) {
      flushAll();
      blocksTarget().push({ kind: "callout", tone: "hypothesis", text: trimmed });
      i++; continue;
    }

    const b = trimmed.match(BULLET);
    if (b) {
      flushPara();
      if (listKind && listKind !== "ul") flushList();
      listKind = "ul";
      listBuf.push(b[1]);
      i++; continue;
    }
    const lm = trimmed.match(LETTERED);
    if (lm) {
      flushPara();
      if (listKind && listKind !== "ol") flushList();
      listKind = "ol";
      listBuf.push(`(${lm[1]}) ${lm[2]}`);
      i++; continue;
    }
    const nm = raw.match(NUMBERED);
    if (nm) {
      flushPara();
      if (listKind && listKind !== "ol") flushList();
      listKind = "ol";
      listBuf.push(nm[1]);
      i++; continue;
    }

    // Blank line: end any open paragraph, but keep the list open so that
    // items separated by blank lines still form a single <ol>/<ul>.
    if (!trimmed) {
      flushPara();
      i++; continue;
    }

    // Continuation of the previous list item: indented, non-empty, not a
    // new bullet/number, and not at column 0. Append to the last item.
    if (listKind && listBuf.length && /^\s+/.test(raw)) {
      listBuf[listBuf.length - 1] = listBuf[listBuf.length - 1] + " " + trimmed;
      i++; continue;
    }

    // A non-indented / clearly new prose line while a list is open ends it.
    if (listKind) flushList();

    // Column-aligned tabular listings render as code blocks.
    if (TABULAR_LINE.test(line)) {
      flushPara();
      codeBuf.push(line);
      i++; continue;
    } else if (codeBuf.length) {
      flushCode();
    }

    const mm = line.match(METRIC_LINE);
    // Guard against prose sentences with embedded colons being mis-parsed as
    // metric rows. A real metric label is short, doesn't contain sentence
    // terminators, and the value isn't a full sentence either.
    const looksLikeMetric =
      mm &&
      mm[1].length <= 32 &&
      !/\.\s/.test(mm[1]) &&
      mm[2].length < 80 &&
      !/\.\s+[A-Z]/.test(mm[2]);
    if (looksLikeMetric) {
      flushPara();
      blocksTarget().push({ kind: "metric", label: mm![1].trim(), value: mm![2].trim() });
      i++; continue;
    }

    // Regular prose line — accumulate into the current paragraph buffer.
    paraBuf.push(trimmed);
    i++;
  }

  flushAll();
  return out;
}

// ─── Reading time ───────────────────────────────────────────────────────────

function estimateReadingTime(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
}

// ─── Figure renderer ────────────────────────────────────────────────────────

function FigureBlock({
  figure,
  number,
}: {
  figure: Figure;
  number: number;
}) {
  return (
    <figure className="my-10 print:break-inside-avoid">
      <div className="overflow-hidden rounded-2xl border border-slate-800/80 bg-white shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset,0_20px_40px_-20px_rgba(0,0,0,0.6)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={figure.src}
          alt={figure.alt}
          loading="lazy"
          className="block h-auto w-full"
        />
      </div>
      <figcaption className="mt-4 flex items-start gap-3 text-[13px] leading-relaxed text-slate-400">
        <span className="mt-0.5 inline-flex shrink-0 items-center gap-1.5 rounded-md border border-slate-800 bg-slate-900/60 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-slate-400">
          <ImageIcon className="h-3 w-3 text-slate-500" />
          Figure {number}
        </span>
        <span className="italic text-slate-300">{figure.caption}</span>
      </figcaption>
    </figure>
  );
}

// ─── ASCII box-drawing table parser ─────────────────────────────────────────
// Source report.txt encodes tables with ┌─┐│├┼┤└┴┘ box characters. Rendering
// them inside a <pre> looks broken in Geist Mono because `─` is ~7-8% wider
// than ASCII chars, so the top/bottom borders extend past the column dividers
// (visible as phantom empty columns). We parse the ASCII back into rows so
// they can render as real <table> elements with CSS borders.

interface ParsedTable {
  header: string[];
  rows: string[][];
}

function parseAsciiTable(raw: string): ParsedTable | null {
  const lines = raw
    .split("\n")
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0);

  // Data rows start with `│` (after optional leading whitespace).
  const dataRows = lines
    .filter((l) => /^\s*│/.test(l))
    .map((l) =>
      l
        .trim()
        .replace(/^│|│$/g, "")
        .split("│")
        .map((c) => c.trim())
    );

  if (dataRows.length < 2) return null;

  const colCount = dataRows[0].length;
  // All rows must have the same column count to be a clean table.
  if (!dataRows.every((r) => r.length === colCount)) return null;

  const [header, ...rows] = dataRows;
  // Drop the alignment row if any (sometimes empty strings).
  const cleanRows = rows.filter((r) => r.some((c) => c.length > 0));

  return { header, rows: cleanRows };
}

// ─── Block renderers ────────────────────────────────────────────────────────

function BlockRender({ block }: { block: Block }) {
  if (block.kind === "p") {
    return (
      <p className="text-[17px] leading-[1.75] text-slate-300 [overflow-wrap:anywhere]">
        {block.text}
      </p>
    );
  }
  if (block.kind === "ul") {
    return (
      <ul className="ml-5 list-disc space-y-2 text-[17px] leading-[1.75] text-slate-300 marker:text-slate-600">
        {block.items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    );
  }
  if (block.kind === "ol") {
    return (
      <ol className="ml-5 list-decimal space-y-2 text-[17px] leading-[1.75] text-slate-300 marker:text-slate-500">
        {block.items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ol>
    );
  }
  if (block.kind === "metric") {
    return (
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-sm tabular-nums">
        <span className="min-w-0 break-words text-slate-500">{block.label}</span>
        <span className="hidden h-px min-w-[2rem] flex-1 self-center border-t border-dashed border-slate-800 sm:block" />
        <span className="min-w-0 break-words text-slate-200 [overflow-wrap:anywhere]">
          {block.value}
        </span>
      </div>
    );
  }
  if (block.kind === "table") {
    const parsed = parseAsciiTable(block.raw);
    if (parsed) {
      return (
        <div className="my-6 overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40 print:break-inside-avoid">
          <table className="w-full border-collapse text-[13.5px] tabular-nums">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/60">
                {parsed.header.map((h, i) => (
                  <th
                    key={i}
                    className="px-4 py-2.5 text-left font-medium text-slate-200"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {parsed.rows.map((row, r) => (
                <tr
                  key={r}
                  className="border-b border-slate-800/60 last:border-b-0"
                >
                  {row.map((cell, c) => (
                    <td key={c} className="px-4 py-2.5 text-slate-300">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    // Fallback: keep the raw box-drawing if the parser bailed.
    return (
      <div className="my-5 overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60 p-3 print:break-inside-avoid">
        <pre className="whitespace-pre font-mono text-[11.5px] leading-tight text-slate-300">
          {block.raw}
        </pre>
      </div>
    );
  }
  if (block.kind === "code") {
    return (
      <pre className="my-5 overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-[12.5px] leading-relaxed text-slate-300">
        {block.raw}
      </pre>
    );
  }
  if (block.kind === "callout") {
    const config = {
      finding: {
        Icon: Lightbulb,
        border: "border-emerald-500/30",
        bg: "bg-emerald-500/[0.07]",
        text: "text-emerald-200",
        label: "Finding",
        labelColor: "text-emerald-400/90",
      },
      result: {
        Icon: CheckCircle2,
        border: "border-cyan-500/30",
        bg: "bg-cyan-500/[0.07]",
        text: "text-cyan-100",
        label: "Result",
        labelColor: "text-cyan-400/90",
      },
      hypothesis: {
        Icon: HelpCircle,
        border: "border-amber-500/30",
        bg: "bg-amber-500/[0.07]",
        text: "text-amber-100",
        label: "Hypothesis",
        labelColor: "text-amber-400/90",
      },
      info: {
        Icon: Info,
        border: "border-slate-700/50",
        bg: "bg-slate-800/40",
        text: "text-slate-200",
        label: "Note",
        labelColor: "text-slate-400",
      },
    }[block.tone];
    const Icon = config.Icon;
    return (
      <aside
        className={cn(
          "my-5 flex items-start gap-4 rounded-2xl border p-5 print:break-inside-avoid",
          config.border,
          config.bg
        )}
      >
        <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", config.labelColor)} />
        <div className="flex-1 space-y-1">
          <div
            className={cn(
              "font-mono text-[10px] uppercase tracking-[0.18em]",
              config.labelColor
            )}
          >
            {config.label}
          </div>
          <div className={cn("text-[15px] leading-[1.7]", config.text)}>
            {block.text}
          </div>
        </div>
      </aside>
    );
  }
  return null;
}

function BlockGroup({ blocks }: { blocks: Block[] }) {
  const groups: Array<
    { kind: "metric-group"; items: { label: string; value: string }[] } | Block
  > = [];
  let buf: { label: string; value: string }[] = [];
  for (const b of blocks) {
    if (b.kind === "metric") {
      buf.push({ label: b.label, value: b.value });
    } else {
      if (buf.length) {
        groups.push({ kind: "metric-group", items: buf });
        buf = [];
      }
      groups.push(b);
    }
  }
  if (buf.length) groups.push({ kind: "metric-group", items: buf });

  return (
    <div className="space-y-5">
      {groups.map((g, i) =>
        "kind" in g && g.kind === "metric-group" ? (
          <div
            key={i}
            className="space-y-2 rounded-2xl border border-slate-800 bg-slate-900/40 px-5 py-4"
          >
            {g.items.map((m, j) => (
              <div
                key={j}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-sm tabular-nums"
              >
                <span className="min-w-0 break-words text-slate-400">{m.label}</span>
                <span className="hidden h-px min-w-[2rem] flex-1 self-center border-t border-dashed border-slate-800 sm:block" />
                <span className="min-w-0 break-words text-slate-100 [overflow-wrap:anywhere]">
                  {m.value}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <BlockRender key={i} block={g as Block} />
        )
      )}
    </div>
  );
}

// ─── Sticky TOC ─────────────────────────────────────────────────────────────

function TableOfContents({
  sections,
  activeId,
}: {
  sections: Section[];
  activeId: string;
}) {
  return (
    <nav aria-label="Table of contents" className="text-sm">
      <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.22em] text-slate-500">
        On this page
      </div>
      <ol className="space-y-1">
        {sections.map((s) => {
          const isActive =
            activeId === s.id ||
            s.subsections.some((sub) => sub.id === activeId);
          return (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className={cn(
                  "flex items-baseline gap-2 rounded py-1 pr-2 text-[13px] leading-snug transition-colors",
                  isActive
                    ? "text-cyan-300"
                    : "text-slate-400 hover:text-slate-200"
                )}
              >
                {s.number && (
                  <span
                    className={cn(
                      "w-6 shrink-0 font-mono text-[10px]",
                      isActive ? "text-cyan-400/80" : "text-slate-600"
                    )}
                  >
                    {s.number}
                  </span>
                )}
                <span className="flex-1">{s.title}</span>
              </a>
              {s.subsections.length > 0 && isActive && (
                <ol className="mt-1 ml-6 space-y-0.5 border-l border-slate-800 pl-3">
                  {s.subsections.map((sub) => (
                    <li key={sub.id}>
                      <a
                        href={`#${sub.id}`}
                        className={cn(
                          "block rounded py-1 text-[12px] leading-snug transition-colors hover:text-slate-300",
                          activeId === sub.id
                            ? "text-cyan-300"
                            : "text-slate-500"
                        )}
                      >
                        {sub.number && (
                          <span
                            className={cn(
                              "mr-1.5 font-mono text-[10px]",
                              activeId === sub.id
                                ? "text-cyan-400/70"
                                : "text-slate-600"
                            )}
                          >
                            {sub.number}
                          </span>
                        )}
                        {sub.title}
                      </a>
                    </li>
                  ))}
                </ol>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// ─── Hero stats ribbon ──────────────────────────────────────────────────────

const HEADLINE_STATS: { label: string; value: string; sub?: string }[] = [
  { label: "Weeks", value: "545", sub: "2014 – 2024" },
  { label: "Features", value: "119", sub: "5 domains" },
  { label: "Regimes", value: "2", sub: "silhouette 0.46" },
  { label: "RMSE", value: "0.1019", sub: "one week ahead" },
  { label: "DA", value: "70.9%", sub: "directional acc." },
];

function HeroStats() {
  return (
    <dl className="grid grid-cols-2 divide-slate-800 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40 sm:grid-cols-5 sm:divide-x">
      {HEADLINE_STATS.map((s, i) => (
        <div
          key={s.label}
          className={cn(
            "px-4 py-3 sm:py-4",
            i < HEADLINE_STATS.length - 1 &&
              "border-b border-slate-800 sm:border-b-0",
            // remove right border on mobile last items handled by divide-x being sm+
          )}
        >
          <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
            {s.label}
          </dt>
          <dd className="mt-1 font-mono text-xl tabular-nums text-white">
            {s.value}
          </dd>
          {s.sub && (
            <dd className="mt-0.5 text-[11px] text-slate-500">{s.sub}</dd>
          )}
        </div>
      ))}
    </dl>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function ReportPage() {
  const [activeId, setActiveId] = useState("");
  const [progress, setProgress] = useState(0);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const articleRef = useRef<HTMLElement>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["report-content"],
    queryFn: () => fetchAPI("/api/report"),
  });

  const raw = data?.content || "";
  const parsed = useMemo(() => parseReport(raw), [raw]);
  const readingTime = useMemo(() => estimateReadingTime(raw), [raw]);
  const wordCount = useMemo(
    () => raw.split(/\s+/).filter(Boolean).length,
    [raw]
  );

  // Assign monotonically-increasing figure numbers in document order so
  // every Figure N caption matches the document flow.
  const figureNumbers = useMemo(() => {
    const map = new Map<string, number>();
    let n = 1;
    for (const section of parsed.sections) {
      for (const fig of section.introFigures) {
        map.set(fig.src + "@" + section.id, n++);
      }
      for (const sub of section.subsections) {
        for (const fig of sub.figures) {
          map.set(fig.src + "@" + sub.id, n++);
        }
      }
    }
    return map;
  }, [parsed]);

  const totalFigures = figureNumbers.size;

  const allIds = useMemo(
    () =>
      parsed.sections.flatMap((s) => [
        s.id,
        ...s.subsections.map((sub) => sub.id),
      ]),
    [parsed]
  );

  useEffect(() => {
    if (!allIds.length) return;
    const elements = allIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => !!el);
    if (!elements.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const inView = entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top
          );
        if (inView[0]) setActiveId(inView[0].target.id);
      },
      { rootMargin: "-15% 0px -70% 0px", threshold: 0 }
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [allIds]);

  useEffect(() => {
    const onScroll = () => {
      const scrollTop = window.scrollY;
      const scrollHeight =
        document.documentElement.scrollHeight - window.innerHeight;
      setProgress(scrollHeight > 0 ? scrollTop / scrollHeight : 0);
      setShowBackToTop(scrollTop > 600);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (isLoading) {
    return (
      <div className="mx-auto flex max-w-5xl items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
      </div>
    );
  }

  if (error || !raw) {
    return (
      <div className="mx-auto max-w-2xl py-24">
        <div className="flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/5 p-5 text-sm text-rose-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-semibold">Report unavailable.</div>
            <div className="mt-1 text-rose-400/80">
              Run <code>python3 stage5_synthesis.py</code> to generate the
              report artifact, then refresh this page.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      {/* Reading-progress bar */}
      <div
        className="fixed left-0 right-0 top-0 z-20 h-0.5 bg-cyan-400/80 transition-[width] print:hidden"
        style={{ width: `${progress * 100}%` }}
        aria-hidden
      />

      {/* Hero */}
      <header className="space-y-7 border-b border-slate-800 pb-12">
        <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.25em] text-cyan-400">
          <BookOpen className="h-3.5 w-3.5" />
          {parsed.title || "Full research report"}
        </div>
        <h1
          className="text-balance text-4xl leading-[1.02] tracking-tight text-white sm:text-5xl lg:text-[64px]"
          style={{ fontFamily: "var(--font-instrument-serif)" }}
        >
          {parsed.meta.Project ||
            "Predicting India's Weighted Average Call Money Rate via monetary regime clustering & XGBoost"}
        </h1>
        {parsed.subtitle && !parsed.meta.Project && (
          <p className="max-w-3xl text-lg leading-relaxed text-slate-400">
            {parsed.subtitle}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500">
          <span>{readingTime} min read</span>
          <span className="text-slate-700">·</span>
          <span>{wordCount.toLocaleString()} words</span>
          <span className="text-slate-700">·</span>
          <span>{parsed.sections.length} sections</span>
          {totalFigures > 0 && (
            <>
              <span className="text-slate-700">·</span>
              <span>{totalFigures} figures</span>
            </>
          )}
          {parsed.meta.Generated && (
            <>
              <span className="text-slate-700">·</span>
              <span>Generated {parsed.meta.Generated}</span>
            </>
          )}
          <button
            onClick={() => window.print()}
            className="ml-auto hidden items-center gap-1.5 rounded-md border border-slate-800 bg-slate-900 px-2.5 py-1 text-[11px] text-slate-400 hover:border-slate-600 hover:text-slate-200 sm:inline-flex print:hidden"
          >
            <Printer className="h-3 w-3" />
            Print
          </button>
        </div>
        <HeroStats />
        {Object.keys(parsed.meta).length > 0 && (
          <dl className="grid gap-x-8 gap-y-2 pt-2 text-[13px] sm:grid-cols-2">
            {Object.entries(parsed.meta)
              .filter(([k]) => k !== "Generated" && k !== "Project")
              .map(([k, v]) => (
                <div key={k} className="flex flex-wrap gap-2">
                  <dt className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                    {k}
                  </dt>
                  <dd className="flex-1 text-slate-300">{v}</dd>
                </div>
              ))}
          </dl>
        )}
      </header>

      {/* 2-column layout */}
      <div className="mt-14 gap-14 lg:grid lg:grid-cols-[minmax(0,1fr)_15rem] lg:items-start">
        <article ref={articleRef} className="min-w-0 print:space-y-16">
          {parsed.sections.map((section, sectionIdx) => (
            <section
              key={section.id}
              id={section.id}
              className={cn(
                "scroll-mt-24",
                sectionIdx > 0 && "mt-24 pt-12 border-t border-slate-800/60"
              )}
            >
              {/* Section heading with outsized numeral */}
              <header className="mb-8 grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-6">
                {section.number !== undefined && (
                  <div
                    className="font-mono text-5xl leading-none text-slate-700 sm:text-6xl lg:text-7xl"
                    aria-hidden
                  >
                    {String(section.number).padStart(2, "0")}
                  </div>
                )}
                <div className={cn(section.number === undefined && "col-span-2")}>
                  <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.22em] text-slate-500">
                    {section.number !== undefined
                      ? `Part ${section.number}`
                      : "Section"}
                  </div>
                  <h2
                    className="text-balance text-3xl leading-[1.1] text-white lg:text-[40px]"
                    style={{
                      fontFamily: "var(--font-instrument-serif)",
                    }}
                  >
                    {section.title}
                  </h2>
                </div>
              </header>

              {/* Section intro content */}
              {section.intro.length > 0 && (
                <div className="max-w-[68ch]">
                  <BlockGroup blocks={section.intro} />
                </div>
              )}

              {/* Section-level figures (attached to the major section heading) */}
              {section.introFigures.map((fig) => (
                <div key={fig.src} className="max-w-[78ch]">
                  <FigureBlock
                    figure={fig}
                    number={
                      figureNumbers.get(fig.src + "@" + section.id) ?? 0
                    }
                  />
                </div>
              ))}

              {/* Subsections */}
              {section.subsections.map((sub, subIdx) => (
                <section
                  key={sub.id}
                  id={sub.id}
                  className={cn(
                    "scroll-mt-24 pt-10",
                    subIdx === 0 ? "mt-2" : "mt-4"
                  )}
                >
                  <header className="mb-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    {sub.number && (
                      <span className="shrink-0 font-mono text-[11px] tracking-wider text-slate-500">
                        §{sub.number}
                      </span>
                    )}
                    <h3 className="min-w-0 break-words text-[22px] font-semibold tracking-tight text-white [overflow-wrap:anywhere]">
                      {sub.title}
                    </h3>
                  </header>
                  <div className="max-w-[68ch]">
                    <BlockGroup blocks={sub.blocks} />
                  </div>
                  {sub.figures.map((fig) => (
                    <div key={fig.src} className="max-w-[78ch]">
                      <FigureBlock
                        figure={fig}
                        number={
                          figureNumbers.get(fig.src + "@" + sub.id) ?? 0
                        }
                      />
                    </div>
                  ))}
                </section>
              ))}
            </section>
          ))}
          <footer className="mt-24 border-t border-slate-800 pt-8 text-xs text-slate-500">
            End of report. Generated by <code>stage5_synthesis.py</code>.
            {totalFigures > 0 && (
              <>
                {" "}· {totalFigures} figures embedded from the pipeline
                artefacts.
              </>
            )}
          </footer>
        </article>

        <aside className="hidden lg:sticky lg:top-8 lg:block lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto print:hidden">
          <TableOfContents sections={parsed.sections} activeId={activeId} />
        </aside>
      </div>

      {/* Back-to-top */}
      {showBackToTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-24 right-6 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 bg-slate-900/90 text-slate-200 shadow-lg backdrop-blur hover:border-slate-600 print:hidden"
          aria-label="Back to top"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
