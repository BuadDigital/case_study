// Session-local driver (not a CI test): the appraiser's «أعمالي» (2026-11-10) — the page, its chips and
// rows, a row opening his page, the summary's new groups, the handed-over page opening on the summary,
// and `?report=1` opening the report window. Read-only.
// LOGIN=<appraiser mobile> SHOT_DIR=<dir> node e2e/.check-appraiser-mywork.mjs
import { chromium } from "@playwright/test";
import fs from "node:fs";

const BASE = process.env.BASE || "http://localhost:3000";
const API = process.env.API || "http://127.0.0.1:5160";
const SHOT_DIR = process.env.SHOT_DIR || "./smoke-shots";
fs.mkdirSync(SHOT_DIR, { recursive: true });

const login = await fetch(`${API}/api/auth/login`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ username: process.env.LOGIN }),
});
if (!login.ok) throw new Error(`login ${login.status}`);
const auth = await login.json();
console.log("pages from the server:", (auth.pages ?? auth.user?.pages ?? []).join(","));

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
await ctx.addCookies([{ name: "ree-auth", value: "1", domain: "localhost", path: "/" }]);
await ctx.addInitScript((s) => window.sessionStorage.setItem("auth", s), JSON.stringify(auth));
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text().slice(0, 240));
});
page.on("pageerror", (e) => errors.push("PAGEERROR " + String(e).slice(0, 240)));
const step = (name, ok, note = "") => console.log(`${ok ? "PASS" : "FAIL"} ${name}${note ? " — " + note : ""}`);
const shot = (name, fullPage = false) => page.screenshot({ path: `${SHOT_DIR}/${name}.png`, fullPage });

try {
  // 1 — the page.
  await page.goto(`${BASE}/my-work`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.locator("section[aria-label='ما ينتظرني']").waitFor({ timeout: 60000 });
  await page.waitForTimeout(9000);
  step("stays on «أعمالي» (no redirect)", new URL(page.url()).pathname === "/my-work", page.url());
  const chips = await page.locator("[aria-label='أعمالي'], button").filter({ hasText: /التقييم|معادة للتصحيح|مسودة بانتظار اعتمادك|الكل/ }).allInnerTexts();
  step("stage chips", chips.length > 0, [...new Set(chips.map((c) => c.replace(/\s+/g, " ").trim()))].slice(0, 8).join(" | "));
  const rows = page.locator("tbody tr");
  const n = await rows.count();
  const first = n ? (await rows.first().innerText()).replace(/\s+/g, " ").slice(0, 160) : "";
  step("rows listed", n > 0, `${n} rows; first: ${first}`);
  const tags = await page.locator("tbody tr td:nth-child(5)").allInnerTexts();
  const tally = {};
  for (const t of tags) {
    const k = t.split("\n")[0].trim();
    tally[k] = (tally[k] ?? 0) + 1;
  }
  step("rows by action", true, JSON.stringify(tally));
  await shot("mywork-01");
  // The sidebar: «تقييم العقار» is gone (Omar 2026-11-11), «أعمالي» is the one entry.
  const nav = (await page.locator("aside, nav").first().innerText().catch(() => "")).replace(/s+/g, " ");
  step("sidebar has no «تقييم العقار»", !nav.includes("تقييم العقار"), nav.slice(0, 200));
  step("sidebar has «أعمالي»", nav.includes("أعمالي"));
  // The handed-over chip: not in «الكل», its own rows under it.
  const allCount = n;
  const handedChip = page.getByRole("button", { name: /المسلَّمة/ }).first();
  step("«المسلَّمة» chip exists", (await handedChip.count()) > 0);
  if (await handedChip.count()) {
    await handedChip.click();
    await page.waitForTimeout(800);
    const hn = await page.locator("tbody tr").count();
    const first = hn ? (await page.locator("tbody tr").first().innerText()).replace(/s+/g, " ").slice(0, 160) : "";
    step("handed rows listed under their chip", hn > 0, hn + " rows; first: " + first);
    await shot("mywork-handed");
    await page.getByRole("button", { name: /الكل/ }).first().click();
    await page.waitForTimeout(500);
    const back = await page.locator("tbody tr").count();
    step("«الكل» excludes the handed-over rows", back === allCount, back + " vs " + allCount);
  }

  // 2 — a row opens his page.
  if (n) {
    await rows.first().click();
    await page.waitForURL(/\/property-appraisal\//, { timeout: 60000 });
    step("a row opens the appraiser's page", true, new URL(page.url()).pathname);
    await page.getByRole("navigation", { name: "أقسام التقييم" }).waitFor({ timeout: 120000 });
  }

  // 3 — the summary's groups on a started valuation, and the handed-over page's first open section.
  const taskRes = await fetch(`${API}/api/workflow-tasks`, { headers: { authorization: `Bearer ${auth.token}` } });
  const body = await taskRes.json();
  const all = (Array.isArray(body) ? body : (body.items ?? body.tasks ?? [])).filter((t) => t.kind === "property-appraisal");
  const withSurvey = all.find((t) => t.engineeringSurveyTaskId && t.fieldInspectionTaskId) ?? all.find((t) => t.fieldInspectionTaskId) ?? all[0];
  console.log("summary task:", withSurvey?.id, "survey:", withSurvey?.engineeringSurveyTaskId, "inspection:", withSurvey?.fieldInspectionTaskId);
  await page.goto(`${BASE}/property-appraisal/${withSurvey.id}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.getByRole("navigation", { name: "أقسام التقييم" }).waitFor({ timeout: 120000 });
  await page.waitForTimeout(8000);
  const areas = page.getByTestId("appraiser-areas");
  step("areas group", (await areas.count()) === 1);
  step("legal group", (await page.getByTestId("appraiser-legal").count()) === 1);
  if (await areas.count()) {
    await areas.scrollIntoViewIfNeeded();
    const txt = (await areas.innerText()).replace(/\s+/g, " ");
    step("areas text", true, txt.slice(0, 300));
    await areas.screenshot({ path: `${SHOT_DIR}/summary-areas.png` });
  }
  const legal = page.getByTestId("appraiser-legal");
  if (await legal.count()) {
    step("legal text", true, (await legal.innerText()).replace(/\s+/g, " ").slice(0, 200));
    await legal.screenshot({ path: `${SHOT_DIR}/summary-legal.png` });
  }
  await shot("summary-top");

  // 4 — a handed-over valuation opens on the summary.
  const handed = all.find((t) => t.appraisalPackageStatus === "submitted");
  if (handed) {
    await page.goto(`${BASE}/property-appraisal/${handed.id}`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.getByRole("navigation", { name: "أقسام التقييم" }).waitFor({ timeout: 120000 });
    await page.waitForTimeout(6000);
    const open = await page.locator("section[id^='work-'] > button[aria-expanded='true']").evaluateAll((els) => els.map((e) => e.closest("section")?.id));
    step("handed-over page opens on the summary", open.length === 1 && open[0] === "work-summary", JSON.stringify(open));
    await shot("handed-over");
  } else step("handed-over page", false, "no handed-over task");

  // 5 — ?report=1 opens the report window once and drops the flag.
  await page.goto(`${BASE}/property-appraisal/${withSurvey.id}?report=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.getByRole("dialog").waitFor({ timeout: 90000 });
  step("?report=1 opens the report window", true);
  step("the flag is dropped from the address", !new URL(page.url()).searchParams.has("report"), page.url());
  await page.waitForTimeout(3000);
  await shot("report-link");
} catch (e) {
  step("run", false, String(e).slice(0, 500));
  await shot("99-failure", true).catch(() => {});
} finally {
  console.log("console errors:", errors.length ? [...new Set(errors)].slice(0, 6) : "none");
  await browser.close();
}
