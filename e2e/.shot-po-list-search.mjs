// Session-local diagnostic driver: work-order list search box with a query typed (mode chip +
// clear button must not overlap the text or the search icon). Not a CI test.
// AUTH_FILE=<login json> SHOT_DIR=<dir> node e2e/.shot-po-list-search.mjs
import { chromium } from "@playwright/test";
import fs from "node:fs";

const BASE = process.env.BASE || "http://localhost:3000";
const SHOT_DIR = process.env.SHOT_DIR || "./smoke-shots";
fs.mkdirSync(SHOT_DIR, { recursive: true });
const auth = fs.readFileSync(process.env.AUTH_FILE || "auth-tmp.json", "utf8");

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 820 } });
await ctx.addCookies([{ name: "ree-auth", value: "1", domain: "localhost", path: "/" }]);
await ctx.addInitScript((session) => {
  window.sessionStorage.setItem("auth", session);
}, auth);

const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 300)));

try {
  await page.goto(`${BASE}/po`, { waitUntil: "domcontentloaded", timeout: 120000 });
  const input = page.getByRole("searchbox", { name: "بحث أوامر العمل" });
  await input.waitFor({ timeout: 120000 });
  const toolbar = input.locator("xpath=ancestor::div[2]");
  for (const [name, text] of [["text", "مسب"], ["deed", "320110003654"], ["po", "PO-068"]]) {
    await input.fill(text);
    await page.waitForTimeout(700);
    await toolbar.screenshot({ path: `${SHOT_DIR}/po-search-${name}.png` });
  }
  await page.getByRole("button", { name: "مسح البحث" }).click();
  await page.waitForTimeout(300);
  console.log("after clear:", JSON.stringify(await input.inputValue()));
} catch (e) {
  console.log("ERROR:", String(e).slice(0, 500));
  await page.screenshot({ path: `${SHOT_DIR}/po-search-error.png` }).catch(() => {});
} finally {
  console.log("page errors:", JSON.stringify(errors.slice(0, 5)));
  await browser.close();
}
