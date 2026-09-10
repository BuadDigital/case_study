// Session-local driver: click «رابط PDF» in the evaluator report tab, capture the PDF the new
// tab receives, save it, and print the link panel state. Not a CI test.
import { chromium } from "@playwright/test";
import fs from "node:fs";

const TASK_ID = process.env.TASK_ID || "62fb83e7-5ff5-45b9-859c-461f99aab392";
const BASE = "http://localhost:3000";
const SHOT_DIR = process.env.SHOT_DIR || "./smoke-shots";
fs.mkdirSync(SHOT_DIR, { recursive: true });

const auth = JSON.parse(fs.readFileSync("auth-tmp.json", "utf8"));
const redact = (s) => String(s).replace(/k=[^&\s"']+/g, "k=***").replace(/key=[A-Za-z0-9_-]+/g, "key=***");
const note = (m) => console.log(redact(m));

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 }, acceptDownloads: true });
await ctx.addCookies([{ name: "ree-auth", value: "1", domain: "localhost", path: "/" }]);
await ctx.addInitScript((session) => {
  window.sessionStorage.setItem("auth", session);
}, JSON.stringify(auth));

const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => {
  if (m.type() === "error") errors.push(redact(m.text()).slice(0, 300));
});
page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 300)));

let postStatus = null;
let postBytes = 0;
page.on("request", (r) => {
  if (r.method() === "POST" && r.url().includes("/report-pdf")) {
    postBytes = (r.postData() ?? "").length;
  }
});
page.on("response", (r) => {
  if (r.request().method() === "POST" && r.url().includes("/report-pdf")) postStatus = r.status();
});

try {
  await page.goto(`${BASE}/property-appraisal/${TASK_ID}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.getByText("أساليب وطرق التقييم المستخدمة").first().waitFor({ timeout: 120000 });
  const outputTab = page.getByRole("tab").filter({ hasText: "تقرير التقييم" }).first();
  const outputBtn = (await outputTab.isVisible().catch(() => false))
    ? outputTab
    : page.getByRole("button", { name: "تقرير التقييم", exact: true }).first();
  await outputBtn.click();
  await page.locator(".val-rpt-screen").first().waitFor({ timeout: 90000 });
  await page.waitForTimeout(4000);
  note("report preview rendered");

  const btn = page.getByRole("button", { name: "رابط PDF" }).first();
  await btn.waitFor({ timeout: 30000 });
  note("button enabled: " + (await btn.isEnabled()));

  const popupP = ctx.waitForEvent("page", { timeout: 180000 });
  const started = Date.now();
  await btn.click();
  const popup = await popupP;
  // The popup starts at about:blank and is navigated to the .pdf link once rendered.
  const pdfResponse = await popup
    .waitForResponse((r) => r.url().includes("/api/valuation-reports/") && r.url().includes(".pdf"), { timeout: 180000 })
    .catch(() => null);
  const elapsed = Math.round((Date.now() - started) / 1000);
  note(`POST /report-pdf → ${postStatus} (body ${(postBytes / 1024 / 1024).toFixed(2)} MB), ${elapsed}s until PDF response`);
  if (pdfResponse) {
    const headers = pdfResponse.headers();
    note(`PDF GET ${pdfResponse.status()} ${headers["content-type"]} disposition=${headers["content-disposition"]}`);
    note("popup url: " + popup.url());
    // Headless Chromium hands PDFs to the download path, so the navigation body is not
    // retrievable through CDP — fetch the same public link again (no session needed).
    const again = await ctx.request.get(pdfResponse.url());
    const body = await again.body();
    note(`re-fetched ${again.status()} bytes=${body.length} magic=${body.subarray(0, 5).toString("latin1")}`);
    fs.writeFileSync(`${SHOT_DIR}/report-link.pdf`, body);
    note(`saved ${SHOT_DIR}/report-link.pdf`);
  } else {
    note("no PDF response captured; popup url: " + popup.url());
  }
  await popup.waitForTimeout(3000);
  await popup.screenshot({ path: `${SHOT_DIR}/pdf-tab.png` }).catch(() => {});

  const panel = page.locator('[data-testid="report-pdf-link"]').first();
  if (await panel.count()) {
    await panel.scrollIntoViewIfNeeded();
    note("link panel: " + (await panel.innerText()).replace(/\s+/g, " ").slice(0, 300));
    const input = panel.locator("input").first();
    note("link value: " + (await input.inputValue()));
    await page.screenshot({ path: `${SHOT_DIR}/link-panel.png` }).catch(() => {});
  } else {
    note("link panel not rendered");
    const err = await page.locator(".text-\\[\\#b42318\\]").first().textContent().catch(() => null);
    note("error text: " + err);
    await page.screenshot({ path: `${SHOT_DIR}/link-error.png` }).catch(() => {});
  }
} catch (e) {
  note("ERROR: " + String(e).slice(0, 600));
  await page.screenshot({ path: `${SHOT_DIR}/error.png` }).catch(() => {});
} finally {
  await browser.close();
  note("console errors: " + JSON.stringify(errors.filter((e) => !e.includes("403") && !e.includes("StaticMapService") && !e.includes("ERR_FAILED")).slice(0, 10), null, 1));
}
