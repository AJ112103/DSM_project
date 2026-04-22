// Rigorous Playwright QA of the WACMR app.
// Visits every page, collects console errors + failed network requests,
// screenshots desktop + mobile, and exercises the critical interactive flows:
//   - /simulate slider
//   - /agent chat
//   - Floating AgentSheet (from /regimes)
//
// Writes a machine-readable report to qa_audit/report.json plus a human
// summary to stdout.

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const APP = "http://localhost:3000";
const SHOTS = path.resolve("../qa_audit/screenshots");
fs.mkdirSync(SHOTS, { recursive: true });

const PAGES = [
  { name: "landing",         path: "/",                          must: ["WACMR", "Try the simulator"] },
  { name: "simulate",        path: "/simulate",                  must: ["Policy counterfactual simulator", "repo-rate change"] },
  { name: "agent",           path: "/agent",                     must: ["WACMR Agent", "Gemini"] },
  { name: "blog-index",      path: "/blog",                      must: ["Writing about", "heartbeat"] },
  { name: "blog-post",       path: "/blog/wacmr-investigation",  must: ["Predicting the", "Table of contents", "regime break"] },
  { name: "regimes",         path: "/regimes",                   must: ["Regime"] },
  { name: "forecast",        path: "/forecast",                  must: ["Forecast", "SHAP"] },
  { name: "dashboard",       path: "/dashboard",                 must: [] },
  { name: "explore",         path: "/explore",                   must: [] },
  { name: "news",            path: "/news",                      must: [] },
  { name: "report",          path: "/report",                    must: [] },
];

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile:  { width: 390,  height: 844 },
};

const report = {
  timestamp: new Date().toISOString(),
  pages: {},
  interactive: {},
  global: { consoleErrors: 0, networkFailures: 0 },
};

async function instrumentPage(pg, label) {
  const errors = [];
  const networkFailures = [];

  pg.on("console", (msg) => {
    if (msg.type() === "error") {
      errors.push({ text: msg.text().slice(0, 400), location: msg.location() });
    }
  });
  pg.on("pageerror", (err) => {
    errors.push({ text: err.message.slice(0, 400), stack: (err.stack || "").split("\n").slice(0, 3).join("\n") });
  });
  pg.on("requestfailed", (req) => {
    networkFailures.push({ url: req.url(), method: req.method(), failure: req.failure()?.errorText });
  });
  pg.on("response", async (resp) => {
    const status = resp.status();
    const url = resp.url();
    if (status >= 400 && !url.includes("favicon")) {
      networkFailures.push({ url, status, method: resp.request().method() });
    }
  });

  return { errors, networkFailures };
}

async function auditPage(browser, page, viewport) {
  const context = await browser.newContext({ viewport: VIEWPORTS[viewport] });
  const pg = await context.newPage();
  const monitor = await instrumentPage(pg, `${page.name}:${viewport}`);

  const result = {
    viewport,
    url: `${APP}${page.path}`,
    loadOk: false,
    networkIdleOk: false,
    missingTexts: [],
    consoleErrors: [],
    networkFailures: [],
    screenshot: null,
    loadTimeMs: null,
  };

  const start = Date.now();
  try {
    const resp = await pg.goto(`${APP}${page.path}`, { waitUntil: "domcontentloaded", timeout: 30000 });
    result.loadOk = resp.ok();
    await pg.waitForLoadState("networkidle", { timeout: 15000 }).then(() => {
      result.networkIdleOk = true;
    }).catch(() => {
      result.networkIdleOk = false;
    });
  } catch (err) {
    result.loadOk = false;
    result.error = err.message;
  }
  result.loadTimeMs = Date.now() - start;

  // Wait briefly for any client-side chart renders.
  await pg.waitForTimeout(1500);

  // Check must-contain texts.
  const content = await pg.content();
  for (const text of page.must || []) {
    if (!content.includes(text)) result.missingTexts.push(text);
  }

  // Screenshot.
  const shotPath = path.join(SHOTS, `${page.name}-${viewport}.png`);
  try {
    await pg.screenshot({ path: shotPath, fullPage: true, timeout: 10000 });
    result.screenshot = path.relative(process.cwd(), shotPath);
  } catch (err) {
    result.screenshotError = err.message;
  }

  result.consoleErrors = monitor.errors;
  result.networkFailures = monitor.networkFailures;

  await context.close();
  return result;
}

async function auditInteractive(browser) {
  const out = {};

  // 1. Simulator: drag slider, verify the headline metric changes.
  {
    const ctx = await browser.newContext({ viewport: VIEWPORTS.desktop });
    const pg = await ctx.newPage();
    const mon = await instrumentPage(pg, "sim-interactive");
    const r = { step: "simulate-slider", ok: false, details: {} };
    try {
      await pg.goto(`${APP}/simulate`, { waitUntil: "networkidle", timeout: 30000 });
      // Click the -100 preset so we get a deterministic change.
      await pg.waitForTimeout(1500);
      // Read baseline prediction
      const baselineBeforeText = await pg.locator("text=Baseline WACMR").first().locator("..").locator(".font-mono").first().textContent();
      r.details.baseline_before = (baselineBeforeText || "").trim();
      await pg.getByRole("button", { name: "-100" }).click();
      await pg.waitForTimeout(2500); // allow react-query to refetch
      const afterText = await pg.locator("text=After").first().locator("..").locator(".font-mono").first().textContent();
      const deltaText = await pg.locator("text=Δ WACMR").locator("..").locator(".font-mono").first().textContent();
      r.details.after = (afterText || "").trim();
      r.details.delta = (deltaText || "").trim();
      r.ok = (afterText && deltaText && afterText !== "—" && deltaText !== "—");
    } catch (err) {
      r.error = err.message;
    }
    r.consoleErrors = mon.errors;
    r.networkFailures = mon.networkFailures;
    await pg.screenshot({ path: path.join(SHOTS, "interactive-simulate.png"), fullPage: true }).catch(() => {});
    out.simulate = r;
    await ctx.close();
  }

  // 2. Floating AgentSheet opens from /regimes.
  {
    const ctx = await browser.newContext({ viewport: VIEWPORTS.desktop });
    const pg = await ctx.newPage();
    const mon = await instrumentPage(pg, "sheet-interactive");
    const r = { step: "agent-sheet", ok: false, details: {} };
    try {
      await pg.goto(`${APP}/regimes`, { waitUntil: "networkidle", timeout: 30000 });
      await pg.waitForTimeout(1500);
      // Find the floating button and click it. There may be multiple elements
      // matching "Ask the agent" (e.g., hidden prerenders); .first() is enough.
      const btn = pg.getByRole("button", { name: /ask the agent/i }).first();
      await btn.waitFor({ state: "visible", timeout: 8000 });
      await btn.click();
      await pg.waitForTimeout(800);
      // Sheet content should now include "WACMR Agent"
      const sheetVisible = await pg.locator("text=WACMR Agent").count();
      r.details.sheet_title_count = sheetVisible;
      r.ok = sheetVisible > 0;
      await pg.screenshot({ path: path.join(SHOTS, "interactive-agent-sheet.png"), fullPage: false }).catch(() => {});
      // Close with Escape
      await pg.keyboard.press("Escape");
      await pg.waitForTimeout(400);
    } catch (err) {
      r.error = err.message;
    }
    r.consoleErrors = mon.errors;
    r.networkFailures = mon.networkFailures;
    out.agentSheet = r;
    await ctx.close();
  }

  // 3. Agent chat: send a simple message, verify we get events back.
  {
    const ctx = await browser.newContext({ viewport: VIEWPORTS.desktop });
    const pg = await ctx.newPage();
    const mon = await instrumentPage(pg, "agent-chat");
    const r = { step: "agent-chat", ok: false, details: {} };
    try {
      await pg.goto(`${APP}/agent`, { waitUntil: "networkidle", timeout: 30000 });
      await pg.waitForTimeout(1500);
      const textarea = pg.locator("textarea").first();
      await textarea.waitFor({ timeout: 8000 });
      await textarea.fill("How many weeks are in the dataset?");
      await pg.keyboard.press("Enter");
      // Poll until Thinking… clears AND the expected answer appears, up to 60s.
      const deadline = Date.now() + 60_000;
      let thinkingCleared = false;
      while (Date.now() < deadline) {
        const thinking = await pg.locator("text=Thinking…").count();
        const hasAnswer = await pg.locator("text=/545/").count();
        if (thinking === 0 && hasAnswer > 0) {
          thinkingCleared = true;
          break;
        }
        await pg.waitForTimeout(500);
      }
      r.details.thinking_cleared = thinkingCleared;
      // Was a run_sql tool panel rendered?
      const toolCallCount = await pg.locator('span.font-mono:has-text("run_sql")').count();
      r.details.tool_call_count = toolCallCount;
      const mentions545 = await pg.locator("text=/545/").count();
      r.details.mentions_545 = mentions545;
      r.ok = thinkingCleared && toolCallCount >= 1 && mentions545 >= 1;
      await pg.screenshot({ path: path.join(SHOTS, "interactive-agent-chat.png"), fullPage: true }).catch(() => {});
    } catch (err) {
      r.error = err.message;
    }
    r.consoleErrors = mon.errors;
    r.networkFailures = mon.networkFailures;
    out.agentChat = r;
    await ctx.close();
  }

  return out;
}

// ─── Main ───────────────────────────────────────────────────────────────────

const browser = await chromium.launch({ headless: true });

console.log("=== Page audits ===");
for (const page of PAGES) {
  report.pages[page.name] = {};
  for (const vp of Object.keys(VIEWPORTS)) {
    process.stdout.write(`  ${page.name}:${vp} … `);
    const r = await auditPage(browser, page, vp);
    report.pages[page.name][vp] = r;
    report.global.consoleErrors += r.consoleErrors.length;
    report.global.networkFailures += r.networkFailures.length;
    const badge = r.loadOk ? "OK" : "FAIL";
    const warns = [];
    if (r.consoleErrors.length) warns.push(`${r.consoleErrors.length} console errors`);
    if (r.networkFailures.length) warns.push(`${r.networkFailures.length} net failures`);
    if (r.missingTexts.length) warns.push(`missing: ${r.missingTexts.join(", ")}`);
    console.log(`${badge}  ${r.loadTimeMs}ms  ${warns.join("; ") || "clean"}`);
  }
}

console.log();
console.log("=== Interactive flows ===");
report.interactive = await auditInteractive(browser);
for (const [k, v] of Object.entries(report.interactive)) {
  console.log(`  ${k}: ${v.ok ? "OK" : "FAIL"}`, v.error ? `- ${v.error}` : "", JSON.stringify(v.details || {}));
  if (v.consoleErrors?.length) console.log(`    consoleErrors: ${v.consoleErrors.length}`);
  if (v.networkFailures?.length) console.log(`    networkFailures: ${v.networkFailures.length}`);
}

await browser.close();

fs.writeFileSync(path.resolve("../qa_audit/report.json"), JSON.stringify(report, null, 2));
console.log();
console.log(`Report: qa_audit/report.json`);
console.log(`Screenshots: ${SHOTS}/`);
console.log(`Global: ${report.global.consoleErrors} console errors across ${Object.keys(report.pages).length * 2} page loads, ${report.global.networkFailures} network failures.`);
