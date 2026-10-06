// Session-local driver: open an appraiser workspace screen by its nav label and capture it.
// AUTH=<login json> TASK_ID=<id> SCREEN="طريقة المقاول" SHOT_DIR=<dir> node e2e/.shot-appraiser-screen.mjs
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
await page.goto(`${BASE}/property-appraisal/${process.env.TASK_ID}`, {
  waitUntil: "domcontentloaded",
  timeout: 120000,
});
await page.getByText(process.env.READY_TEXT || "البيانات الأساسية").first().waitFor({ timeout: 120000 });
await page.waitForTimeout(4000);

const screen = process.env.SCREEN;
if (screen) {
  const target = page.getByText(screen, { exact: true }).first();
  await target.click({ timeout: 30000 });
  await page.waitForTimeout(Number(process.env.WAIT_MS || 9000));
}
const name = process.env.NAME || "screen";
await page.screenshot({ path: `${SHOT_DIR}/${name}.png`, fullPage: true });
fs.writeFileSync(`${SHOT_DIR}/${name}.txt`, await page.locator("body").innerText(), "utf8");
console.log("saved", `${SHOT_DIR}/${name}.png`);
await browser.close();
