// Session-local diagnostic driver: timeline of every loading indicator shown while the valuation
// report opens (appraiser tab and property page), with a screenshot at each change.
// AUTH_APPRAISER=<login json> AUTH_ADMIN=<login json> TASK_ID=<appraisal task> PROPERTY_PATH=</po/.../property/...>
// SHOT_DIR=<dir> node e2e/.trace-report-loading.mjs
import { chromium } from "@playwright/test";
import fs from "node:fs";

const BASE = process.env.BASE || "http://localhost:3000";
const SHOT_DIR = process.env.SHOT_DIR || "./smoke-shots";
fs.mkdirSync(SHOT_DIR, { recursive: true });

async function trace(label, authFile, path, tabName) {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 } });
  await ctx.addCookies([{ name: "ree-auth", value: "1", domain: "localhost", path: "/" }]);
  await ctx.addInitScript((session) => {
    try {
      window.sessionStorage.setItem("auth", session);
    } catch {
      /* sandboxed frames */
    }
  }, fs.readFileSync(authFile, "utf8"));
  const page = await ctx.newPage();
  const requests = [];
  page.on("request", (r) => {
    const u = r.url();
    if (/valuation-report-v3\.html|organization-settings|report-output|valuation-requests|building-inventory|party-task-submissions|comparable-selections|cost-approach|reconciliation|approach-settings|inspector|attachments/.test(u)) {
      requests.push({ t: Date.now(), url: u.replace(BASE, "").replace(/https?:\/\/[^/]+/, "").slice(0, 110) });
    }
  });

  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  const tab = page.getByRole("tab", { name: tabName }).or(page.getByText(tabName, { exact: true })).first();
  await tab.waitFor({ timeout: 120000 });
  // Time on the page before opening the report (the evaluator preloads the report code meanwhile).
  await page.waitForTimeout(Number(process.env.PRE_CLICK_MS || 1500));

  const t0 = Date.now();
  requests.length = 0;
  await tab.click();

  let last = "";
  const timeline = [];
  let shot = 0;
  while (Date.now() - t0 < 25000) {
    const state = await page.evaluate(() => {
      const visible = (el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      };
      const statusBoxes = [...document.querySelectorAll('[role="status"]')].filter(visible)
        .map((el) => (el.textContent || "").replace(/\s+/g, " ").trim()).filter(Boolean);
      const preparing = [...document.querySelectorAll("span")].some(
        (s) => visible(s) && (s.textContent || "").includes("جاري تجهيز تقرير التقييم"),
      );
      const spinners = [...document.querySelectorAll(".animate-spin, [class*='animate-spin']")].filter(visible).length;
      const busy = [...document.querySelectorAll("[aria-busy]")].filter(visible).length;
      const report = document.querySelector(".rpt-ref .val-rpt-screen");
      return JSON.stringify({
        statusBoxes,
        preparing,
        spinners,
        busy,
        report: Boolean(report && visible(report)),
      });
    });
    if (state !== last) {
      const at = Date.now() - t0;
      timeline.push(`${String(at).padStart(5)}ms ${state}`);
      last = state;
      shot += 1;
      await page.screenshot({ path: `${SHOT_DIR}/${label}-${String(shot).padStart(2, "0")}-${at}ms.png` });
      if (JSON.parse(state).report) break;
    }
    await page.waitForTimeout(80);
  }
  console.log(`== ${label}`);
  for (const line of timeline) console.log(line);
  console.log("requests after click:");
  for (const r of requests) console.log(`  +${r.t - t0}ms ${r.url}`);
  await browser.close();
}

await trace("appraiser", process.env.AUTH_APPRAISER, `/property-appraisal/${process.env.TASK_ID}`, "تقرير التقييم");
await trace("property", process.env.AUTH_ADMIN, process.env.PROPERTY_PATH, "تقييم العقار");
