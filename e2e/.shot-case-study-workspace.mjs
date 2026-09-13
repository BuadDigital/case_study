// Session-local diagnostic driver: case-study workspace section cards (1 نموذج الدراسة / 2 تقييم العقار).
// AUTH_FILE=<login json> TASK_ID=<case-study-property task id> SHOT_DIR=<dir> node e2e/.shot-case-study-workspace.mjs
import { chromium } from "@playwright/test";
import fs from "node:fs";

const BASE = process.env.BASE || "http://localhost:3000";
const SHOT_DIR = process.env.SHOT_DIR || "./smoke-shots";
fs.mkdirSync(SHOT_DIR, { recursive: true });
const auth = fs.readFileSync(process.env.AUTH_FILE || "auth-tmp.json", "utf8");

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 } });
await ctx.addCookies([{ name: "ree-auth", value: "1", domain: "localhost", path: "/" }]);
await ctx.addInitScript((session) => {
  window.sessionStorage.setItem("auth", session);
}, auth);

const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 300)));

try {
  await page.goto(`${BASE}/case-study/${process.env.TASK_ID}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  const tabs = page.getByRole("tablist", { name: "أقسام دراسة الحالة" });
  await tabs.waitFor({ timeout: 120000 });
  await page.waitForTimeout(2500);
  console.log("tabs:", JSON.stringify((await tabs.getByRole("tab").allInnerTexts()).map((t) => t.replace(/\s+/g, " ").trim())));
  console.log("selected:", await tabs.getByRole("tab", { selected: true }).innerText());
  await page.screenshot({ path: `${SHOT_DIR}/case-study-study.png` });
  await tabs.getByRole("tab", { name: /تقييم العقار/ }).click();
  await page.waitForTimeout(2000);
  console.log("after click selected:", (await tabs.getByRole("tab", { selected: true }).innerText()).replace(/\s+/g, " "));
  await page.screenshot({ path: `${SHOT_DIR}/case-study-appraisal.png` });
} catch (e) {
  console.log("ERROR:", String(e).slice(0, 500));
  await page.screenshot({ path: `${SHOT_DIR}/case-study-error.png` }).catch(() => {});
} finally {
  console.log("page errors:", JSON.stringify(errors.slice(0, 5)));
  await browser.close();
}
