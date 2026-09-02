import { test, expect } from "@playwright/test";
import { loginViaUi } from "../../fixtures/auth";

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
    await page.locator("#mobile").fill("s.salhy@gmail.com");
    await page.locator("form").evaluate((form) => {
      (form as HTMLFormElement).requestSubmit();
    });
    await expect(page.getByRole("heading", { name: "أدخل رمز التحقق" })).toBeVisible({
      timeout: 15_000,
    });
    const otpBoxes = page.locator('[aria-label^="رقم التحقق"]');
    for (let i = 0; i < 6; i++) {
      await otpBoxes.nth(i).fill(String(i + 1));
    }
    await expect(
      page.getByRole("alert").filter({ hasText: /تعذر الاتصال|انتهت مهلة/ }),
    ).toBeVisible({ timeout: 15_000 });
  });
});
