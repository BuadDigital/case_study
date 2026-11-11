import type { NavItem, PageId, RoleDef, RoleId } from "@platform/types";
import type { PropertyListRowStatus } from "@platform/api-client";
import { ICON_PATHS } from "@platform/ui-kit";
import { ACTIVE_TRANSACTIONS_NAV } from "./active-transactions";
import { SYSTEM_FIELDS_NAV } from "@platform/app-shared/app-data/system-fields-nav";
import { SYSTEM_FIELDS_CATALOG_NAV_ITEM } from "@platform/app-shared/app-data/system-fields-catalog-nav";
import { SYSTEM_SETTINGS_PRIMARY_PAGE_IDS } from "./system-settings-nav";

export type { NavItem, PageId, RoleDef, RoleId };

/** «لوحة التحكم» is the CDO's only (Omar 2026-11-09) — no other role lists "dashboard". */
export const ROLES: Record<RoleId, RoleDef> = {
  cdo: {
    name: "مسؤول النظام",
    dept: "المسؤول",
    init: "مس",
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
      "my-work",
      "all-transactions",
      "po",
      "property-map",
      "favorites",
      "active-primary-data",
      "bourse-inquiry",
      "active-distribution",
      "active-receipt",
      "active-case-study",
      "system-upload",
      "operations-tasks",
      "keys",
      "failures",
      "suspended-transactions",
      "comparable-properties",
      "financial",
      "courts",
      "location-pending",
      "failure-types",
      "case-study-info-roles",
    ],
  },
  "section-supervisor": {
    name: "مشرف دراسة الحالة",
    dept: "مشرف قسم دراسة الحالة",
    init: "مد",
    bg: "var(--warning-bg)",
    tc: "var(--warning)",
    pages: [
      "my-work",
      "all-transactions",
      "po",
      "property-map",
      "favorites",
      "active-primary-data",
      "bourse-inquiry",
      "active-distribution",
      "active-receipt",
      "active-case-study",
      "system-upload",
      "operations-tasks",
      "keys",
      "field-sync-board",
      "failures",
      "suspended-transactions",
      "failure-types",
      "party-fees",
      "fee-pricing",
    ],
  },
  "case-specialist": {
    name: "أسامة الصالحي",
    dept: "أخصائي دراسة حالة",
    init: "أص",
    bg: "var(--success-bg)",
    tc: "var(--success)",
    // Supervisor's operational pages — without fees, pricing or financial: party outputs are
    // accepted inside the transaction and fee money is the supervisor's decision.
    // Plus all-transactions so the specialist can open every case, not only assigned ones.
    pages: [
      "my-work",
      "po",
      "all-transactions",
      "property-map",
      "favorites",
      "active-primary-data",
      "bourse-inquiry",
      "active-distribution",
      "active-receipt",
      "active-case-study",
      "system-upload",
      "operations-tasks",
      "keys",
      "field-sync-board",
      "failures",
      "suspended-transactions",
      "failure-types",
    ],
  },
  "real-estate-appraiser": {
    name: "عبدالله الكثيري",
    dept: "مقيّم عقاري",
    init: "عك",
    bg: "var(--info-bg)",
    tc: "var(--info)",
    pages: [
      // Omar 2026-11-10: the appraiser enters his transactions from «أعمالي» like the specialists.
      "my-work",
      "po",
      "property-map",
      "favorites",
      "operations-tasks",
      "property-appraisal",
      "comparable-properties",
      "failures",
      "suspended-transactions",
    ],
  },
  "field-inspector": {
    name: "عبدالله عبدالمانع",
    dept: "معاين ميداني",
    init: "عع",
    bg: "var(--info-bg)",
    tc: "var(--info)",
    pages: [
      "po",
      "favorites",
      "operations-tasks",
      "active-inspection",
      "party-fees",
      "failures",
    ],
  },
  "government-reviewer": {
    name: "فراس كمرين",
    dept: "مراجع حكومي",
    init: "فك",
    bg: "var(--orange-bg)",
    tc: "var(--orange)",
    pages: [
      "operations-tasks",
      "keys",
      "po",
      "favorites",
      "party-fees",
      "failures",
    ],
  },
  "engineering-office": {
    name: "مكتب جدة للمساحة",
    dept: "مكتب هندسي — رفع مساحي",
    init: "جد",
    bg: "var(--purple-bg)",
    tc: "var(--purple)",
    pages: [
      "po",
      "operations-tasks",
      "favorites",
      "active-survey",
      "party-fees",
      "failures",
    ],
  },
  "financial-officer": {
    name: "إيمان النهدي",
    dept: "موظف مالي — المالية والعقود",
    init: "إن",
    bg: "var(--danger-bg)",
    tc: "var(--danger)",
    pages: ["financial"],
  },
};

/**
 * The main menu (plan 2026-11-05, phase 6): «أعمالي» first, then the transactions, the follow-up
 * lists, the tools and the management pages; a row's label is its page title (`PAGE_TITLES`).
 */
export const NAV: NavItem[] = [
  /** «أعمالي» — every decision waiting for the viewer's roles (plan 2026-11-05, phase 1). */
  {
    id: "my-work",
    label: "أعمالي",
    icon: "M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z",
    grp: null,
  },
  { id: "dashboard", label: "لوحة التحكم", icon: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z", grp: null },
  {
    id: "po",
    label: "أوامر العمل (PO)",
    icon: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z",
    grp: "المعاملات",
  },
  {
    id: "all-transactions",
    label: "المعاملات النشطة",
    icon: "M4 6h16M4 12h16M4 18h10",
    grp: "المعاملات",
  },
  {
    id: "failures",
    label: "التعذّرات",
    icon: "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z",
    grp: "المتابعة",
  },
  {
    id: "suspended-transactions",
    label: "المعاملات المعلّقة",
    icon: "M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z",
    grp: "المتابعة",
  },
  {
    id: "operations-tasks",
    label: "المهام",
    icon: "M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2",
    grp: "المتابعة",
  },
  {
    id: "keys",
    label: "المفاتيح",
    icon: "M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4",
    grp: "المتابعة",
  },
  {
    id: "field-sync-board",
    label: "ظروف بانتظار المزامنة",
    icon: "M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z",
    grp: "المتابعة",
  },
  {
    id: "property-map",
    label: "خريطة العقارات",
    icon: "M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-3.659 1.83a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.382V6.618a1 1 0 0 1 .553-.894l3.659-1.83a2 2 0 0 1 1.788 0zM12 19V5",
    grp: "أدوات",
  },
  {
    id: "favorites",
    label: "المفضلة",
    icon: "m12 2.8 2.84 5.75 6.35.92-4.6 4.48 1.09 6.33L12 17.3l-5.68 2.98 1.09-6.33-4.6-4.48 6.35-.92L12 2.8Z",
    grp: "أدوات",
  },
  {
    id: "comparable-properties",
    label: "بنك المقارنات",
    icon: ICON_PATHS.grid,
    grp: "أدوات",
  },
  {
    id: "location-pending",
    label: "مراجعة المسميات",
    icon: "M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z",
    grp: "الإدارة",
  },
  {
    id: "clients",
    label: "سجل العملاء",
    icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
    grp: "الإدارة",
  },
];

/** CDO (super admin) — union of every prototype route. Filled after NAV is defined. */
export const ALL_PROTOTYPE_PAGES: PageId[] = [
  ...new Set<PageId>([
    ...NAV.map((n) => n.id),
    ...ACTIVE_TRANSACTIONS_NAV.map((n) => n.id),
    ...SYSTEM_FIELDS_NAV.map((n) => n.id),
    ...SYSTEM_SETTINGS_PRIMARY_PAGE_IDS,
    SYSTEM_FIELDS_CATALOG_NAV_ITEM.id,
    // Finance hub lives in FinanceHtmlNav (not NAV[]) but is a real shell page.
    "financial",
  ]),
];

ROLES.cdo.pages = ALL_PROTOTYPE_PAGES;

/**
 * Top-bar titles — Case Study.html `setHeader(title, …)`.
 * Breadcrumb leaf labels live in PAGE_BREADCRUMB (current page only).
 */
export const PAGE_TITLES: Record<PageId, string> = {
  dashboard: "لوحة التحكم",
  "my-work": "أعمالي",
  "active-primary-data": "البيانات الأولية",
  "active-distribution": "توزيع المعاملات",
  "active-receipt": "الاستلام من الأطراف",
  "active-case-study": "دراسة حالة العقارات",
  "system-upload": "الرفع على النظام",
  po: "أوامر العمل (PO)",
  "all-transactions": "المعاملات النشطة",
  "property-map": "خريطة العقارات",
  favorites: "المفضلة",
  "bourse-inquiry": "استعلام بورصة",
  keys: "المفاتيح",
  "field-sync-board": "ظروف بانتظار المزامنة",
  failures: "التعذّرات",
  "suspended-transactions": "المعاملات المعلّقة",
  "comparable-properties": "بنك المقارنات",
  "property-inspection": "معاينة العقار (يتيم)",
  "active-inspection": "معاينة العقار",
  "operations-tasks": "المهام",
  "property-appraisal": "تقييم العقار",
  "active-survey": "الرفع المساحي",
  "party-fees": "فوترة الأتعاب",
  "system-fields-catalog": "قاموس الحقول المركزي",
  financial: "المالية والفوترة",
  users: "المستخدمون",
  courts: "المحاكم والدوائر",
  "location-pending": "مراجعة المسميات",
  "failure-types": "أنواع التعذّرات",
  "case-study-info-roles": "علاقة المستخدم بالمعلومة",
  "audit-log": "سجل التدقيق",
  "fee-pricing": "التسعيرة",
  "organization-settings": "بيانات المنشأة",
  "attachment-print-dictionary": "قوائم التقييم",
  clients: "سجل العملاء",
  profile: "البروفايل",
  "admin-panel": "لوحة الإدارة",
};

/**
 * Header breadcrumb — current page label only (no parent trail).
 * Nested workspace/detail chrome is resolved separately in the shell.
 */
export const PAGE_BREADCRUMB: Record<PageId, string> = {
  dashboard: "لوحة التحكم",
  "my-work": "أعمالي",
  "active-primary-data": "قوائم المراحل / البيانات الأولية",
  "active-distribution": "قوائم المراحل / توزيع المعاملات",
  "active-receipt": "قوائم المراحل / الاستلام من الأطراف",
  "active-case-study": "قوائم المراحل / دراسة حالة العقارات",
  "system-upload": "قوائم المراحل / الرفع على النظام",
  po: "أوامر العمل (PO)",
  "all-transactions": "المعاملات النشطة",
  "property-map": "خريطة العقارات",
  favorites: "المفضلة",
  "bourse-inquiry": "قوائم المراحل / استعلام بورصة",
  keys: "المفاتيح",
  "field-sync-board": "ظروف بانتظار المزامنة",
  failures: "التعذّرات",
  "suspended-transactions": "المعاملات المعلّقة",
  "comparable-properties": "بنك المقارنات",
  "property-inspection": "معاينة العقار",
  "active-inspection": "معاينة العقار",
  "operations-tasks": "المهام",
  "property-appraisal": "تقييم العقار",
  "active-survey": "الرفع المساحي",
  "party-fees": "قوائم المراحل / فوترة الأتعاب",
  "system-fields-catalog": "قاموس الحقول المركزي",
  financial: "المالية والفوترة",
  users: "المستخدمون",
  courts: "المحاكم والدوائر",
  "location-pending": "مراجعة المسميات",
  "failure-types": "أنواع التعذّرات",
  "case-study-info-roles": "علاقة المستخدم بالمعلومة",
  "audit-log": "سجل التدقيق",
  "fee-pricing": "التسعيرة",
  "organization-settings": "بيانات المنشأة",
  "attachment-print-dictionary": "قوائم التقييم",
  clients: "سجل العملاء",
  profile: "البروفايل",
  "admin-panel": "لوحة الإدارة",
};

import type { PoListStatus } from "./po-list-status";

/** Mock rows aligned with `requirment/system_prototype_4.html` (PO / VR / properties). */
export type PoRow = {
  id: string;
  type: string;
  /** Expected property count from Enfath. */
  count: number;
  /** Deeds / properties actually registered. */
  registered: number;
  /** Properties handed over to Enfaz (delivered). */
  done: number;
  /**
   * Workflow progress 0–100 from the API (stages + parties).
   * When set, the list bar prefers this over done/expected.
   */
  progressPct?: number;
  /** Billing-aware status — shown to Finance and management (`canSeeBillingStatuses`). */
  status: PoListStatus;
  /** Study status alone — shown to every other role. */
  studyStatus: PoListStatus;
  date: string;
  dueDate: string;
  specialist: string;
  /** Project name / work-order description — shown as tooltip on the PO number. */
  project?: string;
  /** Transaction team members (stacked avatars in the list). */
  team?: string[];
  /** ISO-8601 — used to show newest POs first in the list. */
  createdAtUtc?: string;
};

export type PropertyWorkflowStage = PropertyListRowStatus;

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

type StaffUserDetail = {
  section: string;
  label: string;
  value: string;
};

export type StaffUser = {
  id: string;
  /** Numbering workshop: internal reference US-{year}-{5-digit sequence}. */
  referenceNumber?: string | null;
  name: string;
  role: string;
  userName?: string;
  distributionAssigneeId?: string;
  reviewerCityCoverage?: string[];
  type: "internal" | "freelance" | "external";
  phone?: string | null;
  roleId?: string | null;
  city?: string | null;
  department?: string | null;
  nationalId?: string | null;
  avatarUrl?: string | null;
  inspectorType?: "employee" | "contractor" | null;
  /** Case-specialist sub-roles (coordination | study | review); empty for other roles. */
  caseSpecialistSubRoles?: string[];
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
};

export const VALID_PAGE_IDS = new Set<PageId>([
  ...NAV.map((n) => n.id),
  ...ACTIVE_TRANSACTIONS_NAV.map((n) => n.id),
  ...SYSTEM_FIELDS_NAV.map((n) => n.id),
  ...SYSTEM_SETTINGS_PRIMARY_PAGE_IDS,
  SYSTEM_FIELDS_CATALOG_NAV_ITEM.id,
  "financial",
  "profile",
]);

