// Session-local driver: log in as the field inspector, open an in-progress
// field-inspection task, upload a photo into the new «صورة رخصة البناء»
// control, and confirm it renders as attached. Not a CI test.
import { chromium } from "@playwright/test";
import fs from "node:fs";

const TASK_ID = process.env.TASK_ID || "a44455a1-9348-45f3-9852-638ad21226e1";
const BASE = "http://localhost:3000";
const SHOT_DIR = process.env.SHOT_DIR || "./smoke-shots";
fs.mkdirSync(SHOT_DIR, { recursive: true });

const auth = JSON.parse(fs.readFileSync("auth-ahmed.json", "utf8"));
const note = (m) => console.log(m);

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
await ctx.addCookies([{ name: "ree-auth", value: "1", domain: "localhost", path: "/" }]);
await ctx.addInitScript((session) => {
  window.sessionStorage.setItem("auth", session);
}, JSON.stringify(auth));

const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text().slice(0, 300));
});
page.on("response", (r) => {
  if (r.status() === 403) errors.push("403 " + r.url().slice(0, 150));
});
page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 300)));

try {
  await page.goto(`${BASE}/active-inspection/${TASK_ID}`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.getByText("معاينة العقار").first().waitFor({ timeout: 60000 });
  note("workspace loaded");
  // The building-areas card only exists in the DOM on wizard step 2.
  await page.getByRole("button", { name: /بيانات العقار/ }).first().click();
  await page
    .getByText("مساحات المباني")
    .first()
    .waitFor({ timeout: 30000 });
  note("building-areas card visible");
  await page.getByText("مساحات المباني").first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000);

  const label = page.getByText("صورة رخصة البناء").first();
  const labelVisible = await label.isVisible().catch(() => false);
  note("licence-photo label visible: " + labelVisible);
  await page.screenshot({ path: `${SHOT_DIR}/before-upload.png` });

  if (labelVisible) {
    // Build a tiny in-memory JPEG-ish file (real image bytes: 1x1 red PNG re-tagged jpg
    // would fail the sniffer; use a minimal valid JPEG instead).
    const tinyJpeg = Buffer.from(
      "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=",
      "base64",
    );
    const inputRef = page.locator('input[type="file"]').filter({ hidden: true });
    // Find the file input nearest the label — click the attach button, which reveals a hidden input.
    const attachBtn = page
      .getByRole("button", { name: /إرفاق صورة|أفلِت|مرفقة/ })
      .filter({ hasNot: page.locator(":visible", { hasText: "المعرض" }) });
    // Simpler & robust: locate the input within the same container as the label.
    const container = page.locator("div", { has: label }).last();
    const fileInput = container.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "build-license.jpg",
      mimeType: "image/jpeg",
      buffer: tinyJpeg,
    });
    await page.waitForTimeout(4000);
    const afterText = await container.innerText().catch(() => "");
    note("container text after upload: " + afterText.replace(/\s+/g, " ").slice(0, 200));
    await label.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SHOT_DIR}/after-upload.png` });
    const region = page.locator("text=رقم رخصة البناء").locator("xpath=ancestor::*[self::div][3]").first();
    await region.screenshot({ path: `${SHOT_DIR}/license-region.png` }).catch(async () => {
      await container.screenshot({ path: `${SHOT_DIR}/license-region.png` });
    });
  }
} catch (e) {
  note("ERROR: " + String(e).slice(0, 600));
  await page.screenshot({ path: `${SHOT_DIR}/error.png` }).catch(() => {});
} finally {
  await browser.close();
  note(
    "console errors: " +
      JSON.stringify(
        errors.filter((e) => !e.includes("404") && !e.includes("favicon")).slice(0, 10),
        null,
        1,
      ),
  );
}
