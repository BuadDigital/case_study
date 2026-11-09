// Session-local: opens the coordinator page and the work page of a transaction as each sub-role,
// records page errors / failed requests / error notes, the rail's rows and marks, then exercises the
// rail (a row folds the others; the arrow expands / collapses all) and screenshots each state.
//   STATE=<dir>/state.json npx -y tsx e2e/.az-2026-11-09-pages.mjs
import { chromium } from "@playwright/test";
import fs from "node:fs";
import { loginRaw } from "./.az-2026-11-09.mjs";

const BASE = "http://localhost:3000";
const S = JSON.parse(fs.readFileSync(process.env.STATE, "utf8"));
const OUT = process.env.STATE.replace(/state\.json$/, "");
const browser = await chromium.launch({ headless: true });
const report = [];

async function visit(user, page, label) {
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 }, locale: "ar" });
  await ctx.addCookies([{ name: "ree-auth", value: "1", domain: "localhost", path: "/" }]);
  const auth = await loginRaw(user);
  await ctx.addInitScript((a) => { sessionStorage.setItem("auth", a); localStorage.setItem("auth", a); }, auth);
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(`pageerror: ${e.message.slice(0, 200)}`));
  p.on("response", (r) => { if (r.status() >= 500 || (r.status() >= 400 && r.url().includes("/api/") && r.status() !== 404)) errors.push(`${r.status()} ${r.url().replace(/^https?:\/\/[^/]+/, "").slice(0, 120)}`); });
  p.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 160)}`); });
  const url = `${BASE}/po/${encodeURIComponent(S.po)}/property/${S.propertyId}/${page}`;
  try {
    await p.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
    await p.locator("nav ol li").first().waitFor({ timeout: 90000 });
    await p.waitForTimeout(4000);
    const rail = await p.evaluate(() => [...document.querySelectorAll("nav ol li button")].map((b) => ({
      text: b.innerText.replace(/\s+/g, " ").trim(),
      mark: b.querySelector(".sr-only")?.textContent ?? "",
      current: b.getAttribute("aria-current") ?? "",
    })));
    const open = await p.evaluate(() => [...document.querySelectorAll("section[id^=work-] > button")].map((b) => `${b.innerText.replace(/\s+/g, " ").trim().slice(0, 40)}:${b.getAttribute("aria-expanded")}`));
    const notes = await p.locator("[role=alert], [data-testid*=error]").allInnerTexts().catch(() => []);
    await p.screenshot({ path: `${OUT}page-${page}-${user}-1.png`, fullPage: false });
    // A rail row folds every other section and gets the selected look.
    const rows = p.locator("nav ol li button");
    const n = await rows.count();
    let foldOk = null;
    if (n > 1) {
      await rows.nth(n - 1).click();
      await p.waitForTimeout(1200);
      const expanded = await p.evaluate(() => [...document.querySelectorAll("section[id^=work-] > button")].filter((b) => b.getAttribute("aria-expanded") === "true").length);
      const picked = await rows.nth(n - 1).getAttribute("aria-current");
      foldOk = expanded === 1 && picked === "location";
      await p.screenshot({ path: `${OUT}page-${page}-${user}-2-picked.png` });
    }
    // The arrow: expand all, then collapse all.
    let arrowOk = null;
    const arrow = p.locator("nav button[aria-label*='جميع الأقسام']");
    if (await arrow.count()) {
      await arrow.click();
      await p.waitForTimeout(1500);
      const all = await p.evaluate(() => [...document.querySelectorAll("section[id^=work-] > button")].every((b) => b.getAttribute("aria-expanded") === "true"));
      await arrow.click();
      await p.waitForTimeout(800);
      const none = await p.evaluate(() => [...document.querySelectorAll("section[id^=work-] > button")].every((b) => b.getAttribute("aria-expanded") === "false"));
      arrowOk = all && none;
    }
    // Sticky: scroll the content and check the rail stays in view.
    if (await arrow.count()) { await arrow.click(); await p.waitForTimeout(1500); } // expand all so the page is long enough to scroll
    const sticky = await p.evaluate(async () => {
      const c = document.getElementById("content");
      if (!c) return null;
      c.scrollTop = 2500;
      await new Promise((r) => setTimeout(r, 400));
      const top = document.querySelector("nav ol")?.getBoundingClientRect().top ?? -1;
      return top >= 0 && top < 300;
    });
    report.push({ label, user, page, rail, open, notes, foldOk, arrowOk, sticky, errors: [...new Set(errors)].slice(0, 12) });
    console.log(`${label} ${page} as ${user}: rail=${rail.map((r) => `${r.text}[${r.mark}]`).join(" | ")}`);
    console.log(`   fold=${foldOk} arrow=${arrowOk} sticky=${sticky} errors=${[...new Set(errors)].length}${errors.length ? "\n     " + [...new Set(errors)].slice(0, 6).join("\n     ") : ""}${notes.length ? "\n   notes: " + notes.join(" / ").slice(0, 300) : ""}`);
  } catch (e) {
    await p.screenshot({ path: `${OUT}page-${page}-${user}-fail.png` }).catch(() => {});
    report.push({ label, user, page, failed: e.message.slice(0, 300), errors });
    console.log(`${label} ${page} as ${user}: FAILED ${e.message.slice(0, 200)}\n   ${errors.slice(0, 5).join("\n   ")}`);
  } finally {
    await ctx.close();
  }
}

for (const [user, page] of [["coord", "coordination"], ["study", "work"], ["review", "work"], ["coord", "work"], ["review", "coordination"]]) {
  await visit(user, page, process.env.LABEL || "");
}
fs.writeFileSync(`${OUT}pages.json`, JSON.stringify(report, null, 1));
await browser.close();
