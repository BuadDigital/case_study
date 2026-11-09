// Session-local diagnostic driver (not a CI test): opens the valuation report of every appraisal task
// as its appraiser and lists what the report printed empty or broken.
// TASKS_FILE=<lines "taskId|po|username"> OUT=<json> node e2e/.audit-report-flow.mjs
import { chromium } from "@playwright/test";
import fs from "node:fs";

const BASE = process.env.BASE || "http://localhost:3000";
const API = process.env.API || "http://127.0.0.1:5160";
const tasks = fs
  .readFileSync(process.env.TASKS_FILE, "utf8")
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => {
    const [taskId, po, username] = line.split("|");
    return { taskId, po, username };
  });

const sessions = {};
async function login(username) {
  if (sessions[username]) return sessions[username];
  const res = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  });
  sessions[username] = await res.text();
  return sessions[username];
}

const BROKEN_TEXT = /NaN|undefined|\bnull\b|Invalid Date|\[object Object\]|Infinity/;

const browser = await chromium.launch({ headless: true });
const results = [];
for (const task of tasks) {
  const auth = await login(task.username);
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  await ctx.addCookies([{ name: "ree-auth", value: "1", domain: "localhost", path: "/" }]);
  await ctx.addInitScript(
    ({ session, taskId }) => {
      window.sessionStorage.setItem("auth", session);
      window.localStorage.setItem("auth", session);
      window.sessionStorage.setItem(`evaluator:tab:${taskId}`, "output");
    },
    { session: auth, taskId: task.taskId },
  );
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 200));
  });
  const failed = [];
  page.on("response", (res) => {
    if (res.status() >= 500) failed.push(`${res.status()} ${res.url().replace(API, "")}`.slice(0, 200));
  });
  const row = { ...task };
  try {
    await page.goto(`${BASE}/property-appraisal/${task.taskId}`, {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });
    await page.locator('.rpt-ref [data-sec]').first().waitFor({ timeout: 150000 });
    await page
      .locator('[data-testid="report-refreshing"]')
      .waitFor({ state: "hidden", timeout: 120000 })
      .catch(() => {});
    await page.waitForTimeout(4000);
    Object.assign(
      row,
      await page.evaluate((brokenSource) => {
        const broken = new RegExp(brokenSource);
        const root = document.querySelector(".rpt-ref");
        const missing = [...root.querySelectorAll("[data-rpt-missing]")].map((cell) => ({
          sec: cell.closest("[data-sec]")?.getAttribute("data-sec") ?? "",
          label: cell.getAttribute("data-rpt-missing-label") ?? "",
          source: cell.getAttribute("data-rpt-missing-source") ?? "",
        }));
        const brokenCells = [...root.querySelectorAll("td, p, span, div")]
          .filter((el) => el.children.length === 0 && broken.test(el.textContent ?? ""))
          .map((el) => ({
            sec: el.closest("[data-sec]")?.getAttribute("data-sec") ?? "",
            text: (el.textContent ?? "").trim().slice(0, 120),
          }));
        const kv = {};
        for (const k of root.querySelectorAll("td.k")) {
          const v = k.nextElementSibling;
          const sec = k.closest("[data-sec]")?.getAttribute("data-sec") ?? "";
          if (v) kv[`${sec}:${(k.textContent ?? "").trim()}`] = (v.textContent ?? "").trim().slice(0, 160);
        }
        const photos = root.querySelectorAll('[data-sec="34"] img, [data-sec="34"] image-slot[src]').length;
        const captions = [...root.querySelectorAll("[data-photo-caption]")].map((c) => c.textContent);
        const sections = [...root.querySelectorAll("[data-sec]")].map((s) => s.getAttribute("data-sec"));
        return { missing, brokenCells, kv, photos, captions, sections };
      }, BROKEN_TEXT.source),
    );
    row.ok = true;
  } catch (e) {
    row.ok = false;
    row.error = String(e).slice(0, 300);
    row.bodyText = (await page.locator("main").innerText().catch(() => "")).slice(0, 400);
  }
  row.consoleErrors = [...new Set(consoleErrors)].slice(0, 10);
  row.failed = [...new Set(failed)].slice(0, 10);
  results.push(row);
  console.log(
    `${task.po} ${row.ok ? "ok" : "FAIL"} missing=${row.missing?.length ?? "-"} broken=${row.brokenCells?.length ?? "-"} photos=${row.photos ?? "-"} 5xx=${row.failed.length}`,
  );
  fs.writeFileSync(process.env.OUT, JSON.stringify(results, null, 1));
  await ctx.close();
}
await browser.close();
