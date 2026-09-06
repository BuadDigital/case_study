/**
 * Case specialist (osama) — PO intake → primary-data queue → party distribution.
 *
 * UI-driven:  the PO intake modal (open, fill, save, land on the property page),
 *             the server-paged "البيانات الأولية" queue (pager + search by PO),
 *             and the "حالة الأطراف" panel on the property detail page.
 * API-driven: adding the property to the PO and walking the parent task
 *             enfath → bourse → distribution. The intake modal itself always
 *             posts `properties: []` (see usePoIntakeForm.ts) — properties are
 *             registered on separate screens that are not part of this journey,
 *             and confirm-distribution has no single-screen UI equivalent.
 */
import { test, expect } from "@playwright/test";
import { loginAs, RELEASE_USERS, waitForPageTitle } from "../../fixtures/auth";
import {
  ASSIGNEE_NAMES,
  addProperty,
  apiLogin,
  clearPoIntakeDraft,
  deleteWorkOrder,
  distributeParties,
  listTasksForPo,
  today,
  uniqueDeedNumber,
  uniquePoNumber,
} from "../../fixtures/transaction";

test.describe("Specialist: intake → distribution", () => {
  const poNumber = uniquePoNumber();
  const deedNumber = uniqueDeedNumber();
  let token = "";

  test.beforeAll(async () => {
    token = await apiLogin(RELEASE_USERS.caseSpecialist);
    // The intake modal autosaves a per-user draft and only clears it on a
    // successful save, so an aborted run would pre-fill this one.
    await clearPoIntakeDraft(token);
  });

  test.afterAll(async () => {
    if (token) await deleteWorkOrder(token, poNumber);
  });

  test("creates a PO, finds it in the paged queue, and distributes it", async ({
    page,
  }) => {
    test.slow();
    await loginAs(page, RELEASE_USERS.caseSpecialist);

    // ── 1. intake modal (UI) ────────────────────────────────────────────────
    await page.getByRole("button", { name: "أمر عمل جديد" }).click();
    const intake = page.getByRole("dialog", { name: "تسجيل أمر عمل (PO) جديد" });
    await expect(intake).toBeVisible();

    await intake.locator("#po_number_modal").fill(poNumber);
    await intake.locator("#promulgation_date_modal").fill(today());
    await intake.locator("#assignment_primary").selectOption("تنفيذ");
    await expect(intake.locator("#expected_property_count_modal")).toHaveValue("1");

    await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes("/api/work-orders") &&
          res.request().method() === "POST",
      ),
      intake.getByRole("button", { name: "حفظ أمر العمل" }).click(),
    ]);

    // Success navigates to the PO's property list; there is no success toast.
    await expect(page).toHaveURL(
      new RegExp(`/po/${encodeURIComponent(poNumber)}/property$`),
    );

    // ── 2. the server-paged primary-data queue (UI) ─────────────────────────
    await page.goto("/active-primary-data", { waitUntil: "commit" });
    await waitForPageTitle(page, "البيانات الأولية");

    // QueuePager renders only when totalCount > 0 — assert the real thing.
    const rangeLabel = page.getByText(/عرض\s.+\sمن\s.+\sنتيجة/).first();
    await expect(rangeLabel).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByRole("button", { name: "الصفحة التالية" }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "الصفحة السابقة" }).first(),
    ).toBeVisible();

    // Searching by PO number is a server round-trip (`q`), not a client filter.
    const search = page.getByRole("searchbox", { name: "بحث المعاملات" });
    await search.fill(poNumber);
    const poLink = page.locator(
      `a[href="/po/${encodeURIComponent(poNumber)}/property"]`,
    );
    await expect(poLink).toHaveCount(1, { timeout: 30_000 });
    await expect(rangeLabel).toContainText("1");

    // ── 3. register the property and distribute the parties (API) ───────────
    const propertyId = await addProperty(token, poNumber, deedNumber);
    const parties = await distributeParties(
      token,
      poNumber,
      propertyId,
      deedNumber,
    );
    expect(parties.fieldInspection.assigneeId).toBe("fi-ahmed");
    expect(parties.engineeringSurvey.assigneeId).toBe("eo-jeddah");
    expect(parties.propertyAppraisal.assigneeId).toBe("val-abdullah");

    const tasks = await listTasksForPo(token, poNumber);
    expect(tasks.filter((t) => t.kind !== "case-study-property")).toHaveLength(3);

    // ── 4. the three children are visible to the specialist (UI) ────────────
    await page.goto(
      `/po/${encodeURIComponent(poNumber)}/property/${propertyId}`,
      { waitUntil: "commit" },
    );
    const rail = page.locator('aside[aria-label="الجدول الزمني للمعاملة"]');
    await expect(rail).toBeVisible({ timeout: 60_000 });
    await expect(rail.getByText("حالة الأطراف")).toBeVisible();
    await expect(rail.locator('[title="المعاين"]')).toHaveText(
      ASSIGNEE_NAMES.fieldInspector,
    );
    await expect(rail.locator('[title="المكتب الهندسي"]')).toHaveText(
      ASSIGNEE_NAMES.engineeringOffice,
    );
    await expect(rail.locator('[title="المقيّم"]')).toHaveText(
      ASSIGNEE_NAMES.appraiser,
    );

    // The timeline records the distribution itself.
    await expect(rail.getByText("توزيع المعاملة")).toBeVisible();
  });
});
