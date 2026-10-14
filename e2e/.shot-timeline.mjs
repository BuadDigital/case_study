import { chromium } from "@playwright/test";
const BASE = "http://127.0.0.1:3000";
const res = await fetch("http://127.0.0.1:5160/api/auth/login", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username: "500000001" }),
});
const session = await res.json();
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
await context.addCookies([{ name: "ree-auth", value: "1", domain: "127.0.0.1", path: "/" }]);
await context.addInitScript((p) => window.sessionStorage.setItem("auth", p), JSON.stringify(session));
const page = await context.newPage();
await page.goto(`${BASE}/po/PO-00111/property/ecfaa8e0-6e35-403f-8745-cc22c4ef47e4`, { waitUntil: "domcontentloaded", timeout: 120000 });
const rail = page.locator('aside[aria-label="الجدول الزمني للمعاملة"]');
await rail.waitFor({ timeout: 120000 });
page.on("response", r => { if (r.url().includes("timeline")) console.log(r.status(), r.url()); });
await page.reload({ waitUntil: "domcontentloaded" });
await rail.waitFor({ timeout: 120000 });
await page.waitForTimeout(8000);
await rail.screenshot({ path: process.env.OUT ?? "timeline-rail.png" });
console.log((await rail.innerText()).replace(/\n+/g, " | "));
await browser.close();
