/**
 * «رفع مساحي» in «مهمة جديدة» (Omar 2026-11-11): which transaction the chosen deed points at, and
 * whether the engineering office may be added to it. Pure — the modal feeds it the lists it has.
 */
import { surveyNotRequiredReason, type WorkflowTask } from "../lib/app-data/tasks-model";
import {
  formatPropertyDeedDisplay,
  type PoIntakeRecord,
} from "../lib/app-data/po-intake-data";

export const SURVEY_PICK_DEED_AR = "اختر أمر العمل والصك";
export const SURVEY_DEED_NOT_FOUND_AR = "الصك غير موجود في أمر العمل";
export const SURVEY_NO_STUDY_TASK_AR = "لا توجد معاملة دراسة حالة لهذا الصك";
// The office is added while the transaction is in the study phase only — each refusal says which
// side of it the transaction is on (one sentence for all of them read as a riddle, Omar 2026-11-11).
export const SURVEY_BEFORE_DISTRIBUTION_AR =
  "المعاملة لم تُوزَّع بعد — يُختار المكتب الهندسي عند التوزيع، أو يُضاف من هنا بعد تأكيده";
export const SURVEY_OBSTRUCTED_AR =
  "المعاملة متعذّرة بانتظار المشرف — يُضاف المكتب الهندسي بعد رفع التعذّر";
export const SURVEY_AFTER_REPORT_AR =
  "صدر تقرير دراسة الحالة لهذه المعاملة — أعد فتح التقرير أولاً ثم أضف المكتب الهندسي";

function phaseRefusal(phase: WorkflowTask["phase"]): string {
  if (phase === "obstruction") return SURVEY_OBSTRUCTED_AR;
  return phase === "done" ? SURVEY_AFTER_REPORT_AR : SURVEY_BEFORE_DISTRIBUTION_AR;
}
// The server's words: an open survey and a delivered one both count — only a cancelled one does not.
export const SURVEY_ALREADY_LIVE_AR = "يوجد رفع مساحي على هذا العقار";
export const SURVEY_EXCEPTION_REASON_REQUIRED_AR = "اذكر سبب طلب الرفع المساحي";

export type EngineeringSurveyTarget =
  | {
      ok: true;
      parentTaskId: string;
      /**
       * Why the survey rule asks no survey for this property — the office is then added by
       * exception and a reason is required; null when the rule asks for one.
       */
      outsideRule: string | null;
    }
  | { ok: false; error: string };

/**
 * The case-study task the survey is added to, or why it cannot be added.
 *
 * How it works: the deed is matched as the form lists it (its display, else its number) inside the
 * chosen work order; the transaction is that property's case-study task; the office may be added
 * while the transaction is in the study phase and no survey is live. A property the survey rule asks
 * no survey for (registered title, approved plan, unit inside a building) is not refused: the answer
 * carries the rule's reason in `outsideRule`, and the form asks why the survey is wanted.
 * The server applies the same checks (`AddEngineeringSurveyAsync`) — this only says them beforehand.
 *
 * Edge cases: a removed property is not offered; a cancelled survey (the office was skipped) does
 * not count as live, so the office can be added again.
 */
export function engineeringSurveyTarget(input: {
  poRecords: PoIntakeRecord[];
  tasks: WorkflowTask[];
  poNumber: string;
  deed: string;
}): EngineeringSurveyTarget {
  const po = input.poNumber.trim();
  const deed = input.deed.trim();
  if (!po || !deed) return { ok: false, error: SURVEY_PICK_DEED_AR };

  const property = input.poRecords
    .find((r) => r.poNumber.trim() === po)
    ?.properties.find(
      (p) => !p.isRemoved && (formatPropertyDeedDisplay(p) || p.deedNumber.trim()) === deed,
    );
  if (!property) return { ok: false, error: SURVEY_DEED_NOT_FOUND_AR };

  const studies = input.tasks.filter(
    (t) =>
      t.kind === "case-study-property" &&
      t.propertyId === property.id &&
      t.status !== "cancelled",
  );
  const parent = studies.find((t) => t.phase === "case-study") ?? studies[0];
  if (!parent) return { ok: false, error: SURVEY_NO_STUDY_TASK_AR };
  if (parent.phase !== "case-study") return { ok: false, error: phaseRefusal(parent.phase) };

  const live = input.tasks.some(
    (t) =>
      t.kind === "engineering-survey" &&
      t.parentTaskId === parent.id &&
      t.status !== "cancelled",
  );
  if (live) return { ok: false, error: SURVEY_ALREADY_LIVE_AR };

  return { ok: true, parentTaskId: parent.id, outsideRule: surveyNotRequiredReason(property) };
}
