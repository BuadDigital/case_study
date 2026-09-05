/**
 * Request fan-out measurement for the PO property detail page (session-local driver,
 * not a CI test). Logs in as osama (case specialist), opens each target page with a
 * cold TanStack cache (fresh browser context per run), records every XHR/fetch to
 * /api/, then clicks through the property detail tabs recording the added requests.
 *
 * Runs the whole thing N times (default 3) and reports medians.
 *
 * Usage:  node e2e/.measure-property-detail.mjs
 * Env:    RUNS, PO, PROPERTY_ID, BASE, API_HOST, OUT
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

// ── config ────────────────────────────────────────────────────────────────────
const BASE = process.env.BASE ?? "http://127.0.0.1:3000";
const API_HOST = process.env.API_HOST ?? "127.0.0.1";
const GATEWAY = `http://${API_HOST}:5160`;
const RUNS = Number(process.env.RUNS ?? 3);
// Passwordless demo login (2026-09-04): the seeded mobile of osama (case specialist).
const USER_MOBILE = "500000004";
const OUT =
  process.env.OUT ??
  path.join(process.cwd(), "docs", "architecture", "property-detail-fanout-2026-09-04.json");

// Fixture PO + property. Defaults are discovered at startup when not supplied.
let PO = process.env.PO ?? "";
let PROPERTY_ID = process.env.PROPERTY_ID ?? "";

/** Property detail tab ids + labels — mirrors po-property-detail-tabs-state.ts TABS. */
const TABS = [
  { id: "basic", label: "البيانات الأساسية" },
  { id: "documents", label: "مستندات العقار" },
  { id: "linked", label: "العقارات المرتبطة" },
  { id: "survey", label: "التقرير المساحي" },
  { id: "inspection", label: "معاينة العقار" },
  { id: "photos", label: "صور العقار" },
  { id: "government", label: "المراجعات الحكومية" },
  { id: "keys", label: "مفاتيح العقار" },
  { id: "appraisal", label: "تقييم العقار" },
  { id: "failures", label: "التعذرات" },
  { id: "report", label: "دراسة العقار" },
  { id: "enfath-upload", label: "الرفع على انفاذ" },
  { id: "finance", label: "المالية" },
  { id: "log", label: "السجل والتدقيق" },
  { id: "survey-notes", label: "ملاحظات" },
];

const TAB_STRIP = '[aria-label="أقسام تفاصيل العقار"]';

// ── gateway route table → upstream service ────────────────────────────────────
// Mirrors backend/gateway/RealEstateEval.Gateway/appsettings.json ReverseProxy.Routes.
// Order matters: the case-study catch-all has Order 100 so it loses to every prefix.
const ROUTE_TABLE = [
  ["/api/auth", "identity", 5161],
  ["/api/users", "identity", 5161],
  ["/api/permissions", "identity", 5161],
  ["/api/survey-offices", "operations", 5163],
  ["/api/property-keys", "operations", 5163],
  ["/api/key-envelopes", "operations", 5163],
  ["/api/operations-tasks", "operations", 5163],
  ["/api/valuation-requests", "valuation", 5166],
  ["/api/comparable-properties", "valuation", 5166],
  ["/api/property-comparable-links", "valuation", 5166],
  ["/api/evaluator-recalls", "valuation", 5166],
  ["/api/reporting", "reporting", 5164],
  ["/api/financial", "financial", 5165],
  ["/api/failures", "failures", 5167],
  ["/api/failure-types-catalog", "failures", 5167],
  ["/api/field-dictionary", "platform", 5168],
  ["/api/courts", "platform", 5168],
  ["/api/regions", "platform", 5168],
  ["/api/admin/courts", "platform", 5168],
  ["/api/case-study-info-roles", "platform", 5168],
  ["/api/organization-settings", "platform", 5168],
  ["/api/valuation-lists", "platform", 5168],
  ["/api/difference-factor-catalog", "platform", 5168],
  ["/api/attachment-print-dictionary", "platform", 5168],
  ["/api/field-sync-status", "platform", 5168],
  ["/api/audit-log", "platform", 5168],
  ["/api/notifications", "platform", 5168],
  ["/api/push", "platform", 5168],
  ["/api/attachments", "attachments", 5169],
];

/** Classify a stripped /api/ path to the upstream YARP answers from. */
function classify(pathname) {
  let best = null;
  for (const [prefix, service, port] of ROUTE_TABLE) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) {
      if (!best || prefix.length > best[0].length) best = [prefix, service, port];
    }
  }
  if (best) return { service: best[1], port: best[2] };
  if (pathname.startsWith("/api/")) return { service: "case-study", port: 5162 };
  return { service: "shell", port: 3000 };
}

/** Strip query + collapse uuid/number path segments so endpoints group. */
function normalizePath(rawUrl) {
  let u;
  try {
    u = new URL(rawUrl);
  } catch {
    return rawUrl;
  }
  return u.pathname;
}

function queryOf(rawUrl) {
  try {
    return new URL(rawUrl).search.replace(/^\?/, "");
  } catch {
    return "";
  }
}

/** Only gateway traffic counts; "/maps/api/..." telemetry and friends do not. */
function isApiCall(request) {
  const type = request.resourceType();
  if (type !== "xhr" && type !== "fetch") return false;
  return normalizePath(request.url()).startsWith("/api/");
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function templatePath(pathname) {
  return pathname
    .split("/")
    .map((seg) => {
      if (UUID_RE.test(seg)) return "{id}";
      if (/^\d{3,}$/.test(seg)) return "{n}";
      return seg;
    })
    .join("/");
}

// ── helpers ───────────────────────────────────────────────────────────────────
const median = (xs) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const sum = (xs) => xs.reduce((a, b) => a + b, 0);

async function login() {
  const res = await fetch(`${GATEWAY}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: USER_MOBILE }),
  });
  if (!res.ok) throw new Error(`login failed: HTTP ${res.status}`);
  const raw = await res.json();
  const user = raw.user ?? raw.User ?? {};
  const session = {
    token: String(raw.token ?? raw.Token ?? ""),
    expiresAtUtc: String(raw.expiresAtUtc ?? raw.ExpiresAtUtc ?? ""),
    user: {
      id: String(user.id ?? user.Id ?? ""),
      email: String(user.email ?? user.Email ?? ""),
      displayName: String(user.displayName ?? user.DisplayName ?? ""),
    },
  };
  if (!session.token) throw new Error("login returned no token");
  return session;
}

/** Discover the fixture PO + first property when not pinned via env. */
async function discoverFixture(token) {
  const auth = { Authorization: `Bearer ${token}` };
  const list = await (
    await fetch(`${GATEWAY}/api/work-orders?page=1&pageSize=50`, { headers: auth })
  ).json();
  const items = Array.isArray(list) ? list : (list.items ?? []);
  // Skip POs seeded by concurrent Playwright journeys — they carry no documents
  // and would understate the fan-out. Prefer the richest real PO.
  const candidates = (
    process.env.PO ? items.filter((w) => w.poNumber === process.env.PO) : items
  )
    .filter((w) => !/^E2E-/i.test(String(w.poNumber ?? "")))
    .sort((a, b) => (b.propertyCount ?? 0) - (a.propertyCount ?? 0));
  for (const wo of candidates) {
    const detail = await (
      await fetch(`${GATEWAY}/api/work-orders/${encodeURIComponent(wo.poNumber)}`, {
        headers: auth,
      })
    ).json();
    const props = detail.properties ?? [];
    if (props.length) return { po: detail.poNumber, propertyId: props[0].id };
  }
  throw new Error("no work order with at least one property found");
}

/**
 * Instrument a page: collect every /api/ request into `bucket`, tagged with the
 * current phase. Sizes/timings are resolved lazily; `settle()` drains them.
 */
function instrument(page, state) {
  const pending = [];
  page.on("requestfinished", (request) => {
    if (!isApiCall(request)) return;
    const url = request.url();
    const phase = state.phase;
    pending.push(
      (async () => {
        const pathname = normalizePath(url);
        const [response, sizes, timing] = await Promise.all([
          request.response().catch(() => null),
          request.sizes().catch(() => null),
          Promise.resolve(request.timing()).catch(() => null),
        ]);
        const duration =
          timing && timing.responseEnd > 0 && timing.startTime >= 0
            ? Math.max(0, timing.responseEnd)
            : null;
        const { service, port } = classify(pathname);
        state.records.push({
          phase,
          method: request.method(),
          path: pathname,
          query: queryOf(url),
          endpoint: templatePath(pathname),
          status: response ? response.status() : 0,
          durationMs: duration === null ? null : Math.round(duration * 100) / 100,
          responseBytes: sizes ? sizes.responseBodySize : null,
          transferBytes: sizes
            ? sizes.responseBodySize + sizes.responseHeadersSize
            : null,
          service,
          port,
        });
      })().catch(() => {}),
    );
  });
  page.on("requestfailed", (request) => {
    if (!isApiCall(request)) return;
    const url = request.url();
    state.records.push({
      phase: state.phase,
      method: request.method(),
      path: normalizePath(url),
      query: queryOf(url),
      endpoint: templatePath(normalizePath(url)),
      status: -1,
      durationMs: null,
      responseBytes: null,
      transferBytes: null,
      ...classify(normalizePath(url)),
      failed: request.failure()?.errorText ?? "failed",
    });
  });
  return async function settle() {
    await Promise.all(pending.splice(0));
  };
}

/**
 * Wait for the network to go quiet without failing the run on a slow dev build.
 * The shell holds long-lived connections, so `networkidle` frequently never
 * resolves; the timeout is the real budget and is deliberately short. Observed
 * request durations are ~1.5s, so an 8s window still captures the full burst.
 */
const IDLE_MS = Number(process.env.IDLE_MS ?? 8000);
const IDLE_MS_INITIAL = Number(process.env.IDLE_MS_INITIAL ?? 25000);

async function quiet(page, settleMs = 700, idleMs = IDLE_MS) {
  await page.waitForLoadState("networkidle", { timeout: idleMs }).catch(() => {});
  await page.waitForTimeout(settleMs);
}

// ── one measurement run ───────────────────────────────────────────────────────
async function measureRun(browser, session, runIndex) {
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    // Cold cache every run: fresh context => empty TanStack cache + empty HTTP cache.
    bypassCSP: true,
  });
  await context.addCookies([
    { name: "ree-auth", value: "1", domain: API_HOST, path: "/" },
  ]);
  await context.addInitScript((payload) => {
    window.sessionStorage.setItem("auth", payload);
  }, JSON.stringify(session));

  const page = await context.newPage();
  const state = { phase: "boot", records: [] };
  const settle = instrument(page, state);
  const notes = [];

  // ── page 1: property detail, initial load ──
  const detailPath = `/po/${encodeURIComponent(PO)}/property/${encodeURIComponent(PROPERTY_ID)}`;
  state.phase = "property-detail:initial";
  await page.goto(`${BASE}${detailPath}`, {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });
  await page
    .locator(TAB_STRIP)
    .first()
    .waitFor({ timeout: 120_000 })
    .catch(() => notes.push("tab strip not found on property detail"));
  await quiet(page, 1200, IDLE_MS_INITIAL);
  await settle();

  // ── property detail: click each tab in order ──
  const strip = page.locator(TAB_STRIP).first();
  for (const tab of TABS) {
    state.phase = `tab:${tab.id}`;
    const btn = strip.getByText(tab.label, { exact: true }).first();
    const visible = await btn.isVisible().catch(() => false);
    if (!visible) {
      notes.push(`tab "${tab.id}" not visible for this role`);
      continue;
    }
    await btn.click({ timeout: 20_000 }).catch((e) => {
      notes.push(`tab "${tab.id}" click failed: ${String(e).slice(0, 120)}`);
    });
    await quiet(page);
    await settle();
  }

  // ── page 2: active transactions queue (ActiveCaseStudyView) ──
  await page.close();
  const page2 = await context.newPage();
  const state2 = { phase: "active-case-study:initial", records: [] };
  const settle2 = instrument(page2, state2);
  await page2.goto(`${BASE}/active-case-study`, {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });
  await quiet(page2, 1200, IDLE_MS_INITIAL);
  await settle2();

  // ── page 3: PO list ──
  await page2.close();
  const page3 = await context.newPage();
  const state3 = { phase: "po-list:initial", records: [] };
  const settle3 = instrument(page3, state3);
  await page3.goto(`${BASE}/po`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await quiet(page3, 1200, IDLE_MS_INITIAL);
  await settle3();

  await context.close();

  return {
    run: runIndex,
    notes,
    records: [...state.records, ...state2.records, ...state3.records],
  };
}

// ── aggregation ───────────────────────────────────────────────────────────────
/**
 * Requests in `phase` whose (method, endpoint) had not been seen earlier in the
 * same run. Live queues poll on a 30s timer, so raw per-tab counts drift with
 * whichever tab happened to be open when the timer fired; "newly introduced
 * endpoints" isolates what the tab itself actually needed.
 */
function newEndpointsInPhase(run, phase, orderedPhases) {
  const idx = orderedPhases.indexOf(phase);
  const seen = new Set();
  for (const p of orderedPhases.slice(0, idx)) {
    run.records
      .filter((x) => x.phase === p)
      .forEach((x) => seen.add(`${x.method} ${x.endpoint}`));
  }
  return run.records.filter(
    (x) => x.phase === phase && !seen.has(`${x.method} ${x.endpoint}`),
  );
}

function summarizePhase(runs, phase, orderedPhases) {
  const perRun = runs.map((r) => r.records.filter((x) => x.phase === phase));
  const totals = perRun.map((rs) => rs.length);
  const distinct = perRun.map((rs) => new Set(rs.map((x) => `${x.method} ${x.endpoint}`)).size);
  const bytes = perRun.map((rs) => sum(rs.map((x) => x.responseBytes ?? 0)));

  // per-service medians
  const services = new Set();
  perRun.forEach((rs) => rs.forEach((x) => services.add(x.service)));
  const perService = {};
  for (const svc of [...services].sort()) {
    perService[svc] = {
      port: perRun.flat().find((x) => x.service === svc)?.port ?? null,
      medianCount: median(
        perRun.map((rs) => rs.filter((x) => x.service === svc).length),
      ),
    };
  }

  // endpoint medians (duration median across every observation in every run)
  const byEndpoint = new Map();
  perRun.flat().forEach((x) => {
    const key = `${x.method} ${x.endpoint}`;
    if (!byEndpoint.has(key))
      byEndpoint.set(key, { key, service: x.service, port: x.port, durations: [], bytes: [] });
    const e = byEndpoint.get(key);
    if (x.durationMs !== null) e.durations.push(x.durationMs);
    if (x.responseBytes !== null) e.bytes.push(x.responseBytes);
  });
  const endpoints = [...byEndpoint.values()]
    .map((e) => ({
      endpoint: e.key,
      service: e.service,
      port: e.port,
      medianMs: Math.round(median(e.durations)),
      medianBytes: Math.round(median(e.bytes)),
      observations: e.durations.length,
    }))
    .sort((a, b) => b.medianMs - a.medianMs);

  const newPerRun = orderedPhases
    ? runs.map((r) => newEndpointsInPhase(r, phase, orderedPhases))
    : perRun;

  return {
    phase,
    perRunTotals: totals,
    medianRequests: median(totals),
    perRunNewEndpointRequests: newPerRun.map((rs) => rs.length),
    medianNewEndpointRequests: median(newPerRun.map((rs) => rs.length)),
    newEndpoints: [
      ...new Set(newPerRun.flat().map((x) => `${x.method} ${x.endpoint}`)),
    ].sort(),
    medianDistinctEndpoints: median(distinct),
    medianBytes: Math.round(median(bytes)),
    perService,
    endpoints,
    slowestThree: endpoints.slice(0, 3),
  };
}

// ── main ──────────────────────────────────────────────────────────────────────
const session = await login();
if (!PO || !PROPERTY_ID) {
  const found = await discoverFixture(session.token);
  PO = PO || found.po;
  PROPERTY_ID = PROPERTY_ID || found.propertyId;
}
console.log(`fixture: PO=${PO} property=${PROPERTY_ID}`);

const browser = await chromium.launch({ headless: true });
const runs = [];
for (let i = 1; i <= RUNS; i++) {
  console.log(`--- run ${i}/${RUNS} ---`);
  const r = await measureRun(browser, session, i);
  console.log(`    ${r.records.length} api requests recorded`);
  r.notes.forEach((n) => console.log(`    note: ${n}`));
  runs.push(r);
}
await browser.close();

const phases = [
  "property-detail:initial",
  ...TABS.map((t) => `tab:${t.id}`),
  "active-case-study:initial",
  "po-list:initial",
];
const summary = phases.map((p) => summarizePhase(runs, p, phases));

const out = {
  measuredAtUtc: new Date().toISOString(),
  base: BASE,
  gateway: GATEWAY,
  user: USER_MOBILE,
  runs: RUNS,
  fixture: { po: PO, propertyId: PROPERTY_ID },
  notes: [...new Set(runs.flatMap((r) => r.notes))],
  summary,
  raw: runs,
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log(`\nwrote ${OUT}`);

for (const s of summary) {
  if (!s.medianRequests && !s.perRunTotals.some(Boolean)) continue;
  console.log(
    `${s.phase.padEnd(30)} med=${String(s.medianRequests).padStart(3)}  runs=[${s.perRunTotals}]  distinct=${s.medianDistinctEndpoints}  bytes=${s.medianBytes}`,
  );
}
