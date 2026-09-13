// Session-local diagnostic driver: «طلبات التقييم» property column shows deed + work order,
// not the internal property id. Not a CI test.
// AUTH_FILE=<login json> SHOT_DIR=<dir> node e2e/.shot-valuation-requests.mjs
import { chromium } from "@playwright/test";
import fs from "node:fs";

const BASE = process.env.BASE || "http://localhost:3000";
const SHOT_DIR = process.env.SHOT_DIR || "./smoke-shots";
fs.mkdirSync(SHOT_DIR, { recursive: true });
const auth = fs.readFileSync(process.env.AUTH_FILE || "auth-tmp.json", "utf8");

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
await ctx.addCookies([{ name: "ree-auth", value: "1", domain: "localhost", path: "/" }]);
await ctx.addInitScript((session) => {
  window.sessionStorage.setItem("auth", session);
}, auth);

const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 300)));

try {
  await page.goto(`${BASE}/valuation-requests`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.getByText("سجل طلبات التقييم").waitFor({ timeout: 120000 });
  await page.locator("tbody tr").filter({ hasText: "VR-" }).first().waitFor({ timeout: 60000 });
  await page.waitForTimeout(2500);
  for (const row of await page.locator("tbody tr").filter({ hasText: "VR-" }).all()) {
    const cells = await row.locator("td").allInnerTexts();
    console.log(cells.slice(0, 4).map((c) => c.replace(/\s+/g, " ").trim()).join(" | "));
  }
  console.log("guid visible:", await page.getByText(/[0-9a-f]{8}-[0-9a-f]{4}-/).count());
  await page.screenshot({ path: `${SHOT_DIR}/valuation-requests.png` });
} catch (e) {
  console.log("ERROR:", String(e).slice(0, 500));
  await page.screenshot({ path: `${SHOT_DIR}/valuation-requests-error.png` }).catch(() => {});
} finally {
  console.log("page errors:", JSON.stringify(errors.slice(0, 5)));
  await browser.close();
}
