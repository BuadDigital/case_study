// Session-local: «أعمالي» as the CDO and the supervisor (chips, groups), on a phone, and its search.
import { chromium } from "@playwright/test";
import fs from "node:fs";
import { loginRaw } from "./.az-2026-11-09.mjs";
const OUT = "test-results/az-2026-11-09/";
const S = JSON.parse(fs.readFileSync("test-results/az-2026-11-09-e1/state.json", "utf8"));
const browser = await chromium.launch({ headless: true });
async function open(user, viewport) {
  const ctx = await browser.newContext({ viewport, locale: "ar", isMobile: viewport.width < 500, hasTouch: viewport.width < 500 });
  await ctx.addCookies([{ name: "ree-auth", value: "1", domain: "localhost", path: "/" }]);
  const auth = await loginRaw(user);
  await ctx.addInitScript((a) => { sessionStorage.setItem("auth", a); localStorage.setItem("auth", a); }, auth);
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message.slice(0, 160)));
  await p.goto("http://localhost:3000/my-work", { waitUntil: "domcontentloaded", timeout: 120000 });
  await p.locator("table, [class*=MobileRecord], section[aria-label='ما ينتظرني']").first().waitFor({ timeout: 90000 });
  await p.waitForTimeout(4000);
  return { ctx, p, errors };
}
for (const user of ["cdo", "supervisor"]) {
  const { ctx, p, errors } = await open(user, { width: 1500, height: 950 });
  const chips = (await p.locator("[role=group][aria-label='تصفية سريعة'] button").allInnerTexts()).map((c) => c.replace(/\s+/g, " "));
  const rows = await p.locator("table tbody tr").count();
  console.log(`${user}: chips=${JSON.stringify(chips)} rows=${rows} errors=${errors.length}`);
  await p.screenshot({ path: `${OUT}mywork-${user}.png` });
  // Search: deed, PO, transaction number, city.
  for (const q of [S.deed, S.po, "PR-26-00158", "النرجس", "لا-يوجد-شيء"]) {
    await p.locator("input[type=search]").fill(q);
    await p.waitForTimeout(800);
    console.log(`   search «${q}» → ${await p.locator("table tbody tr").count()} rows`);
  }
  await ctx.close();
}
const { ctx, p, errors } = await open("coord", { width: 390, height: 844 });
const cards = await p.evaluate(() => document.body.innerText.includes("رقم الصك / التسجيل العيني"));
const overflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
console.log(`phone: card fields shown=${cards} horizontal-overflow=${overflow} errors=${errors.length}`);
await p.screenshot({ path: `${OUT}mywork-phone.png` });
await ctx.close();
await browser.close();
