// Smoke driver for the refactored evaluator valuation workspace (session-local, not a CI test).
import { chromium } from "@playwright/test";
import fs from "node:fs";

const TASK_ID = "65d43556-06f5-4514-abba-7d6b63e538a3"; // FIT-2026 fixture
const BASE = "http://localhost:3000";
const SHOT_DIR = process.env.SHOT_DIR || "./smoke-shots";
fs.mkdirSync(SHOT_DIR, { recursive: true });

const auth = JSON.parse(fs.readFileSync("auth-tmp.json", "utf8"));
const results = { steps: [], consoleErrors: [], pageErrors: [], network: {} };
const step = (name, ok, note = "") => {
  results.steps.push({ name, ok, note });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${note ? " — " + note : ""}`);
};

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
await ctx.addCookies([
  { name: "ree-auth", value: "1", domain: "localhost", path: "/" },
]);
await ctx.addInitScript((session) => {
  window.sessionStorage.setItem("auth", session);
}, JSON.stringify(auth));

const page = await ctx.newPage();
page.on("console", (m) => {
  if (m.type() === "error") results.consoleErrors.push(m.text().slice(0, 300));
});
page.on("pageerror", (e) => results.pageErrors.push(String(e).slice(0, 300)));

const apiRequests = [];
page.on("request", (r) => {
  const u = r.url();
  if (u.includes("/api/") || u.includes("valuation-report-v3.html")) {
    apiRequests.push(u);
  }
});

const shot = (name) => page.screenshot({ path: `${SHOT_DIR}/${name}.png`, fullPage: false });
const clickNav = async (label) => {
  await page.getByRole("button", { name: label }).first().click();
};

try {
  await page.goto(`${BASE}/property-appraisal/${TASK_ID}`, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });

  // ── basic screen (ApproachSettingsSection) ──
  await page
    .getByText("أساليب وطرق التقييم المستخدمة")
    .first()
    .waitFor({ timeout: 120000 });
  step("basic screen renders", true);
  await shot("01-basic");

  await page.getByRole("button", { name: "حفظ إعدادات التقييم" }).first().click();
  const savedToast = await page
    .getByText("تم حفظ إعدادات التقييم")
    .first()
    .waitFor({ timeout: 20000 })
    .then(() => true)
    .catch(() => false);
  step("settings save toast", savedToast);

  // ── market screen (bank + matrix) ──
  await clickNav("طريقة المقارنة");
  await page.getByText("بنك المقارنات").first().waitFor({ timeout: 30000 });
  const matrixVisible = await page
    .getByText("جدول التسويات")
    .first()
    .isVisible()
    .catch(() => false);
  step("market screen renders (bank + matrix)", matrixVisible, matrixVisible ? "" : "no adopted comparables?");
  await shot("02-market");

  // search should hit only the bank endpoint, not the full reload set
  apiRequests.length = 0;
  const search = page.getByPlaceholder("بحث حي / نوع / رقم مرجعي");
  await search.fill("الرياض");
  await page.waitForTimeout(1200);
  const searchCalls = apiRequests.filter((u) => u.includes("comparable-properties"));
  const heavyCalls = apiRequests.filter(
    (u) => u.includes("/cost") || u.includes("/reconciliation") || u.includes("/issuance-gates") || u.includes("/approach-settings"),
  );
  step(
    "bank search is a single-scope fetch",
    searchCalls.length >= 1 && heavyCalls.length === 0,
    `bank:${searchCalls.length} heavy:${heavyCalls.length}`,
  );
  await search.fill("");
  await page.waitForTimeout(800);

  // type a rationale in the matrix and blur (save path)
  const rationale = page.getByPlaceholder("مبرّر التسوية؟").first();
  if (await rationale.isVisible().catch(() => false)) {
    await rationale.fill("مبرر تجريبي — فحص دخاني");
    await rationale.blur();
    await page.waitForTimeout(1500);
    step("matrix rationale typed + blurred", true);
  } else {
    step("matrix rationale typed + blurred", false, "no rationale input visible");
  }

  // ── cost screen (CostApproachSection + CostBasisUnitCard) ──
  await clickNav("طريقة المقاول");
  await page.getByText("بنود التكلفة المباشرة").first().waitFor({ timeout: 30000 });
  const basisCard = await page
    .getByText("طريقة التكلفة وأسلوب التقدير")
    .first()
    .isVisible()
    .catch(() => false);
  step("cost screen renders (table + basis card)", basisCard);
  await shot("03-cost");

  // draft persistence across screen switch (persistent hidden mount)
  const costRationale = page.getByPlaceholder("أساس التقدير…").first();
  let persisted = false;
  if (await costRationale.isVisible().catch(() => false)) {
    await costRationale.fill("مسودة فحص البقاء");
    await clickNav("رأي القيمة النهائي");
    await page.waitForTimeout(700);
    await clickNav("طريقة المقاول");
    await page.waitForTimeout(500);
    persisted =
      (await page.getByPlaceholder("أساس التقدير…").first().inputValue()) ===
      "مسودة فحص البقاء";
  }
  step("cost drafts survive screen switch", persisted);

  // ── final screen (FinalOpinionSection) ──
  await clickNav("رأي القيمة النهائي");
  await page.getByText("الرأي النهائي للقيمة").first().waitFor({ timeout: 30000 });
  const gatesVisible = await page
    .getByText("اعتماد التقييم — شروط الإصدار")
    .first()
    .isVisible()
    .catch(() => false);
  step("final screen renders (ledger + gates)", gatesVisible);
  await shot("04-final");

  // lazy preview chain: first click must dynamic-import the builder and open a tab, no error toast
  const previewBtn = page.getByRole("button", { name: "معاينة التقرير" }).first();
  if (await previewBtn.isVisible().catch(() => false)) {
    const popupP = page.context().waitForEvent("page", { timeout: 25000 }).catch(() => null);
    await previewBtn.click();
    const popup = await popupP;
    const errToast = await page
      .getByText("تعذّر فتح استعراض تقرير التقييم")
      .first()
      .isVisible()
      .catch(() => false);
    step("lazy report preview opens", !!popup && !errToast, popup ? "popup opened" : "no popup");
    if (popup) await popup.close().catch(() => {});
  } else {
    step("lazy report preview opens", false, "preview button not visible");
  }


  // ── review screen (FinalReviewTab — attachments fix) ──
  await clickNav("المراجعة النهائية");
  await page.getByText("رأي القيمة عند التسليم").first().waitFor({ timeout: 30000 });
  const attachHeader = await page
    .getByText("مرفقات التقرير")
    .first()
    .isVisible()
    .catch(() => false);
  step("review screen renders (attachments card)", attachHeader);
  await shot("05-review");

  // ── output tab: report preview + template cached once ──
  const outputTab = page.getByRole("tab").filter({ hasText: "تقرير التقييم" }).first();
  const outputBtn = (await outputTab.isVisible().catch(() => false))
    ? outputTab
    : page.getByRole("button", { name: "تقرير التقييم", exact: true }).first();
  if (await outputBtn.isVisible().catch(() => false)) {
    apiRequests.length = 0;
    await outputBtn.click();
    await page.waitForTimeout(15000);
    const templateFetches = apiRequests.filter((u) =>
      u.includes("valuation-report-v3.html"),
    ).length;
    const previewVisible = await page
      .locator(".val-rpt-screen")
      .first()
      .isVisible()
      .catch(() => false);
    step("output preview renders", previewVisible, `template fetches:${templateFetches}`);
    results.network.templateFetches = templateFetches;
    const bodyText = await page.locator("body").innerText().catch(() => "");
    step("no literal null/undefined in preview", !/\bnull\b|\bundefined\b/.test(bodyText));
    await shot("06-output");
    // tab bounce: within staleTime the cached bundle must not refire the fetch storm
    const reportTabLoc = page.getByRole("tab").filter({ hasText: "تقييم العقار" }).first();
    const reportTabBtn = (await reportTabLoc.isVisible().catch(() => false)) ? reportTabLoc : page.getByText("تقييم العقار", { exact: true }).first();
    await reportTabBtn.click();
    await page.waitForTimeout(2500);
    apiRequests.length = 0;
    await outputBtn.click();
    await page.waitForTimeout(6000);
    const bounceApi = apiRequests.filter((u) => u.includes("/api/")).length;
    step("tab bounce uses cached bundle", bounceApi <= 3, "api calls on revisit: " + bounceApi);

  } else {
    step("output preview renders", false, "output tab not found");
  }
} catch (err) {
  step("UNCAUGHT", false, String(err).slice(0, 400));
  await shot("99-error").catch(() => {});
}

results.consoleErrors = [...new Set(results.consoleErrors)].slice(0, 12);
results.pageErrors = [...new Set(results.pageErrors)].slice(0, 12);
fs.writeFileSync(`${SHOT_DIR}/results.json`, JSON.stringify(results, null, 2));
console.log("\nSUMMARY", JSON.stringify(results, null, 2).slice(0, 3000));
await browser.close();
