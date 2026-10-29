// Session-local driver: walk every tab of the appraiser's valuation window (read only), screenshot
// each, and collect console errors, page errors and failed responses; flag any income-approach text
// (the locked setting and a valued document's method label are expected) and check that the report
// preview and print copy open.
// AUTH=<login json> TASK_ID=<appraisal task> OUT=<dir> node e2e/.walk-valuation-tabs.mjs
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE || "http://localhost:3000";
const OUT = process.env.OUT;
fs.mkdirSync(OUT, { recursive: true });
const results = { steps: [], consoleErrors: [], pageErrors: [], failedApi: [] };
const step = (name, ok, note = "") => {
  results.steps.push({ name, ok, note });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${note ? " — " + note : ""}`);
};

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
ctx.on("page", (p) => {
  p.on("console", (m) => {
    if (m.type() === "error") results.consoleErrors.push(`${p.url().slice(-40)} ${m.text().slice(0, 300)}`);
  });
  p.on("pageerror", (e) => results.pageErrors.push(String(e).slice(0, 300)));
  p.on("response", (r) => {
    if (r.status() >= 400) {
      results.failedApi.push(`${r.status()} ${r.request().method()} ${r.url().replace(/^https?:\/\/[^/]+/, "")}`);
    }
  });
});

const page = await ctx.newPage();
const shot = (name) => page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
try {
  await page.goto(`${BASE}/property-appraisal/${process.env.TASK_ID}`, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await page.getByText("أساليب وطرق التقييم المستخدمة").first().waitFor({ timeout: 120000 });
  await page.waitForTimeout(2500);
  step("basic tab renders", true);
  const basicText = await page.locator("body").innerText();
  step("income approach not offered", !/أسلوب الدخل|طريقة الدخل|رسملة الدخل/.test(basicText));
  await shot("01-basic");

  const tabs = page.getByRole("tablist", { name: "أقسام نافذة التقييم" });
  const checks = [
    ["طريقة المقارنة", "02-market", "جدول التسويات"],
    ["طريقة المقاول", "03-cost", "بنود التكلفة المباشرة"],
    ["رأي القيمة النهائي", "04-final", "الرأي النهائي للقيمة"],
    ["المراجعة النهائية", "05-review", "الافتراضات الخاصة"],
  ];
  for (const [tab, name, marker] of checks) {
    await tabs.getByRole("tab", { name: tab }).click();
    const ok = await page.getByText(marker).first().waitFor({ timeout: 30000 }).then(() => true).catch(() => false);
    await page.waitForTimeout(2500);
    const text = await page.locator("body").innerText();
    step(`${tab} renders`, ok, ok ? "" : `marker «${marker}» missing`);
    step(`${tab}: no literal null/undefined/NaN`, !/\bnull\b|\bundefined\b|\bNaN\b/.test(text));
    step(`${tab}: no income approach`, !/أسلوب الدخل|طريقة الدخل|رسملة الدخل/.test(text));
    await shot(name);
  }

  await tabs.getByRole("tab", { name: "تقرير التقييم" }).click();
  await page.locator(".rpt-ref .val-rpt-screen").waitFor({ timeout: 90000 });
  await page.waitForTimeout(4000);
  const reportText = await page.locator(".val-rpt-screen").first().innerText();
  step("report preview renders", true);
  step("report: no literal null/undefined/NaN", !/\bnull\b|\bundefined\b|\bNaN\b/.test(reportText));
  step("report: no income approach section", !/أسلوب الدخل|طريقة الدخل|رسملة الدخل/.test(reportText));
  step("report: adjustment rationales printed", reportText.includes("مبررات التسويات"));
  step("report: cost rationale printed", reportText.includes("مبررات التقدير"));
  step("report: weight rationales printed", reportText.includes("مبررات نسب المشاركة"));
  step("report: subject column in adjustments", reportText.includes("العقار محل التقييم"));
  fs.writeFileSync(path.join(OUT, "report.txt"), reportText, "utf8");
  await shot("06-output");

  const popupP = ctx.waitForEvent("page", { timeout: 60000 });
  await page.getByRole("button", { name: /طباعة/ }).first().click();
  const popup = await popupP;
  await popup.waitForLoadState("load", { timeout: 90000 }).catch(() => {});
  const pages = await popup
    .waitForFunction(() => document.querySelectorAll(".page").length, null, { timeout: 90000 })
    .then((h) => h.jsonValue())
    .catch(() => 0);
  step("print copy opens", pages > 0, `${pages} pages`);
  await popup.waitForTimeout(5000);
  await popup.pdf({ path: path.join(OUT, "report.pdf"), format: "A4", printBackground: true, preferCSSPageSize: true });
} catch (e) {
  step("walk", false, String(e).slice(0, 300));
  await shot("error").catch(() => {});
} finally {
  fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 2), "utf8");
  console.log("console errors:", results.consoleErrors.length, "page errors:", results.pageErrors.length);
  console.log(results.consoleErrors.slice(0, 15).join("\n"));
  console.log(results.pageErrors.slice(0, 10).join("\n"));
  console.log("failed api:\n" + [...new Set(results.failedApi)].join("\n"));
  await browser.close();
}
