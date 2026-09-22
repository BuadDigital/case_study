import type { CaseStudyFormDto } from "@platform/api-client";
import { todayIso } from "@platform/app-shared/format/date";

export type CaseStudyFormAnswer = "A" | "B" | "NA";

export type SaveCaseStudyFormDraftResult =
  | { ok: true; draft: CaseStudyFormDraft }
  | { ok: false; error: string };

export type CaseStudyFormStatus = "new" | "draft" | "submitted";

export type CaseStudyMeterType = "" | "electronic" | "analog" | "none";

export type CaseStudyAnswerProvenanceEntry = {
  value?: string | null;
  sourcePartyId?: string | null;
  sourceRole?: string | null;
  matrixRole?: string | null;
  workflowTaskId: string;
  formId?: string | null;
  answeredByUserId?: string | null;
  answeredByName?: string | null;
  answeredAtUtc: string;
};

/** Nested inside `answers` JSON so notes persist without a schema migration. */
export const CASE_STUDY_ANSWER_NOTES_KEY = "__answerNotes";

function isFormAnswer(value: unknown): value is CaseStudyFormAnswer {
  return value === "A" || value === "B" || value === "NA";
}

export function splitCaseStudyAnswersPayload(
  raw: Record<string, unknown> | null | undefined,
): {
  answers: Record<string, CaseStudyFormAnswer | null>;
  answerNotes: Record<string, string>;
} {
  const answers: Record<string, CaseStudyFormAnswer | null> = {};
  const answerNotes: Record<string, string> = {};
  if (!raw) return { answers, answerNotes };

  for (const [key, value] of Object.entries(raw)) {
    if (key === CASE_STUDY_ANSWER_NOTES_KEY) {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        for (const [noteKey, noteValue] of Object.entries(
          value as Record<string, unknown>,
        )) {
          if (typeof noteValue === "string" && noteValue.trim()) {
            answerNotes[noteKey] = noteValue;
          }
        }
      }
      continue;
    }
    if (isFormAnswer(value) || value === null) {
      answers[key] = value;
    }
  }
  return { answers, answerNotes };
}

export function mergeCaseStudyAnswersPayload(
  answers: Record<string, CaseStudyFormAnswer | null>,
  answerNotes: Record<string, string> | undefined,
): Record<string, unknown> {
  const notes: Record<string, string> = {};
  for (const [key, value] of Object.entries(answerNotes ?? {})) {
    const trimmed = value.trim();
    if (trimmed) notes[key] = value;
  }
  return Object.keys(notes).length > 0
    ? { ...answers, [CASE_STUDY_ANSWER_NOTES_KEY]: notes }
    : { ...answers };
}

export type CaseStudyFormDraft = {
  taskId: string;
  propertyId?: string;
  poNumber?: string;
  status: CaseStudyFormStatus;
  currentStep: number;
  requestNumber: string;
  requestDate: string;
  deedNumber: string;
  answers: Record<string, CaseStudyFormAnswer | null>;
  /** Per-question notes — opened from the row check in the study table. */
  answerNotes?: Record<string, string>;
  deedRemarks: string;
  surveyRemarks: string;
  componentsRemarks: string;
  occupancyRemarks: string;
  meterType: CaseStudyMeterType;
  meterNumber: string;
  hoaFee: string;
  sigDeed: string;
  sigApprover: string;
  sigDate: string;
  /** Specialist approval after reviewing party answers — questionKey → true */
  specialistReviewApproved?: Record<string, boolean>;
  /** Infath package fields — specialist */
  infathLinkedAssets?: "" | "yes" | "no";
  infathLinkedDeedNumbers?: string;
  infathLinkedAssetsNotes?: string;
  infathOtherNotes?: string;
  infathClosingNotes?: string;
  /** matched | differences | impediment | "" */
  deedNatureMatchOutcome?: string;
  deedNatureMatchNotes?: string;
  savedAtUtc?: string;
  answerProvenance?: Record<string, CaseStudyAnswerProvenanceEntry>;
};

export function caseStudyFormDtoToDraft(dto: CaseStudyFormDto): CaseStudyFormDraft {
  const { answers, answerNotes } = splitCaseStudyAnswersPayload(
    dto.answers as Record<string, unknown>,
  );
  return {
    taskId: dto.taskId,
    propertyId: dto.propertyId,
    poNumber: dto.poNumber,
    status: dto.status as CaseStudyFormStatus,
    currentStep: dto.currentStep,
    requestNumber: dto.requestNumber,
    requestDate: dto.requestDate,
    deedNumber: dto.deedNumber,
    answers,
    answerNotes,
    deedRemarks: dto.deedRemarks,
    surveyRemarks: dto.surveyRemarks,
    componentsRemarks: dto.componentsRemarks,
    occupancyRemarks: dto.occupancyRemarks,
    meterType: (dto.meterType || "") as CaseStudyMeterType,
    meterNumber: dto.meterNumber,
    hoaFee: dto.hoaFee,
    sigDeed: dto.sigDeed,
    sigApprover: dto.sigApprover,
    sigDate: dto.sigDate,
    specialistReviewApproved: dto.specialistReviewApproved,
    infathLinkedAssets: (dto.infathLinkedAssets || "") as CaseStudyFormDraft["infathLinkedAssets"],
    infathLinkedDeedNumbers: dto.infathLinkedDeedNumbers ?? "",
    infathLinkedAssetsNotes: dto.infathLinkedAssetsNotes ?? "",
    infathOtherNotes: dto.infathOtherNotes ?? "",
    infathClosingNotes: dto.infathClosingNotes ?? "",
    deedNatureMatchOutcome: dto.deedNatureMatchOutcome ?? "",
    deedNatureMatchNotes: dto.deedNatureMatchNotes ?? "",
    savedAtUtc: dto.savedAtUtc,
    answerProvenance: dto.answerProvenance as
      | Record<string, CaseStudyAnswerProvenanceEntry>
      | undefined,
  };
}

export function caseStudyFormDraftToDto(draft: CaseStudyFormDraft): CaseStudyFormDto {
  return {
    taskId: draft.taskId,
    propertyId: draft.propertyId,
    poNumber: draft.poNumber,
    status: draft.status,
    currentStep: draft.currentStep,
    requestNumber: draft.requestNumber,
    requestDate: draft.requestDate,
    deedNumber: draft.deedNumber,
    answers: mergeCaseStudyAnswersPayload(draft.answers, draft.answerNotes),
    deedRemarks: draft.deedRemarks,
    surveyRemarks: draft.surveyRemarks,
    componentsRemarks: draft.componentsRemarks,
    occupancyRemarks: draft.occupancyRemarks,
    meterType: draft.meterType,
    meterNumber: draft.meterNumber,
    hoaFee: draft.hoaFee,
    sigDeed: draft.sigDeed,
    sigApprover: draft.sigApprover,
    sigDate: draft.sigDate,
    specialistReviewApproved: draft.specialistReviewApproved,
    infathLinkedAssets: draft.infathLinkedAssets ?? "",
    infathLinkedDeedNumbers: draft.infathLinkedDeedNumbers ?? "",
    infathLinkedAssetsNotes: draft.infathLinkedAssetsNotes ?? "",
    infathOtherNotes: draft.infathOtherNotes ?? "",
    infathClosingNotes: draft.infathClosingNotes ?? "",
    deedNatureMatchOutcome: draft.deedNatureMatchOutcome ?? "",
    deedNatureMatchNotes: draft.deedNatureMatchNotes ?? "",
    savedAtUtc: draft.savedAtUtc,
  };
}

export function emptyCaseStudyFormDraft(
  taskId: string,
  seed?: Partial<
    Pick<
      CaseStudyFormDraft,
      | "requestNumber"
      | "requestDate"
      | "deedNumber"
      | "propertyId"
      | "poNumber"
      | "sigDeed"
    >
  >,
): CaseStudyFormDraft {
  const today = todayIso();
  return {
    taskId,
    propertyId: seed?.propertyId,
    poNumber: seed?.poNumber,
    status: "new",
    currentStep: 0,
    requestNumber: seed?.requestNumber ?? "",
    requestDate: seed?.requestDate ?? today,
    deedNumber: seed?.deedNumber ?? "",
    answers: {},
    answerNotes: {},
    deedRemarks: "",
    surveyRemarks: "",
    componentsRemarks: "",
    occupancyRemarks: "",
    meterType: "",
    meterNumber: "",
    hoaFee: "",
    sigDeed: seed?.sigDeed ?? seed?.deedNumber ?? "",
    sigApprover: "",
    sigDate: today,
    specialistReviewApproved: {},
    infathLinkedAssets: "",
    infathLinkedDeedNumbers: "",
    infathLinkedAssetsNotes: "",
    infathOtherNotes: "",
    infathClosingNotes: "",
    deedNatureMatchOutcome: "",
    deedNatureMatchNotes: "",
  };
}

export const PARTY_CASE_STUDY_FORM_CHANGED_EVENT =
  "party-case-study-form-changed";

export function notifyPartyCaseStudyFormChanged(taskId: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(PARTY_CASE_STUDY_FORM_CHANGED_EVENT, {
      detail: { taskId },
    }),
  );
}
