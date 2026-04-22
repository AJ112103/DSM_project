/**
 * Per-route network performance harness.
 *
 * Walks every public route, records every request/response timing, and
 * writes a JSON report. Run twice — once before a deploy, once after —
 * and diff the totals to see what got faster.
 *
 * Usage:
 *   node playwright_perf.mjs                   # default: live site, label=after
 *   LABEL=before node playwright_perf.mjs      # save as perf-before.json
 *   BASE_URL=http://localhost:3000 node playwright_perf.mjs
 *   ROUTES=/,/simulate node playwright_perf.mjs
 *
 * Outputs ../qa_audit/perf-<label>.json with per-route waterfalls.
 */

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL || "https://dsm-project-phi.vercel.app";
const LABEL = process.env.LABEL || "after";
const OUT_DIR = path.resolve("../qa_audit");
fs.mkdirSync(OUT_DIR, { recursive: true });

const DEFAULT_ROUTES = [
  "/",
  "/dashboard",
  "/forecast",
  "/simulate",
  "/regimes",
  "/explore",
  "/news",
];
const ROUTES = (process.env.ROUTES?.split(",") || DEFAULT_ROUTES).map((r) => r.trim());

function isApiCall(url) {
  return /\/api\//.test(url);
}

async function profileRoute(ctx, route) {
  const page = await ctx.newPage();
  const requests = new Map();           // url -> { start, end, status, size, type, method, fromCache }
  const consoleErrors = [];

  page.on("request", (req) => {
    requests.set(req.url(), {
      url: req.url(),
      method: req.method(),
      type: req.resourceType(),
      start: Date.now(),
    });
  });
  page.on("response", async (res) => {
    const req = res.request();
    const e = requests.get(req.url());
    if (!e) return;
    e.end = Date.now();
    e.status = res.status();
    e.fromCache = res.fromServiceWorker() || (res.headers()["x-cache"] || "").includes("HIT");
    e.cacheControl = res.headers()["cache-control"] || "";
    e.contentEncoding = res.headers()["content-encoding"] || "";
    try {
      const body = await res.body();
      e.size = body.length;
    } catch {
      e.size = null;
    }
  });
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 240));
  });
  page.on("pageerror", (err) => consoleErrors.push(`pageerror: ${err.message.slice(0, 240)}`));

  const url = `${BASE}${route}`;
  const t0 = Date.now();
  let domLoaded = null;
  let networkIdle = null;
  let navStatus = null;

  try {
    const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    navStatus = resp?.status() ?? null;
    domLoaded = Date.now() - t0;
  } catch (e) {
    return { route, error: e.message, ttfb: null, domLoaded: null, networkIdle: null, requests: [] };
  }

  try {
    await page.waitForLoadState("networkidle", { timeout: 30000 });
    networkIdle = Date.now() - t0;
  } catch {
    networkIdle = null;
  }

  // Bonus: simulator slider drag — ensure we don't fire 81 backend calls
  let sliderApiCalls = null;
  if (route === "/simulate") {
    const callsBefore = Array.from(requests.values()).filter(
      (e) => isApiCall(e.url) && /counterfactual|attribution/.test(e.url)
    ).length;
    const slider = page.locator('input[type="range"]').first();
    if (await slider.count()) {
      await slider.evaluate((el) => {
        const proto = Object.getPrototypeOf(el);
        const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
        for (let v = -200; v <= 200; v += 5) {
          setter?.call(el, String(v));
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });
      // Let any debounced calls fire
      await page.waitForTimeout(2000);
      const callsAfter = Array.from(requests.values()).filter(
        (e) => isApiCall(e.url) && /counterfactual|attribution/.test(e.url)
      ).length;
      sliderApiCalls = callsAfter - callsBefore;
    }
  }

  const all = Array.from(requests.values()).filter((e) => e.end != null);
  const apiCalls = all.filter((e) => isApiCall(e.url));
  const apiTotalMs = apiCalls.reduce((a, e) => a + (e.end - e.start), 0);
  const apiTotalBytes = apiCalls.reduce((a, e) => a + (e.size || 0), 0);
  const apiSlowest = [...apiCalls].sort((a, b) => b.end - b.start - (a.end - a.start)).slice(0, 5);

  await page.close();

  return {
    route,
    url,
    navStatus,
    domLoadedMs: domLoaded,
    networkIdleMs: networkIdle,
    consoleErrors,
    api: {
      count: apiCalls.length,
      totalMs: apiTotalMs,
      totalBytes: apiTotalBytes,
      avgMs: apiCalls.length ? Math.round(apiTotalMs / apiCalls.length) : 0,
      slowest: apiSlowest.map((e) => ({
        url: e.url.replace(BASE, "").replace("https://wacmr-api.onrender.com", ""),
        ms: e.end - e.start,
        status: e.status,
        bytes: e.size,
        cacheControl: e.cacheControl,
        contentEncoding: e.contentEncoding,
      })),
    },
    sliderApiCalls,
  };
}

console.log(`perf harness: BASE=${BASE} LABEL=${LABEL} routes=${ROUTES.length}`);
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });

const results = [];
for (const route of ROUTES) {
  process.stdout.write(`  ${route} ... `);
  const r = await profileRoute(ctx, route);
  results.push(r);
  if (r.error) {
    console.log(`ERROR: ${r.error}`);
    continue;
  }
  console.log(
    `dom=${r.domLoadedMs}ms idle=${r.networkIdleMs ?? "n/a"}ms api=${r.api.count}calls/${r.api.totalMs}ms` +
      (r.sliderApiCalls != null ? ` slider=${r.sliderApiCalls}calls` : "")
  );
}

await browser.close();

const summary = {
  base: BASE,
  label: LABEL,
  generatedAt: new Date().toISOString(),
  routes: results,
  totals: {
    pages: results.length,
    apiCalls: results.reduce((a, r) => a + (r.api?.count || 0), 0),
    apiBytes: results.reduce((a, r) => a + (r.api?.totalBytes || 0), 0),
    apiMs: results.reduce((a, r) => a + (r.api?.totalMs || 0), 0),
  },
};

const outPath = path.join(OUT_DIR, `perf-${LABEL}.json`);
fs.writeFileSync(outPath, JSON.stringify(summary, null, 2));
console.log(`\nWrote ${outPath}`);
console.log(
  `Totals: ${summary.totals.pages} pages · ${summary.totals.apiCalls} API calls · ` +
    `${(summary.totals.apiBytes / 1024).toFixed(1)} KB · ${summary.totals.apiMs} ms backend time`
);
