// Session-local diagnostic driver: screenshot the organization-settings branding tab
// (cards, letterhead zoom, A4 preview) and log console/page errors. Not a CI test.
// AUTH_FILE=<login response json> SHOT_DIR=<dir> node e2e/.shot-org-branding.mjs
import { chromium } from "@playwright/test";
import fs from "node:fs";

const BASE = process.env.BASE || "http://localhost:3000";
const SHOT_DIR = process.env.SHOT_DIR || "./smoke-shots";
fs.mkdirSync(SHOT_DIR, { recursive: true });
const auth = fs.readFileSync(process.env.AUTH_FILE || "auth-tmp.json", "utf8");

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
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
  await page.goto(`${BASE}/organization-settings?tab=branding`, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await page.getByText("كليشة التقرير").first().waitFor({ timeout: 120000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${SHOT_DIR}/branding-full.png`, fullPage: true });

  // Draft a stamp size change → dirty badge, undo button and the unsaved note.
  // Autosave round trip on the stamp size (restored to the original values afterwards).
  const stampWidth = page.locator("#brand-stamp-width");
  const stampHeight = page.locator("#brand-stamp-height");
  if (await stampWidth.count()) {
    const originalWidth = await stampWidth.inputValue();
    const originalHeight = await stampHeight.inputValue();
    await stampWidth.fill("5");
    await page.waitForTimeout(200);
    console.log("status while typing:", await page.getByRole("status").allTextContents());
    await page.screenshot({ path: `${SHOT_DIR}/branding-pending.png` });
    await page.getByText("✓ تم الحفظ").first().waitFor({ timeout: 15000 });
    console.log("after autosave — height with lock:", await stampHeight.inputValue());
    await page.screenshot({ path: `${SHOT_DIR}/branding-saved.png` });

    await stampWidth.fill(originalWidth);
    await page.waitForTimeout(300);
    await stampHeight.fill(originalHeight);
    await page.waitForTimeout(2500);
    console.log(
      "restored:",
      await stampWidth.inputValue(),
      await stampHeight.inputValue(),
      await page.getByRole("status").allTextContents(),
    );
  }

  // Letterhead zoom, fitted.
  await page.getByRole("button", { name: /معاينة الكليشة|اضغط للتكبير/ }).first().click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SHOT_DIR}/branding-letterhead-zoom.png` });
  await page.getByRole("button", { name: "تم", exact: true }).click();

  // A4 approval-page preview.
  await page.getByRole("button", { name: "معاينة صفحة الاعتماد على A4" }).click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${SHOT_DIR}/branding-a4-preview.png` });
} catch (e) {
  console.log("ERROR:", String(e).slice(0, 500));
  await page.screenshot({ path: `${SHOT_DIR}/branding-error.png` }).catch(() => {});
} finally {
  console.log("errors:", JSON.stringify(errors.slice(0, 10), null, 1));
  await browser.close();
}
