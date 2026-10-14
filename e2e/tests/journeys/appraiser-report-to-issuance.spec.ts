/**
 * Appraiser (abdullah) opens the valuation workspace and saves a draft; the case
 * specialist (osama) then reads the property's «تقييم العقار» tab, where the
 * report draft is prepared once the appraiser hands his package over.
 *
 * UI-driven:  the evaluator workspace — «بدء التقييم» (the first real save,
 *             PUT …/approach-settings), the screen tabs it unlocks
 *             (طريقة المقارنة / طريقة المقاول), the final-opinion screen,
 *             «المراجعة النهائية», and the specialist's «تقييم العقار» tab:
 *             the report-draft panel (waiting for the hand-over) above the
 *             valuation report as the appraiser sees it.
 * API-driven: building the distributed transaction and submitting the sibling
 *             field inspection, the specialist's components (accepting needs
 *             them) and the guard rails of the report cycle that hold before
 *             the appraiser hands over (draft, approval, deposit).
 *             The valuation gates and everything after the hand-over (draft →
 *             approval → deposit code + certificate → final PDF) are not walked
 *             here: they need a complete valuation — see the unit / container
 *             tests and e2e/README.md.
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
  completeSpecialistComponents,
  createDistributedTransaction,
  deleteWorkOrder,
  submitFieldInspection,
  TINY_PDF_BASE64,
  today,
  type Transaction,
} from "../../fixtures/transaction";

test.describe("Appraiser: valuation draft → specialist report panel", () => {
  let osamaToken = "";
  let abdullahToken = "";
  let tx: Transaction;

  test.beforeAll(async () => {
    osamaToken = await apiLogin(RELEASE_USERS.caseSpecialist);
    abdullahToken = await apiLogin(RELEASE_USERS.appraiser);
    const inspectorToken = await apiLogin(RELEASE_USERS.fieldInspector);
    tx = await createDistributedTransaction(osamaToken);
    await submitFieldInspection(inspectorToken, tx.fieldInspection.id);
    await completeSpecialistComponents(osamaToken, tx.poNumber, tx.propertyId);
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

    // Issuance no longer lives on this screen: the gates card moved off the
    // final-opinion screen and the Q-6 cycle is part of «المراجعة النهائية».
    await tabs.getByRole("tab", { name: "المراجعة النهائية" }).click();
    await expect(page.getByText("الافتراضات الخاصة").first()).toBeVisible({
      timeout: 60_000,
    });
  });

  test("report cycle guard rails hold before the appraiser hands over", async () => {
    const draft = await apiOk<{
      valuationRequestId: string;
      status: string;
      canPrepare: boolean;
      reportStage: string;
    }>(osamaToken, "GET", `/api/valuation-report-drafts/by-property/${tx.propertyId}`);
    expect(draft.status).toBe("none");
    expect(draft.canPrepare).toBe(false);
    expect(draft.reportStage).toBe("draft");

    // The queue labels read this batch; a property with no request is simply absent from it.
    const states = await apiOk<{ propertyId: string; status: string }[]>(
      osamaToken,
      "GET",
      `/api/valuation-report-drafts/states?propertyIds=${tx.propertyId}`,
    );
    expect(states).toEqual([{ propertyId: tx.propertyId, status: "none", reportStage: "draft" }]);

    const base = `/api/valuation-requests/${draft.valuationRequestId}`;
    // The specialist cannot prepare the draft: nothing was handed over.
    const save = await api(osamaToken, "PUT", `${base}/report-draft/choices`, { choices: {} });
    expect(save.ok).toBe(false);
    expect([400, 409]).toContain(save.status);
    // The appraiser cannot approve a draft nobody sent.
    const approve = await api(abdullahToken, "POST", `${base}/report-draft/approve`, {
      reportDate: today(),
      html: "<p>x</p>",
    });
    expect(approve.ok).toBe(false);
    // Only the assigned appraiser records a deposit; the specialist is refused.
    const deposit = await api(osamaToken, "POST", `${base}/report-issuance/certificate`, {
      depositCode: "QYM-1",
      certificateContentBase64: TINY_PDF_BASE64,
    });
    expect([401, 403]).toContain(deposit.status);
    // There is no final report to download yet.
    const download = await api(osamaToken, "GET", `${base}/report-draft/final-report`);
    expect(download.ok).toBe(false);
  });

  test("specialist opens the property's «تقييم العقار» tab and sees the draft waiting for the hand-over", async ({
    page,
  }) => {
    test.slow();
    await loginAs(page, RELEASE_USERS.caseSpecialist);
    await page.goto(
      `/po/${encodeURIComponent(tx.poNumber)}/property/${tx.propertyId}?tab=appraisal`,
      { waitUntil: "commit" },
    );
    await expect(
      page.getByRole("tab", { name: "تقييم العقار", exact: true }),
    ).toHaveAttribute("aria-selected", "true", { timeout: 90_000 });

    // The report-draft panel: nothing to prepare until the appraiser hands his package over.
    await expect(page.getByRole("heading", { name: "مسودة تقرير التقييم" })).toBeVisible({
      timeout: 90_000,
    });
    await expect(page.getByTestId("report-draft-status")).toContainText("لم تبدأ");
    await expect(
      page.getByText("تُفتح المسودة بعد أن يسلّم المقيّم تقييمه للأخصائي."),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "إرسال المسودة للمقيّم" })).toHaveCount(0);

    // Below it, the valuation report exactly as the appraiser sees it (read-only).
    await expect(page.getByText("تقرير تقييم عقار").first()).toBeVisible({ timeout: 90_000 });
  });
});
