// Session-local driver: opens the appraiser's valuation window in a VISIBLE browser on the
// «المراجعة النهائية» screen and leaves it open (no click on the submit button).
// AUTH_FILE=<login json> TASK_ID=<appraisal task id> [HOLD_MINUTES=120] node e2e/.walk-open-appraiser.mjs
import { chromium } from "@playwright/test";
import fs from "node:fs";

const BASE = process.env.BASE || "http://localhost:3000";
const TASK_ID = process.env.TASK_ID;
const auth = fs.readFileSync(process.env.AUTH_FILE, "utf8");
const holdMs = Number(process.env.HOLD_MINUTES || 120) * 60_000;

const browser = await chromium.launch({ headless: false, slowMo: 250 });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 } });
await ctx.addCookies([{ name: "ree-auth", value: "1", domain: "localhost", path: "/" }]);
await ctx.addInitScript((session) => {
  window.sessionStorage.setItem("auth", session);
}, auth);

const page = await ctx.newPage();
await page.goto(`${BASE}/property-appraisal/${TASK_ID}`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.getByText("أساليب وطرق التقييم المستخدمة").first().waitFor({ timeout: 120000 });
const tabs = page.getByRole("tablist", { name: "أقسام نافذة التقييم" });
for (const name of ["طريقة المقارنة", "رأي القيمة النهائي", "المراجعة النهائية"]) {
  await tabs.getByRole("tab", { name }).click();
  await page.waitForTimeout(2500);
}
const submit = page.getByRole("button", { name: "اعتماد التقييم وإرسال للأخصائي" }).first();
await submit.scrollIntoViewIfNeeded().catch(() => {});
if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT, fullPage: true });
console.log("READY — window open on «المراجعة النهائية»; submit button visible:", await submit.isVisible().catch(() => false));
await page.waitForTimeout(holdMs);
await browser.close();
