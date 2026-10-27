import type { RoleId } from "@platform/types";
import { isSuperAdmin } from "@platform/app-shared/app-data/role-access";
import {
  isActiveFailureStatus,
  type FailureRecord,
} from "@platform/app-shared/failures/failures-types";
import { failureRecordTitle } from "./failures-labels";
import type { FailuresTab } from "./failures-list-page";
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
      return "لا توجد تعذّرات — سجّل تعذّراً من قائمة الرفع المساحي أو من تبويب التعذّرات في المعاملة.";
    case "field-inspector":
      return "لا توجد تعذّرات — سجّل تعذّراً من قائمة المعاينة الميدانية أو من تبويب التعذّرات في المعاملة.";
    case "real-estate-appraiser":
      return "لا توجد تعذّرات — سجّل تعذّراً من قائمة تقييم العقار أو من تبويب التعذّرات في المعاملة.";
    case "government-reviewer":
      return "لا توجد تعذّرات — سجّل تعذّراً من تفاصيل المهمة في «المهام»، ثم تظهر هنا.";
    default:
      return null;
  }
}

export const FAILURES_DEFAULT_EMPTY_LINE =
  "لا توجد تعذّرات — سجّل تعذّراً من شاشة العقارات.";

/**
 * Empty-tab message. «التعذّرات» has its own line; on «تحتاج إجراء» the supervisor reads
 * that nothing is escalated, a party role its raising hint, everyone else the generic line.
 *
 * How it works: the tab decides first, then the role. Edge cases: `tab` defaults to «تحتاج
 * إجراء» so callers from before the tabs keep their old line; the supervisor's line exists
 * because his tab holds only escalated failures, and the generic «سجّل تعذّراً» hint was wrong
 * for him.
 */
export function failuresEmptyLine(role: RoleId, tab: FailuresTab = "action"): string {
  if (tab === "final") return "لا توجد تعذّرات نهائية.";
  if (role === "section-supervisor") return "لا توجد تعذّرات مصعّدة بانتظار اعتمادك.";
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
  if (role === "cdo") return "صلاحيات كاملة — يمكنك اعتماد التعذّرات وإنشاؤها";
  return "أنت في وضع المراقبة — لا تملك صلاحية تعديل التعذّرات";
}

export type FailuresKpiStats = {
  /** With the specialist: possible / internal failures and the ones returned to them. */
  withSpecialist: number;
  /** Escalated, waiting for the supervisor's approval. */
  review: number;
  /** Final failures (approved) — the «التعذّرات» tab. */
  final: number;
};

/**
 * One pass computes the three badges. Whole set, not the page: there is no
 * /api/failures/counts endpoint (see the pagination contract). Resolved and suspended
 * failures are on no tab, so they count nowhere.
 *
 * How it works: `internal` (possible or internal) and `returned` count as «عند الأخصائي»,
 * `review` as «قيد المراجعة», `approved` as «تعذّرات نهائية».
 *
 * Edge cases: the three counters are the same for every role (only the items differ for party
 * roles), so the supervisor reads his own work in «قيد المراجعة» and the specialist his in the
 * first cell. The old «الإجمالي» and «معتمدة / تم الحل» cells were dropped with the tabs — they
 * counted resolved failures the screen no longer shows.
 */
export function failuresKpiStats(items: FailureRecord[]): FailuresKpiStats {
  let withSpecialist = 0;
  let review = 0;
  let final = 0;
  for (const f of items) {
    if (f.status === "internal" || f.status === "returned") withSpecialist += 1;
    else if (f.status === "review") review += 1;
    else if (f.status === "approved") final += 1;
  }
  return { withSpecialist, review, final };
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

/** Mobile card title: the deed with its «صك» prefix, else the failure title. */
export function failureRowTitle(f: FailureRecord): string {
  if (!f.deedNumber) return failureRecordTitle(f);
  return f.deedNumber.startsWith("صك") ? f.deedNumber : `صك ${f.deedNumber}`;
}

/**
 * Table cell under «رقم الصك/التسجيل العيني»: the bare number (a stored «صك» prefix dropped), else «—».
 *
 * How it works: trims, removes a leading «صك» with any spaces after it, falls back to «—».
 *
 * Edge cases: the cell used to reuse `failureRowTitle`, which added «صك» before the number (wrong
 * for a registration number under a header that already names it) and printed the problem type
 * when there was no deed — under a deed-number header. The phone card keeps `failureRowTitle`,
 * since a card has no column header to say what the number is.
 */
export function failureDeedCell(f: Pick<FailureRecord, "deedNumber">): string {
  return (f.deedNumber ?? "").trim().replace(/^صك\s*/, "") || "—";
}

/**
 * «الأخصائي» on a failure (table cell and phone card alike): the company's case specialist
 * assigned to the deed, "" until one is. Not the work order's `assignmentSpecialist` — that is
 * Enfaz's «أخصائي الإسناد».
 *
 * How it works: reads `caseSpecialistName`, which the failures API fills from the deed's
 * case-study task assignee.
 *
 * Edge cases: the table once showed the name stored on the record when it was raised (often a
 * role label such as «النظام» or the inspector), and the phone card the work order's
 * `assignmentSpecialist` — two different people for one failure, and the second was Enfaz's.
 * Both now read this one field; "" renders «—».
 */
export function failureSpecialistName(f: Pick<FailureRecord, "caseSpecialistName">): string {
  return f.caseSpecialistName?.trim() || "";
}

type FailureCardTone = "done" | "pending" | "returned";

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

type FailureActionPermissions = {
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

type FailureMetaRow = { label: string; value: string };

/**
 * The label/value lines under the title in the expanded panel.
 *
 * How it works: each non-blank note becomes a row in the order the failure lived them — raise
 * note, «سبب التصعيد», «قرار المشرف», the resolve pair — then, while under review, Enfaz's
 * «أخصائي الإسناد» the supervisor consults.
 *
 * Edge cases: «سبب التصعيد» was added with the required escalation note; failures escalated
 * before it carry none and simply show no row.
 */
export function failureMetaRows(
  f: FailureRecord,
  specialistByPo: Map<string, string>,
): FailureMetaRow[] {
  const rows: FailureMetaRow[] = [];
  if (f.internalNote?.trim()) {
    rows.push({ label: "ملاحظات", value: f.internalNote.trim() });
  }
  if (f.escalationNote?.trim()) {
    rows.push({ label: "سبب التصعيد", value: f.escalationNote.trim() });
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

type FailureAction =
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
