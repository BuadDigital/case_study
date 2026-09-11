// Session-local diagnostic driver: screenshot sections of a rendered screen-mode valuation report
// with red missing-field marks. Not a CI test.
// RENDER_FILE=<html from zz-tmp-render-missing.test.ts> SHOT_DIR=<dir> node e2e/.shot-report-missing-fields.mjs
import { chromium } from "@playwright/test";
import fs from "node:fs";
import { pathToFileURL } from "node:url";

const SHOT_DIR = process.env.SHOT_DIR || "./smoke-shots";
fs.mkdirSync(SHOT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
try {
  await page.goto(pathToFileURL(process.env.RENDER_FILE).href, { waitUntil: "load" });
  console.log("marked cells:", await page.locator("[data-rpt-missing]").count());
  for (const sec of ["1", "2", "6", "7", "11", "14", "25", "26"]) {
    const el = page.locator(`[data-sec="${sec}"]`).first();
    if (!(await el.count())) {
      console.log(`sec ${sec}: removed`);
      continue;
    }
    await el.screenshot({ path: `${SHOT_DIR}/missing-sec-${sec}.png` });
  }
  const first = page.locator("[data-rpt-missing]").first();
  console.log("first title:", await first.getAttribute("title"));
} catch (e) {
  console.log("ERROR:", String(e).slice(0, 500));
} finally {
  await browser.close();
}
