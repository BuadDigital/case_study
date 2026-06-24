import type { NavItem, PageId, RoleDef, RoleId } from "@platform/types";
import { ACTIVE_TRANSACTIONS_NAV } from "./active-transactions";
import { SETTINGS_NAV } from "@platform/app-shared/prototype/settings-nav";
import { SYSTEM_FIELDS_NAV } from "@platform/app-shared/prototype/system-fields-nav";
import { SYSTEM_FIELDS_CATALOG_NAV_ITEM } from "@platform/app-shared/prototype/system-fields-catalog-nav";
import { SYSTEM_SCREEN_CATALOG_NAV_ITEM } from "@platform/app-shared/prototype/system-screen-catalog-nav";

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
  "hr-admin": {
    name: "آلاء قمصاني",
    dept: "أخصائية موارد بشرية",
    init: "آق",
    bg: "var(--info-bg)",
    tc: "var(--info)",
    pages: ["dashboard", "users", "system-fields-catalog", "system-screen-catalog"],
  },
  "proc-admin": {
    name: "علي الأمين",
    dept: "مدير المالية والعقود",
    init: "عل",
    bg: "var(--warning-bg)",
    tc: "var(--warning)",
    pages: ["dashboard", "users", "system-fields-catalog", "system-screen-catalog"],
  },
  "crm-admin": {
    name: "شهد العماري",
    dept: "مدير علاقات العملاء",
    init: "شع",
    bg: "var(--success-bg)",
    tc: "var(--success)",
    pages: ["dashboard", "users", "system-fields-catalog", "system-screen-catalog"],
  },
  "general-manager": {
    name: "سالم الغريب",
    dept: "مدير إدارة التقييم العقاري",
    init: "سغ",
    bg: "var(--info-bg)",
    tc: "var(--info)",
    pages: [
      "dashboard",
      "po",
      "active-primary-data",
      "bourse-inquiry",
      "active-distribution",
      "active-case-study",
      "survey",
      "keys",
      "failures",
      "suspended-transactions",
      "valuation-requests",
      "system-fields-catalog",
      "system-screen-catalog",
      "financial",
      "kpi",
      "users",
      "courts",
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
      "dashboard",
      "po",
      "active-primary-data",
      "bourse-inquiry",
      "active-distribution",
      "active-case-study",
      "keys",
      "failures",
      "suspended-transactions",
      "failure-types",
      "party-fees",
      "system-fields-catalog",
      "system-screen-catalog",
    ],
  },
  "case-specialist": {
    name: "أسامة الصالحي",
    dept: "أخصائي دراسة الحالة",
    init: "أص",
    bg: "var(--success-bg)",
    tc: "var(--success)",
    pages: [
      "dashboard",
      "po",
      "active-primary-data",
      "bourse-inquiry",
      "active-distribution",
      "active-case-study",
      "failures",
      "suspended-transactions",
      "system-fields-catalog",
      "system-screen-catalog",
    ],
  },
  "valuation-coordinator": {
    name: "محمد دياب",
    dept: "منسق عمليات التقييم",
    init: "مد",
    bg: "var(--purple-bg)",
    tc: "var(--purple)",
    pages: ["dashboard", "valuation-coordination", "system-fields-catalog", "system-screen-catalog"],
  },
  "real-estate-appraiser": {
    name: "عبدالله الكثيري",
    dept: "مقيم عقاري",
    init: "عك",
    bg: "var(--info-bg)",
    tc: "var(--info)",
    pages: ["dashboard", "po", "property-appraisal", "suspended-transactions", "system-fields-catalog", "system-screen-catalog"],
  },
  "field-inspector": {
    name: "أحمد سعيد",
    dept: "معاين ميداني",
    init: "أس",
    bg: "var(--info-bg)",
    tc: "var(--info)",
    pages: [
      "dashboard",
      "property-inspection",
      "party-fees",
      "system-fields-catalog",
      "system-screen-catalog",
    ],
  },
  "government-reviewer": {
    name: "فراس كمرين",
    dept: "مراجع حكومي",
    init: "فك",
    bg: "var(--orange-bg)",
    tc: "var(--orange)",
    pages: ["dashboard", "government-review", "keys", "system-fields-catalog", "system-screen-catalog"],
  },
  "engineering-office": {
    name: "مكتب جدة للمساحة",
    dept: "مكتب هندسي — رفع مساحي",
    init: "جد",
    bg: "var(--purple-bg)",
    tc: "var(--purple)",
    pages: [
      "dashboard",
      "active-survey",
      "party-fees",
      "system-fields-catalog",
      "system-screen-catalog",
    ],
  },
  "financial-officer": {
    name: "إيمان النهدي",
    dept: "موظف مالي — المالية والعقود",
    init: "إن",
    bg: "var(--danger-bg)",
    tc: "var(--danger)",
    pages: ["dashboard", "financial", "system-fields-catalog", "system-screen-catalog"],
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
    id: "survey",
    label: "مكاتب الرفع الهندسي",
    icon: "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z",
    grp: null,
    placeholder: true,
  },
  {
    id: "keys",
    label: "إدارة المفاتيح",
    icon: "M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4",
    grp: null,
    placeholder: true,
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
  {
    id: "valuation-requests",
    label: "طلبات التقييم",
    icon: "M9 11l3 3L22 4",
    grp: "قسم التقييم العقاري",
    placeholder: true,
  },
  {
    id: "financial",
    label: "التقارير المالية",
    icon: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
    grp: null,
  },
  {
    id: "kpi",
    label: "مؤشرات الأداء",
    icon: "M18 20V10M12 20V4M6 20v-6",
    grp: null,
    placeholder: true,
  },
  {
    id: "party-fees",
    label: "الاتعاب والفوتره",
    icon: "M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
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
    SYSTEM_FIELDS_CATALOG_NAV_ITEM.id,
    SYSTEM_SCREEN_CATALOG_NAV_ITEM.id,
  ]),
];

ROLES.cdo.pages = ALL_PROTOTYPE_PAGES;

export const PAGE_TITLES: Record<PageId, string> = {
  dashboard: "لوحة التحكم",
  "active-primary-data": "البيانات الأولية",
  "active-distribution": "توزيع المعاملات",
  "active-case-study": "دراسة حالة العقارات",
  po: "أوامر العمل",
  "bourse-inquiry": "استعلام بورصة",
  survey: "مكاتب الرفع الهندسي",
  keys: "إدارة المفاتيح",
  failures: "إدارة التعذرات",
  "suspended-transactions": "المعاملات المعلقة",
  "valuation-requests": "طلبات التقييم",
  "property-inspection": "معاينة العقار",
  "government-review": "المراجعة الحكومية",
  "valuation-coordination": "استلام التقييم",
  "property-appraisal": "تقييم العقار",
  "active-survey": "الرفع المساحي",
  "party-fees": "الاتعاب والفوتره",
  "system-fields-catalog": "قاموس الحقول المركزي",
  "system-screen-catalog": "دليل الشاشات",
  financial: "التقارير المالية",
  kpi: "مؤشرات الأداء",
  users: "إدارة المستخدمين",
  courts: "المحاكم و الدوائر",
  "failure-types": "أنواع التعذرات",
  "case-study-info-roles": "علاقة المستخدم بالمعلومة",
};

export const PAGE_BREADCRUMB: Record<PageId, string> = {
  dashboard: "الرئيسية",
  "active-primary-data": "دراسة الحالة / المعاملات النشطة / البيانات الأولية",
  "active-distribution": "دراسة الحالة / المعاملات النشطة / توزيع المعاملات",
  "active-case-study": "دراسة الحالة / المعاملات النشطة / دراسة حالة العقارات",
  po: "دراسة الحالة / أوامر العمل",
  "bourse-inquiry": "دراسة الحالة / المعاملات النشطة / استعلام بورصة",
  survey: "دراسة الحالة",
  keys: "دراسة الحالة",
  failures: "دراسة الحالة",
  "suspended-transactions": "دراسة الحالة",
  "valuation-requests": "التقييم العقاري",
  "property-inspection": "المعاملات النشطة / معاينة العقار",
  "government-review": "المعاملات النشطة / المراجعة الحكومية",
  "valuation-coordination": "المعاملات النشطة / استلام التقييم",
  "property-appraisal": "المعاملات النشطة / تقييم العقار",
  "active-survey": "المعاملات النشطة / الرفع المساحي",
  "party-fees": "الاتعاب والفوتره",
  "system-fields-catalog": "عام / قاموس الحقول المركزي",
  "system-screen-catalog": "عام / دليل الشاشات",
  financial: "المالية",
  kpi: "الإدارة",
  users: "الإدارة",
  courts: "جميع حقول النظام / المحاكم و الدوائر",
  "failure-types": "جميع حقول النظام / أنواع التعذرات",
  "case-study-info-roles": "جميع حقول النظام / علاقة المستخدم بالمعلومة",
};

/** Mock rows aligned with `requirment/system_prototype_4.html` (PO / VR / عقارات). */
export type PoRow = {
  id: string;
  type: string;
  count: number;
  done: number;
  status: "progress" | "done" | "under_study";
  date: string;
  dueDate: string;
  specialist: string;
};

export type VrRow = {
  id: string;
  propId: string;
  area: string;
  type: string;
  appraiser: string;
  status: "done" | "progress";
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
  createdAt?: string;
  status?: "Active" | "Inactive";
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
  SYSTEM_FIELDS_CATALOG_NAV_ITEM.id,
  SYSTEM_SCREEN_CATALOG_NAV_ITEM.id,
]);

