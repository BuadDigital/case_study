// Session-local diagnostic driver: استعلام بورصة — pressing save without «حالة الصك» must mark
// the pill group red and scroll to it (same as the intake form). Never completes a bourse save.
// AUTH_FILE=<login json> SHOT_DIR=<dir> node e2e/.shot-bourse-errors.mjs
import { chromium } from "@playwright/test";
import fs from "node:fs";

const BASE = process.env.BASE || "http://localhost:3000";
const SHOT_DIR = process.env.SHOT_DIR || "./smoke-shots";
fs.mkdirSync(SHOT_DIR, { recursive: true });
const auth = fs.readFileSync(process.env.AUTH_FILE || "auth-tmp.json", "utf8");

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 820 } });
await ctx.addCookies([{ name: "ree-auth", value: "1", domain: "localhost", path: "/" }]);
await ctx.addInitScript((session) => {
  window.sessionStorage.setItem("auth", session);
}, auth);

const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 300)));

try {
  await page.goto(`${BASE}/bourse-inquiry`, { waitUntil: "domcontentloaded", timeout: 120000 });
  const row = page.locator("tbody tr").filter({ hasText: /\d/ }).first();
  await row.waitFor({ timeout: 120000 });
  await row.click();
  const save = page.getByRole("button", { name: "حفظ وإكمال البورصة" });
  await save.waitFor({ timeout: 60000 });

  // Push the vitality pills out of view first, so the scroll is observable.
  await page.locator("#city").scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(500);
  await save.click();
  await page.waitForTimeout(1200);

  const group = page.locator("#deed_vitality");
  const cls = (await group.getAttribute("class")) ?? "";
  const box = await group.boundingBox();
  console.log("vitality group red:", cls.includes("border-danger"));
  console.log("vitality group in view:", Boolean(box && box.y >= 0 && box.y < 820));
  console.log("inline message:", await group.locator('[role="alert"]').innerText().catch(() => ""));
  await page.screenshot({ path: `${SHOT_DIR}/bourse-vitality-error.png` });

  // Choosing a status clears the mark (no save afterwards).
  await page.getByRole("button", { name: "الصك فعال" }).click();
  await page.waitForTimeout(400);
  console.log(
    "after choosing — red:",
    ((await group.getAttribute("class")) ?? "").includes("border-danger"),
    "| top note:",
    await page.getByText("اختر حالة الصك: فعال أو غير فعال.").count(),
  );
  await page.screenshot({ path: `${SHOT_DIR}/bourse-vitality-cleared.png` });
} catch (e) {
  console.log("ERROR:", String(e).slice(0, 500));
  await page.screenshot({ path: `${SHOT_DIR}/bourse-error.png` }).catch(() => {});
} finally {
  console.log("page errors:", JSON.stringify(errors.slice(0, 5)));
  await browser.close();
}
