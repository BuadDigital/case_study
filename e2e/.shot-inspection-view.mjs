// Session-local driver: full-page shots of the case-study «الاستعلام الميداني» read view.
// AUTH=<login json> TASK_ID=<id> SHOT_DIR=<dir> [NAME=inspection] [DARK=1] node e2e/.shot-inspection-view.mjs
import { chromium } from "@playwright/test";
import fs from "node:fs";

const BASE = process.env.BASE || "http://localhost:3000";
const SHOT_DIR = process.env.SHOT_DIR || "./smoke-shots";
const NAME = process.env.NAME || "inspection";
fs.mkdirSync(SHOT_DIR, { recursive: true });
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: Number(process.env.VH || 1000) },
  colorScheme: process.env.DARK ? "dark" : "light",
});
await ctx.addCookies([{ name: "ree-auth", value: "1", domain: "localhost", path: "/" }]);
await ctx.addInitScript((s) => {
  try { window.sessionStorage.setItem("auth", s); } catch {}
}, fs.readFileSync(process.env.AUTH, "utf8"));
const page = await ctx.newPage();
await page.goto(`${BASE}/case-study/${process.env.TASK_ID}`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForLoadState("networkidle", { timeout: 60000 }).catch(() => null);
await page.waitForTimeout(3000);
const tabs = await page.getByRole("tab").allInnerTexts().catch(() => []);
console.log("tabs:", JSON.stringify(tabs.map((t) => t.replace(/\s+/g, " ").trim())));
const link = page.getByText(/استعلام ميداني|الاستعلام الميداني|معاينة العقار/).first();
if (process.env.CLICK) await page.getByText(process.env.CLICK).first().click();
await page.waitForTimeout(2500);
if (process.env.CLIPS) {
  let i = 0;
  for (const c of process.env.CLIPS.split(",")) {
    const [y, h] = c.split(":").map(Number);
    await page.screenshot({ path: `${SHOT_DIR}/${NAME}-${i++}.png`, fullPage: true, clip: { x: 240, y, width: 920, height: h } });
  }
} else await page.screenshot({ path: `${SHOT_DIR}/${NAME}.png`, fullPage: true });
fs.writeFileSync(`${SHOT_DIR}/${NAME}.txt`, await page.locator("body").innerText(), "utf8");
console.log("saved");
await browser.close();
