import { test, expect } from "@playwright/test";
import {
  loginAs,
  MODULE_PAGES,
  RELEASE_USERS,
  pagePath,
  waitForPageTitle,
} from "../../fixtures/auth";

test.describe("PO workflow", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, RELEASE_USERS.caseSpecialist);
  });

  test("lists work orders and opens intake modal", async ({ page }) => {
    await page.goto("/po", { waitUntil: "commit" });
    await waitForPageTitle(page, "أوامر العمل");
    await page.goto("/po/intake", { waitUntil: "commit" });
    await expect(page).toHaveURL(/\/po\?intake=1/);
  });
});

test.describe("Failures module", () => {
  test("supervisor can open failures catalog", async ({ page }) => {
    await loginAs(page, RELEASE_USERS.caseSpecialist);
    await page.goto("/failures", { waitUntil: "commit" });
    await waitForPageTitle(page, "إدارة التعذرات");
    await page.goto("/failure-types", { waitUntil: "commit" });
    await waitForPageTitle(page, "أنواع التعذرات");
  });
});

test.describe("Government reviewer ops hub", () => {
  test("reviewer reaches operations tasks and keys", async ({ page }) => {
    await loginAs(page, RELEASE_USERS.governmentReviewer);
    for (const pageId of ["operations-tasks", "keys"] as const) {
      const meta = MODULE_PAGES.find((p) => p.id === pageId)!;
      await page.goto(pagePath(pageId), { waitUntil: "commit" });
      await waitForPageTitle(page, meta.title);
    }
  });
});

test.describe("Survey and engineering office", () => {
  test("engineering office reaches active survey", async ({ page }) => {
    await loginAs(page, RELEASE_USERS.engineeringOffice);
    await page.goto("/active-survey", { waitUntil: "commit" });
    await waitForPageTitle(page, "الرفع المساحي");
  });
});

test.describe("Valuation and appraisal queues", () => {
  test("coordinator and appraiser reach their queues", async ({ page }) => {
    await loginAs(page, RELEASE_USERS.valuationCoordinator);
    await page.goto("/valuation-coordination", { waitUntil: "commit" });
    await waitForPageTitle(page, "استلام التقييم");

    await loginAs(page, RELEASE_USERS.appraiser);
    await page.goto("/property-appraisal", { waitUntil: "commit" });
    await waitForPageTitle(page, "تقييم العقار");
  });
});

test.describe("Financial officer", () => {
  test("financial reports page loads", async ({ page }) => {
    await loginAs(page, RELEASE_USERS.financialOfficer);
    await page.goto("/financial", { waitUntil: "commit" });
    await waitForPageTitle(page, "التقارير المالية");
  });
});

test.describe("Settings catalog", () => {
  test("CDO opens system field and screen catalogs", async ({ page }) => {
    await loginAs(page, RELEASE_USERS.cdo);
    await page.goto("/system-fields-catalog", { waitUntil: "commit" });
    await waitForPageTitle(page, "قاموس الحقول المركزي");
    await page.goto("/system-screen-catalog", { waitUntil: "commit" });
    await waitForPageTitle(page, "دليل الشاشات");
  });
});

test.describe("API field inspection reporting", () => {
  test("summary endpoint returns counts", async ({ request }) => {
    const login = await request.post(
      "http://127.0.0.1:5160/api/auth/login-username",
      { data: { username: RELEASE_USERS.cdo } },
    );
    expect(login.ok()).toBeTruthy();
    const { token } = await login.json();
    const res = await request.get(
      "http://127.0.0.1:5160/api/field-inspection-workspaces/summary",
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(typeof body.total).toBe("number");
    expect(typeof body.submitted).toBe("number");
  });

  test("reporting dashboard includes field inspection progress", async ({
    request,
  }) => {
    const login = await request.post(
      "http://127.0.0.1:5160/api/auth/login-username",
      { data: { username: RELEASE_USERS.cdo } },
    );
    const { token } = await login.json();
    const res = await request.get(
      "http://127.0.0.1:5160/api/reporting/v1/dashboard",
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.fieldInspectionProgress).toBeTruthy();
  });
});
