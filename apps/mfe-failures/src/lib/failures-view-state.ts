import type { RoleId } from "@platform/types";
import { isSuperAdmin } from "@platform/app-shared/app-data/role-access";
import {
  isActiveFailureStatus,
  type FailureRecord,
} from "@platform/app-shared/failures/failures-types";
import { failureRecordTitle } from "./failures-labels";
import { isPartyScopedFailuresRole } from "./failures-party-raiser-scope";

/**
 * Pure decisions behind the failures queue screen (`FailuresView` and its
 * regions): who may act, the KPI counts, row titles, the resolve draft and
 * the busy keys. No React, no DOM.
 */

export function isCaseEditor(role: RoleId): boolean {
  return isSuperAdmin(role) || role === "case-specialist";
}

export function isSupervisor(role: RoleId): boolean {
  return isSuperAdmin(role) || role === "section-supervisor";
}

export function partyScopedFailuresEmptyLine(role: RoleId): string | null {
  switch (role) {
    case "engineering-office":
      return "لا توجد تعذرات — سجّل تعذراً من قائمة الرفع المساحي أو من تبويب التعذرات في المعاملة.";
    case "field-inspector":
      return "لا توجد تعذرات — سجّل تعذراً من قائمة المعاينة الميدانية أو من تبويب التعذرات في المعاملة.";
    case "real-estate-appraiser":
      return "لا توجد تعذرات — سجّل تعذراً من قائمة تقييم العقار أو من تبويب التعذرات في المعاملة.";
    case "government-reviewer":
      return "لا توجد تعذرات — سجّل تعذراً من تفاصيل المهمة في «المهام»، ثم تظهر هنا.";
    default:
      return null;
  }
}

export const FAILURES_DEFAULT_EMPTY_LINE =
  "لا توجد تعذرات — سجّل تعذراً من شاشة العقارات.";

/** Empty-queue message: the party-scoped hint when there is one, else the generic line. */
export function failuresEmptyLine(role: RoleId): string {
  return partyScopedFailuresEmptyLine(role) ?? FAILURES_DEFAULT_EMPTY_LINE;
}

/** The info note shown to roles that can only look at the queue. */
export function viewerModeNote(role: RoleId): string | null {
  if (isCaseEditor(role) || isSupervisor(role) || isPartyScopedFailuresRole(role)) {
    return null;
  }
  if (role === "general-manager") {
    return "أنت في وضع الاطلاع — صلاحية التعديل للمشرف والأخصائي";
  }
  if (role === "cdo") return "صلاحيات كاملة — يمكنك اعتماد التعذرات وإنشاؤها";
  return "أنت في وضع المراقبة — لا تملك صلاحية تعديل التعذرات";
}

export type FailuresKpiStats = {
  open: number;
  review: number;
  closed: number;
  total: number;
  closedPct: string;
};

/**
 * One pass computes all four badges — countOpenFailures was a second full pass
 * over the same array (js-combine-iterations). Whole set, not the page: there
 * is no /api/failures/counts endpoint (pagination-contract §5).
 */
export function failuresKpiStats(items: FailureRecord[]): FailuresKpiStats {
  let open = 0;
  let review = 0;
  let closed = 0;
  let total = 0;
  for (const f of items) {
    if (
      isActiveFailureStatus(f.status) &&
      (f.status === "internal" || f.status === "review" || f.status === "returned")
    ) {
      open += 1;
    }
    if (f.status === "review") review += 1;
    else if (f.status === "approved" || f.status === "resolved") closed += 1;
    if (f.status !== "suspended") total += 1;
  }
  return {
    open,
    review,
    closed,
    total,
    closedPct:
      total > 0 ? `${Math.round((closed / total) * 100)}% من الإجمالي` : "—",
  };
}

/** Work order → assignment specialist, from the case-study bridge records. */
export function assignmentSpecialistByPo(
  records: { poNumber: string; assignmentSpecialist?: string | null }[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const record of records) {
    const name = record.assignmentSpecialist?.trim();
    if (name) map.set(record.poNumber.trim(), name);
  }
  return map;
}

/** Row / card title: the deed with its «صك» prefix, else the failure title. */
export function failureRowTitle(f: FailureRecord): string {
  if (!f.deedNumber) return failureRecordTitle(f);
  return f.deedNumber.startsWith("صك") ? f.deedNumber : `صك ${f.deedNumber}`;
}

/** Card specialist: the assignment specialist of the work order, else the record's own. */
export function failureCardSpecialist(
  f: FailureRecord,
  specialistByPo: Map<string, string>,
): string {
  return (
    specialistByPo.get(f.poNumber.trim())?.trim() || f.specialist?.trim() || ""
  );
}

export type FailureCardTone = "done" | "pending" | "returned";

export function failureCardTone(f: FailureRecord): FailureCardTone {
  if (!isActiveFailureStatus(f.status)) return "done";
  return f.severity === "suspected" ? "pending" : "returned";
}

export type ResolveDraft = { reason: string; instructions: string };

export const EMPTY_RESOLVE_DRAFT: ResolveDraft = { reason: "", instructions: "" };

export function resolveDraftFor(
  drafts: Record<string, ResolveDraft>,
  id: string,
): ResolveDraft {
  return drafts[id] ?? EMPTY_RESOLVE_DRAFT;
}

export function patchResolveDraftMap(
  drafts: Record<string, ResolveDraft>,
  id: string,
  patch: Partial<ResolveDraft>,
): Record<string, ResolveDraft> {
  return { ...drafts, [id]: { ...resolveDraftFor(drafts, id), ...patch } };
}

export function isResolveDraftComplete(draft: ResolveDraft): boolean {
  return Boolean(draft.reason.trim() && draft.instructions.trim());
}

export type FailureActionPermissions = {
  active: boolean;
  canSpecialistAct: boolean;
  canSupervisorAct: boolean;
  canResolve: boolean;
};

export function failureActionPermissions(
  f: FailureRecord,
  viewer: { caseEditor: boolean; supervisor: boolean },
): FailureActionPermissions {
  const active = isActiveFailureStatus(f.status);
  const canSpecialistAct =
    viewer.caseEditor &&
    active &&
    (f.status === "internal" || f.status === "returned");
  const canSupervisorAct = viewer.supervisor && active && f.status === "review";
  // `status !== "approved"` is implied by canSpecialistAct; kept for parity with the screen's rule.
  const canResolve = canSpecialistAct && (f.status as string) !== "approved";
  return { active, canSpecialistAct, canSupervisorAct, canResolve };
}

export type FailureMetaRow = { label: string; value: string };

/** The label/value lines under the title in the expanded panel. */
export function failureMetaRows(
  f: FailureRecord,
  specialistByPo: Map<string, string>,
): FailureMetaRow[] {
  const rows: FailureMetaRow[] = [];
  if (f.internalNote?.trim()) {
    rows.push({ label: "ملاحظات", value: f.internalNote.trim() });
  }
  if (f.finalNote?.trim()) {
    rows.push({ label: "قرار المشرف", value: f.finalNote.trim() });
  }
  if (f.resolutionReason?.trim()) {
    rows.push({ label: "سبب الحل", value: f.resolutionReason.trim() });
  }
  if (f.continueInstructions?.trim()) {
    rows.push({
      label: "توجيه استمرار العمل",
      value: f.continueInstructions.trim(),
    });
  }
  if (f.status === "review") {
    rows.push({
      label: "أخصائي الإسناد",
      value: specialistByPo.get(f.poNumber.trim()) || "—",
    });
  }
  return rows;
}

export type FailureAction =
  | "submit"
  | "upgrade"
  | "approve"
  | "return"
  | "suspend"
  | "resolve";

/** `failureId:action` — the key that shows a spinner on that one button. */
export function failureBusyKey(id: string, action: FailureAction): string {
  return `${id}:${action}`;
}

/** True while any action of that failure is in flight. */
export function isFailureBusy(busyKey: string | null, id: string): boolean {
  return Boolean(busyKey?.startsWith(`${id}:`));
}

/** Where the screen goes after a resolve — the bourse inquiry for unknown boundaries. */
export function resolvedFailureRedirect(
  f: Pick<FailureRecord, "problemTypeId"> | undefined,
): string | null {
  return f?.problemTypeId === "unknown-boundaries" ? "/bourse-inquiry" : null;
}
