/**
 * Field inspector (ahmed) fills and submits the inspection, then the case
 * specialist (osama) accepts the package.
 *
 * UI-driven:  the /active-inspection queue (search + open the task), the whole
 *             three-step inspector wizard — step 1 «الموقع والتصوير» (GPS pin,
 *             «خصائص العقار», access-contact block), step 2 «بيانات العقار»
 *             (description, component pills with a proof photo uploaded through
 *             the real file input, the deed-boundaries verdict), step 3 the
 *             confirmation checkbox and «حفظ وإرسال»; and the specialist's
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
  completeSpecialistComponents,
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
  // Once the upload round-trips the picker becomes a thumbnail with «استبدال».
  await expect(cell.getByRole("button", { name: "استبدال" })).toBeVisible({
    timeout: 30_000,
  });
}

/**
 * The yes/no component pills (step 2 «مكوّنات العقار», and «يوجد منقولات» in
 * step 1) cycle "" → نعم → لا. Each is answered explicitly with «لا».
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

    // The row opens through a transition; on the dev server the first visit to
    // the work route also compiles it, which is far longer than the default 5 s.
    await expect(page).toHaveURL(
      new RegExp(`/active-inspection/${tx.fieldInspection.id}$`),
      { timeout: 60_000 },
    );
    const ws = workspace(page);
    await expect(ws).toBeVisible({ timeout: 60_000 });

    // ── 2. step 1 «الموقع والتصوير» — pin, features, access contact (UI) ──
    const coords = ws.locator('input[placeholder="21.523339, 39.187743"]');
    await expect(coords).toBeVisible({ timeout: 30_000 });
    await coords.fill("24.7136, 46.6753");
    await expect(coords).toHaveValue("24.7136, 46.6753");
    await ws.getByRole("button", { name: "تثبيت الموقع", exact: true }).click();
    const moveDialog = page.getByRole("dialog", { name: "تأكيد تحريك الموقع" });
    if (await moveDialog.isVisible().catch(() => false)) {
      await page.getByRole("button", { name: "تثبيت الموقع الجديد" }).click();
    }
    // Pinning swaps the coordinates input for a read-only value and a status chip.
    await expect(ws.getByRole("status").filter({ hasText: "تم تثبيت الموقع" })).toBeVisible();
    await expect(ws.locator("#ins-map-coords")).toHaveText("24.7136, 46.6753");

    // «خصائص العقار» now lives on step 1: every non-yes/no feature needs a value.
    await ws.locator("#ins-feature-select-assetSubject").selectOption("فيلا");
    await ws.locator("#ins-feature-select-facade").selectOption("شمالية");
    // «استخدام العقار» lists the bourse classifications (أرض / مبنى مفرد / …).
    await ws.locator("#ins-feature-select-propertyUsage").selectOption("مبنى مفرد");
    for (const [key, value] of [
      ["zoneStatus", "غير موقوفة"],
      ["propertyCondition", "مستخدم"],
      ["buildState", "جيد"],
      ["occupancyState", "شاغر"],
      ["districtState", "جديد"],
    ] as const) {
      await ws
        .locator(`#ins-feature-${key}`)
        .getByRole("button", { name: value, exact: true })
        .click();
    }
    await answerComponentPillNo(ws, "يوجد منقولات");

    await ws.locator("#ins-access-name").fill("ضابط اتصال آلي");
    await ws.locator("#ins-access-phone").fill("0555000111");
    await ws.locator("#ins-access-role").selectOption("مالك");

    await ws.getByRole("button", { name: "حفظ ومتابعة" }).click();

    // ── 3. step 2 «بيانات العقار» — description, components, boundaries (UI) ─
    const description = ws.locator("#ins-desc");
    await expect(description).toBeVisible({ timeout: 30_000 });
    await description.fill("فيلا سكنية من دورين وملحق");

    // «مدخل السيارة» answered «نعم» offers a proof photo — upload it through the
    // real file input; the remaining component pills are answered «لا».
    const carEntrance = ws.getByRole("button", { name: "مدخل السيارة", exact: true });
    await carEntrance.click();
    await expect(carEntrance).toHaveClass(/bg-ink/);
    await attachFeaturePhoto(ws, "carEntrance");
    for (const label of ["يوجد قبو", "يوجد مصعد", "يوجد مسبح", "مطبخ"]) {
      await answerComponentPillNo(ws, label);
    }

    // «هل حدود الصك مطابقة للطبيعة؟» — the inspector's explicit verdict.
    const verdict = ws.getByRole("radiogroup", { name: "مطابقة حدود الصك للطبيعة" });
    await verdict.getByRole("radio", { name: "مطابق", exact: true }).click();
    await expect(
      verdict.getByRole("radio", { name: "مطابق", exact: true }),
    ).toHaveAttribute("aria-checked", "true");

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
    await completeSpecialistComponents(osamaToken, tx.poNumber, tx.propertyId);
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
    await expect(rail.getByText("قبول الأخصائي لمخرجات المعاينة")).toBeVisible();
  });
});
