// Session-local driver (not a CI test): opens the appraiser's page in its sections layout
// (2026-11-10), checks the frame, and takes screenshots. Read-only — it clicks nothing that saves.
// LOGIN=<appraiser email or mobile> [TASK_ID=<appraisal task id>] SHOT_DIR=<dir> node e2e/.shot-appraiser-sections.mjs
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

let taskId = process.env.TASK_ID;
if (!taskId) {
  const res = await fetch(`${API}/api/workflow-tasks`, {
    headers: { authorization: `Bearer ${auth.token}` },
  });
  const body = await res.json();
  const rows = Array.isArray(body) ? body : (body.items ?? body.tasks ?? []);
  const mine = rows.filter((t) => t.kind === "property-appraisal" && t.status !== "cancelled");
  const pick = mine.find((t) => t.status !== "completed") ?? mine[0];
  if (!pick) throw new Error(`no appraisal task (of ${rows.length} rows)`);
  taskId = pick.id;
  console.log(`task ${taskId} status=${pick.status} (${mine.length} appraisal tasks)`);
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
await ctx.addCookies([{ name: "ree-auth", value: "1", domain: "localhost", path: "/" }]);
await ctx.addInitScript((session) => {
  window.sessionStorage.setItem("auth", session);
}, JSON.stringify(auth));

const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text().slice(0, 300));
});
page.on("pageerror", (e) => errors.push("PAGEERROR " + String(e).slice(0, 300)));

const step = (name, ok, note = "") => console.log(`${ok ? "PASS" : "FAIL"} ${name}${note ? " — " + note : ""}`);
const shot = (name, fullPage = false) => page.screenshot({ path: `${SHOT_DIR}/${name}.png`, fullPage });

try {
  await page.goto(`${BASE}/property-appraisal/${taskId}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  const rail = page.getByRole("navigation", { name: "أقسام التقييم" });
  await rail.waitFor({ timeout: 120000 });
  await page.waitForTimeout(6000);
  const railRows = await rail.locator("ol > li").allInnerTexts();
  step("rail lists the sections", railRows.length >= 4, railRows.map((r) => r.replace(/\s+/g, " ").trim()).join(" | "));
  step("no tab bar", (await page.getByRole("tablist", { name: "أقسام نافذة التقييم" }).count()) === 0);
  step("summary section present", (await page.locator("#work-summary").count()) === 1);
  step("study summary slot", (await page.getByTestId("appraiser-study-summary").count()) === 1);
  step("report line", (await page.getByTestId("evaluator-report-line").count()) === 1);
  const open = await page.locator("section[id^='work-'] > button[aria-expanded='true']").count();
  step("sections open at first paint", true, `${open} open`);
  await shot("01-top");
  // Expand everything and capture the whole page.
  await rail.getByRole("button", { name: "توسيع جميع الأقسام" }).click();
  await page.waitForTimeout(5000);
  await shot("02-all-open", true);
  const study = page.getByTestId("appraiser-study-summary");
  await study.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1500);
  await study.screenshot({ path: `${SHOT_DIR}/01b-study-summary.png` });
  const studyButtons = await study.getByRole("button").allInnerTexts();
  step("study summary buttons", true, studyButtons.join(" | ") || "none");
  const labels = await study.locator("label, [class*='text-[11px]']").allInnerTexts();
  step("study summary fields", true, [...new Set(labels.map((l) => l.trim()).filter(Boolean))].join(" | "));

  for (const id of ["summary", "basic", "market", "cost", "final", "review"]) {
    const sec = page.locator(`#work-${id}`);
    if ((await sec.count()) === 0) continue;
    await sec.scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    await sec.screenshot({ path: `${SHOT_DIR}/sec-${id}.png` });
  }

  // Rail pick folds the rest and scrolls.
  await rail.locator("ol > li button").nth(1).click();
  await page.waitForTimeout(1500);
  const openAfter = await page.locator("section[id^='work-'] > button[aria-expanded='true']").count();
  step("rail pick opens one section", openAfter === 1, `${openAfter} open`);
  await shot("03-approaches");

  // Report window.
  await page.getByTestId("evaluator-report-line").getByRole("button", { name: "تقرير التقييم" }).click();
  await page.getByRole("dialog").waitFor({ timeout: 30000 });
  await page.waitForTimeout(8000);
  await shot("04-report-window");
  step("report window opens", true);
} catch (e) {
  step("run", false, String(e).slice(0, 400));
  await shot("99-failure", true).catch(() => {});
} finally {
  console.log("console errors:", errors.length ? errors.slice(0, 8) : "none");
  await browser.close();
}
