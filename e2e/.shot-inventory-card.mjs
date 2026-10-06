import { chromium } from "@playwright/test";
import fs from "node:fs";
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
await ctx.addCookies([{ name: "ree-auth", value: "1", domain: "localhost", path: "/" }]);
await ctx.addInitScript((s) => { try { window.sessionStorage.setItem("auth", s); } catch {} },
  fs.readFileSync(process.env.AUTH, "utf8"));
const page = await ctx.newPage();
const calls = [];
page.on("response", (r) => {
  if (r.url().includes("building-inventory")) calls.push(`${r.status()} ${r.request().method()} ${r.url().split("/api/")[1]}`);
});
await page.goto(`http://localhost:3000/active-inspection/${process.env.TASK_ID}`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.getByText("الموقع والتصوير").first().waitFor({ timeout: 120000 });
await page.getByText("بيانات العقار", { exact: true }).first().click();
await page.waitForTimeout(10000);
const card = page.locator("#inspector-inventory");
await card.scrollIntoViewIfNeeded();
await card.screenshot({ path: `${process.env.SHOT_DIR}/inventory-card.png` });
console.log("inventory API calls:", calls.join(" | ") || "(none)");
console.log("card text:", (await card.innerText()).replace(/\n+/g, " | ").slice(0, 300));
await browser.close();
