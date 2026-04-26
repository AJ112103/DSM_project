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
  | { kind: "coltable"; header: string[]; rows: string[][] }
  | { kind: "kvtable"; items: { key: string; value: string; badge?: string }[] }
  | { kind: "minihead"; text: string }
  | { kind: "labelparagraph"; label: string; body: string[]; badge?: string }
  | { kind: "cardOpen"; title: string; subtitle?: string }
  | { kind: "cardClose" }
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
const METRIC_LINE = /^\s{2,}([A-Za-z][A-Za-z0-9 ./\-_()=]+?)\s*[:=]\s+([^\s].*)$/;
// Labels that introduce a multi-line prose block (Evidence, Action, Problem,
// Solution, etc.). When matched, the entire labelled block — header line +
// every continuation line at the same or deeper indent — is wrapped into a
// single bordered card so the body can't visually leak out.
const LABELED_PROSE_LABELS = [
  "Evidence",
  "Action",
  "Problem",
  "Solution",
  "Fix",
  "Note",
  "Rationale",
  "Caveat",
];
const LABELED_PROSE = new RegExp(
  `^(\\s+)(${LABELED_PROSE_LABELS.join("|")}):\\s+(\\S.*)$`
);
// Hypothesis lines: `  H1 (supported): description …`, `  H4 (new finding): …`
const HYPOTHESIS_LINE = /^(\s+)(H\d+)\s+\(([^)]+)\):\s+(\S.*)$/;
// Objective lines: `  Objective 2 (Supervised): description …`
const OBJECTIVE_LINE = /^(\s+)(Objective\s+\d+)\s+\(([^)]+)\):\s+(\S.*)$/;
// File-section heading: a line that is JUST a labelled heading with a colon
// and nothing after, e.g. `  Stage Scripts:`. Used in §7 to wrap the file
// listings that follow each heading into a card.
const FILE_SECTION_HEAD = /^(\s+)([A-Z][\w &\-/]+):\s*$/;
// Card titles — wrap a run of subsequent blocks in a single bordered card.
const CARD_RECOMMENDATION = /^RECOMMENDATION\s+(\d+)\s+—\s+(.+?):?\s*$/;
const CARD_CHALLENGE = /^\s+Challenge\s+(\d+\.\d+)\s+—\s+(.+)$/;
const CARD_STAGE = /^STAGE\s+(\d+)\s+—\s+(.+)$/;
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

// Sniff a 3+-column header followed by a dash separator and ≥1 data row.
// Returns the parsed table and the next index to resume from.
function sniffColTable(
  lines: string[],
  i: number
): { header: string[]; rows: string[][]; endIdx: number } | null {
  const headerLine = lines[i];
  if (!headerLine) return null;
  // The header must have at least 3 visual fields separated by 3+ spaces.
  // We split by /\s{3,}/ on the trimmed line.
  const headerFields = headerLine.trim().split(/\s{3,}/);
  if (headerFields.length < 2) return null;
  // Reject if any header "field" looks like prose (contains ", " or "." mid-word).
  if (headerFields.some((f) => /\s\w+,\s/.test(f))) return null;

  const sepLine = lines[i + 1];
  if (!sepLine) return null;
  // Separator line: predominantly hyphens or box-drawing dashes.
  // (Some tables use `─` instead of `-` — e.g. §5.2 SHAP feature ranking.)
  if (!/^\s*[-─]{6,}\s*$/.test(sepLine)) return null;

  // Determine column boundaries from the header by recording the start
  // column of each header field in the original (untrimmed) header line.
  const leftPad = headerLine.match(/^\s*/)?.[0].length ?? 0;
  const headerBody = headerLine.slice(leftPad);
  const colStarts: number[] = [];
  let cursor = 0;
  for (const f of headerFields) {
    const idx = headerBody.indexOf(f, cursor);
    colStarts.push(idx + leftPad);
    cursor = idx + f.length;
  }

  // Slice each subsequent line into columns at the recorded column starts,
  // stopping at a blank line or an obviously different structure.
  const rows: string[][] = [];
  let j = i + 2;
  while (j < lines.length) {
    const ln = lines[j];
    if (!ln.trim()) break;
    if (/^\s*-{6,}\s*$/.test(ln)) { j++; break; } // table footer dashes
    if (/^\s*[─=]{4,}/.test(ln)) break; // section separator
    if (/^──/.test(ln.trim())) break; // subsection marker
    if (ln.trim().startsWith("[")) break; // bracketed annotation
    // A `Word : Value` line (METRIC_LINE) signals end-of-table — these
    // belong to a different block kind, not extra table rows.
    if (METRIC_LINE.test(ln)) break;
    // Need enough chars to slice
    const cells: string[] = [];
    for (let c = 0; c < colStarts.length; c++) {
      const start = colStarts[c];
      const end = c + 1 < colStarts.length ? colStarts[c + 1] : ln.length;
      cells.push(ln.slice(start, end).trim());
    }
    // Reject row if all cells empty, or if the first cell is empty (means
    // the line is a continuation of the previous row's last column).
    if (cells.every((s) => !s)) break;
    if (!cells[0]) break;
    // Reject row whose first cell spans >2× the first column width — that's
    // wrap-around prose, not a table row.
    const firstColWidth =
      colStarts.length > 1 ? colStarts[1] - colStarts[0] : Infinity;
    if (cells[0].length > firstColWidth * 2) break;
    rows.push(cells);
    j++;
  }
  if (rows.length === 0) return null;
  return { header: headerFields, rows, endIdx: j };
}

// Sniff a label/value listing. Two patterns are accepted:
//
//   (a) Feature-ID: `  prefix_id   description …`   (e.g. `rates_I7496_5`)
//   (b) Aligned-colon: `  Label (params)  : value`  (e.g. OHLCV indicators)
//
// Both produce a kvtable block of {key, value, badge?} items. We require ≥2
// consecutive lines so prose with one stray colon doesn't get hijacked.
function sniffKvTable(
  lines: string[],
  i: number
): { items: { key: string; value: string; badge?: string }[]; endIdx: number } | null {
  const FEATURE = /^\s+([a-z][A-Za-z0-9_]*[A-Za-z0-9])\s{2,}(\S.*)$/;
  // Aligned-colon: label can include parens, =, commas, ×, etc., as long as
  // it stays on one side of a `:` and is short. Value must be short too so
  // we don't capture a paragraph with one colon.
  const COLON = /^\s+([A-Za-z][^:]{1,40}?)\s*:\s+(\S.{0,90})$/;
  // Arrow-separated, e.g. silhouette scores: `    K=2  →  0.4643  ★ OPTIMAL`
  const ARROW = /^\s+(\S{1,30})\s+→\s+(\S.{0,80})$/;

  const detectKind = (
    line: string | undefined
  ): "feature" | "colon" | "arrow" | null => {
    if (!line) return null;
    if (FEATURE.test(line)) return "feature";
    if (ARROW.test(line)) return "arrow";
    if (COLON.test(line) && !METRIC_LINE.test(line)) {
      // METRIC_LINE matches simpler `Word : Value` rows that already become
      // metric blocks; only consider lines that don't fit METRIC_LINE here.
      return "colon";
    }
    return null;
  };

  const kind = detectKind(lines[i]);
  if (!kind) return null;
  if (detectKind(lines[i + 1]) !== kind) return null;

  const items: { key: string; value: string; badge?: string }[] = [];
  let j = i;
  while (j < lines.length) {
    const ln = lines[j];
    const k = detectKind(ln);
    if (k !== kind) break;
    const m =
      kind === "feature"
        ? ln.match(FEATURE)
        : kind === "arrow"
          ? ln.match(ARROW)
          : ln.match(COLON);
    if (!m) break;
    const key = m[1].trim();
    let value = m[2].trim();
    let badge: string | undefined;
    const badgeMatch = value.match(/(.+?)\s+(★\s*.+)$/);
    if (badgeMatch) {
      value = badgeMatch[1].trim();
      badge = badgeMatch[2].trim();
    }
    items.push({ key, value, badge });
    j++;
  }
  if (items.length < 2) return null;
  return { items, endIdx: j };
}

// Sniff a labelled-prose block: `  Evidence: first sentence …\n  continuation\n  more continuation\n`.
// The whole thing gets bound into one bordered card so the continuation can't
// visually float outside the box.
function sniffLabelParagraph(
  lines: string[],
  i: number
): { label: string; body: string[]; badge?: string; endIdx: number } | null {
  // Try the three label patterns. Each yields (indent, label, body, badge?).
  const line = lines[i];
  if (!line) return null;
  let labelIndent: number;
  let label: string;
  let firstBody: string;
  let badge: string | undefined;

  const hyp = line.match(HYPOTHESIS_LINE);
  const obj = line.match(OBJECTIVE_LINE);
  const std = line.match(LABELED_PROSE);
  if (hyp) {
    labelIndent = hyp[1].length;
    label = hyp[2];
    badge = hyp[3];
    firstBody = hyp[4];
  } else if (obj) {
    labelIndent = obj[1].length;
    label = obj[2];
    badge = obj[3];
    firstBody = obj[4];
  } else if (std) {
    labelIndent = std[1].length;
    label = std[2];
    firstBody = std[3];
  } else {
    return null;
  }
  // Replicate the original `m` shape so the rest of the function works.
  const m = [line, " ".repeat(labelIndent), label, firstBody] as RegExpMatchArray;
  // `body` is a list of paragraphs (split on blank lines), each paragraph a
  // single string. Continuation lines at indent ≥ labelIndent are joined into
  // the current paragraph.
  const paragraphs: string[] = [m[3].trim()];
  let j = i + 1;
  let inBlank = false;
  while (j < lines.length) {
    const ln = lines[j];
    if (!ln.trim()) {
      // A blank line ends the current paragraph but the labelled block can
      // continue across one blank line if the *next* non-blank line is also
      // indented and isn't itself a new label / divider / title.
      inBlank = true;
      const peek = lines[j + 1];
      if (!peek || !peek.trim()) break;
      const peekIndent = peek.match(/^\s*/)?.[0].length ?? 0;
      if (peekIndent < labelIndent) break;
      if (LABELED_PROSE.test(peek) || HYPOTHESIS_LINE.test(peek) || OBJECTIVE_LINE.test(peek)) break;
      if (/^\s*[─=]{4,}/.test(peek)) break;
      if (/^\s*──\s/.test(peek)) break;
      if (CARD_RECOMMENDATION.test(peek.trim())) break;
      if (CARD_CHALLENGE.test(peek)) break;
      if (CARD_STAGE.test(peek.trim())) break;
      paragraphs.push(""); // marker — next line starts a new paragraph
      j++; continue;
    }
    const ind = ln.match(/^\s*/)?.[0].length ?? 0;
    if (ind < labelIndent) break;
    if (LABELED_PROSE.test(ln) || HYPOTHESIS_LINE.test(ln) || OBJECTIVE_LINE.test(ln)) break;
    if (/^\s*[─=]{4,}/.test(ln)) break;
    if (CARD_RECOMMENDATION.test(ln.trim())) break;
    if (CARD_CHALLENGE.test(ln)) break;
    if (CARD_STAGE.test(ln.trim())) break;
    if (inBlank && paragraphs[paragraphs.length - 1] === "") {
      paragraphs[paragraphs.length - 1] = ln.trim();
    } else {
      paragraphs[paragraphs.length - 1] =
        (paragraphs[paragraphs.length - 1] + " " + ln.trim()).trim();
    }
    inBlank = false;
    j++;
  }
  // Drop trailing empty paragraphs left from blank-line markers.
  while (paragraphs.length && !paragraphs[paragraphs.length - 1]) paragraphs.pop();
  return { label, body: paragraphs, badge, endIdx: j };
}

// Sniff a `  Section Name:\n    file  desc\n    file  desc\n…` block. Used
// in §7 (Project File Outputs) and similar places. Returns a heading + a
// list of {key, value} rows so the renderer can wrap the whole thing in a
// card with the heading at top.
function sniffFileGroup(
  lines: string[],
  i: number
): { heading: string; items: { key: string; value: string }[]; endIdx: number } | null {
  const head = lines[i]?.match(FILE_SECTION_HEAD);
  if (!head) return null;
  const headIndent = head[1].length;
  const heading = head[2];
  // Need at least 2 file rows underneath.
  const items: { key: string; value: string }[] = [];
  let j = i + 1;
  while (j < lines.length) {
    const ln = lines[j];
    if (!ln.trim()) {
      // Allow a single blank line to separate file groups within the section
      // — but only if we haven't started collecting items yet.
      if (items.length === 0) { j++; continue; }
      break;
    }
    const ind = ln.match(/^\s*/)?.[0].length ?? 0;
    if (ind <= headIndent) break;
    // File-line shape: `    filename   description`
    const m = ln.match(/^\s+(\S+)\s{2,}(\S.*)$/);
    if (!m) break;
    items.push({ key: m[1], value: m[2].trim() });
    j++;
  }
  if (items.length < 2) return null;
  return { heading, items, endIdx: j };
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
    const isBoxLine = !earlySubMatch && /[┌┐┤├└┘│┼]/.test(trimmed);
    // Markdown pipe table line: starts and ends with `|` and has at least
    // one separator inside. Excludes inline `|` text by requiring the line
    // to be visually a row.
    const isPipeLine =
      !earlySubMatch &&
      /^\s*\|.*\|\s*$/.test(line) &&
      (line.match(/\|/g) || []).length >= 3;

    if (isBoxLine || isPipeLine) {
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
      // Numbered (e.g. "3.1 Source Datasets") → real subsection in TOC.
      // Unnumbered nested markers like "── X.csv (prefix: Y_) ──" get
      // demoted to a minihead block: visual divider, no TOC noise, no
      // structural break.
      if (nm) {
        startNewSubsection(smartTitleCase(nm[2]), nm[1]);
      } else {
        blocksTarget().push({ kind: "minihead", text: innerTitle });
      }
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

    // Card titles — wrap a contiguous run of subsequent blocks in a single
    // bordered card. Two patterns: RECOMMENDATION at column 0 (preceded by
    // full-width dashes) and Challenge with 2-space indent (followed by a
    // short dash separator).
    const recMatch = trimmed.match(CARD_RECOMMENDATION);
    if (recMatch) {
      flushAll();
      blocksTarget().push({
        kind: "cardClose", // close any previous open card first
      });
      blocksTarget().push({
        kind: "cardOpen",
        title: `Recommendation ${recMatch[1]}`,
        subtitle: recMatch[2].trim(),
      });
      i++; continue;
    }
    const chMatch = line.match(CARD_CHALLENGE);
    if (chMatch) {
      flushAll();
      blocksTarget().push({ kind: "cardClose" });
      blocksTarget().push({
        kind: "cardOpen",
        title: `Challenge ${chMatch[1]}`,
        subtitle: chMatch[2].trim(),
      });
      // Skip the short dash separator that follows challenge titles.
      i++;
      if (i < lines.length && /^\s*[─-]{20,}\s*$/.test(lines[i])) i++;
      continue;
    }
    // STAGE N — TITLE: render as a horizontal section divider with label.
    // Also closes any open card so subsequent challenges start clean.
    const stMatch = trimmed.match(CARD_STAGE);
    if (stMatch) {
      flushAll();
      blocksTarget().push({ kind: "cardClose" });
      blocksTarget().push({
        kind: "minihead",
        text: `Stage ${stMatch[1]} — ${stMatch[2].trim()}`,
      });
      i++; continue;
    }
    // Full-width divider closes any in-flight card.
    if (/^[─-]{60,}$/.test(trimmed)) {
      flushAll();
      blocksTarget().push({ kind: "cardClose" });
      i++; continue;
    }

    // Labelled multi-line prose (Evidence/Action/Problem/Solution/etc.).
    // Catch this BEFORE METRIC_LINE so the body can't get truncated to one
    // line and bleed into prose underneath.
    const lp = sniffLabelParagraph(lines, i);
    if (lp) {
      flushAll();
      blocksTarget().push({
        kind: "labelparagraph",
        label: lp.label,
        body: lp.body,
        badge: lp.badge,
      });
      i = lp.endIdx;
      continue;
    }

    // §7-style file-section header (`  Stage Scripts:`) followed by a
    // tabular file listing. Wrap heading + listing in a single card.
    const fg = sniffFileGroup(lines, i);
    if (fg) {
      flushAll();
      blocksTarget().push({ kind: "cardClose" });
      blocksTarget().push({
        kind: "cardOpen",
        title: fg.heading,
      });
      blocksTarget().push({
        kind: "kvtable",
        items: fg.items.map((it) => ({ key: it.key, value: it.value })),
      });
      blocksTarget().push({ kind: "cardClose" });
      i = fg.endIdx;
      continue;
    }

    // Column-aligned plain-text TABLE: "Header  Header2  Header3" then a
    // dash separator then ≥1 data row with similar column boundaries.
    // Source has these for "Source Datasets" (3.1) and "Model Performance"
    // (5.1). Without this, they collapse into one merged paragraph.
    const tbl = sniffColTable(lines, i);
    if (tbl) {
      flushAll();
      blocksTarget().push({ kind: "coltable", header: tbl.header, rows: tbl.rows });
      i = tbl.endIdx;
      continue;
    }

    // Feature-ID listings: 2+ consecutive lines of `prefix_id  description`.
    // Source has these throughout 3.4 ("Engineered Features", per-CSV
    // feature lists). Without this, they collapse into a wall of text.
    const kv = sniffKvTable(lines, i);
    if (kv) {
      flushAll();
      blocksTarget().push({ kind: "kvtable", items: kv.items });
      i = kv.endIdx;
      continue;
    }

    // Metric vs. code: a column-aligned line that ALSO has a `Label : Value`
    // shape with a short label is a metric (e.g. `Weeks : 308 (Feb 2014…)`),
    // not a code block. Without this, Section 4.2 splits each `Weeks:` and
    // `Context:` row into its own one-line <pre> instead of joining the
    // metric group with `Avg WACMR / Avg Repo / Avg MSF`.
    const mm = line.match(METRIC_LINE);
    const looksLikeMetric =
      mm &&
      mm[1].length <= 32 &&
      !/\.\s/.test(mm[1]);
    if (looksLikeMetric) {
      flushPara();
      flushCode();
      // Slurp hanging-indent continuation lines into the value so multi-line
      // metric values (e.g. Context paragraphs) stay attached to their label.
      const labelIndent = (line.match(/^\s*/)?.[0].length) ?? 0;
      let value = mm![2].trim();
      let k = i + 1;
      while (k < lines.length) {
        const next = lines[k];
        if (!next.trim()) break;
        const nextIndent = (next.match(/^\s*/)?.[0].length) ?? 0;
        if (nextIndent <= labelIndent + 2) break;
        if (METRIC_LINE.test(next)) break;
        if (/^\s*[─=]{4,}/.test(next) || /^──/.test(next.trim())) break;
        value += " " + next.trim();
        k++;
      }
      blocksTarget().push({ kind: "metric", label: mm![1].trim(), value });
      i = k;
      continue;
    }

    // Column-aligned tabular listings render as code blocks.
    if (TABULAR_LINE.test(line)) {
      flushPara();
      codeBuf.push(line);
      i++; continue;
    } else if (codeBuf.length) {
      flushCode();
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

  // Pipe (markdown) table: lines that start AND end with `|`. Drop the
  // separator row consisting only of `-`, `:` and `|`.
  const pipeRows = lines
    .filter((l) => /^\s*\|.*\|\s*$/.test(l))
    .filter((l) => !/^\s*\|[\s\-:|]+\|\s*$/.test(l))
    .map((l) =>
      l
        .trim()
        .replace(/^\||\|$/g, "")
        .split("|")
        .map((c) => c.trim())
    );
  if (pipeRows.length >= 2) {
    const colCount = pipeRows[0].length;
    if (pipeRows.every((r) => r.length === colCount)) {
      const [header, ...rows] = pipeRows;
      return { header, rows };
    }
  }

  // Box-drawing table fallback: rows start with `│`.
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
      <p className="text-[16.5px] leading-[1.75] text-slate-300 [overflow-wrap:anywhere]">
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
  if (block.kind === "coltable") {
    return (
      <div className="my-6 overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40 print:break-inside-avoid">
        <table className="w-full border-collapse text-[13.5px] tabular-nums">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/60">
              {block.header.map((h, i) => (
                <th
                  key={i}
                  className="px-4 py-2.5 text-left font-medium text-slate-200 [overflow-wrap:anywhere]"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, r) => (
              <tr key={r} className="border-b border-slate-800/60 last:border-b-0">
                {row.map((cell, c) => (
                  <td
                    key={c}
                    className="px-4 py-2 text-slate-300 [overflow-wrap:anywhere]"
                  >
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
  if (block.kind === "kvtable") {
    return (
      <div className="my-5 overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40 print:break-inside-avoid">
        <ul className="divide-y divide-slate-800/70 text-[13.5px]">
          {block.items.map((item, i) => (
            <li
              key={i}
              className="grid grid-cols-1 gap-x-5 gap-y-1 px-4 py-2.5 sm:grid-cols-[minmax(8rem,14rem)_minmax(0,1fr)_auto] sm:items-baseline"
            >
              <code className="font-mono text-[12.5px] tabular-nums text-cyan-300/90 [overflow-wrap:anywhere]">
                {item.key}
              </code>
              <span className="text-slate-300 [overflow-wrap:anywhere]">
                {item.value}
              </span>
              {item.badge && (
                <span className="justify-self-start rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-amber-300 sm:justify-self-end">
                  {item.badge}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (block.kind === "minihead") {
    return (
      <div className="mt-8 mb-3 flex items-center gap-3 text-[13px]">
        <span className="font-mono uppercase tracking-[0.18em] text-slate-400 [overflow-wrap:anywhere]">
          {block.text}
        </span>
        <span className="h-px flex-1 bg-slate-800" />
      </div>
    );
  }
  if (block.kind === "labelparagraph") {
    type Palette = { border: string; bg: string; tag: string; pill: string };
    const palette: Record<string, Palette> = {
      Evidence: {
        border: "border-cyan-500/25", bg: "bg-cyan-500/[0.04]",
        tag: "text-cyan-300/90", pill: "border-cyan-500/40 bg-cyan-500/10 text-cyan-200",
      },
      Action: {
        border: "border-emerald-500/25", bg: "bg-emerald-500/[0.04]",
        tag: "text-emerald-300/90", pill: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
      },
      Problem: {
        border: "border-rose-500/25", bg: "bg-rose-500/[0.04]",
        tag: "text-rose-300/90", pill: "border-rose-500/40 bg-rose-500/10 text-rose-200",
      },
      Solution: {
        border: "border-emerald-500/25", bg: "bg-emerald-500/[0.04]",
        tag: "text-emerald-300/90", pill: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
      },
      Fix: {
        border: "border-emerald-500/25", bg: "bg-emerald-500/[0.04]",
        tag: "text-emerald-300/90", pill: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
      },
      Note: {
        border: "border-slate-700/60", bg: "bg-slate-800/30",
        tag: "text-slate-400", pill: "border-slate-700 bg-slate-800/60 text-slate-300",
      },
      Rationale: {
        border: "border-slate-700/60", bg: "bg-slate-800/30",
        tag: "text-slate-400", pill: "border-slate-700 bg-slate-800/60 text-slate-300",
      },
      Caveat: {
        border: "border-amber-500/25", bg: "bg-amber-500/[0.04]",
        tag: "text-amber-300/90", pill: "border-amber-500/40 bg-amber-500/10 text-amber-200",
      },
    };
    // For HN / Objective labels, the badge text drives the colour.
    const isHN = /^H\d+$/.test(block.label);
    const isObj = /^Objective\s+\d+$/.test(block.label);
    let p: Palette = palette["Note"];
    if (palette[block.label]) {
      p = palette[block.label];
    } else if (isHN) {
      const badge = (block.badge || "").toLowerCase();
      if (badge.includes("rejected") || badge.includes("contradict")) p = palette["Problem"];
      else if (badge.includes("supported") || badge.includes("confirmed")) p = palette["Solution"];
      else if (badge.includes("new finding") || badge.includes("partial")) p = palette["Evidence"];
      else p = palette["Note"];
    } else if (isObj) {
      p = palette["Evidence"];
    }
    return (
      <div
        className={cn(
          "my-4 overflow-hidden rounded-xl border p-5 print:break-inside-avoid",
          p.border,
          p.bg
        )}
      >
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "font-mono text-[10px] uppercase tracking-[0.2em]",
              p.tag
            )}
          >
            {block.label}
          </span>
          {block.badge && (
            <span
              className={cn(
                "rounded-md border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em]",
                p.pill
              )}
            >
              {block.badge}
            </span>
          )}
        </div>
        <div className="space-y-3 text-[15px] leading-[1.7] text-slate-200 [overflow-wrap:anywhere]">
          {block.body.map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
      </div>
    );
  }
  if (block.kind === "cardOpen" || block.kind === "cardClose") {
    // Cards are wrapped by BlockGroup; if we ever render one in isolation,
    // emit nothing rather than a stray div.
    return null;
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

// First pass: turn the flat block list into a tree by wrapping every
// `cardOpen … cardClose` run in a synthetic `card` group. Cards have inner
// blocks rendered recursively by another BlockGroup.
type CardGroup = {
  kind: "card";
  title: string;
  subtitle?: string;
  blocks: Block[];
};

function buildCards(blocks: Block[]): Array<Block | CardGroup> {
  const out: Array<Block | CardGroup> = [];
  let card: CardGroup | null = null;
  for (const b of blocks) {
    if (b.kind === "cardOpen") {
      if (card) out.push(card);
      card = { kind: "card", title: b.title, subtitle: b.subtitle, blocks: [] };
      continue;
    }
    if (b.kind === "cardClose") {
      if (card) {
        // Drop empty cards (the parser emits cardClose markers eagerly).
        if (card.blocks.length) out.push(card);
        card = null;
      }
      continue;
    }
    if (card) card.blocks.push(b);
    else out.push(b);
  }
  if (card && card.blocks.length) out.push(card);
  return out;
}

function MetricGroupRender({
  items,
}: {
  items: { label: string; value: string }[];
}) {
  return (
    <div className="space-y-2 rounded-2xl border border-slate-800 bg-slate-900/40 px-5 py-4">
      {items.map((m, j) => (
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
  );
}

function BlockGroup({ blocks }: { blocks: Block[] }) {
  // Step 1: wrap cardOpen…cardClose runs into card groups.
  const cardWrapped = buildCards(blocks);
  // Step 2: coalesce consecutive metric blocks into metric-group.
  const groups: Array<
    | { kind: "metric-group"; items: { label: string; value: string }[] }
    | Block
    | CardGroup
  > = [];
  let buf: { label: string; value: string }[] = [];
  for (const b of cardWrapped) {
    if ("kind" in b && b.kind === "metric") {
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
      {groups.map((g, i) => {
        if ("kind" in g && g.kind === "metric-group") {
          return <MetricGroupRender key={i} items={g.items} />;
        }
        if ("kind" in g && g.kind === "card") {
          return (
            <section
              key={i}
              className="rounded-2xl border border-slate-800 bg-slate-900/30 p-6 print:break-inside-avoid"
            >
              <header className="mb-4 border-b border-slate-800/70 pb-3">
                <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-cyan-400/90">
                  {g.title}
                </div>
                {g.subtitle && (
                  <div
                    className="mt-1 text-[20px] leading-snug text-white [overflow-wrap:anywhere]"
                    style={{ fontFamily: "var(--font-instrument-serif)" }}
                  >
                    {g.subtitle}
                  </div>
                )}
              </header>
              <BlockGroup blocks={g.blocks} />
            </section>
          );
        }
        return <BlockRender key={i} block={g as Block} />;
      })}
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
