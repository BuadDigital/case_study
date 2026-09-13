// Session-local driver: open the embedded valuation report on a property page and save each
// report page as PNG plus its text, for side-by-side comparison with a reference PDF.
// AUTH=<login json> PAGE_PATH=</po/.../property/...> TAB=<tab name> SHOT_DIR=<dir> node e2e/.shot-report-pages.mjs
import { chromium } from "@playwright/test";
import fs from "node:fs";

const BASE = process.env.BASE || "http://localhost:3000";
const SHOT_DIR = process.env.SHOT_DIR || "./smoke-shots";
fs.mkdirSync(SHOT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
await ctx.addCookies([{ name: "ree-auth", value: "1", domain: "localhost", path: "/" }]);
await ctx.addInitScript((session) => {
  try {
    window.sessionStorage.setItem("auth", session);
  } catch {
    /* sandboxed frames */
  }
}, fs.readFileSync(process.env.AUTH, "utf8"));
const page = await ctx.newPage();
await page.goto(`${BASE}${process.env.PAGE_PATH}`, { waitUntil: "domcontentloaded", timeout: 120000 });
const tabName = process.env.TAB || "تقييم العقار";
const tab = page.getByRole("tab", { name: tabName }).or(page.getByText(tabName, { exact: true })).first();
await tab.waitFor({ timeout: 120000 });
await tab.click();
await page.locator(".rpt-ref .val-rpt-screen").waitFor({ timeout: 60000 });
await page.waitForTimeout(2500);

const pages = page.locator(".rpt-ref .page");
const count = await pages.count();
const texts = [];
for (let i = 0; i < count; i += 1) {
  const el = pages.nth(i);
  await el.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await el.screenshot({ path: `${SHOT_DIR}/ours-p${String(i + 1).padStart(2, "0")}.png` });
  texts.push(`\n===== PAGE ${i + 1} =====\n${(await el.innerText()).replace(/\n{2,}/g, "\n")}`);
}
fs.writeFileSync(`${SHOT_DIR}/ours-text.txt`, texts.join("\n"), "utf8");
console.log("pages", count);
await browser.close();
