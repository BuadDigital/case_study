import { test, expect } from "@playwright/test";
import {
  loginAs,
  MODULE_PAGES,
  ROLE_MODULE_PAGES,
  pagePath,
  waitForPageTitle,
} from "../../fixtures/auth";

test.describe("CDO module smoke (all routes)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "sliman");
  });

  for (const mod of MODULE_PAGES) {
    test(`loads ${mod.id}`, async ({ page }) => {
      await page.goto(pagePath(mod.id), { waitUntil: "commit" });
      await waitForPageTitle(page, mod.title);
      const alert = page.getByRole("alert");
      if (await alert.count()) {
        const text = await alert.first().textContent();
        expect(text).not.toMatch(/تعذر|خطأ|فشل|error/i);
      }
    });
  }
});

test.describe("role-based module smoke", () => {
  for (const [username, pages] of Object.entries(ROLE_MODULE_PAGES)) {
    if (username === "sliman") continue;

    test(`user ${username} reaches assigned modules`, async ({ page }) => {
      await loginAs(page, username);
      for (const pageId of pages) {
        const meta = MODULE_PAGES.find((p) => p.id === pageId);
        if (!meta) continue;
        await page.goto(pagePath(pageId), { waitUntil: "commit" });
        await waitForPageTitle(page, meta.title);
      }
    });
  }
});

test.describe("PO intake journey", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "osama");
  });

  test("PO list and intake modal open", async ({ page }) => {
    await page.goto("/po", { waitUntil: "commit" });
    await waitForPageTitle(page, "أوامر العمل");
    await page.goto("/po/intake");
    await expect(page).toHaveURL(/\/po\?intake=1/);
  });
});
