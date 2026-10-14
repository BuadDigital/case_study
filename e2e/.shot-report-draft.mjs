// Session-local diagnostic driver: the specialist's report-draft panel in the case-study screen
// («مدخلات التقييم» tab). AUTH_FILE=<login json> TASK_ID=<case-study-property task id> SHOT_DIR=<dir>
import { chromium } from "@playwright/test";
import fs from "node:fs";

const BASE = process.env.BASE || "http://localhost:3000";
const SHOT_DIR = process.env.SHOT_DIR || "./smoke-shots";
fs.mkdirSync(SHOT_DIR, { recursive: true });
const auth = fs.readFileSync(process.env.AUTH_FILE || "auth-tmp.json", "utf8");

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1100 } });
await ctx.addCookies([{ name: "ree-auth", value: "1", domain: "localhost", path: "/" }]);
await ctx.addInitScript((session) => {
  window.sessionStorage.setItem("auth", session);
}, auth);

const page = await ctx.newPage();
try {
  await page.goto(`${BASE}/case-study/${process.env.TASK_ID}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  const tabs = page.getByRole("tablist", { name: "أقسام دراسة الحالة" });
  await tabs.waitFor({ timeout: 120000 });
  await tabs.getByRole("tab", { name: /مدخلات التقييم/ }).click();
  await page.getByText("جاري تجهيز تقرير التقييم").waitFor({ state: "hidden", timeout: 120000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${SHOT_DIR}/report-draft.png` });
  await page.screenshot({ path: `${SHOT_DIR}/report-draft-full.png`, fullPage: true });
  console.log("ok");
} catch (e) {
  console.log("ERROR:", String(e).slice(0, 500));
  await page.screenshot({ path: `${SHOT_DIR}/report-draft-error.png` }).catch(() => {});
} finally {
  await browser.close();
}
