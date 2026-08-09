import type { NavItem, PageId, RoleDef, RoleId } from "@platform/types";
import { ACTIVE_TRANSACTIONS_NAV } from "./active-transactions";
import { SETTINGS_NAV } from "@platform/app-shared/prototype/settings-nav";
import { SYSTEM_FIELDS_NAV } from "@platform/app-shared/prototype/system-fields-nav";
import { SYSTEM_FIELDS_CATALOG_NAV_ITEM } from "@platform/app-shared/prototype/system-fields-catalog-nav";
import { SYSTEM_SCREEN_CATALOG_NAV_ITEM } from "@platform/app-shared/prototype/system-screen-catalog-nav";
import { ORPHAN_SCREENS_PAGE_IDS } from "@platform/app-shared/prototype/orphan-screens-nav";
import { SYSTEM_SETTINGS_PRIMARY_PAGE_IDS } from "./system-settings-nav";

export type { NavItem, PageId, RoleDef, RoleId };

export const ROLES: Record<RoleId, RoleDef> = {
  cdo: {
    name: "سليمان",
    dept: "المسؤول",
    init: "سل",
    bg: "var(--purple-bg)",
    tc: "var(--purple)",
    pages: ["dashboard"],
  },
  "general-manager": {
    name: "سالم الغريب",
    dept: "مدير إدارة التقييم العقاري",
    init: "سغ",
    bg: "var(--info-bg)",
    tc: "var(--info)",
    pages: [
      "po",
      "favorites",
      "active-primary-data",
      "bourse-inquiry",
      "active-distribution",
      "active-case-study",
      "system-upload",
      "operations-tasks",
      "keys",
      "failures",
      "suspended-transactions",
      "valuation-requests",
      "system-screen-catalog",
      "financial",
      "courts",
      "location-pending",
      "failure-types",
      "case-study-info-roles",
    ],
  },
  "section-supervisor": {
    name: "عبدالرحمن النفيعي",
    dept: "مشرف قسم دراسة الحالة",
    init: "عن",
    bg: "var(--warning-bg)",
    tc: "var(--warning)",
    pages: [
      "po",
      "favorites",
      "active-primary-data",
      "bourse-inquiry",
      "active-distribution",
      "active-case-study",
      "system-upload",
      "operations-tasks",
      "keys",
      "field-sync-board",
      "failures",
      "suspended-transactions",
      "failure-types",
      "party-fees",
      "system-screen-catalog",
    ],
  },
  "case-specialist": {
    name: "أسامة الصالحي",
    dept: "أخصائي دراسة حالة",
    init: "أص",
    bg: "var(--success-bg)",
    tc: "var(--success)",
    pages: [
      "po",
      "favorites",
      "active-primary-data",
      "bourse-inquiry",
      "active-distribution",
      "active-case-study",
      "system-upload",
      "operations-tasks",
      "failures",
      "suspended-transactions",
      "system-screen-catalog",
    ],
  },
  "real-estate-appraiser": {
    name: "عبدالله الكثيري",
    dept: "مقيم عقاري",
    init: "عك",
    bg: "var(--info-bg)",
    tc: "var(--info)",
    pages: [
      "po",
      "favorites",
      "operations-tasks",
      "property-appraisal",
      "failures",
      "suspended-transactions",
      "system-screen-catalog",
    ],
  },
  "field-inspector": {
    name: "عبدالله عبدالمانع",
    dept: "معاين ميداني",
    init: "عع",
    bg: "var(--info-bg)",
    tc: "var(--info)",
    pages: [
      "favorites",
      "operations-tasks",
      "active-inspection",
      "party-fees",
      "failures",
      "system-screen-catalog",
    ],
  },
  "government-reviewer": {
    name: "فراس كمرين",
    dept: "مراجع حكومي",
    init: "فك",
    bg: "var(--orange-bg)",
    tc: "var(--orange)",
    pages: [
      "government-review",
      "operations-tasks",
      "keys",
      "po",
      "favorites",
      "party-fees",
      "failures",
      "system-screen-catalog",
    ],
  },
  "engineering-office": {
    name: "مكتب جدة للمساحة",
    dept: "مكتب هندسي — رفع مساحي",
    init: "جد",
    bg: "var(--purple-bg)",
    tc: "var(--purple)",
    pages: [
      "operations-tasks",
      "favorites",
      "active-survey",
      "party-fees",
      "failures",
      "system-screen-catalog",
    ],
  },
  "financial-officer": {
    name: "إيمان النهدي",
    dept: "موظف مالي — المالية والعقود",
    init: "إن",
    bg: "var(--danger-bg)",
    tc: "var(--danger)",
    pages: ["financial", "system-screen-catalog"],
  },
};

export const NAV: NavItem[] = [
  { id: "dashboard", label: "لوحة التحكم", icon: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z", grp: null },
  {
    id: "po",
    label: "أوامر العمل (PO)",
    icon: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z",
    grp: "قسم دراسة الحالة",
  },
  {
    id: "all-transactions",
    label: "جميع المعاملات",
    icon: "M4 6h16M4 12h16M4 18h10",
    grp: "قسم دراسة الحالة",
  },
  {
    id: "favorites",
    label: "المفضلة",
    icon: "m12 2.8 2.84 5.75 6.35.92-4.6 4.48 1.09 6.33L12 17.3l-5.68 2.98 1.09-6.33-4.6-4.48 6.35-.92L12 2.8Z",
    grp: "قسم دراسة الحالة",
  },
  {
    id: "operations-tasks",
    label: "المهام",
    icon: "M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2",
    grp: "قسم دراسة الحالة",
  },
  {
    id: "keys",
    label: "إدارة المفاتيح",
    icon: "M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4",
    grp: null,
  },
  {
    id: "field-sync-board",
    label: "ظروف معلّقة",
    icon: "M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z",
    grp: "قسم دراسة الحالة",
  },
  {
    id: "failures",
    label: "إدارة التعذرات",
    icon: "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z",
    grp: null,
  },
  {
    id: "suspended-transactions",
    label: "المعاملات المعلقة",
    icon: "M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z",
    grp: null,
  },
];

/** CDO (super admin) — union of every prototype route. Filled after NAV is defined. */
export const ALL_PROTOTYPE_PAGES: PageId[] = [
  ...new Set<PageId>([
    ...NAV.map((n) => n.id),
    ...ACTIVE_TRANSACTIONS_NAV.map((n) => n.id),
    ...SETTINGS_NAV.map((n) => n.id),
    ...SYSTEM_FIELDS_NAV.map((n) => n.id),
    ...SYSTEM_SETTINGS_PRIMARY_PAGE_IDS,
    SYSTEM_FIELDS_CATALOG_NAV_ITEM.id,
    SYSTEM_SCREEN_CATALOG_NAV_ITEM.id,
    ...ORPHAN_SCREENS_PAGE_IDS,
  ]),
];

ROLES.cdo.pages = ALL_PROTOTYPE_PAGES;

/**
 * Top-bar titles — Case Study.html `setHeader(title, …)`.
 * Keep in sync with PAGE_BREADCRUMB trails below.
 */
export const PAGE_TITLES: Record<PageId, string> = {
  dashboard: "لوحة التحكم",
  "active-primary-data": "البيانات الأولية",
  "active-distribution": "توزيع المعاملات",
  "active-case-study": "دراسة حالة العقارات",
  "system-upload": "الرفع على النظام",
  po: "أوامر العمل (PO)",
  "all-transactions": "جميع المعاملات",
  favorites: "المفضلة",
  "bourse-inquiry": "استعلام بورصة",
  keys: "محفظة المفاتيح",
  "field-sync-board": "ظروف معلّقة لم تُزامن",
  failures: "إدارة التعذرات",
  "suspended-transactions": "المعاملات المعلقة",
  "valuation-requests": "طلبات التقييم",
  "property-inspection": "معاينة العقار (يتيم)",
  "active-inspection": "معاينة العقار",
  "government-review": "المراجعة الحكومية",
  "operations-tasks": "المهام",
  "property-appraisal": "تقييم العقار",
  "active-survey": "الرفع المساحي",
  survey: "مكاتب الرفع الهندسي",
  "party-fees": "فوترة الأتعاب",
  "system-fields-catalog": "قاموس الحقول المركزي",
  "system-screen-catalog": "دليل الشاشات",
  financial: "المالية والفوترة",
  users: "المستخدمون",
  courts: "",
  "location-pending": "مراجعة المسميات المبدئية",
  "failure-types": "أنواع التعذرات",
  "case-study-info-roles": "علاقة المستخدم بالمعلومة",
  "audit-log": "سجل التدقيق",
  "fee-pricing": "التسعيرة",
  "organization-settings": "إعدادات المنشأة",
  profile: "البروفايل",
};

/**
 * Full crumb trails including the current page (last segment), matching
 * Case Study.html `crumb([...])` / `renderGeneric` / `renderList`
 * (`setHeader(label, crumb(['لوحة التحكم', label]))`).
 * Intermediate labels that are real routes get `href` via shell
 * `slashTrailToSegments`.
 */
export const PAGE_BREADCRUMB: Record<PageId, string> = {
  dashboard: "الرئيسية / لوحة التحكم",
  "active-primary-data": "لوحة التحكم / البيانات الأولية",
  "active-distribution": "لوحة التحكم / توزيع المعاملات",
  "active-case-study": "لوحة التحكم / دراسة حالة العقارات",
  "system-upload": "لوحة التحكم / الرفع على النظام",
  po: "لوحة التحكم / دراسة الحالة / أوامر العمل",
  "all-transactions": "لوحة التحكم / جميع المعاملات",
  favorites: "لوحة التحكم / المفضلة",
  "bourse-inquiry": "لوحة التحكم / استعلام بورصة",
  keys: "لوحة التحكم / دراسة الحالة / محفظة المفاتيح",
  "field-sync-board": "لوحة التحكم / دراسة الحالة / ظروف معلّقة",
  failures: "لوحة التحكم / إدارة التعذرات",
  "suspended-transactions": "لوحة التحكم / المعاملات المعلقة",
  "valuation-requests": "لوحة التحكم / طلبات التقييم",
  "property-inspection": "الشاشات (Draft) / معاينة العقار",
  "active-inspection": "لوحة التحكم / معاينة العقار",
  "government-review": "دراسة الحالة / المعاملات النشطة / المراجعة الحكومية",
  "operations-tasks": "لوحة التحكم / المهام",
  "property-appraisal": "لوحة التحكم / تقييم العقار",
  "active-survey": "لوحة التحكم / الرفع المساحي",
  survey: "لوحة التحكم / مكاتب الرفع الهندسي",
  "party-fees": "لوحة التحكم / فوترة الأتعاب",
  "system-fields-catalog": "لوحة التحكم / قاموس الحقول المركزي",
  "system-screen-catalog": "لوحة التحكم / دليل الشاشات",
  financial: "عام / المالية والفوترة",
  users: "لوحة التحكم / المستخدمون",
  courts: "لوحة التحكم",
  "location-pending": "لوحة التحكم / مراجعة المسميات",
  "failure-types": "لوحة التحكم / أنواع التعذرات",
  "case-study-info-roles": "لوحة التحكم / علاقة المستخدم بالمعلومة",
  "audit-log": "لوحة التحكم / سجل التدقيق",
  "fee-pricing": "لوحة التحكم / التسعيرة",
  "organization-settings": "لوحة التحكم / إعدادات المنشأة",
  profile: "البروفايل",
};

import type { PoListStatus } from "./po-list-status";

/** Mock rows aligned with `requirment/system_prototype_4.html` (PO / VR / عقارات). */
export type PoRow = {
  id: string;
  type: string;
  /** عدد العقارات المتوقع من إنفاذ */
  count: number;
  /** صكوك / عقارات مسجّلة فعلياً */
  registered: number;
  /** دراسات حالة مكتملة */
  done: number;
  status: PoListStatus;
  date: string;
  dueDate: string;
  specialist: string;
  /** اسم المشروع / وصف أمر العمل — يظهر كتلميح على رقم PO */
  project?: string;
  /** أعضاء فريق المعاملة (أفاتارات متراكبة في القائمة) */
  team?: string[];
  /** ISO-8601 — used to show newest POs first in the list. */
  createdAtUtc?: string;
};

export type VrRow = {
  /** API record id (GUID) */
  recordId: string;
  /** Display id shown in tables (e.g. VR-441) */
  id: string;
  propId: string;
  area: string;
  type: string;
  appraiser: string;
  status: "done" | "progress" | "fail";
  date: string;
};

export type PropertyWorkflowStage =
  | "new"
  | "progress"
  | "done"
  | "fail"
  | "incomplete";

export type PropertyRow = {
  id: string;
  po: string;
  area: string;
  type: string;
  key: boolean;
  survey: PropertyWorkflowStage;
  val: PropertyWorkflowStage;
  study: PropertyWorkflowStage;
  status: PropertyWorkflowStage;
  specialist: string;
};

export type TeamKind = "internal" | "freelance" | "external";

export type TeamCardRow = [string, string, string, TeamKind, number];

export type StaffUserDetail = {
  section: string;
  label: string;
  value: string;
};

export type StaffUser = {
  id: string;
  name: string;
  role: string;
  email: string;
  userName?: string;
  distributionAssigneeId?: string;
  reviewerCityCoverage?: string[];
  password?: string;
  type: "internal" | "freelance" | "external";
  source?: "hr" | "proc" | "crm";
  phone?: string | null;
  roleId?: string | null;
  city?: string | null;
  department?: string | null;
  nationalId?: string | null;
  avatarUrl?: string | null;
  inspectorType?: "employee" | "contractor" | null;
  hasCompensation?: boolean;
  feeValueSar?: number | null;
  iban?: string | null;
  taxNumber?: string | null;
  commercialRegistration?: string | null;
  joinedAt?: string | null;
  createdAt?: string;
  lastLoginAtUtc?: string | null;
  status?: "Active" | "Disabled" | "PendingActivation" | "Locked";
  systemRoles?: string[];
  details?: StaffUserDetail[];
  registration?: Record<string, string>;
};

export type SurveyOfficeRow = {
  name: string;
  active: number;
  doneMonth: number;
  avgDays: string;
  contract: string;
  statusBusy: boolean;
};

export const VALID_PAGE_IDS = new Set<PageId>([
  ...NAV.map((n) => n.id),
  ...ACTIVE_TRANSACTIONS_NAV.map((n) => n.id),
  ...SETTINGS_NAV.map((n) => n.id),
  ...SYSTEM_FIELDS_NAV.map((n) => n.id),
  ...SYSTEM_SETTINGS_PRIMARY_PAGE_IDS,
  SYSTEM_FIELDS_CATALOG_NAV_ITEM.id,
  SYSTEM_SCREEN_CATALOG_NAV_ITEM.id,
  ...ORPHAN_SCREENS_PAGE_IDS,
  "profile",
]);

