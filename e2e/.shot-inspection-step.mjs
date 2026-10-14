// Session-local driver: open the inspector workspace, move to a step, capture it.
// AUTH=<login json> TASK_ID=<id> STEP="بيانات العقار" SHOT_DIR=<dir> node e2e/.shot-inspection-step.mjs
import { chromium } from "@playwright/test";
import fs from "node:fs";

const BASE = process.env.BASE || "http://localhost:3000";
const SHOT_DIR = process.env.SHOT_DIR || "./smoke-shots";
fs.mkdirSync(SHOT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1100 } });
await ctx.addCookies([{ name: "ree-auth", value: "1", domain: "localhost", path: "/" }]);
await ctx.addInitScript((session) => {
  try {
    window.sessionStorage.setItem("auth", session);
  } catch {
    /* sandboxed */
  }
}, fs.readFileSync(process.env.AUTH, "utf8"));
const page = await ctx.newPage();
await page.goto(`${BASE}/active-inspection/${process.env.TASK_ID}`, {
  waitUntil: "domcontentloaded",
  timeout: 120000,
});
await page.getByText("الموقع والتصوير").first().waitFor({ timeout: 120000 });
await page.waitForTimeout(4000);
const step = process.env.STEP;
if (step) {
  await page.getByText(step, { exact: true }).first().click({ timeout: 30000 });
  await page.waitForTimeout(Number(process.env.WAIT_MS || 8000));
}
const name = process.env.NAME || "step";
await page.screenshot({ path: `${SHOT_DIR}/${name}.png`, fullPage: true });
fs.writeFileSync(`${SHOT_DIR}/${name}.txt`, await page.locator("body").innerText(), "utf8");
console.log("saved", `${SHOT_DIR}/${name}.png`);
await browser.close();
