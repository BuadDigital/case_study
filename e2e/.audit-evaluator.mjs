// Session-local audit driver: walk all six evaluator tabs, screenshot each,
// capture console errors, plant unique marker strings in a few free-text
// fields, then check whether those markers actually appear in the printed
// report HTML. Not a CI test.
import { chromium } from "@playwright/test";
import fs from "node:fs";

const TASK_ID = process.env.TASK_ID || "62fb83e7-5ff5-45b9-859c-461f99aab392";
const BASE = "http://localhost:3000";
const SHOT_DIR = process.env.SHOT_DIR || "./smoke-shots";
fs.mkdirSync(SHOT_DIR, { recursive: true });

const auth = JSON.parse(fs.readFileSync("auth-abdullah.json", "utf8"));
const results = { consoleErrors: [], notes: [], markers: {} };
const note = (m) => {
  results.notes.push(m);
  console.log(m);
};

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
await ctx.addCookies([{ name: "ree-auth", value: "1", domain: "localhost", path: "/" }]);
await ctx.addInitScript((session) => {
  window.sessionStorage.setItem("auth", session);
}, JSON.stringify(auth));

const page = await ctx.newPage();
page.on("console", (m) => {
  if (m.type() === "error") {
    const t = m.text();
    if (/StaticMapService|maps\.googleapis|403|favicon/i.test(t)) return;
    results.consoleErrors.push(`[${page.url().split("/").pop()}] ${t.slice(0, 300)}`);
  }
});
page.on("pageerror", (e) => results.consoleErrors.push("pageerror: " + String(e).slice(0, 300)));

const shot = (name) => page.screenshot({ path: `${SHOT_DIR}/${name}.png`, fullPage: true });
const clickTab = async (label) => {
  // A save toast sits fixed top-center and can occlude the tab bar — wait it out.
  for (let i = 0; i < 8; i++) {
    const toastUp = await page
      .locator('[class*="fixed"][class*="top"], [role="status"], [role="alert"]')
      .filter({ hasText: /./ })
      .first()
      .isVisible()
      .catch(() => false);
    if (!toastUp) break;
    await page.waitForTimeout(1000);
  }
  // Belt-and-suspenders: a toast can still be mid-fade: give it a moment either way.
  await page.waitForTimeout(500);
  const tab = page.getByRole("tab").filter({ hasText: label }).first();
  const btn = (await tab.isVisible().catch(() => false))
    ? tab
    : page.getByRole("button", { name: label, exact: true }).first();
  await btn.scrollIntoViewIfNeeded().catch(() => {});
  await btn.click({ timeout: 15000, force: true });
  await page.waitForTimeout(1500);
};

try {
  await page.goto(`${BASE}/property-appraisal/${TASK_ID}`, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await page.getByText("أساليب وطرق التقييم المستخدمة").first().waitFor({ timeout: 120000 });
  note("=== TAB 1: البيانات الأساسية ===");
  await page.waitForTimeout(2000);
  await shot("01-basic");
  const basicErrText = await page
    .locator(".text-danger-text, [class*='b42318']")
    .allTextContents()
    .catch(() => []);
  note("basic tab visible error texts: " + JSON.stringify(basicErrText.filter(Boolean).slice(0, 10)));

  // ── Market ──
  await clickTab("طريقة المقارنة");
  note("=== TAB 2: طريقة المقارنة ===");
  await page.waitForTimeout(1500);
  await shot("02-market");
  const narrativeBox = page.locator("textarea").first();
  const narrativeVisible = await narrativeBox.isVisible().catch(() => false);
  note("narrative textarea visible: " + narrativeVisible);
  if (narrativeVisible) {
    const MARKER = "MARKER-NARRATIVE-QWERTY123";
    await narrativeBox.click();
    await narrativeBox.fill(MARKER);
    await narrativeBox.blur();
    await page.waitForTimeout(2000);
    results.markers.marketNarrative = MARKER;
    note(`planted market narrative marker: ${MARKER}`);
    const savedToast = await page.locator("text=/تم الحفظ|تم التحديث|saved/i").first().isVisible().catch(() => false);
    note("save toast after narrative edit: " + savedToast);
  }
  // Try a rationale field in the adjustments matrix if present
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  const rationaleInput = page.getByPlaceholder("مبرّر التسوية؟").first();
  if (await rationaleInput.isVisible().catch(() => false)) {
    const MARKER2 = "MARKER-RATIONALE-ASDFGH456";
    await rationaleInput.fill(MARKER2);
    await rationaleInput.blur();
    await page.waitForTimeout(1500);
    results.markers.adjustmentRationale = MARKER2;
    note(`planted rationale marker: ${MARKER2}`);
  } else {
    note("no rationale input visible on market tab (no adopted comparables to show one?)");
  }
  // Methodology-alert justification text (appears when < 3 adopted comparables etc.)
  const alertJustification = page.getByPlaceholder(/المبرر النصي لتجاوز التنبيه/).first();
  if (await alertJustification.isVisible().catch(() => false)) {
    const MARKER2B = "MARKER-METHODALERT-QAZWSX678";
    await alertJustification.fill(MARKER2B);
    results.markers.methodologyAlertJustification = MARKER2B;
    note(`planted methodology-alert justification marker: ${MARKER2B}`);
    const saveAlertBtn = page.getByRole("button", { name: "حفظ معالجة التنبيهات" }).first();
    if (await saveAlertBtn.isVisible().catch(() => false)) {
      await saveAlertBtn.click();
      await page.waitForTimeout(1500);
    }
  }
  await shot("02b-market-after-edit");

  // ── Cost ──
  await clickTab("طريقة المقاول");
  note("=== TAB 3: طريقة المقاول ===");
  await page.waitForTimeout(1500);
  await shot("03-cost");
  const costErrText = await page
    .locator(".text-danger-text, [class*='b42318']")
    .allTextContents()
    .catch(() => []);
  note("cost tab visible error texts: " + JSON.stringify(costErrText.filter(Boolean).slice(0, 10)));
  const costTextarea = page.locator("textarea").first();
  if (await costTextarea.isVisible().catch(() => false)) {
    const MARKER3 = "MARKER-COSTBASIS-ZXCVBN789";
    await costTextarea.fill(MARKER3);
    await costTextarea.blur();
    await page.waitForTimeout(1500);
    results.markers.costBasis = MARKER3;
    note(`planted cost-basis textarea marker: ${MARKER3}`);
  }

  // ── Final opinion ──
  await clickTab("رأي القيمة النهائي");
  note("=== TAB 4: رأي القيمة النهائي ===");
  await page.waitForTimeout(1500);
  await shot("04-final");
  const gatesText = await page.locator("body").innerText().catch(() => "");
  const blockingSection = gatesText.split("اعتماد التقييم")[1]?.slice(0, 800) ?? "";
  note("issuance-gate area text: " + blockingSection.replace(/\s+/g, " "));

  // ── Final review ──
  await clickTab("المراجعة النهائية");
  note("=== TAB 5: المراجعة النهائية ===");
  await page.waitForTimeout(1500);
  await shot("05-review");
  const esgTextareas = page.locator("textarea");
  const esgCount = await esgTextareas.count();
  note("textareas found on review tab: " + esgCount);
  if (esgCount > 0) {
    const MARKER4 = "MARKER-ESG-TYUIOP012";
    await esgTextareas.first().fill(MARKER4);
    await esgTextareas.first().blur();
    await page.waitForTimeout(1500);
    results.markers.esgNote = MARKER4;
    note(`planted ESG/first-textarea marker: ${MARKER4}`);
  }
  // Try the extra-attachments "+" card
  const plusBtn = page.getByRole("button", { name: "إضافة مرفق" }).first();
  if (await plusBtn.isVisible().catch(() => false)) {
    await plusBtn.click();
    await page.waitForTimeout(800);
    await shot("05b-review-extra-attach-open");
    const captionInput = page.getByPlaceholder(/تسمية|caption/i).first();
    if (await captionInput.isVisible().catch(() => false)) {
      const MARKER5 = "MARKER-EXTRAATTACH-LKJHGF345";
      await captionInput.fill(MARKER5);
      results.markers.extraAttachmentCaption = MARKER5;
      note(`planted extra-attachment caption marker: ${MARKER5}`);
      await shot("05c-review-extra-attach-filled");
    } else {
      note("no caption input found in extra-attachments editor — inspect screenshot");
    }
  } else {
    note("extra-attachment + button not visible");
  }

  // ── Output / report ──
  await clickTab("تقرير التقييم");
  note("=== TAB 6: تقرير التقييم ===");
  await page.locator(".val-rpt-screen").first().waitFor({ timeout: 90000 });
  await page.waitForTimeout(6000);
  await shot("06-output");
  const bodyText = await page.locator(".rpt-ref").innerText().catch(() => "");
  for (const [key, marker] of Object.entries(results.markers)) {
    const found = bodyText.includes(marker);
    note(`marker check — ${key} ("${marker}") appears in printed report: ${found}`);
  }
  const nullUndefined = /\bnull\b|\bundefined\b/.test(bodyText);
  note("literal null/undefined visible in report: " + nullUndefined);
} catch (e) {
  note("ERROR: " + String(e).slice(0, 600));
  await page.screenshot({ path: `${SHOT_DIR}/error.png`, fullPage: true }).catch(() => {});
} finally {
  await browser.close();
  fs.writeFileSync(`${SHOT_DIR}/audit-results.json`, JSON.stringify(results, null, 2));
  console.log("\n=== CONSOLE ERRORS ===");
  console.log(JSON.stringify(results.consoleErrors.slice(0, 30), null, 1));
}
