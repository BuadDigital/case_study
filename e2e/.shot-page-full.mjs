// Session-local driver: full-page screenshot + visible text of any app page.
// AUTH=<login json> PAGE_PATH=</path?query> SHOT_DIR=<dir> [NAME=page] node e2e/.shot-page-full.mjs
import { chromium } from "@playwright/test";
import fs from "node:fs";

const BASE = process.env.BASE || "http://localhost:3000";
const SHOT_DIR = process.env.SHOT_DIR || "./smoke-shots";
const NAME = process.env.NAME || "page";
fs.mkdirSync(SHOT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
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
await page.waitForLoadState("networkidle", { timeout: 60000 }).catch(() => null);
await page.waitForTimeout(3000);
await page.screenshot({ path: `${SHOT_DIR}/${NAME}.png`, fullPage: true });
fs.writeFileSync(`${SHOT_DIR}/${NAME}.txt`, await page.locator("body").innerText(), "utf8");
console.log("saved", `${SHOT_DIR}/${NAME}.png`);
await browser.close();
