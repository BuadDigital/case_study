/**
 * Engineering office (jeddah_survey) fills and submits the survey; the case
 * specialist (osama) accepts the outputs.
 *
 * UI-driven:  the /active-survey queue, the read-only workspace and its
 *             «بدء الرفع المساحي» hand-off into /entry, the coordinate fields,
 *             the PDF dropzone (including the assertion that the dropzone is
 *             replaced by a file chip), the site-confirmation declaration, the
 *             13-item field-verification checklist, «إرسال الرفع المساحي», and
 *             the specialist's «قبول المخرجات» review bar + timeline.
 * API-driven: building the distributed transaction, and completing the sibling
 *             field-inspection — the engineering office is blocked until the
 *             inspection is done (DocumentaryWorkflowRules.SurveyWorkBlockReason)
 *             and that package is exercised by inspector-submit-and-accept.spec.
 */
import { test, expect } from "@playwright/test";
import { loginAs, RELEASE_USERS } from "../../fixtures/auth";
import {
  api,
  apiLogin,
  createDistributedTransaction,
  deleteWorkOrder,
  submitFieldInspection,
  tinyPdfBuffer,
  type Transaction,
} from "../../fixtures/transaction";

const REPORT_FILE_NAME = "survey-report-e2e.pdf";

/** True when the engineering-survey pricing table has at least one area tier. */
async function surveyPricingConfigured(adminToken: string): Promise<boolean> {
  const tables = await api<{ id: string; category: string }[]>(
    adminToken,
    "GET",
    "/api/financial/party-fee-pricing/tables?category=engineering-survey",
  );
  if (!tables.ok || !Array.isArray(tables.json) || tables.json.length === 0) {
    return false;
  }
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

test.describe("Engineering office: survey submit → specialist accept", () => {
  let osamaToken = "";
  let adminToken = "";
  let tx: Transaction;

  test.beforeAll(async () => {
    osamaToken = await apiLogin(RELEASE_USERS.caseSpecialist);
    adminToken = await apiLogin(RELEASE_USERS.cdo);
    const inspectorToken = await apiLogin(RELEASE_USERS.fieldInspector);
    tx = await createDistributedTransaction(osamaToken);
    // The survey stays blocked until the sibling inspection is completed.
    await submitFieldInspection(inspectorToken, tx.fieldInspection.id);
  });

  test.afterAll(async () => {
    if (osamaToken && tx) await deleteWorkOrder(osamaToken, tx.poNumber);
  });

  test("engineering office submits the survey with a PDF report", async ({
    page,
  }) => {
    test.slow();
    await loginAs(page, RELEASE_USERS.engineeringOffice);

    // ── 1. queue → read-only workspace → data entry (UI) ────────────────────
    await page.goto("/active-survey", { waitUntil: "commit" });
    const search = page.getByRole("searchbox", { name: "بحث المعاملات" });
    await expect(search).toBeVisible({ timeout: 60_000 });
    await search.fill(tx.poNumber);
    // The engineering-survey queue table has no PO column — rows are keyed by deed.
    const row = page.locator("tbody tr").filter({ hasText: tx.deedNumber });
    await expect(row).toHaveCount(1, { timeout: 30_000 });
    await row.locator("td").nth(1).click();

    await expect(page).toHaveURL(
      new RegExp(`/active-survey/${tx.engineeringSurvey.id}$`),
      { timeout: 90_000 },
    );
    // /active-survey/{id} is a read-only view; the entry form lives one level in.
    await page.getByRole("button", { name: "بدء الرفع المساحي" }).click();
    await expect(page).toHaveURL(
      new RegExp(`/active-survey/${tx.engineeringSurvey.id}/entry$`),
      { timeout: 90_000 },
    );

    // ── 2. coordinates (UI) ────────────────────────────────────────────────
    const lat = page.locator("#eng-lat");
    await expect(lat).toBeEditable({ timeout: 60_000 });
    await lat.fill("24.7136");
    await page.locator("#eng-lng").fill("46.6753");

    // ── 3. the PDF dropzone → chip (UI) ────────────────────────────────────
    const reportBox = page.locator("#eng-survey-report");
    const dropzone = reportBox.locator('[role="button"]');
    await expect(dropzone).toHaveAttribute(
      "aria-label",
      "رفع التقرير المساحي — اختر ملفاً أو اسحبه هنا",
    );
    await reportBox.locator('input[type="file"]').setInputFiles({
      name: REPORT_FILE_NAME,
      mimeType: "application/pdf",
      buffer: tinyPdfBuffer(),
    });
    // Once the upload round-trips, the dropzone (and its file input) unmounts
    // and a chip carrying the file name takes its place.
    await expect(
      reportBox.getByRole("button", { name: "حذف الملف" }),
    ).toBeVisible({ timeout: 60_000 });
    await expect(dropzone).toHaveCount(0);
    await expect(reportBox.locator('span[dir="ltr"]')).toHaveText(
      REPORT_FILE_NAME,
    );

    // ── 4. deed/nature match, declaration, checklist (UI) ──────────────────
    await page
      .locator("#eng-deed-matches")
      .getByText("نعم", { exact: true })
      .click();
    // The declaration is a controlled checkbox that re-renders on change, so a
    // plain check() can lose the element between click and verification.
    const siteConfirm = page.locator("#eng-site-confirm input[type=checkbox]");
    await siteConfirm.click();
    await expect(siteConfirm).toBeChecked({ timeout: 15_000 });

    const checklist = page.locator("#eng-checklist");
    const groups = checklist.getByRole("radiogroup");
    const groupCount = await groups.count();
    expect(groupCount).toBe(13);
    for (let i = 0; i < groupCount; i++) {
      await groups.nth(i).getByRole("radio", { name: "نعم", exact: true }).click();
    }

    // ── 5. submit (UI) ─────────────────────────────────────────────────────
    const submit = page.getByRole("button", { name: "إرسال الرفع المساحي" });
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
    await expect(
      page.getByText("اكتمل الرفع المساحي لهذا العقار."),
    ).toBeVisible({ timeout: 30_000 });
  });

  test("specialist accepts the survey outputs", async ({ page }) => {
    test.slow();
    // Accepting a survey accrues the office fee from the pricing table, so it
    // cannot succeed while the engineering-survey table has no area tiers.
    test.skip(
      !(await surveyPricingConfigured(adminToken)),
      "engineering-survey party-fee pricing has no area tiers in this environment — " +
        "acceptance would fail with «تعذر تحديد الأتعاب من جدول التسعير — راجع ضبط الأسعار.»",
    );

    await loginAs(page, RELEASE_USERS.caseSpecialist);
    await page.goto(
      `/po/${encodeURIComponent(tx.poNumber)}/property/${tx.propertyId}?tab=survey`,
      { waitUntil: "commit" },
    );

    const accept = page.getByRole("button", { name: "قبول المخرجات" });
    await expect(accept).toBeVisible({ timeout: 60_000 });
    await accept.click();

    await expect(
      page.getByText("تم قبول مخرجات الرفع المساحي"),
    ).toBeVisible({ timeout: 30_000 });

    const rail = page.locator('aside[aria-label="الجدول الزمني للمعاملة"]');
    await expect(rail.getByText("إتمام الرفع المساحي")).toBeVisible();
    await expect(rail.getByText("قبول مخرجات الرفع المساحي")).toBeVisible({
      timeout: 30_000,
    });
  });
});
