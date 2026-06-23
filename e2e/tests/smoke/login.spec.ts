import { test, expect } from "@playwright/test";
import { loginAs, loginViaUi } from "../../fixtures/auth";

test.describe("login journey", () => {
  test("prototype user can sign in and reach dashboard", async ({ page }) => {
    await loginViaUi(page, "sliman");
    await expect(page.locator("#page-title")).toContainText("لوحة التحكم", {
      timeout: 20_000,
    });
  });

  test("login page shows error when API is unreachable", async ({ page }) => {
    await page.route("**/api/auth/login-username", (route) => route.abort());
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await page.locator("#username").selectOption("sliman");
    await page.locator("form").evaluate((form) => {
      (form as HTMLFormElement).requestSubmit();
    });
    await expect(
      page.getByRole("alert").filter({ hasText: /تعذر الاتصال|انتهت مهلة/ }),
    ).toBeVisible({ timeout: 15_000 });
  });
});
