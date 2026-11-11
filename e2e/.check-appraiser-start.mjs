// Session-local driver (not a CI test): the appraiser's page in its sections layout (2026-11-10)
// — does the first save still work? Opens an appraisal not started yet, ticks the approaches,
// presses «بدء التقييم», and checks the save went through and the remaining sections appeared.
// WRITES to the local stack: it starts the valuation of the task it picks.
// LOGIN=<appraiser mobile> [TASK_ID=<appraisal task id>] SHOT_DIR=<dir> node e2e/.check-appraiser-start.mjs
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

const res = await fetch(`${API}/api/workflow-tasks`, { headers: { authorization: `Bearer ${auth.token}` } });
const body = await res.json();
const rows = Array.isArray(body) ? body : (body.items ?? body.tasks ?? []);
const open = rows.filter((t) => t.kind === "property-appraisal" && t.status !== "cancelled" && t.status !== "completed");
const candidates = process.env.TASK_ID ? [{ id: process.env.TASK_ID }] : open;
console.log(`${open.length} open appraisal tasks`);

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
await ctx.addCookies([{ name: "ree-auth", value: "1", domain: "localhost", path: "/" }]);
await ctx.addInitScript((session) => window.sessionStorage.setItem("auth", session), JSON.stringify(auth));
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text().slice(0, 300));
});
page.on("pageerror", (e) => errors.push("PAGEERROR " + String(e).slice(0, 300)));
const notFound = [];
page.on("response", (r) => {
  if (r.status() === 404) notFound.push(r.request().method() + " " + new URL(r.url()).pathname.replace(/[0-9a-f-]{36}/g, ":id"));
});
const step = (name, ok, note = "") => console.log(`${ok ? "PASS" : "FAIL"} ${name}${note ? " — " + note : ""}`);
const shot = (name, fullPage = false) => page.screenshot({ path: `${SHOT_DIR}/${name}.png`, fullPage });

try {
  const rail = page.getByRole("navigation", { name: "أقسام التقييم" });
  const start = page.getByRole("button", { name: "بدء التقييم" }).first();
  // The first open task whose valuation has not started: «بدء التقييم» is offered and the rail
  // has no «طريقة المقارنة» yet.
  let picked = null;
  for (const task of candidates.slice(0, 12)) {
    await page.goto(`${BASE}/property-appraisal/${task.id}`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await rail.getByRole("button", { name: /أساليب وطرق التقييم/ }).waitFor({ timeout: 120000 });
    await page.waitForTimeout(5000);
    const started = (await rail.getByRole("button", { name: /طريقة المقارنة|طريقة المقاول/ }).count()) > 0;
    const canStart = (await start.count()) > 0 && (await start.isEnabled().catch(() => false));
    console.log(`task ${task.id}: started=${started} canStart=${canStart}`);
    if (!started && canStart) {
      picked = task.id;
      break;
    }
  }
  if (!picked) throw new Error("no appraisal waiting for «بدء التقييم» among the first tasks");
  step("found a valuation not started", true, picked);
  await shot("start-01-before");

  const marketBox = page.getByRole("checkbox", { name: "أسلوب السوق" });
  const costBox = page.getByRole("checkbox", { name: "أسلوب التكلفة" });
  for (let i = 0; i < 10; i += 1) {
    if (!(await marketBox.isChecked())) await marketBox.check();
    if ((await costBox.count()) > 0 && (await costBox.isEnabled()) && !(await costBox.isChecked())) await costBox.check();
    await page.waitForTimeout(1500);
    if (await marketBox.isChecked()) break;
  }
  step("approaches ticked", await marketBox.isChecked());

  const saved = page
    .waitForResponse((r) => r.url().includes("/approach-settings") && r.request().method() === "PUT", { timeout: 90000 })
    .catch(() => null);
  await start.click();
  const save = await saved;
  step("first save sent", save !== null);
  if (save) step("first save accepted", save.status() === 200, `HTTP ${save.status()}${save.status() === 200 ? "" : " " + (await save.text()).slice(0, 300)}`);
  await page.waitForTimeout(4000);
  await shot("start-02-after");

  const names404 = [...new Set(notFound)];
  console.log("404s:", names404.length ? names404.join(" , ") : "none");
  const names = (await rail.locator("ol > li").allInnerTexts()).map((r) => r.replace(/\s+/g, " ").trim());
  step("remaining sections appeared", names.some((n) => /رأي القيمة النهائي/.test(n)), names.join(" | "));

  await rail.getByRole("button", { name: /رأي القيمة النهائي/ }).click();
  await page.waitForTimeout(3000);
  step("final-opinion section opens", (await page.locator("#work-final > button[aria-expanded='true']").count()) === 1);
  await shot("start-03-final");
  await rail.getByRole("button", { name: /المراجعة النهائية/ }).click();
  await page.waitForTimeout(3000);
  step("review section opens", (await page.locator("#work-review > button[aria-expanded='true']").count()) === 1);
  const send = page.getByRole("button", { name: /اعتماد التقييم/ });
  step("send button on the page", (await send.count()) > 0, `${await send.count()} button(s)`);
  await shot("start-04-review", true);
} catch (e) {
  step("run", false, String(e).slice(0, 500));
  await shot("start-99-failure", true).catch(() => {});
} finally {
  console.log("console errors:", errors.length ? errors.slice(0, 8) : "none");
  await browser.close();
}
