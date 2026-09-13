// Session-local diagnostic driver: evaluator report tab — red missing-field cells are the controls
// (prompt for party sources, tab jump for the appraiser's own fields). Not a CI test.
// AUTH_FILE=<login json> TASK_ID=<property-appraisal task id> SHOT_DIR=<dir> node e2e/.shot-report-click.mjs
import { chromium } from "@playwright/test";
import fs from "node:fs";

const BASE = process.env.BASE || "http://localhost:3000";
const SHOT_DIR = process.env.SHOT_DIR || "./smoke-shots";
fs.mkdirSync(SHOT_DIR, { recursive: true });
const auth = fs.readFileSync(process.env.AUTH_FILE || "auth-tmp.json", "utf8");

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
await ctx.addCookies([{ name: "ree-auth", value: "1", domain: "localhost", path: "/" }]);
await ctx.addInitScript((session) => {
  window.sessionStorage.setItem("auth", session);
}, auth);

const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text().slice(0, 300));
});
page.on("pageerror", (e) => errors.push(String(e).slice(0, 300)));

try {
  await page.goto(`${BASE}/property-appraisal/${process.env.TASK_ID}`, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await page.getByRole("tab", { name: "تقرير التقييم" }).or(page.getByText("تقرير التقييم", { exact: true })).first().click({ timeout: 120000 });
  await page.locator(".rpt-ref td[data-rpt-missing]").first().waitFor({ timeout: 120000 });
  await page.waitForTimeout(1500);

  console.log("banner present:", await page.locator('[data-testid="report-missing-fields"]').count());
  console.log("marked cells:", await page.locator(".rpt-ref td[data-rpt-missing]").count());
  const sources = await page.$$eval(".rpt-ref td[data-rpt-missing]", (cells) =>
    cells.reduce((acc, c) => {
      const s = c.getAttribute("data-rpt-missing-source");
      acc[s] = (acc[s] ?? 0) + 1;
      return acc;
    }, {}),
  );
  console.log("by source:", JSON.stringify(sources));
  await page.screenshot({ path: `${SHOT_DIR}/report-click-top.png` });

  for (const source of ["intake", "inspector", "org"]) {
    const cell = page.locator(`.rpt-ref td[data-rpt-missing-source="${source}"]`).first();
    if (!(await cell.count())) {
      console.log(`${source}: no marked cell`);
      continue;
    }
    await cell.scrollIntoViewIfNeeded();
    console.log(`${source} cell:`, await cell.getAttribute("data-rpt-missing-label"), "|", await cell.getAttribute("title"));
    await cell.click();
    const prompt = page.locator('[data-testid="report-missing-prompt"]');
    await prompt.waitFor({ timeout: 10000 });
    await page.waitForTimeout(2500);
    console.log(`${source} prompt:`, (await prompt.innerText()).replace(/\s+/g, " "));
    await page.screenshot({ path: `${SHOT_DIR}/report-click-${source}.png` });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    console.log(`${source} closed:`, (await prompt.count()) === 0);
  }

  const appraiserCell = page.locator('.rpt-ref td[data-rpt-missing-source="appraiser"]').first();
  if (await appraiserCell.count()) {
    await appraiserCell.scrollIntoViewIfNeeded();
    const tab = await appraiserCell.getAttribute("data-rpt-missing-tab");
    console.log("appraiser cell:", await appraiserCell.getAttribute("data-rpt-missing-label"), "→", tab);
    await appraiserCell.click();
    await page.waitForTimeout(2000);
    console.log("report still visible after click:", await page.locator(".rpt-ref").isVisible());
    await page.screenshot({ path: `${SHOT_DIR}/report-click-appraiser-nav.png` });
  }
} catch (e) {
  console.log("ERROR:", String(e).slice(0, 500));
  await page.screenshot({ path: `${SHOT_DIR}/report-click-error.png` }).catch(() => {});
} finally {
  console.log("errors:", JSON.stringify(errors.slice(0, 10), null, 1));
  await browser.close();
}
