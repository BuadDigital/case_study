import type { PageId, RoleId } from "@platform/types";
import type { WorkflowTask, WorkflowTaskKind } from "@case-study/mfe";

export type PartyTaskPageDef = {
  pageId: PageId;
  kind: WorkflowTaskKind;
  roleId: RoleId;
  pageTitle: string;
  emptyLine: string;
  emptyHint: string;
  tableHint: string;
  breadcrumbTitle: string;
  workTitle: string;
  workIntro: string;
  saveLabel: string;
  completeTitle: string;
  completeMessage: string;
  assigneeSubtitle: string;
  icon: string;
  /** Use field inspection form in the work panel. */
  useFieldForm?: boolean;
};

const PARTY_TASK_PAGES_MAP = {
  "government-review": {
    pageId: "government-review",
    kind: "government-review",
    roleId: "government-reviewer",
    pageTitle: "المراجعة الحكومية",
    emptyLine: "لا توجد مهام مراجعة حكومية بانتظار التنفيذ.",
    emptyHint:
      "تظهر هنا بعد تأكيد التوزيع عند تفعيل المراجع الحكومي واختيار المسؤول.",
    tableHint:
      "اضغط الصف لفتح نموذج المراجعة (أو لوحة اختيار العقار إن وُجد أكثر من مهمة). خطاب التفويض من عمود «مهمة زيارة المحكمة».",
    breadcrumbTitle: "المراجعة الحكومية",
    workTitle: "المراجعة الحكومية",
    workIntro:
      "زيارة المحكمة وجمع المفاتيح — أكمل التحقق ثم أرسل النتيجة.",
    saveLabel: "حفظ وإتمام المراجعة",
    completeTitle: "تم إتمام المراجعة",
    completeMessage: "اكتملت المراجعة الحكومية لهذا العقار.",
    assigneeSubtitle: "مراجع حكومي",
    icon: "M3 21h18M6 21V7l6-4 6 4M12 3v18",
  },
  "valuation-coordination": {
    pageId: "valuation-coordination",
    kind: "valuation-coordination",
    roleId: "valuation-coordinator",
    pageTitle: "استلام التقييم",
    emptyLine: "لا توجد معاملات بانتظار استلام منسق التقييم.",
    emptyHint:
      "تظهر هنا بعد تأكيد التوزيع عند تفعيل قسم التقييم العقاري واختيار المنسق.",
    tableHint:
      "اضغط الصف لفتح مهمة الاستلام — اضغط نفس الصف مرة أخرى للإغلاق.",
    breadcrumbTitle: "استلام التقييم",
    workTitle: "استلام التقييم",
    workIntro:
      "استلم المعاملة من دراسة الحالة ونسّق إسناد المعاين والمقيم.",
    saveLabel: "تأكيد الاستلام",
    completeTitle: "تم التسليم",
    completeMessage: "تم تسليم المعامله للمقيم العقاري",
    assigneeSubtitle: "منسق عمليات التقييم",
    icon: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 8 0 4 4 0 0 0-8 0z",
  },
  "property-inspection": {
    pageId: "property-inspection",
    kind: "field-inspection",
    roleId: "field-inspector",
    pageTitle: "معاينة العقار",
    emptyLine: "لا توجد معاينات ميدانية بانتظار التنفيذ.",
    emptyHint:
      "تظهر هنا بعد تأكيد التوزيع عند اختيار المعاين الميداني.",
    tableHint:
      "اضغط الصف لفتح نموذج المعاينة — اضغط نفس الصف مرة أخرى للإغلاق.",
    breadcrumbTitle: "معاينة العقار",
    workTitle: "معاينة العقار",
    workIntro:
      "وصلت هذه المهمة بعد تأكيد التوزيع — أكمل نموذج المعاينة الميدانية.",
    saveLabel: "حفظ وإرسال المعاينة",
    completeTitle: "تم إرسال المعاينة",
    completeMessage: "اكتملت معاينة هذا العقار وتم إرسال النموذج.",
    assigneeSubtitle: "معاين ميداني",
    icon: "M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z",
    useFieldForm: true,
  },
  "property-appraisal": {
    pageId: "property-appraisal",
    kind: "property-appraisal",
    roleId: "real-estate-appraiser",
    pageTitle: "تقييم العقار",
    emptyLine: "لا توجد مهام تقييم عقاري بانتظار التنفيذ.",
    emptyHint:
      "بعد الإرسال للأخصائي يمكن طلب استرجاع المعاملة من شاشة العمل أو من عقارات أمر العمل (⋮).",
    tableHint:
      "⋮ — فتح المعاملة · عقارات أمر العمل · تفاصيل العقار.",
    breadcrumbTitle: "تقييم العقار",
    workTitle: "تقييم العقار",
    workIntro: "",
    saveLabel: "حفظ وإتمام التقييم",
    completeTitle: "تم إرسال التقييم",
    completeMessage: "اكتمل تقييم هذا العقار.",
    assigneeSubtitle: "مقيم عقاري",
    icon: "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
  },
  "active-survey": {
    pageId: "active-survey",
    kind: "engineering-survey",
    roleId: "engineering-office",
    pageTitle: "الرفع المساحي",
    emptyLine: "لا توجد مهام رفع مساحي بانتظار التنفيذ.",
    emptyHint:
      "تظهر هنا بعد تأكيد التوزيع عند تفعيل المكتب الهندسي واختيار المكتب.",
    tableHint:
      "اضغط الصف لفتح مهمة الرفع — اضغط نفس الصف مرة أخرى للإغلاق.",
    breadcrumbTitle: "الرفع المساحي",
    workTitle: "الرفع المساحي",
    workIntro: "أصدر تقرير الرفع المساحي للعقار وأرفق الملفات.",
    saveLabel: "حفظ وإرسال الرفع",
    completeTitle: "تم إرسال الرفع",
    completeMessage: "اكتمل الرفع المساحي لهذا العقار.",
    assigneeSubtitle: "مكتب هندسي",
    icon: "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z",
  },
} satisfies Record<string, PartyTaskPageDef>;

export const PARTY_TASK_PAGES: Record<string, PartyTaskPageDef> =
  PARTY_TASK_PAGES_MAP;

export const PARTY_TASK_PAGE_IDS = Object.keys(
  PARTY_TASK_PAGES_MAP,
) as PageId[];

export function isPartyTaskPage(page: PageId): boolean {
  return page in PARTY_TASK_PAGES;
}

export function partyTaskPageDef(page: PageId): PartyTaskPageDef | null {
  return PARTY_TASK_PAGES[page] ?? null;
}

export function filterTasksForPartyKind(
  tasks: WorkflowTask[],
  kind: WorkflowTaskKind,
): WorkflowTask[] {
  return tasks.filter((t) => t.kind === kind);
}

/** Distributed party workflow roles (معاين، مكتب هندسي، مقيم، منسق). */
export const PARTY_WORKFLOW_ROLE_IDS: RoleId[] = [
  "field-inspector",
  "engineering-office",
  "real-estate-appraiser",
  "valuation-coordinator",
  "government-reviewer",
];

export function isPartyWorkflowRole(role: RoleId): boolean {
  return PARTY_WORKFLOW_ROLE_IDS.includes(role);
}

export function partyTaskPageDefForKind(
  kind: WorkflowTaskKind,
): PartyTaskPageDef | null {
  return Object.values(PARTY_TASK_PAGES).find((d) => d.kind === kind) ?? null;
}

/**
 * Sidebar — المعاملات النشطة for distributed party roles.
 * Legacy government-review list lives under الشاشات اليتيمة (CDO only).
 */
export const PARTY_ACTIVE_TRANSACTIONS_NAV = PARTY_TASK_PAGE_IDS.filter(
  (pageId) => pageId !== "government-review",
).map((pageId) => {
  const def = PARTY_TASK_PAGES[pageId];
  return {
    id: def.pageId,
    label: def.pageTitle,
    icon: def.icon,
    available: true,
  };
});
