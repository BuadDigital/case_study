/**
 * Finance officer (eman) — the cost/dues ledger for the created PO, plus the
 * server-paged billing list.
 *
 * UI-driven:  /financial, the «التكاليف» payees area, the engineering office's
 *             dues account (its tabs, its ledger search, its rows), and the
 *             server-paged work-order/billing list with its pager.
 * API-driven: building the distributed transaction, the field inspection, and
 *             the survey submission — those have their own UI journeys
 *             (inspector-submit-and-accept.spec.ts, engineering-office-survey.spec.ts).
 *
 * Two environment/product facts shape this spec:
 *   1. Accepting a survey accrues the office fee from the engineering-survey
 *      party-fee pricing table. That table has no area tiers in the dev
 *      database, so acceptance fails with
 *      «تعذر تحديد الأتعاب من جدول التسعير — راجع ضبط الأسعار.» and no ledger
 *      row can exist. The ledger test skips (loudly) until it is configured.
 *   2. No screen under /financial renders a pager: both billing APIs
 *      (/api/party-billing-statements, /api/enfaz-billing/*) return plain
 *      arrays with no paging parameters. The only server-paged billing list is
 *      the work-order list with its «مفوتر جزئي» / «مفوتر بالكامل» buckets on
 *      /po — which eman cannot reach (ROLE_MODULE_PAGES gives her /financial
 *      only), so that half is asserted as the case specialist.
 */
import { test, expect } from "@playwright/test";
import { loginAs, RELEASE_USERS, waitForPageTitle } from "../../fixtures/auth";
import {
  ASSIGNEE_IDS,
  ASSIGNEE_NAMES,
  api,
  apiLogin,
  apiOk,
  createDistributedTransaction,
  deleteWorkOrder,
  submitFieldInspection,
  TINY_PDF_BASE64,
  uploadAttachment,
  type Transaction,
} from "../../fixtures/transaction";

const DUES_URL = `/financial?area=costs&section=dues&party=${ASSIGNEE_IDS.engineeringOffice}`;

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

test.describe("Finance: cost ledger and the server-paged billing list", () => {
  let osamaToken = "";
  let adminToken = "";
  let tx: Transaction;

  test.beforeAll(async () => {
    osamaToken = await apiLogin(RELEASE_USERS.caseSpecialist);
    adminToken = await apiLogin(RELEASE_USERS.cdo);
    const inspectorToken = await apiLogin(RELEASE_USERS.fieldInspector);
    const officeToken = await apiLogin(RELEASE_USERS.engineeringOffice);

    tx = await createDistributedTransaction(osamaToken);
    await submitFieldInspection(inspectorToken, tx.fieldInspection.id);
    await apiOk(
      osamaToken,
      "POST",
      `/api/party-task-submissions/${tx.fieldInspection.id}/accept`,
    );

    await uploadAttachment(officeToken, {
      scope: "engineering-survey-report",
      scopeKey: tx.engineeringSurvey.id,
      fileName: "survey-report-e2e.pdf",
      contentType: "application/pdf",
      contentBase64: TINY_PDF_BASE64,
    });
    await apiOk(
      officeToken,
      "PUT",
      `/api/party-task-submissions/${tx.engineeringSurvey.id}`,
      {
        payload: {
          latitude: "24.7136",
          longitude: "46.6753",
          surveyReportFileName: "survey-report-e2e.pdf",
          siteConfirmed: true,
        },
      },
    );
    await apiOk(
      officeToken,
      "POST",
      `/api/party-task-submissions/${tx.engineeringSurvey.id}/submit`,
    );
  });

  test.afterAll(async () => {
    if (osamaToken && tx) await deleteWorkOrder(osamaToken, tx.poNumber);
  });

  test("finance officer opens the engineering office's dues account", async ({
    page,
  }) => {
    test.slow();
    await loginAs(page, RELEASE_USERS.financialOfficer);

    // Payees list — «المستحقون المسجّلون لدى المالية».
    await page.goto("/financial?area=costs", { waitUntil: "commit" });
    await expect(
      page.getByRole("textbox", { name: "بحث المستحقين" }),
    ).toBeVisible({ timeout: 90_000 });
    await expect(
      page.getByText("التكاليف — صرف المستحقات").first(),
    ).toBeVisible();

    // The engineering office's account.
    await page.goto(DUES_URL, { waitUntil: "commit" });
    await expect(page.getByText(ASSIGNEE_NAMES.engineeringOffice).first()).toBeVisible(
      { timeout: 90_000 },
    );
    await expect(page.getByText(ASSIGNEE_IDS.engineeringOffice).first()).toBeVisible();

    for (const tab of [
      "المستحقات",
      "مسيرات وأوامر صرف",
      "مدفوعة",
      "مستبعدة",
    ]) {
      await expect(page.getByRole("tab", { name: new RegExp(tab) })).toBeVisible();
    }

    // The dues ledger itself, and the copy that names the survey line scope.
    await expect(
      page.getByRole("textbox", { name: "بحث المستحقات" }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "تظهر هنا بنود المعاينة والمراجعة والرفع المساحي بحالة جاهز أو مرحَّل.",
      ),
    ).toBeVisible();
  });

  test("the accepted survey shows as a ledger row for the office", async ({
    page,
  }) => {
    test.slow();
    test.skip(
      !(await surveyPricingConfigured(adminToken)),
      "engineering-survey party-fee pricing has no area tiers in this environment — " +
        "acceptance fails with «تعذر تحديد الأتعاب من جدول التسعير — راجع ضبط الأسعار.» " +
        "and no dues row can be accrued",
    );

    const accept = await api(
      osamaToken,
      "POST",
      `/api/party-task-submissions/${tx.engineeringSurvey.id}/accept`,
    );
    expect(
      accept.ok,
      `survey accept failed: ${JSON.stringify(accept.json)}`,
    ).toBe(true);

    await loginAs(page, RELEASE_USERS.financialOfficer);
    await page.goto(DUES_URL, { waitUntil: "commit" });
    const search = page.getByRole("textbox", { name: "بحث المستحقات" });
    await expect(search).toBeVisible({ timeout: 90_000 });
    await search.fill(tx.poNumber);

    // searchAndSortDues matches on `${propertyLabel} ${poNumber} ${workflowTaskId}`.
    // The row lives inside the office's own dues account, so it carries the
    // property/PO label and the accrued amount — not the payee name.
    const row = page.locator("tbody tr").filter({ hasText: tx.poNumber });
    await expect(row).toHaveCount(1, { timeout: 30_000 });
    await expect(row).toContainText("ر.س");
  });

  test("the billing work-order list is server-paged and honours its page size", async ({
    page,
  }) => {
    test.slow();
    // eman has no paged screen; /po is the list that carries the billing buckets.
    await loginAs(page, RELEASE_USERS.caseSpecialist);

    const listRequests: string[] = [];
    page.on("request", (req) => {
      const url = req.url();
      if (url.includes("/api/work-orders?")) listRequests.push(url);
    });

    await page.goto("/po", { waitUntil: "commit" });
    await waitForPageTitle(page, "أوامر العمل");

    const rangeLabel = page.getByText(/عرض\s.+\sمن\s.+\sنتيجة/).first();
    await expect(rangeLabel).toBeVisible({ timeout: 60_000 });
    await expect(
      page.getByRole("button", { name: "الصفحة السابقة" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "الصفحة التالية" })).toBeVisible();
    // Numbered pager — the current page is marked with aria-current.
    await expect(page.locator('[aria-current="page"]')).toHaveCount(1);

    // PO_LIST_PAGE_SIZE = 10, and the server clamps rather than ignores it.
    expect(
      listRequests.some((url) => url.includes("pageSize=10")),
      `no GET /api/work-orders carried pageSize=10 — saw: ${listRequests.join(", ")}`,
    ).toBe(true);
    expect(await page.locator("tbody tr").count()).toBeLessThanOrEqual(10);

    // The billing buckets are reachable from the same list.
    const statusFilter = page.getByRole("combobox", { name: "تصفية الحالة" });
    await expect(statusFilter).toBeVisible();
    await expect(
      statusFilter.locator("option", { hasText: "مفوتر بالكامل" }),
    ).toHaveCount(1);
  });
});
