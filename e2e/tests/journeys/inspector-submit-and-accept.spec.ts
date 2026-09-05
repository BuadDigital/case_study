/**
 * Field inspector (ahmed) fills and submits the inspection, then the case
 * specialist (osama) accepts the package.
 *
 * UI-driven:  the /active-inspection queue (search + open the task), the whole
 *             three-step inspector wizard — GPS, access-contact block, feature
 *             values, the two proof photos that the validator demands
 *             (الواجهة / حالة البناء) uploaded through the real file inputs —
 *             the confirmation checkbox and «حفظ وإرسال»; and the specialist's
 *             property-detail timeline.
 * API-driven: (a) building the distributed transaction under test, and
 *             (b) the specialist's ACCEPT. There is no accept control on the
 *             «معاينة العقار» tab — PropertyDetailPartyPackageReview is mounted
 *             only on the survey and appraisal tabs — so acceptance goes through
 *             POST /api/party-task-submissions/{taskId}/accept, and the
 *             assertion is the timeline entry it writes.
 */
import { test, expect, type Locator, type Page } from "@playwright/test";
import { loginAs, RELEASE_USERS } from "../../fixtures/auth";
import {
  api,
  apiLogin,
  apiOk,
  createDistributedTransaction,
  deleteWorkOrder,
  tinyPngBuffer,
  type Transaction,
} from "../../fixtures/transaction";

const WORKSPACE = "#view-active-inspection-workspace";

/** Both the desktop wizard and the mobile shell mount at once — scope to one. */
function workspace(page: Page): Locator {
  return page.locator(WORKSPACE);
}

async function attachFeaturePhoto(ws: Locator, key: string) {
  const cell = ws.locator(`#ins-feature-photo-${key}`);
  await expect(cell).toBeVisible();
  await expect(cell.getByText("إرفاق صورة")).toBeVisible();
  await cell.locator('input[type="file"]').setInputFiles({
    name: `${key}.png`,
    mimeType: "image/png",
    buffer: tinyPngBuffer(),
  });
  // The cell flips to a ✓ + "مرفقة" only after the upload round-trips.
  await expect(cell.getByText("مرفقة")).toBeVisible({ timeout: 30_000 });
}

/**
 * carEntrance / hasBasement / hasElevator / hasPool / kitchen are rendered in
 * «مكوّنات العقار» as toggle pills that cycle "" → نعم → لا, and the validator
 * demands a value for each. Answering نعم would demand a proof photo that the
 * desktop wizard renders no control for, so every one of them is set to لا.
 */
async function answerComponentPillNo(ws: Locator, label: string) {
  const pill = ws.getByRole("button", { name: label, exact: true });
  await expect(pill).toBeVisible();
  await pill.click();
  await expect(pill).toHaveClass(/bg-ink/);
  await pill.click();
  await expect(pill).not.toHaveClass(/bg-ink/);
}

test.describe("Field inspector: submit → specialist accept", () => {
  let osamaToken = "";
  let ahmedToken = "";
  let tx: Transaction;

  test.beforeAll(async () => {
    osamaToken = await apiLogin(RELEASE_USERS.caseSpecialist);
    ahmedToken = await apiLogin(RELEASE_USERS.fieldInspector);
    tx = await createDistributedTransaction(osamaToken);
  });

  test.afterAll(async () => {
    if (osamaToken && tx) await deleteWorkOrder(osamaToken, tx.poNumber);
  });

  test("inspector completes the wizard and the specialist accepts", async ({
    page,
  }) => {
    test.slow();
    await loginAs(page, RELEASE_USERS.fieldInspector);

    // ── 1. the inspection queue (UI) ────────────────────────────────────────
    await page.goto("/active-inspection", { waitUntil: "commit" });
    const search = page.getByRole("searchbox", { name: "بحث المعاملات" });
    await expect(search).toBeVisible({ timeout: 60_000 });
    await search.fill(tx.poNumber);

    const poHref = `/po/${encodeURIComponent(tx.poNumber)}/property`;
    const row = page.locator(`tbody tr:has(a[href="${poHref}"])`);
    await expect(row).toHaveCount(1, { timeout: 30_000 });
    // The PO cell is a link that stops propagation — click the assignment-type
    // cell instead so the row handler runs.
    await row.getByText("تنفيذ", { exact: true }).first().click();

    await expect(page).toHaveURL(
      new RegExp(`/active-inspection/${tx.fieldInspection.id}$`),
    );
    const ws = workspace(page);
    await expect(ws).toBeVisible({ timeout: 60_000 });

    // ── 2. step 1 — location and access contact (UI) ────────────────────────
    const coords = ws.locator('input[placeholder="21.523339, 39.187743"]');
    await expect(coords).toBeVisible({ timeout: 30_000 });
    await coords.fill("24.7136, 46.6753");
    await ws.getByRole("button", { name: "تثبيت الموقع", exact: true }).click();
    const moveDialog = page.getByRole("dialog", { name: "تأكيد تحريك الموقع" });
    if (await moveDialog.isVisible().catch(() => false)) {
      await page.getByRole("button", { name: "تثبيت الموقع الجديد" }).click();
    }
    await expect(coords).toHaveValue("24.7136, 46.6753");

    await ws.locator("#ins-access-name").fill("ضابط اتصال آلي");
    await ws.locator("#ins-access-phone").fill("0555000111");
    await ws.locator("#ins-access-role").selectOption("مالك");

    await ws.getByRole("button", { name: "حفظ ومتابعة" }).click();

    // ── 3. step 2 — property features + the two required proof photos (UI) ──
    await expect(ws.locator("#ins-feature-select-assetSubject")).toBeVisible({
      timeout: 30_000,
    });
    await ws.locator("#ins-feature-select-assetSubject").selectOption("فيلا");
    await ws.locator("#ins-feature-select-propertyUsage").selectOption("سكني");

    // الواجهة and حالة البناء are `photoOnYes` closed lists: choosing any value
    // makes a proof photo mandatory, and only then does the cell appear.
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

    // Every yes/no feature has to carry a value, and "نعم" would demand a proof
    // photo the desktop wizard offers no control for — answer them all "لا".
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

    await ws.getByRole("button", { name: "حفظ ومتابعة" }).click();

    // ── 4. step 3 — declaration + submit (UI) ───────────────────────────────
    const submit = ws.getByRole("button", { name: "حفظ وإرسال", exact: true });
    await expect(submit).toBeVisible({ timeout: 30_000 });
    await ws
      .locator("label")
      .filter({ hasText: "أقر بأن بيانات المعاينة صحيحة ومطابقة للواقع الميداني" })
      .locator('input[type="checkbox"]')
      .check();
    await expect(submit).toBeEnabled();

    const submitted = page
      .waitForResponse(
        (res) =>
          /\/api\/party-task-submissions\/[^/]+\/submit$/.test(res.url()) &&
          res.request().method() === "POST",
        { timeout: 60_000 },
      )
      .catch(() => null);
    await submit.click();
    const submitResponse = await submitted;
    if (!submitResponse) {
      // Client validation swallowed the click — surface what it complained about
      // instead of a bare timeout.
      const complaints = (await page.getByRole("alert").allInnerTexts())
        .join(" | ")
        .replace(/\s+/g, " ")
        .trim();
      throw new Error(
        `«حفظ وإرسال» never reached the API. Workspace validation said: ${complaints || "(nothing)"}`,
      );
    }
    expect(
      submitResponse.status(),
      `submit rejected: ${await submitResponse.text()}`,
    ).toBe(200);

    // ── 5. specialist accepts and sees the timeline entry ───────────────────
    const accept = await api(
      osamaToken,
      "POST",
      `/api/party-task-submissions/${tx.fieldInspection.id}/accept`,
    );
    expect(accept.ok, `accept failed: ${JSON.stringify(accept.json)}`).toBe(true);

    const submission = await apiOk<{ status: string; acceptedAtUtc: string | null }>(
      osamaToken,
      "GET",
      `/api/party-task-submissions/${tx.fieldInspection.id}`,
    );
    expect(submission.status).toBe("submitted");
    expect(submission.acceptedAtUtc).not.toBeNull();

    await loginAs(page, RELEASE_USERS.caseSpecialist);
    await page.goto(
      `/po/${encodeURIComponent(tx.poNumber)}/property/${tx.propertyId}?tab=inspection`,
      { waitUntil: "commit" },
    );
    const rail = page.locator('aside[aria-label="الجدول الزمني للمعاملة"]');
    await expect(rail).toBeVisible({ timeout: 60_000 });
    await expect(rail.getByText("إتمام المعاينة الميدانية")).toBeVisible({
      timeout: 30_000,
    });
    await expect(rail.getByText("استلام بيانات المعاينة")).toBeVisible();
  });
});
