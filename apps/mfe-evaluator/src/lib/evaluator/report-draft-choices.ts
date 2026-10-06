import type { ValuationReportDraftDto } from "@platform/api-client";
import {
  emptyReportChoices,
  normalizeReportChoices,
  type EvaluatorReportChoices,
  type EvaluatorSubmission,
} from "./evaluator-window-data";

/**
 * The report choices the case specialist owns (the print attachments, their order and slots). Mirrors the
 * server's allow-list (`ReportDraftChoiceRules.AllowedKeys`): the specialist's copy overlays the appraiser's
 * own `reportChoices` when the report is rendered; every other choice — ESG included — stays the appraiser's.
 */
export const SPECIALIST_REPORT_CHOICE_KEYS = [
  "printAttachmentKeys",
  "printAttachmentOrder",
  "printAttachmentDocIds",
  "reportSlotAssignments",
  "reportSlotFrames",
] as const satisfies readonly (keyof EvaluatorReportChoices)[];

export type SpecialistReportChoices = Pick<
  EvaluatorReportChoices,
  (typeof SPECIALIST_REPORT_CHOICE_KEYS)[number]
>;

/** Only the specialist-owned keys of a choices object (what is posted / seeded). */
export function pickSpecialistChoices(
  choices: EvaluatorReportChoices | null | undefined,
): SpecialistReportChoices {
  const source = choices ?? emptyReportChoices();
  const picked: Record<string, unknown> = {};
  for (const key of SPECIALIST_REPORT_CHOICE_KEYS) picked[key] = source[key];
  return picked as SpecialistReportChoices;
}

/** The overlay the draft carries, reduced to the allow-listed keys that are present. */
export function overlayFromDraft(
  draft: Pick<ValuationReportDraftDto, "specialistChoices"> | null | undefined,
): Partial<SpecialistReportChoices> | null {
  const raw = draft?.specialistChoices;
  if (!raw || typeof raw !== "object") return null;
  const overlay: Record<string, unknown> = {};
  for (const key of SPECIALIST_REPORT_CHOICE_KEYS) {
    if (key in raw) overlay[key] = (raw as Record<string, unknown>)[key];
  }
  return Object.keys(overlay).length > 0
    ? (overlay as Partial<SpecialistReportChoices>)
    : null;
}

/**
 * The appraiser's submission with the specialist's choices laid over his report choices. Only keys the
 * specialist actually saved overlay; an absent draft or an empty overlay returns the submission untouched.
 */
export function applyReportDraftChoices(
  submission: EvaluatorSubmission,
  overlay: Partial<SpecialistReportChoices> | null | undefined,
): EvaluatorSubmission {
  if (!overlay) return submission;
  return {
    ...submission,
    reportChoices: normalizeReportChoices({
      ...(submission.reportChoices ?? emptyReportChoices()),
      ...overlay,
    }),
  };
}

/** The date printed as «تاريخ التقرير»: the approved date once the appraiser approved, else the draft's own. */
export function reportDateForPrint(
  submission: Pick<EvaluatorSubmission, "appraisalDate" | "reportIssueDate">,
  draft: Pick<ValuationReportDraftDto, "status" | "reportDate"> | null | undefined,
): string {
  if (draft?.status === "approved" && draft.reportDate?.trim()) {
    return draft.reportDate.trim();
  }
  return submission.appraisalDate || submission.reportIssueDate;
}

/** The report number printed on the report: a new version (n+1) keeps the number and adds «نسخة n». */
export function versionedReportNo(
  reportNo: string | null | undefined,
  version: number | null | undefined,
): string {
  const base = (reportNo ?? "").trim();
  return base && version != null && version > 1 ? `${base} نسخة ${version}` : base;
}

/** The deposit code printed on the report: the one recorded with the deposit copy — nowhere else keeps it. */
export function depositCodeForPrint(
  recorded: Pick<ValuationReportDraftDto, "depositCode"> | null | undefined,
): string {
  return (recorded?.depositCode ?? "").trim();
}
