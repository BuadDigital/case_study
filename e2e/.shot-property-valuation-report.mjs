// Session-local diagnostic driver: property detail «تقييم العقار» tab shows the appraiser's
// valuation report (read-only, no PDF / print buttons). Not a CI test.
// AUTH_FILE=<login json> PAGE_PATH=</po/.../property/...> SHOT_DIR=<dir> node e2e/.shot-property-valuation-report.mjs
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
  try {
    window.sessionStorage.setItem("auth", session);
  } catch {
    /* sandboxed frames */
  }
}, auth);

const page = await ctx.newPage();
const messages = [];
page.on("console", (m) => {
  if (m.type() === "error") messages.push(`[error] ${m.text().slice(0, 200)}`);
});
page.on("pageerror", (e) => messages.push(`[pageerror] ${String(e).slice(0, 300)}`));

try {
  await page.goto(`${BASE}${process.env.PAGE_PATH}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.getByRole("tab", { name: "تقييم العقار" }).or(page.getByText("تقييم العقار", { exact: true })).first().click({ timeout: 120000 });
  const report = page.locator(".rpt-ref .val-rpt-screen");
  await report.waitFor({ timeout: 180000 });
  await page.waitForTimeout(2500);

  for (const label of ["فتح في نافذة", "تنزيل PDF", "رابط PDF", "طباعة / PDF"]) {
    console.log(`button «${label}»:`, await page.getByRole("button", { name: label }).count());
  }
  console.log("report pages:", await page.locator(".rpt-ref section.page").count());
  console.log("red cells:", await page.locator(".rpt-ref td[data-rpt-missing]").count());
  console.log("title:", (await page.locator(".rpt-ref").innerText()).slice(0, 80).replace(/\s+/g, " "));
  await page.screenshot({ path: `${SHOT_DIR}/property-valuation-report.png` });
} catch (e) {
  console.log("ERROR:", String(e).slice(0, 500));
  await page.screenshot({ path: `${SHOT_DIR}/property-valuation-report-error.png` }).catch(() => {});
} finally {
  console.log("messages:", JSON.stringify(messages.slice(0, 8), null, 1));
  await browser.close();
}
