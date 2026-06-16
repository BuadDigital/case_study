import type { PageId } from "@platform/types";
import { CASE_STUDY_READY_NAV } from "@platform/types";
import {
  ACTIVE_TRANSACTIONS_GROUP,
  ACTIVE_TRANSACTIONS_NAV,
} from "../active-transactions";
import { NAV, PAGE_BREADCRUMB } from "../constants";
import { PARTY_TASK_PAGES } from "../party-task-pages";
import { SETTINGS_GROUP, SETTINGS_NAV } from "../settings-nav";
import { SYSTEM_FIELDS_CATALOG_NAV_ITEM } from "../system-fields-catalog-nav";
import { SYSTEM_SCREEN_CATALOG_NAV_ITEM } from "../system-screen-catalog-nav";
import { SYSTEM_FIELDS_GROUP, SYSTEM_FIELDS_NAV } from "../system-fields-nav";
import { screenCatalogPageName } from "./display-names";
import { rolesWithPageAccess } from "./roles";
import type { ScreenCatalogStatus, SystemScreenEntry } from "./types";

type NavLike = {
  id: PageId;
  label: string;
  grp?: string | null;
  placeholder?: boolean;
};

function pageEntry(
  item: NavLike,
  group: string,
  overrides?: Partial<SystemScreenEntry>,
): SystemScreenEntry {
  const pageId = item.id;
  const status: ScreenCatalogStatus =
    overrides?.status ?? (item.placeholder ? "قيد التطوير" : "جاهزة");
  return {
    id: `page:${pageId}`,
    name: screenCatalogPageName(pageId, item.label),
    path: `/${pageId}`,
    group,
    kind: "page",
    pageId,
    status,
    roles: rolesWithPageAccess(pageId),
    breadcrumb: PAGE_BREADCRUMB[pageId],
    ...overrides,
  };
}

function subRouteEntry(input: {
  id: string;
  name: string;
  path: string;
  whereToFind: string;
  pageId: PageId;
  group: string;
  status?: ScreenCatalogStatus;
  notes?: string;
}): SystemScreenEntry {
  return {
    id: `route:${input.id}`,
    name: input.name,
    path: input.path,
    whereToFind: input.whereToFind,
    group: input.group,
    kind: "sub-route",
    pageId: input.pageId,
    status: input.status ?? "جاهزة",
    roles: rolesWithPageAccess(input.pageId),
    breadcrumb: PAGE_BREADCRUMB[input.pageId],
    notes: input.notes,
  };
}

function taskWorkEntry(input: {
  id: string;
  name: string;
  path: string;
  whereToFind: string;
  pageId: PageId;
  notes?: string;
}): SystemScreenEntry {
  const def = PARTY_TASK_PAGES[input.pageId];
  return {
    id: `task:${input.id}`,
    name: input.name,
    path: input.path,
    whereToFind: input.whereToFind,
    group: "شاشات إنجاز المهام",
    kind: "task-work",
    pageId: input.pageId,
    status: "جاهزة",
    roles: rolesWithPageAccess(input.pageId),
    breadcrumb: def?.breadcrumbTitle ?? PAGE_BREADCRUMB[input.pageId],
    notes: input.notes ?? def?.workIntro,
  };
}

function buildMainPages(): SystemScreenEntry[] {
  const byPageId = new Map<string, SystemScreenEntry>();

  const add = (entry: SystemScreenEntry) => {
    const key = entry.pageId ?? entry.id;
    if (!byPageId.has(key)) byPageId.set(key, entry);
  };

  add(
    pageEntry(
      { id: "dashboard", label: "لوحة التحكم", grp: null },
      "الرئيسية",
      {
        whereToFind: "القائمة الجانبية ← لوحة التحكم",
      },
    ),
  );

  NAV.forEach((item) => {
    const whereToFind = item.grp
      ? `القائمة الجانبية ← ${item.grp} ← ${item.label}`
      : `القائمة الجانبية ← ${item.label}`;
    add(
      pageEntry({ ...item, grp: item.grp }, item.grp ?? "عام", {
        whereToFind,
        notes: item.placeholder
          ? "شاشة تجريبية — لم تُربط بعد بسير العمل الفعلي للمعاملات."
          : undefined,
      }),
    );
  });

  CASE_STUDY_READY_NAV.forEach((item) => {
    add(
      pageEntry(item, ACTIVE_TRANSACTIONS_GROUP, {
        whereToFind: `القائمة الجانبية ← المعاملات النشطة ← ${item.label}`,
      }),
    );
  });

  ACTIVE_TRANSACTIONS_NAV.forEach((item) => {
    if (CASE_STUDY_READY_NAV.some((n) => n.id === item.id)) return;
    add(
      pageEntry(
        {
          id: item.id,
          label: item.label,
          placeholder: item.placeholder,
        },
        ACTIVE_TRANSACTIONS_GROUP,
        {
          whereToFind: `القائمة الجانبية ← المعاملات النشطة ← ${item.label}`,
        },
      ),
    );
  });

  SETTINGS_NAV.forEach((item) => {
    add(
      pageEntry(item, SETTINGS_GROUP, {
        whereToFind: `أسفل الشاشة ← الإعدادات ← ${item.label}`,
      }),
    );
  });

  SYSTEM_FIELDS_NAV.forEach((item) => {
    add(
      pageEntry(item, SYSTEM_FIELDS_GROUP, {
        whereToFind: `أسفل الشاشة ← جميع حقول النظام ← ${item.label}`,
        notes: item.placeholder
          ? "مرجع إعدادات — قيد إكمال الربط بالنظام."
          : undefined,
      }),
    );
  });

  add(
    pageEntry(SYSTEM_FIELDS_CATALOG_NAV_ITEM, "أدوات عامة", {
      path: `/${SYSTEM_FIELDS_CATALOG_NAV_ITEM.id}`,
      whereToFind: "القائمة الجانبية ← عام ← قاموس الحقول المركزي",
    }),
  );

  add(
    pageEntry(SYSTEM_SCREEN_CATALOG_NAV_ITEM, "أدوات عامة", {
      path: `/${SYSTEM_SCREEN_CATALOG_NAV_ITEM.id}`,
      whereToFind: "القائمة الجانبية ← عام ← دليل الشاشات",
    }),
  );

  return [...byPageId.values()];
}

function buildPoSubRoutes(): SystemScreenEntry[] {
  const group = "أوامر العمل والعقارات";
  return [
    subRouteEntry({
      id: "po-intake",
      name: "إنشاء أمر عمل جديد",
      path: "/po/intake",
      whereToFind: "أوامر العمل ← زر إنشاء أمر جديد",
      pageId: "po",
      group,
    }),
    subRouteEntry({
      id: "po-edit",
      name: "تعديل بيانات أمر العمل",
      path: "/po/{poNumber}/edit",
      whereToFind: "أوامر العمل ← اختيار أمر ← تعديل الرأس",
      pageId: "po",
      group,
    }),
    subRouteEntry({
      id: "po-properties",
      name: "عقارات أمر العمل",
      path: "/po/{poNumber}/property",
      whereToFind: "أوامر العمل ← اختيار أمر ← قائمة العقارات",
      pageId: "po",
      group,
    }),
    subRouteEntry({
      id: "po-property-new",
      name: "إضافة عقار لأمر العمل",
      path: "/po/{poNumber}/property/new",
      whereToFind: "أوامر العمل ← أمر ← إضافة عقار",
      pageId: "po",
      group,
    }),
    subRouteEntry({
      id: "po-property-detail",
      name: "تفاصيل العقار",
      path: "/po/{poNumber}/property/{propertyId}",
      whereToFind: "أوامر العمل ← أمر ← عقار ← التفاصيل",
      pageId: "po",
      group,
      notes:
        "تبويبات: البيانات، الأطراف، المستندات، دراسة الحالة، رفع النفاذ، وغيرها.",
    }),
    subRouteEntry({
      id: "po-property-edit",
      name: "تعديل بيانات العقار",
      path: "/po/{poNumber}/property/{propertyId}/edit",
      whereToFind: "تفاصيل العقار ← تعديل",
      pageId: "po",
      group,
    }),
    subRouteEntry({
      id: "po-property-failure",
      name: "تسجيل تعذر على العقار",
      path: "/po/{poNumber}/property/{propertyId}/failure",
      whereToFind: "تفاصيل العقار ← رفع تعذر",
      pageId: "failures",
      group,
    }),
    subRouteEntry({
      id: "case-study-workspace",
      name: "نموذج دراسة الحالة (الأخصائي)",
      path: "/case-study/{taskId}",
      whereToFind: "المعاملات النشطة ← دراسة حالة العقارات ← فتح مهمة",
      pageId: "active-case-study",
      group: "المعاملات النشطة",
      notes: "نموذج الأخصائي، الأسئلة، والمصفوفة.",
    }),
  ];
}

function buildTaskWorkRoutes(): SystemScreenEntry[] {
  return [
    taskWorkEntry({
      id: "property-inspection-work",
      name: "إنجاز معاينة العقار",
      path: "/property-inspection/{taskId}",
      whereToFind: "المعاملات النشطة ← معاينة العقار ← اختيار مهمة",
      pageId: "property-inspection",
    }),
    taskWorkEntry({
      id: "government-review-work",
      name: "إنجاز المراجعة الحكومية",
      path: "/government-review/{taskId}",
      whereToFind: "المعاملات النشطة ← المراجعة الحكومية ← اختيار مهمة",
      pageId: "government-review",
    }),
    taskWorkEntry({
      id: "valuation-coordination-work",
      name: "إنجاز استلام التقييم",
      path: "/valuation-coordination/{taskId}",
      whereToFind: "المعاملات النشطة ← استلام التقييم ← اختيار مهمة",
      pageId: "valuation-coordination",
    }),
    taskWorkEntry({
      id: "property-appraisal-work",
      name: "إنجاز تقييم العقار",
      path: "/property-appraisal/{taskId}",
      whereToFind: "المعاملات النشطة ← تقييم العقار ← اختيار مهمة",
      pageId: "property-appraisal",
    }),
    taskWorkEntry({
      id: "active-survey-work",
      name: "إنجاز الرفع المساحي",
      path: "/active-survey/{taskId}",
      whereToFind: "المعاملات النشطة ← الرفع المساحي ← اختيار مهمة",
      pageId: "active-survey",
    }),
  ];
}

function buildAuthScreens(): SystemScreenEntry[] {
  return [
    {
      id: "auth:login",
      name: "تسجيل الدخول",
      path: "/login",
      whereToFind: "أول ما يفتح المستخدم النظام",
      group: "الدخول",
      kind: "auth",
      status: "جاهزة",
      roles: rolesWithPageAccess("dashboard"),
      notes: "متاح لجميع المستخدمين المسجّلين في النظام.",
    },
  ];
}

export function buildSystemScreenCatalog(): SystemScreenEntry[] {
  return [
    ...buildMainPages(),
    ...buildPoSubRoutes(),
    ...buildTaskWorkRoutes(),
    ...buildAuthScreens(),
  ].sort((a, b) => {
    const group = a.group.localeCompare(b.group, "ar");
    if (group !== 0) return group;
    return a.name.localeCompare(b.name, "ar");
  });
}

export const SYSTEM_SCREEN_CATALOG = buildSystemScreenCatalog();

export function systemScreenById(id: string): SystemScreenEntry | undefined {
  return SYSTEM_SCREEN_CATALOG.find((screen) => screen.id === id);
}

export function systemScreensForRole(roleId: string): SystemScreenEntry[] {
  return SYSTEM_SCREEN_CATALOG.filter((screen) =>
    screen.roles.includes(roleId as never),
  );
}

export function screenCatalogGroups(): string[] {
  return [...new Set(SYSTEM_SCREEN_CATALOG.map((screen) => screen.group))].sort(
    (a, b) => a.localeCompare(b, "ar"),
  );
}

export function screenCountByRole(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const screen of SYSTEM_SCREEN_CATALOG) {
    for (const role of screen.roles) {
      counts[role] = (counts[role] ?? 0) + 1;
    }
  }
  return counts;
}
