// Session-local driver: open the appraiser's valuation report, press «طباعة / PDF», and save the
// print tab as an A4 PDF (what the user prints) for comparison with a reference report.
// AUTH=<login json> TASK_ID=<appraisal task> OUT_PDF=<file.pdf> node e2e/.print-report-pdf.mjs
import { chromium } from "@playwright/test";
import fs from "node:fs";

const BASE = process.env.BASE || "http://localhost:3000";
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
await ctx.addCookies([{ name: "ree-auth", value: "1", domain: "localhost", path: "/" }]);
await ctx.addInitScript((session) => {
  try {
    window.sessionStorage.setItem("auth", session);
  } catch {
    /* sandboxed frames */
  }
}, fs.readFileSync(process.env.AUTH, "utf8"));
const page = await ctx.newPage();
try {
  await page.goto(`${BASE}/property-appraisal/${process.env.TASK_ID}`, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  const tab = page.getByRole("tab", { name: "تقرير التقييم" }).or(page.getByText("تقرير التقييم", { exact: true })).first();
  await tab.waitFor({ timeout: 120000 });
  await tab.click();
  await page.locator(".rpt-ref .val-rpt-screen").waitFor({ timeout: 90000 });
  await page.waitForTimeout(3000);

  const popupP = ctx.waitForEvent("page", { timeout: 60000 });
  await page.getByRole("button", { name: /طباعة/ }).first().click();
  const popup = await popupP;
  await popup.waitForLoadState("load", { timeout: 90000 }).catch(() => {});
  await popup.waitForFunction(() => document.querySelectorAll(".page").length > 0, null, { timeout: 90000 });
  await popup.waitForTimeout(6000);
  await popup.pdf({ path: process.env.OUT_PDF, format: "A4", printBackground: true, preferCSSPageSize: true });
  console.log("saved", process.env.OUT_PDF);
} catch (e) {
  console.log("ERROR:", String(e).slice(0, 500));
  await page.screenshot({ path: `${process.env.OUT_PDF}.error.png` }).catch(() => {});
} finally {
  await browser.close();
}
