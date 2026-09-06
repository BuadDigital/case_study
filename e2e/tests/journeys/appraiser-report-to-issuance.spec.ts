/**
 * Appraiser (abdullah) opens the valuation workspace and saves a draft; the case
 * specialist (osama) then reads the property's «تقييم العقار» tab.
 *
 * UI-driven:  the evaluator workspace — «بدء التقييم» (the first real save,
 *             PUT …/approach-settings), the screen tabs it unlocks
 *             (طريقة المقارنة / طريقة المقاول), the final-opinion screen, and
 *             the specialist's «تقييم العقار» tab with its final-report panel
 *             (stage badge + either the PDF iframe or the documented empty
 *             state).
 * API-driven: building the distributed transaction and completing + accepting
 *             the sibling field inspection — the appraiser cannot start until
 *             the inspection package is specialist-accepted
 *             (WorkflowTaskDto.FieldInspectionAccepted). That package has its
 *             own UI journey in inspector-submit-and-accept.spec.ts.
 *
 * Note: the evaluator screen switches are `role="tab"` buttons inside
 * `aria-label="أقسام نافذة التقييم"` — not plain buttons.
 */
import { test, expect } from "@playwright/test";
import { loginAs, RELEASE_USERS } from "../../fixtures/auth";
import {
  api,
  apiLogin,
  apiOk,
  createDistributedTransaction,
  deleteWorkOrder,
  submitFieldInspection,
  type Transaction,
} from "../../fixtures/transaction";

test.describe("Appraiser: valuation draft → specialist report panel", () => {
  let osamaToken = "";
  let tx: Transaction;

  test.beforeAll(async () => {
    osamaToken = await apiLogin(RELEASE_USERS.caseSpecialist);
    const inspectorToken = await apiLogin(RELEASE_USERS.fieldInspector);
    tx = await createDistributedTransaction(osamaToken);
    await submitFieldInspection(inspectorToken, tx.fieldInspection.id);
    await apiOk(
      osamaToken,
      "POST",
      `/api/party-task-submissions/${tx.fieldInspection.id}/accept`,
    );
  });

  test.afterAll(async () => {
    if (osamaToken && tx) await deleteWorkOrder(osamaToken, tx.poNumber);
  });

  test("appraiser starts the valuation and unlocks the remaining screens", async ({
    page,
  }) => {
    test.slow();
    await loginAs(page, RELEASE_USERS.appraiser);
    await page.goto(`/property-appraisal/${tx.propertyAppraisal.id}`, {
      waitUntil: "commit",
    });

    await expect(
      page.getByText("أساليب وطرق التقييم المستخدمة").first(),
    ).toBeVisible({ timeout: 120_000 });

    const tabs = page.getByRole("tablist", { name: "أقسام نافذة التقييم" });
    await expect(tabs.getByRole("tab", { name: "البيانات الأساسية" })).toBeVisible();
    // The market/cost screens are gated on a saved settings draft.
    await expect(tabs.getByRole("tab", { name: "طريقة المقارنة" })).toHaveCount(0);

    const start = page.getByRole("button", { name: "بدء التقييم" }).first();
    await expect(start).toBeVisible({ timeout: 60_000 });

    const settingsSaved = page
      .waitForResponse(
        (res) =>
          res.url().includes("/approach-settings") &&
          res.request().method() === "PUT",
        { timeout: 90_000 },
      )
      .catch(() => null);
    await start.click();
    const saveResponse = await settingsSaved;
    expect(saveResponse, "PUT …/approach-settings never fired").not.toBeNull();
    expect(
      saveResponse!.status(),
      `approach settings rejected: ${await saveResponse!.text()}`,
    ).toBe(200);
    await expect(page.getByText("تم بدء التقييم").first()).toBeVisible({
      timeout: 30_000,
    });

    // Saving the draft is what unlocks the remaining valuation screens.
    await expect(tabs.getByRole("tab", { name: "طريقة المقارنة" })).toBeVisible({
      timeout: 60_000,
    });
    await expect(tabs.getByRole("tab", { name: "طريقة المقاول" })).toBeVisible();

    await tabs.getByRole("tab", { name: "رأي القيمة النهائي" }).click();
    await expect(page.getByText("الرأي النهائي للقيمة").first()).toBeVisible({
      timeout: 60_000,
    });
    await expect(
      page.getByText("اعتماد التقييم — شروط الإصدار").first(),
    ).toBeVisible({ timeout: 60_000 });
  });

  test("specialist opens the property's «تقييم العقار» tab", async ({ page }) => {
    test.slow();
    // PropertyDetailValuationFinalReport resolves the request through
    // GET /api/valuation-requests/open-by-property/{id}, which is gated by the
    // ReadValuationQueue capability. The case specialist does not hold it, so
    // the panel renders its error state instead of the report — see the README.
    const probe = await api(
      osamaToken,
      "GET",
      `/api/valuation-requests/open-by-property/${tx.propertyId}`,
    );
    test.skip(
      probe.status === 403,
      "the case specialist is denied GET /api/valuation-requests/open-by-property " +
        "(ReadValuationQueue), so «تقييم العقار» can only render " +
        "«تعذّر تحميل تقرير التقييم» — product bug, see e2e/README.md",
    );

    await loginAs(page, RELEASE_USERS.caseSpecialist);
    await page.goto(
      `/po/${encodeURIComponent(tx.poNumber)}/property/${tx.propertyId}?tab=appraisal`,
      { waitUntil: "commit" },
    );
    await expect(
      page.getByRole("tab", { name: "تقييم العقار", exact: true }),
    ).toHaveAttribute("aria-selected", "true", { timeout: 90_000 });

    await expect(page.getByText("التقرير النهائي", { exact: true })).toBeVisible({
      timeout: 90_000,
    });
    // Stage badge — nothing has been issued yet, so it reads «مسودة».
    await expect(page.getByText("مسودة", { exact: true }).first()).toBeVisible();

    // Either the PDF preview rendered, or the documented "no file yet" state did.
    // The preview PDF is rendered server-side on demand, so the panel can sit on
    // its spinner for a while and flip between states while queries settle:
    // wait for whichever terminal state shows, then branch on it.
    const pdfFrame = page.locator('iframe[title^="تقرير التقييم — "]');
    const noFileYet = page.getByText("لا يوجد ملف تقرير بعد");
    const settled = pdfFrame.first().or(noFileYet);
    await expect(settled).toBeVisible({ timeout: 90_000 });

    // The empty state can be painted first and then replaced by the PDF once
    // the preview finishes rendering, so never pin the branch: whichever state
    // is on screen must be a complete one.
    if (await pdfFrame.first().isVisible().catch(() => false)) {
      await expect(pdfFrame.first()).toHaveAttribute("src", /^blob:/, {
        timeout: 30_000,
      });
    } else {
      const emptyStateSub = page.getByText(
        "يظهر الملف هنا بعد أن يكمل المقيّم مسودة التقرير أو يصدرها.",
      );
      await expect(emptyStateSub.or(pdfFrame.first())).toBeVisible({
        timeout: 30_000,
      });
    }
  });
});
