// Session-local: clicks «إرسال المعاملة للدراسة» on the coordinator page of a transaction that is
// not ready, and records what the coordinator is told.
import { chromium } from "@playwright/test";
import fs from "node:fs";
import { loginRaw } from "./.az-2026-11-09.mjs";
const S = JSON.parse(fs.readFileSync(process.env.STATE, "utf8"));
const OUT = process.env.STATE.replace(/state\.json$/, "");
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 }, locale: "ar" });
await ctx.addCookies([{ name: "ree-auth", value: "1", domain: "localhost", path: "/" }]);
const auth = await loginRaw("coord");
await ctx.addInitScript((a) => { sessionStorage.setItem("auth", a); localStorage.setItem("auth", a); }, auth);
const p = await ctx.newPage();
await p.goto(`http://localhost:3000/po/${encodeURIComponent(S.po)}/property/${S.propertyId}/coordination`, { waitUntil: "domcontentloaded", timeout: 120000 });
const btn = p.getByRole("button", { name: "إرسال المعاملة للدراسة" });
await btn.waitFor({ timeout: 90000 });
console.log("disabled:", await btn.isDisabled());
await btn.scrollIntoViewIfNeeded();
await btn.click().catch((e) => console.log("click:", e.message.slice(0, 100)));
await p.waitForTimeout(2500);
const said = await p.evaluate(() => [...document.querySelectorAll("[role=alert],[role=status],[data-sonner-toast],[role=dialog]")].map((e) => e.innerText.replace(/\s+/g, " ").trim()).filter(Boolean));
console.log("told:", JSON.stringify(said).slice(0, 600));
const card = p.locator("section", { hasText: "الإرسال للدراسة" }).last();
console.log("card:", (await card.innerText()).replace(/\s+/g, " ").slice(0, 400));
await card.scrollIntoViewIfNeeded();
await card.screenshot({ path: `${OUT}click-send.png` });
await browser.close();
