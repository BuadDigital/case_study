import { expect, type Page } from "@playwright/test";

const AUTH_STORAGE_KEY = "auth";
const API_HOST = process.env.API_HOST ?? "127.0.0.1";

/** Prototype users used in role-based module smoke tests. */
export const RELEASE_USERS = {
  cdo: "sliman",
  caseSpecialist: "osama",
  fieldInspector: "ahmed",
  valuationCoordinator: "mohammed",
  appraiser: "abdullah",
  governmentReviewer: "feras",
  engineeringOffice: "jeddah_survey",
  financialOfficer: "eman",
} as const;

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
  const res = await fetch(
    `http://${API_HOST}:5160/api/auth/login-username`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    },
  );
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
  await page.addInitScript(
    ([key, value]) => {
      sessionStorage.setItem(key, value);
    },
    [AUTH_STORAGE_KEY, payload] as const,
  );
}

/** Post-login landing per release test user (matches server page permissions). */
const POST_LOGIN_LANDING: Record<string, { path: string; title: string }> = {
  [RELEASE_USERS.cdo]: { path: "/dashboard", title: "لوحة التحكم" },
  [RELEASE_USERS.caseSpecialist]: { path: "/po", title: "أوامر العمل" },
  [RELEASE_USERS.fieldInspector]: {
    path: "/property-inspection",
    title: "معاينة العقار",
  },
  [RELEASE_USERS.valuationCoordinator]: {
    path: "/valuation-coordination",
    title: "استلام التقييم",
  },
  [RELEASE_USERS.appraiser]: { path: "/po", title: "أوامر العمل" },
  [RELEASE_USERS.governmentReviewer]: {
    path: "/government-review",
    title: "المراجعة الحكومية",
  },
  [RELEASE_USERS.engineeringOffice]: {
    path: "/active-survey",
    title: "الرفع المساحي",
  },
  [RELEASE_USERS.financialOfficer]: {
    path: "/financial",
    title: "التقارير المالية",
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
  await expect(page.getByRole("button", { name: "دخول" })).toBeVisible();
  await page.locator("#username").selectOption(username);
  await expect(page.locator("#username")).toHaveValue(username);

  const [response] = await Promise.all([
    page.waitForResponse(
      (res) =>
        res.url().includes("/api/auth/login-username") &&
        res.request().method() === "POST",
      { timeout: 60_000 },
    ),
    page.locator("form").evaluate((form) => {
      (form as HTMLFormElement).requestSubmit();
    }),
  ]);

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
  { id: "po", title: "أوامر العمل" },
  { id: "bourse-inquiry", title: "استعلام بورصة" },
  { id: "keys", title: "إدارة المفاتيح" },
  { id: "failures", title: "إدارة التعذرات" },
  { id: "suspended-transactions", title: "المعاملات المعلقة" },
  { id: "valuation-requests", title: "طلبات التقييم" },
  { id: "property-inspection", title: "معاينة العقار" },
  { id: "government-review", title: "المراجعة الحكومية" },
  { id: "valuation-coordination", title: "استلام التقييم" },
  { id: "property-appraisal", title: "تقييم العقار" },
  { id: "active-survey", title: "الرفع المساحي" },
  { id: "system-fields-catalog", title: "قاموس الحقول المركزي" },
  { id: "system-screen-catalog", title: "دليل الشاشات" },
  { id: "financial", title: "التقارير المالية" },
  { id: "kpi", title: "مؤشرات الأداء" },
  { id: "users", title: "إدارة المستخدمين" },
  { id: "fee-pricing", title: "التسعيرة" },
  { id: "courts", title: "المحاكم و الدوائر" },
  { id: "failure-types", title: "أنواع التعذرات" },
  { id: "case-study-info-roles", title: "علاقة المستخدم بالمعلومة" },
];

/** Role → pages each persona should reach without server errors. */
export const ROLE_MODULE_PAGES: Record<string, string[]> = {
  [RELEASE_USERS.cdo]: MODULE_PAGES.map((p) => p.id),
  [RELEASE_USERS.caseSpecialist]: [
    "po",
    "active-primary-data",
    "bourse-inquiry",
    "active-distribution",
    "active-case-study",
    "failures",
    "suspended-transactions",
    "system-screen-catalog",
  ],
  [RELEASE_USERS.fieldInspector]: [
    "property-inspection",
    "system-screen-catalog",
  ],
  [RELEASE_USERS.valuationCoordinator]: [
    "valuation-coordination",
    "system-screen-catalog",
  ],
  [RELEASE_USERS.appraiser]: [
    "po",
    "property-appraisal",
    "suspended-transactions",
    "system-screen-catalog",
  ],
  [RELEASE_USERS.governmentReviewer]: [
    "government-review",
    "keys",
    "system-screen-catalog",
  ],
  [RELEASE_USERS.engineeringOffice]: [
    "active-survey",
    "system-screen-catalog",
  ],
  [RELEASE_USERS.financialOfficer]: [
    "financial",
    "system-screen-catalog",
  ],
};
