import { test, expect } from "@playwright/test";
import { loginAs, RELEASE_USERS, waitForPageTitle } from "../../fixtures/auth";

const FAILURE_ID = "11111111-1111-4111-8111-111111111111";

const reviewFailure = {
  id: FAILURE_ID,
  poNumber: "PO-E2E-1",
  propertyId: "prop-e2e-1",
  deedNumber: "DEED-E2E",
  title: "تعذر اختبار التراجع",
  problemTypeId: "access-denied",
  severity: "internal",
  raisedByRole: "case-specialist",
  internalNote: "note",
  finalNote: "",
  resolutionReason: "",
  continueInstructions: "",
  status: "review",
  specialist: "osama",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

test.describe("Failures optimistic rollback", () => {
  test("aborted final failure keeps the status and shows an error toast", async ({
    page,
  }) => {
    await loginAs(page, RELEASE_USERS.cdo);

    // Whole-set read (plain array) and the server-paged list (envelope) both
    // return the one mocked row — the screen is paged since 2026-09-04.
    await page.route(
      (url) => /\/api\/failures(\?.*)?$/.test(url.href),
      async (route) => {
        if (route.request().method() !== "GET") {
          await route.continue();
          return;
        }
        const paged = new URL(route.request().url()).searchParams.has("page");
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(
            paged
              ? {
                  items: [reviewFailure],
                  totalCount: 1,
                  page: 1,
                  pageSize: 10,
                  totalPages: 1,
                }
              : [reviewFailure],
          ),
        });
      },
    );

    // «اعتماد التعذّر» opens the final-failure dialog (since 31c27c53); abort the dialog's post.
    await page.route("**/api/failures/final", (route) => route.abort("failed"));

    await page.goto(`/failures?highlight=${FAILURE_ID}`, { waitUntil: "commit" });
    await waitForPageTitle(page, "إدارة التعذّرات");

    const row = page.locator(`#failure-${FAILURE_ID}`);
    await expect(row).toBeVisible();
    await expect(row.getByText("قيد المراجعة")).toBeVisible();

    await page.getByRole("button", { name: "اعتماد التعذّر" }).click();
    const dialog = page.getByRole("dialog", { name: /التعذّر النهائي عن المعاملة/ });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel(/سبب التعذّر النهائي/).fill("سبب اختبار التراجع");
    await dialog.getByRole("button", { name: "تسجيل التعذّر النهائي" }).click();

    await expect(
      page.getByRole("status").filter({ hasText: "تعذّر الاتصال بالخادم" }),
    ).toBeVisible({ timeout: 10_000 });
    // The dialog stays open with the typed reason, and the row keeps its status.
    await expect(dialog).toBeVisible();
    await expect(row.getByText("قيد المراجعة")).toBeVisible();
    // Scoped to the row: the KPI band and the tab strip also say «تعذّر نهائي» / «التعذّرات».
    await expect(row.getByText("تعذّر نهائي", { exact: true })).toHaveCount(0);
  });
});
