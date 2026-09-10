/**
 * One transaction, driven through the real frontend from intake to invoice.
 *
 * Unlike the focused journeys (each of which owns one hand-off), this walks a
 * SINGLE PO across every role's screens in order, screenshotting each stage:
 *
 *   osama (specialist)   intake modal → property page → parties rail
 *   ahmed (inspector)    queue → 3-step wizard → «حفظ وإرسال»
 *   osama                inspection package accepted → timeline
 *   jeddah_survey        queue → entry form → PDF report → «إرسال الرفع المساحي»
 *   osama                «قبول المخرجات» on the survey tab
 *   abdullah (appraiser) «بدء التقييم» → all six valuation screens
 *   osama                the property's «تقييم العقار» tab
 *   eman (finance)       the office's dues ledger
 *   sliman (CDO)         the dashboard over the finished transaction
 *
 * API is used only where the product has no single-screen UI equivalent, and
 * every such spot is commented: registering the property (the intake modal
 * always posts `properties: []`), confirm-distribution, and the specialist's
 * inspection ACCEPT (PropertyDetailPartyPackageReview is mounted on the survey
 * and appraisal tabs only).
 *
 * Opt-in: it is slow and it is a demonstration, not a regression net, so it
 * runs only with WALKTHROUGH=1. Screenshots go to $SHOT_DIR.
 */
import fs from "node:fs";
import path from "node:path";
import { test, expect, type Locator, type Page } from "@playwright/test";
import { loginAs, RELEASE_USERS, waitForPageTitle } from "../../fixtures/auth";
import {
  ASSIGNEE_IDS,
  ASSIGNEE_NAMES,
  addProperty,
  api,
  apiLogin,
  apiOk,
  clearPoIntakeDraft,
  deleteWorkOrder,
  distributeParties,
  tinyPdfBuffer,
  tinyPngBuffer,
  today,
  uniqueDeedNumber,
  uniquePoNumber,
  type PartyTasks,
} from "../../fixtures/transaction";

const ENABLED = process.env.WALKTHROUGH === "1";
const SHOT_DIR = process.env.SHOT_DIR ?? "test-results/walkthrough";
const REPORT_FILE_NAME = "survey-report-walkthrough.pdf";
const WORKSPACE = "#view-active-inspection-workspace";

let shotIndex = 0;
async function shot(page: Page, name: string) {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  shotIndex += 1;
  const file = path.join(
    SHOT_DIR,
    `${String(shotIndex).padStart(2, "0")}-${name}.png`,
  );
  await page.screenshot({ path: file, fullPage: true });
  console.log(`  📸 ${file}`);
}

/** Both the desktop wizard and the mobile shell mount at once — scope to one. */
function workspace(page: Page): Locator {
  return page.locator(WORKSPACE);
}

async function attachFeaturePhoto(ws: Locator, key: string) {
  const cell = ws.locator(`#ins-feature-photo-${key}`);
  await expect(cell).toBeVisible();
  await cell.locator('input[type="file"]').setInputFiles({
    name: `${key}.png`,
    mimeType: "image/png",
    buffer: tinyPngBuffer(),
  });
  await expect(cell.getByText("مرفقة")).toBeVisible({ timeout: 30_000 });
}

/** Yes/no component pills cycle "" → نعم → لا; "نعم" would demand a photo. */
async function answerComponentPillNo(ws: Locator, label: string) {
  const pill = ws.getByRole("button", { name: label, exact: true });
  await expect(pill).toBeVisible();
  await pill.click();
  await expect(pill).toHaveClass(/bg-ink/);
  await pill.click();
  await expect(pill).not.toHaveClass(/bg-ink/);
}

/** True when the engineering-survey pricing table has at least one area tier. */
async function surveyPricingConfigured(adminToken: string): Promise<boolean> {
  const tables = await api<{ id: string }[]>(
    adminToken,
    "GET",
    "/api/financial/party-fee-pricing/tables?category=engineering-survey",
  );
  if (!tables.ok || !Array.isArray(tables.json)) return false;
  for (const table of tables.json) {
    const detail = await api<{ areaTiers?: unknown[] }>(
      adminToken,
      "GET",
      `/api/financial/party-fee-pricing/${table.id}`,
    );
    if (detail.ok && (detail.json.areaTiers?.length ?? 0) > 0) return true;
  }
  return false;
}

test.describe.configure({ mode: "serial" });

test.describe("Full frontend walkthrough: intake → inspection → survey → valuation → billing", () => {
  test.skip(!ENABLED, "set WALKTHROUGH=1 to run the demonstration walkthrough");

  const poNumber = uniquePoNumber();
  const deedNumber = uniqueDeedNumber();
  let osamaToken = "";
  let adminToken = "";
  let propertyId = "";
  let parties: PartyTasks;

  test.beforeAll(async () => {
    osamaToken = await apiLogin(RELEASE_USERS.caseSpecialist);
    adminToken = await apiLogin(RELEASE_USERS.cdo);
    // The intake modal autosaves a per-user draft and clears it only on save.
    await clearPoIntakeDraft(osamaToken);
    console.log(`\n  ▶ walkthrough PO ${poNumber} / deed ${deedNumber}\n`);
  });

  test.afterAll(async () => {
    if (osamaToken) await deleteWorkOrder(osamaToken, poNumber);
  });

  test("1 · specialist opens the PO and distributes it to the three parties", async ({
    page,
  }) => {
    test.slow();
    await loginAs(page, RELEASE_USERS.caseSpecialist);
    await shot(page, "specialist-dashboard");

    await page.getByRole("button", { name: "أمر عمل جديد" }).click();
    const intake = page.getByRole("dialog", { name: "تسجيل أمر عمل (PO) جديد" });
    await expect(intake).toBeVisible();
    await intake.locator("#po_number_modal").fill(poNumber);
    await intake.locator("#promulgation_date_modal").fill(today());
    await intake.locator("#assignment_primary").selectOption("تنفيذ");
    await shot(page, "specialist-intake-modal");

    await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes("/api/work-orders") &&
          res.request().method() === "POST",
      ),
      intake.getByRole("button", { name: "حفظ أمر العمل" }).click(),
    ]);
    await expect(page).toHaveURL(
      new RegExp(`/po/${encodeURIComponent(poNumber)}/property$`),
    );
    await shot(page, "specialist-po-properties");

    // API: the intake modal always posts `properties: []` (usePoIntakeForm), and
    // confirm-distribution has no single-screen UI equivalent.
    propertyId = await addProperty(osamaToken, poNumber, deedNumber);
    parties = await distributeParties(osamaToken, poNumber, propertyId, deedNumber);
    expect(parties.fieldInspection.assigneeId).toBe(ASSIGNEE_IDS.fieldInspector);
    expect(parties.engineeringSurvey.assigneeId).toBe(ASSIGNEE_IDS.engineeringOffice);
    expect(parties.propertyAppraisal.assigneeId).toBe(ASSIGNEE_IDS.appraiser);

    await page.goto(`/po/${encodeURIComponent(poNumber)}/property/${propertyId}`, {
      waitUntil: "commit",
    });
    const rail = page.locator('aside[aria-label="الجدول الزمني للمعاملة"]');
    await expect(rail).toBeVisible({ timeout: 60_000 });
    const partyName = (role: string) =>
      rail.locator(`span:has(> span:text-is("${role}"))`).locator("span").first();
    await expect(partyName("المعاين")).toHaveText(ASSIGNEE_NAMES.fieldInspector);
    await expect(partyName("المكتب الهندسي")).toHaveText(
      ASSIGNEE_NAMES.engineeringOffice,
    );
    await expect(partyName("المقيّم")).toHaveText(ASSIGNEE_NAMES.appraiser);
    await shot(page, "specialist-parties-rail");
  });

  test("2 · field inspector fills the wizard and submits the inspection", async ({
    page,
  }) => {
    test.slow();
    await loginAs(page, RELEASE_USERS.fieldInspector);

    await page.goto("/active-inspection", { waitUntil: "commit" });
    const search = page.getByRole("searchbox", { name: "بحث المعاملات" });
    await expect(search).toBeVisible({ timeout: 60_000 });
    await search.fill(poNumber);
    const row = page.locator(
      `tbody tr:has(a[href="/po/${encodeURIComponent(poNumber)}/property"])`,
    );
    await expect(row).toHaveCount(1, { timeout: 30_000 });
    await shot(page, "inspector-queue");
    // The PO cell stops propagation — click a plain cell so the row handler runs.
    await row.getByText("تنفيذ", { exact: true }).first().click();
    await expect(page).toHaveURL(
      new RegExp(`/active-inspection/${parties.fieldInspection.id}$`),
      { timeout: 60_000 },
    );

    const ws = workspace(page);
    await expect(ws).toBeVisible({ timeout: 60_000 });
    const coords = ws.locator('input[placeholder="21.523339, 39.187743"]');
    await expect(coords).toBeVisible({ timeout: 30_000 });
    await coords.fill("24.7136, 46.6753");
    await ws.getByRole("button", { name: "تثبيت الموقع", exact: true }).click();
    const moveDialog = page.getByRole("dialog", { name: "تأكيد تحريك الموقع" });
    if (await moveDialog.isVisible().catch(() => false)) {
      await page.getByRole("button", { name: "تثبيت الموقع الجديد" }).click();
    }
    await ws.locator("#ins-access-name").fill("ضابط اتصال آلي");
    await ws.locator("#ins-access-phone").fill("0555000111");
    await ws.locator("#ins-access-role").selectOption("مالك");
    await shot(page, "inspector-step1-location");
    await ws.getByRole("button", { name: "حفظ ومتابعة" }).click();

    await expect(ws.locator("#ins-feature-select-assetSubject")).toBeVisible({
      timeout: 30_000,
    });
    await ws.locator("#ins-feature-select-assetSubject").selectOption("فيلا");
    await ws.locator("#ins-feature-select-propertyUsage").selectOption("سكني");
    await ws.locator("#ins-feature-select-facade").selectOption("شمالية");
    await attachFeaturePhoto(ws, "facade");
    await ws
      .locator("#ins-feature-buildState")
      .getByRole("button", { name: "جيد", exact: true })
      .click();
    await attachFeaturePhoto(ws, "buildState");
    await ws
      .locator("#ins-feature-occupancyState")
      .getByRole("button", { name: "شاغر", exact: true })
      .click();
    await ws
      .locator("#ins-feature-districtState")
      .getByRole("button", { name: "جديد", exact: true })
      .click();
    for (const label of [
      "يوجد منقولات",
      "مدخل السيارة",
      "يوجد قبو",
      "يوجد مصعد",
      "يوجد مسبح",
      "مطبخ",
    ]) {
      await answerComponentPillNo(ws, label);
    }
    await shot(page, "inspector-step2-features");
    await ws.getByRole("button", { name: "حفظ ومتابعة" }).click();

    const submit = ws.getByRole("button", { name: "حفظ وإرسال", exact: true });
    await expect(submit).toBeVisible({ timeout: 30_000 });
    await ws
      .locator("label")
      .filter({ hasText: "أقر بأن بيانات المعاينة صحيحة ومطابقة للواقع الميداني" })
      .locator('input[type="checkbox"]')
      .check();
    await shot(page, "inspector-step3-declaration");

    const submitted = page
      .waitForResponse(
        (res) =>
          /\/api\/party-task-submissions\/[^/]+\/submit$/.test(res.url()) &&
          res.request().method() === "POST",
        { timeout: 60_000 },
      )
      .catch(() => null);
    await submit.click();
    const response = await submitted;
    if (!response) {
      const complaints = (await page.getByRole("alert").allInnerTexts())
        .join(" | ")
        .replace(/\s+/g, " ")
        .trim();
      throw new Error(
        `«حفظ وإرسال» never reached the API. Validation said: ${complaints || "(nothing)"}`,
      );
    }
    expect(response.status(), `submit rejected: ${await response.text()}`).toBe(200);
  });

  test("3 · specialist accepts the inspection package", async ({ page }) => {
    test.slow();
    // API: the «معاينة العقار» tab mounts no accept control.
    const accept = await api(
      osamaToken,
      "POST",
      `/api/party-task-submissions/${parties.fieldInspection.id}/accept`,
    );
    expect(accept.ok, `accept failed: ${JSON.stringify(accept.json)}`).toBe(true);

    await loginAs(page, RELEASE_USERS.caseSpecialist);
    await page.goto(
      `/po/${encodeURIComponent(poNumber)}/property/${propertyId}?tab=inspection`,
      { waitUntil: "commit" },
    );
    const rail = page.locator('aside[aria-label="الجدول الزمني للمعاملة"]');
    await expect(rail.getByText("إتمام المعاينة الميدانية")).toBeVisible({
      timeout: 60_000,
    });
    await expect(rail.getByText("استلام بيانات المعاينة")).toBeVisible();
    await shot(page, "specialist-inspection-tab");
  });

  test("4 · engineering office submits the survey with its PDF report", async ({
    page,
  }) => {
    test.slow();
    await loginAs(page, RELEASE_USERS.engineeringOffice);

    await page.goto("/active-survey", { waitUntil: "commit" });
    const search = page.getByRole("searchbox", { name: "بحث المعاملات" });
    await expect(search).toBeVisible({ timeout: 60_000 });
    await search.fill(poNumber);
    // The survey queue has no PO column — rows are keyed by deed.
    const row = page.locator("tbody tr").filter({ hasText: deedNumber });
    await expect(row).toHaveCount(1, { timeout: 30_000 });
    await shot(page, "survey-queue");
    await row.locator("td").nth(1).click();
    await expect(page).toHaveURL(
      new RegExp(`/active-survey/${parties.engineeringSurvey.id}$`),
      { timeout: 90_000 },
    );
    await page.getByRole("button", { name: "بدء الرفع المساحي" }).click();
    await expect(page).toHaveURL(
      new RegExp(`/active-survey/${parties.engineeringSurvey.id}/entry$`),
      { timeout: 90_000 },
    );

    const lat = page.locator("#eng-lat");
    await expect(lat).toBeEditable({ timeout: 60_000 });
    await lat.fill("24.7136");
    await page.locator("#eng-lng").fill("46.6753");

    const reportBox = page.locator("#eng-survey-report");
    await reportBox.locator('input[type="file"]').setInputFiles({
      name: REPORT_FILE_NAME,
      mimeType: "application/pdf",
      buffer: tinyPdfBuffer(),
    });
    await expect(reportBox.getByRole("button", { name: "حذف الملف" })).toBeVisible({
      timeout: 60_000,
    });

    await page.locator("#eng-deed-matches").getByText("نعم", { exact: true }).click();
    const siteConfirm = page.locator("#eng-site-confirm input[type=checkbox]");
    await siteConfirm.click();
    await expect(siteConfirm).toBeChecked({ timeout: 15_000 });

    const groups = page.locator("#eng-checklist").getByRole("radiogroup");
    const groupCount = await groups.count();
    for (let i = 0; i < groupCount; i++) {
      await groups.nth(i).getByRole("radio", { name: "نعم", exact: true }).click();
    }
    await shot(page, "survey-entry-form");

    const submitted = page
      .waitForResponse(
        (res) =>
          /\/api\/party-task-submissions\/[^/]+\/submit$/.test(res.url()) &&
          res.request().method() === "POST",
        { timeout: 60_000 },
      )
      .catch(() => null);
    await page.getByRole("button", { name: "إرسال الرفع المساحي" }).click();
    const response = await submitted;
    if (!response) {
      const complaints = (await page.locator("body").innerText())
        .split("\n")
        .filter((line) => /ارفع|أدخل|حدد|يجب|أكمل|تعذر/.test(line))
        .join(" | ")
        .replace(/\s+/g, " ")
        .trim();
      throw new Error(
        `«إرسال الرفع المساحي» never reached the API. Validation said: ${complaints || "(nothing)"}`,
      );
    }
    expect(response.status(), `submit rejected: ${await response.text()}`).toBe(200);
    await expect(page.getByText("اكتمل الرفع المساحي لهذا العقار.")).toBeVisible({
      timeout: 30_000,
    });
    await shot(page, "survey-submitted");
  });

  test("5 · specialist accepts the survey outputs", async ({ page }) => {
    test.slow();
    // Acceptance accrues the office fee from the pricing table.
    test.skip(
      !(await surveyPricingConfigured(adminToken)),
      "engineering-survey party-fee pricing has no area tiers in this environment",
    );
    await loginAs(page, RELEASE_USERS.caseSpecialist);
    await page.goto(
      `/po/${encodeURIComponent(poNumber)}/property/${propertyId}?tab=survey`,
      { waitUntil: "commit" },
    );
    const accept = page.getByRole("button", { name: "قبول المخرجات" });
    await expect(accept).toBeVisible({ timeout: 60_000 });
    await accept.click();
    await expect(page.getByText("تم قبول مخرجات الرفع المساحي")).toBeVisible({
      timeout: 30_000,
    });
    await shot(page, "specialist-survey-accepted");
  });

  test("6 · appraiser starts the valuation and walks every screen", async ({
    page,
  }) => {
    test.slow();
    await loginAs(page, RELEASE_USERS.appraiser);
    await page.goto(`/property-appraisal/${parties.propertyAppraisal.id}`, {
      waitUntil: "commit",
    });
    await expect(
      page.getByText("أساليب وطرق التقييم المستخدمة").first(),
    ).toBeVisible({ timeout: 120_000 });

    const tabs = page.getByRole("tablist", { name: "أقسام نافذة التقييم" });
    // Both approaches start unchecked on a fresh request — the first save is
    // refused client-side ("يلزم تفعيل أسلوب واحد على الأقل") until one is picked.
    // The settings fetch re-hydrates these toggles when it lands, discarding a
    // tick made before it, so hold the pair until it survives a re-render.
    const marketBox = page.getByRole("checkbox", { name: "أسلوب السوق" });
    const costBox = page.getByRole("checkbox", { name: "أسلوب التكلفة" });
    await expect(async () => {
      if (!(await marketBox.isChecked())) await marketBox.check();
      if (!(await costBox.isChecked())) await costBox.check();
      expect(await marketBox.isChecked()).toBe(true);
      expect(await costBox.isChecked()).toBe(true);
    }).toPass({ timeout: 30_000 });
    await shot(page, "appraiser-basics");

    const settingsSaved = page
      .waitForResponse(
        (res) =>
          res.url().includes("/approach-settings") &&
          res.request().method() === "PUT",
        { timeout: 90_000 },
      )
      .catch(() => null);
    await page.getByRole("button", { name: "بدء التقييم" }).first().click();
    const saveResponse = await settingsSaved;
    expect(saveResponse, "PUT …/approach-settings never fired").not.toBeNull();
    expect(saveResponse!.status()).toBe(200);
    await expect(page.getByText("تم بدء التقييم").first()).toBeVisible({
      timeout: 30_000,
    });

    for (const [tabName, slug] of [
      ["طريقة المقارنة", "appraiser-market"],
      ["طريقة المقاول", "appraiser-cost"],
      ["رأي القيمة النهائي", "appraiser-final-opinion"],
      ["المراجعة النهائية", "appraiser-final-review"],
      ["تقرير التقييم", "appraiser-report"],
    ] as const) {
      const tab = tabs.getByRole("tab", { name: tabName });
      await expect(tab).toBeVisible({ timeout: 60_000 });
      await tab.click();
      await page.waitForTimeout(1_500);
      await shot(page, slug);
    }
  });

  test("7 · specialist reads the property's valuation tab", async ({ page }) => {
    test.slow();
    await loginAs(page, RELEASE_USERS.caseSpecialist);
    await page.goto(
      `/po/${encodeURIComponent(poNumber)}/property/${propertyId}?tab=appraisal`,
      { waitUntil: "commit" },
    );
    await expect(
      page.locator('aside[aria-label="الجدول الزمني للمعاملة"]'),
    ).toBeVisible({ timeout: 60_000 });
    // Tab ids live in po-property-detail-tabs-state.ts — «تقييم العقار» is `appraisal`.
    await expect(
      page.getByRole("tab", { name: "تقييم العقار" }),
    ).toHaveAttribute("aria-selected", "true", { timeout: 30_000 });
    await shot(page, "specialist-valuation-tab");
  });

  test("8 · finance officer opens the engineering office's dues ledger", async ({
    page,
  }) => {
    test.slow();
    await loginAs(page, RELEASE_USERS.financialOfficer);
    await page.goto(
      `/financial?area=costs&section=dues&party=${ASSIGNEE_IDS.engineeringOffice}`,
      { waitUntil: "commit" },
    );
    await expect(
      page.getByText(ASSIGNEE_NAMES.engineeringOffice).first(),
    ).toBeVisible({ timeout: 60_000 });
    await shot(page, "finance-dues-ledger");
  });

  test("9 · CDO sees the finished transaction on the dashboard", async ({ page }) => {
    test.slow();
    await loginAs(page, RELEASE_USERS.cdo);
    await waitForPageTitle(page, "لوحة المؤشرات").catch(() => undefined);
    await shot(page, "cdo-dashboard");

    const tasks = await apiOk<{ kind: string; status: string; phase: string }[]>(
      osamaToken,
      "GET",
      `/api/workflow-tasks?poNumber=${encodeURIComponent(poNumber)}`,
    );
    console.log(
      `\n  ▶ final task states for ${poNumber}:\n` +
        tasks
          .map((t) => `      ${t.kind.padEnd(22)} ${t.phase} / ${t.status}`)
          .join("\n") +
        "\n",
    );
  });
});
