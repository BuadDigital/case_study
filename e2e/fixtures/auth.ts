import { expect, type Page } from "@playwright/test";

const AUTH_STORAGE_KEY = "auth";
/** Server-side auth gate cookie — mirrors packages/auth-client/src/session.ts. */
const AUTH_COOKIE_NAME = "ree-auth";
const API_HOST = process.env.API_HOST ?? "127.0.0.1";
const SHELL_BASE = process.env.SHELL_BASE_URL ?? "http://127.0.0.1:3000";
export const API_BASE = `http://${API_HOST}:5160`;

/** Prototype users used in role-based module smoke tests. */
export const RELEASE_USERS = {
  cdo: "sliman",
  caseSpecialist: "osama",
  fieldInspector: "ahmed",
  appraiser: "abdullah",
  governmentReviewer: "feras",
  engineeringOffice: "jeddah_survey",
  financialOfficer: "eman",
} as const;

export const RELEASE_USER_EMAILS: Record<string, string> = {
  [RELEASE_USERS.cdo]: "s.salhy@gmail.com",
  [RELEASE_USERS.caseSpecialist]: "osama@ejadah.dev",
  [RELEASE_USERS.fieldInspector]: "ahmed@ejadah.dev",
  [RELEASE_USERS.appraiser]: "abdullah.kathiri@ejadah.dev",
  [RELEASE_USERS.governmentReviewer]: "feras@ejadah.dev",
  [RELEASE_USERS.engineeringOffice]: "survey.jeddah@ejadah.dev",
  [RELEASE_USERS.financialOfficer]: "eman@ejadah.dev",
};

/** Seeded Saudi mobiles (9 digits after +966) — matches DataSeeder DemoMobileByLogin. */
export const RELEASE_USER_PHONES: Record<string, string> = {
  [RELEASE_USERS.cdo]: "500000001",
  [RELEASE_USERS.caseSpecialist]: "500000004",
  [RELEASE_USERS.fieldInspector]: "500000008",
  [RELEASE_USERS.appraiser]: "500000007",
  [RELEASE_USERS.governmentReviewer]: "500000005",
  [RELEASE_USERS.engineeringOffice]: "500000011",
  [RELEASE_USERS.financialOfficer]: "500000010",
};

type LoginResponse = {
  token: string;
  expiresAtUtc: string;
  user: { id: string; email: string; displayName: string };
};

function normalizeLoginResponse(raw: Record<string, unknown>): LoginResponse {
  const userRaw = (raw.user ?? raw.User) as Record<string, unknown> | undefined;
  return {
    token: String(raw.token ?? raw.Token ?? ""),
    expiresAtUtc: String(raw.expiresAtUtc ?? raw.ExpiresAtUtc ?? ""),
    user: {
      id: String(userRaw?.id ?? userRaw?.Id ?? ""),
      email: String(userRaw?.email ?? userRaw?.Email ?? ""),
      displayName: String(userRaw?.displayName ?? userRaw?.DisplayName ?? ""),
    },
  };
}

async function fetchLoginSession(username: string): Promise<LoginResponse> {
  const phone = RELEASE_USER_PHONES[username];
  if (!phone) throw new Error(`No demo phone mapped for "${username}"`);
  // `/api/auth/login` is the passwordless target shape; a gateway still running
  // the password build rejects it, so fall back to `/api/auth/login-username`,
  // which has always been passwordless. Works on either build.
  let res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: phone }),
  });
  if (!res.ok) {
    res = await fetch(`${API_BASE}/api/auth/login-username`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: phone }),
    });
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `API login failed for "${username}" (HTTP ${res.status}): ${body}`,
    );
  }
  const raw = (await res.json()) as Record<string, unknown>;
  const session = normalizeLoginResponse(raw);
  if (!session.token) {
    throw new Error(`API login for "${username}" returned no token`);
  }
  return session;
}

async function seedBrowserSession(
  page: Page,
  session: LoginResponse,
): Promise<void> {
  const payload = JSON.stringify(session);
  // getAuthSession() reads localStorage FIRST and only falls back to
  // sessionStorage, so a journey that switches persona mid-test must overwrite
  // both — otherwise the previous persona's localStorage session wins.
  await page.addInitScript(
    ([key, value]) => {
      localStorage.setItem(key, value);
      sessionStorage.setItem(key, value);
    },
    [AUTH_STORAGE_KEY, payload] as const,
  );
  // apps/shell/src/proxy.ts (Next 16 renamed middleware.ts → proxy.ts) redirects
  // every non-prefetch navigation that carries no `ree-auth` cookie back to
  // /login, which silently turns a deep link into the persona's landing page.
  // sessionStorage alone is not enough — the cookie is what the server gate reads.
  const { hostname } = new URL(SHELL_BASE);
  await page.context().addCookies([
    { name: AUTH_COOKIE_NAME, value: "1", domain: hostname, path: "/" },
  ]);
}

/** Post-login landing per release test user (matches server page permissions). */
const POST_LOGIN_LANDING: Record<string, { path: string; title: string }> = {
  [RELEASE_USERS.cdo]: { path: "/dashboard", title: "لوحة التحكم" },
  [RELEASE_USERS.caseSpecialist]: { path: "/po", title: "أوامر العمل" },
  [RELEASE_USERS.fieldInspector]: {
    path: "/operations-tasks",
    title: "المهام",
  },
  [RELEASE_USERS.appraiser]: {
    path: "/operations-tasks",
    title: "المهام",
  },
  [RELEASE_USERS.governmentReviewer]: {
    path: "/operations-tasks",
    title: "المهام",
  },
  [RELEASE_USERS.engineeringOffice]: {
    path: "/operations-tasks",
    title: "المهام",
  },
  [RELEASE_USERS.financialOfficer]: {
    // The finance workspace overrides the shell title with its current area,
    // and it opens on «مهامي» — PAGE_TITLES.financial is never rendered here.
    path: "/financial",
    title: "مهامي",
  },
};

/** Fast, reliable login for module/journey tests (API + sessionStorage). */
export async function loginAs(page: Page, username: string) {
  const session = await fetchLoginSession(username);
  await seedBrowserSession(page, session);
  const landing = POST_LOGIN_LANDING[username] ?? {
    path: "/po",
    title: "أوامر العمل",
  };
  await page.goto(landing.path, { waitUntil: "commit" });
  await waitForPageTitle(page, landing.title);
}

/** Exercises the real login form — used only by login.spec.ts. */
export async function loginViaUi(page: Page, username: string) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  const phone = RELEASE_USER_PHONES[username];
  if (!phone) throw new Error(`No demo phone mapped for "${username}"`);
  await submitMobileStep(page, phone);

  await expect(page.getByRole("heading", { name: "أدخل رمز التحقق" })).toBeVisible({
    timeout: 15_000,
  });
  const otpBoxes = page.locator('[aria-label^="رقم التحقق"]');
  await expect(otpBoxes).toHaveCount(6);

  const responsePromise = page.waitForResponse(
    (res) =>
      res.url().includes("/api/auth/login") &&
      res.request().method() === "POST",
    { timeout: 60_000 },
  );
  // Pace the digits like a person: each box's onChange derives the code from
  // the previous render, so six back-to-back fills under load can leave the
  // last digit unseen and the auto-confirm never fires.
  for (let i = 0; i < 6; i++) {
    await otpBoxes.nth(i).fill(String(i + 1));
    await page.waitForTimeout(40);
  }
  // Fallback: if auto-confirm did not fire within a few seconds, press the
  // confirm button (a no-op once the request is already in flight).
  const confirmFallback = (async () => {
    try {
      await page.waitForTimeout(5_000);
      const confirm = page.getByRole("button", { name: "تأكيد الدخول" });
      if (await confirm.isEnabled()) await confirm.click({ timeout: 2_000 });
    } catch {
      // Normal: the request was already in flight, or the test/page ended first.
    }
  })();
  const response = await responsePromise;
  void confirmFallback;

  if (!response.ok()) {
    const alertText =
      (await page
        .getByRole("alert")
        .filter({ hasText: /تعذر|خطأ|فشل|error/i })
        .textContent()
        .catch(() => "")) ?? "";
    throw new Error(
      `UI login failed (HTTP ${response.status()}): ${alertText.trim()}`,
    );
  }

  // Completing 6 digits auto-confirms and navigates; keep button as fallback.
  // While auto-confirm is in flight the button is disabled/aria-busy and then
  // detaches on navigation — only click it when it is actually actionable.
  const confirmLogin = page.getByRole("button", { name: "تأكيد الدخول" });
  if (
    (await confirmLogin.isVisible().catch(() => false)) &&
    (await confirmLogin.isEnabled().catch(() => false))
  ) {
    await confirmLogin.click({ timeout: 5_000 }).catch(() => undefined);
  }

  const landing = POST_LOGIN_LANDING[username] ?? {
    path: "/po",
    title: "أوامر العمل",
  };

  await page.waitForFunction(
    (expectedPath) => window.location.pathname.startsWith(expectedPath),
    landing.path,
    { timeout: 60_000 },
  );
  await waitForPageTitle(page, landing.title);
}

/**
 * Fill the mobile number and continue to the OTP step. A fill that lands before
 * React hydrates is discarded on hydration (the «متابعة» button stays disabled),
 * so re-fill until the button reports enabled, then click it.
 */
export async function submitMobileStep(page: Page, phone: string) {
  const mobile = page.locator("#mobile");
  const next = page.getByRole("button", { name: "متابعة" });
  await expect(next).toBeVisible();
  await expect
    .poll(
      async () => {
        // Clear first: React's value tracker treats a re-fill of the same
        // string as "no change" and never fires onChange, so a fill that
        // landed pre-hydration would otherwise stick forever.
        await mobile.fill("");
        await mobile.fill(phone);
        return next.isEnabled();
      },
      { timeout: 15_000, message: "mobile step never became submittable" },
    )
    .toBe(true);
  await next.click();
  await expect(page.getByRole("heading", { name: "أدخل رمز التحقق" })).toBeVisible({
    timeout: 15_000,
  });
}

export function pagePath(pageId: string): string {
  return pageId === "po" ? "/po" : `/${pageId}`;
}

/** Wait for AppShell title — avoids Next dev "navigation never finishes" hangs. */
export async function waitForPageTitle(page: Page, text: string) {
  await page.waitForFunction(
    (expected) => {
      const title = document.querySelector("#page-title");
      if (title?.textContent?.includes(expected)) return true;
      // PO list omits #page-title; the label lives in the breadcrumb only.
      const breadcrumb = document.querySelector('[aria-label="مسار التنقل"]');
      return Boolean(breadcrumb?.textContent?.includes(expected));
    },
    text,
    { timeout: 90_000 },
  );
}

/** Every shell module route — mirrors ALL_PROTOTYPE_PAGES. */
export const MODULE_PAGES: { id: string; title: string }[] = [
  { id: "dashboard", title: "لوحة التحكم" },
  { id: "active-primary-data", title: "البيانات الأولية" },
  { id: "active-distribution", title: "توزيع المعاملات" },
  { id: "active-case-study", title: "دراسة حالة العقارات" },
  { id: "system-upload", title: "الرفع على النظام" },
  { id: "po", title: "أوامر العمل" },
  { id: "property-map", title: "خريطة العقارات" },
  { id: "bourse-inquiry", title: "استعلام بورصة" },
  { id: "keys", title: "محفظة المفاتيح" },
  { id: "failures", title: "إدارة التعذرات" },
  { id: "suspended-transactions", title: "المعاملات المعلقة" },
  { id: "valuation-requests", title: "طلبات التقييم" },
  { id: "property-inspection", title: "معاينة العقار (يتيم)" },
  { id: "active-inspection", title: "معاينة العقار" },
  { id: "operations-tasks", title: "المهام" },
  { id: "property-appraisal", title: "تقييم العقار" },
  { id: "active-survey", title: "الرفع المساحي" },
  { id: "system-fields-catalog", title: "قاموس الحقول المركزي" },
  { id: "system-screen-catalog", title: "دليل الشاشات" },
  { id: "financial", title: "مهامي" },
  { id: "users", title: "المستخدمون" },
  { id: "fee-pricing", title: "التسعيرة" },
  { id: "courts", title: "المحاكم والدوائر" },
  { id: "location-pending", title: "مراجعة المسميات" },
  { id: "failure-types", title: "أنواع التعذرات" },
  { id: "case-study-info-roles", title: "علاقة المستخدم بالمعلومة" },
];

/** Role → pages each persona should reach without server errors. */
export const ROLE_MODULE_PAGES: Record<string, string[]> = {
  [RELEASE_USERS.cdo]: MODULE_PAGES.map((p) => p.id),
  [RELEASE_USERS.caseSpecialist]: [
    "po",
    "property-map",
    "active-primary-data",
    "bourse-inquiry",
    "active-distribution",
    "active-case-study",
    "system-upload",
    "keys",
    "field-sync-board",
    "failures",
    "suspended-transactions",
    "failure-types",
    "party-fees",
    "fee-pricing",
  ],
  [RELEASE_USERS.fieldInspector]: [
    "favorites",
    "operations-tasks",
    "active-inspection",
    "party-fees",
    "failures",
  ],
  [RELEASE_USERS.appraiser]: [
    "po",
    "property-map",
    "property-appraisal",
    "suspended-transactions",
  ],
  [RELEASE_USERS.governmentReviewer]: [
    "operations-tasks",
    "keys",
    "po",
    "favorites",
    "party-fees",
    "failures",
  ],
  [RELEASE_USERS.engineeringOffice]: [
    "operations-tasks",
    "active-survey",
  ],
  [RELEASE_USERS.financialOfficer]: ["financial"],
};