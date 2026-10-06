/**
 * Pure rules of the «إعادة المعاينة للمعاين» dialog (batch 2C, wire (d)): which inspector-data
 * sections can be sent back, which affected parties start ticked, what the server needs before it
 * accepts the return, and how each party's outcome reads. No React, no fetches.
 */
import type {
  ReturnImpactParty,
  ReturnInspectionRequest,
  ReturnInspectionResultDto,
  ReturnInspectionStudyReportDecision,
} from "@platform/api-client";
import { caseStudyReopenReasonError } from "./case-study-report-issue-errors";

/** The inspector-data groups (same keys as the server's `InspectorDataGroupRules`). */
export const RETURN_INSPECTION_SECTIONS: ReadonlyArray<{ key: string; labelAr: string }> = [
  { key: "assetType", labelAr: "نوع الأصل" },
  { key: "components", labelAr: "المكونات" },
  { key: "area", labelAr: "المساحات" },
  { key: "age", labelAr: "العمر" },
  { key: "boundaries", labelAr: "الحدود" },
  { key: "location", labelAr: "الموقع" },
  { key: "photos", labelAr: "الصور" },
  { key: "narrative", labelAr: "الوصف والملاحظات" },
  { key: "services", labelAr: "الخدمات" },
];

export const RETURN_INSPECTION_NOTE_REQUIRED = "يجب إدخال سبب الإرجاع للتصحيح";
export const RETURN_INSPECTION_STUDY_REPORT_REQUIRED =
  "اختر إبقاء التقرير الصادر أو إعادة فتحه";

/** Tick / untick one key in an ordered list (returns a new list). */
export function toggleKey(list: readonly string[], key: string): string[] {
  return list.includes(key) ? list.filter((k) => k !== key) : [...list, key];
}

/** The parties the server pre-selects for the chosen sections. */
export function suggestedAffectedTaskIds(
  parties: readonly ReturnImpactParty[],
): string[] {
  return parties.filter((p) => p.suggested).map((p) => p.taskId);
}

/**
 * The affected-party selection after the impact list reloads (the sections changed). Until the
 * specialist touches a party the server's suggestion rules; afterwards his picks stay, minus any
 * party that no longer exists in the list.
 */
export function reconcileAffectedTaskIds(args: {
  parties: readonly ReturnImpactParty[];
  current: readonly string[];
  touched: boolean;
}): string[] {
  if (!args.touched) return suggestedAffectedTaskIds(args.parties);
  const known = new Set(args.parties.map((p) => p.taskId));
  return args.current.filter((id) => known.has(id));
}

export type ReturnInspectionPlan =
  | {
      ok: false;
      field: "note" | "studyReport" | "studyReportReason";
      error: string;
    }
  | { ok: true; request: ReturnInspectionRequest };

/**
 * What the dialog submits. The note is always required; once the study report is issued the
 * specialist must choose keep / reopen, and reopening needs its own reason (≥ 10 characters).
 */
export function planReturnInspectionSubmit(args: {
  note: string;
  sections: readonly string[];
  affectedTaskIds: readonly string[];
  studyReportIssued: boolean;
  studyReport: ReturnInspectionStudyReportDecision | null;
  studyReportReopenReason: string;
}): ReturnInspectionPlan {
  const note = args.note.trim();
  if (!note) {
    return { ok: false, field: "note", error: RETURN_INSPECTION_NOTE_REQUIRED };
  }
  if (!args.studyReportIssued) {
    return {
      ok: true,
      request: {
        returnNote: note,
        sections: [...args.sections],
        affectedTaskIds: [...args.affectedTaskIds],
        studyReport: null,
      },
    };
  }
  if (!args.studyReport) {
    return {
      ok: false,
      field: "studyReport",
      error: RETURN_INSPECTION_STUDY_REPORT_REQUIRED,
    };
  }
  if (args.studyReport === "reopen") {
    const reasonError = caseStudyReopenReasonError(args.studyReportReopenReason);
    if (reasonError) {
      return { ok: false, field: "studyReportReason", error: reasonError };
    }
  }
  return {
    ok: true,
    request: {
      returnNote: note,
      sections: [...args.sections],
      affectedTaskIds: [...args.affectedTaskIds],
      studyReport: args.studyReport,
      ...(args.studyReport === "reopen"
        ? { studyReportReopenReason: args.studyReportReopenReason.trim() }
        : {}),
    },
  };
}

/** Server field errors → the dialog's inline fields (anything else is a general message). */
export function mapReturnInspectionFieldErrors(
  errors: Record<string, string> | undefined,
): { note?: string; studyReport?: string; studyReportReason?: string } {
  const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  return {
    note: text(errors?.returnNote),
    studyReport: text(errors?.studyReport),
    studyReportReason: text(errors?.studyReportReopenReason),
  };
}

export function returnPartyKindLabel(kind: string): string {
  if (kind === "property-appraisal") return "المقيّم العقاري";
  if (kind === "engineering-survey") return "مكتب الهندسة";
  return "طرف";
}

export type ReturnPackageStatusTone = "gray" | "amber" | "teal";

export function returnPackageStatusBadge(status: string): {
  label: string;
  tone: ReturnPackageStatusTone;
} {
  switch (status) {
    case "submitted":
      return { label: "مُسلَّم", tone: "teal" };
    case "draft":
      return { label: "مسودة", tone: "amber" };
    case "reopened":
      return { label: "معاد للتصحيح", tone: "amber" };
    default:
      return { label: "لم يبدأ", tone: "gray" };
  }
}

/** What happens to a party that is ticked: its package reopens, or it is only told. */
export function returnImpactActionLabel(willBe: string): string {
  return willBe === "reopen" ? "إعادة فتح" : "إشعار";
}

export function returnPartyOutcomeLabel(outcome: string): string {
  switch (outcome) {
    case "reopened":
      return "أُعيد فتح حزمته";
    case "notified":
      return "أُشعر بالتعديل";
    case "already":
      return "حزمته مفتوحة أصلاً";
    case "skipped_deposited":
      return "المقيّم أودع تقريره — إشعار فقط حتى يُتاح إصدار نسخة جديدة";
    case "skipped_no_assignee":
      return "لا مكلّف على المهمة — لم يُشعَر أحد";
    default:
      return outcome;
  }
}

/** Outcomes that need the specialist's eye (nothing changed for that party). */
export function returnPartyOutcomeIsWarning(outcome: string): boolean {
  return outcome === "skipped_deposited" || outcome === "skipped_no_assignee";
}

export function returnInspectionSuccessMessage(
  result: ReturnInspectionResultDto,
): string {
  return result.studyReport.reopened
    ? "أُعيدت المعاينة للمعاين وأُعيد فتح تقرير دراسة الحالة"
    : "أُعيدت المعاينة للمعاين للتصحيح";
}
