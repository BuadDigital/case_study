import {
  DEFAULT_CASE_STUDY_QUESTION_CATALOG,
  type CaseStudyQuestionCatalog,
} from "@platform/app-shared/domain/case-study/question-catalog";
import {
  caseStudyProviderName,
  caseStudyApproverName,
  CASE_STUDY_REPORT_TITLE,
  CASE_STUDY_TABLE_HEADERS,
  caseStudyAnswerKey,
  type CaseStudyReportAnswer,
  type CaseStudyQuestionSection,
} from "./case-study-report-data";
import type { CaseStudyReportDraft } from "./case-study-report-model";
import {
  formatDateAr,
  formatPoDisplay,
  formatPropertyDeedDisplay,
  formatPropertyLocation,
  formatPropertyTypeLine,
  type PoIntakeRecord,
  type PoPropertyIntake,
} from "./po-intake-data";
import type { WorkflowTask } from "./tasks";
import { fmtMax, parseLocaleNumber } from "@platform/app-shared/format/number";

type CaseStudyReportQuestionRow = {
  question: string;
  colAHeader: string;
  colBHeader: string;
  colNaHeader: string;
  markA: boolean;
  markB: boolean;
  markNa: boolean;
  note?: string;
};

export type CaseStudyReportSection = {
  id: CaseStudyQuestionSection;
  title: string;
  colAHeader: string;
  colBHeader: string;
  colNaHeader: string;
  rows: CaseStudyReportQuestionRow[];
  remarks?: string;
  /** Extra lines below the table (meter, HOA, etc.) */
  extras?: string[];
};

type CaseStudyReportApproval = {
  providerName: string;
  declarationText: string;
  deedNumber: string;
  approverName: string;
  reportDate: string;
  reportDateIso: string;
  requestNumber: string;
};

/** One deed of a linked property (decision 2026-10-19) as the report prints it. */
export type CaseStudyReportDeedRow = {
  propertyId: string;
  /** Deed number, or the registry number when the deed is identified by one. */
  label: string;
  poNumber: string;
  /** Area as entered on the deed; "—" when unknown. */
  area: string;
};

export type CaseStudyReportDeeds = {
  rows: CaseStudyReportDeedRow[];
  /** Sum of the deed areas in m², formatted; "—" when any area is missing. */
  totalArea: string;
};

export type CaseStudyReportModel = {
  title: string;
  providerName: string;
  requestNumber: string;
  requestDate: string;
  requestDateIso: string;
  deedNumber: string;
  /** Assignment specialist from Infath (e.g. Saad Muharib) — header display only. */
  assignmentSpecialist: string;
  propertyLocation: string;
  propertyType: string;
  sections: CaseStudyReportSection[];
  approval: CaseStudyReportApproval;
  /**
   * Phase 4: the deeds of a transaction with several — one study covers them all, so the
   * report lists every deed and the total area. Absent for an ordinary one-deed property.
   */
  deeds?: CaseStudyReportDeeds;
};

/** The deeds table input: what the transaction endpoint returns per deed. */
export type CaseStudyReportDeedSource = {
  propertyId: string;
  poNumber: string;
  identifierType?: string;
  deedNumber: string;
  realEstateRegNumber?: string | null;
  area?: string | null;
  isRemoved?: boolean;
};

/**
 * The deeds block the case-study report prints for a transaction with several deeds
 * (phase 4, decision 2026-10-19: one study covers every deed).
 *
 * How it works: 1) drops removed deeds; 2) fewer than two left → `undefined`; 3) one row per
 * deed: label = the registry number when the deed is identified by one, else the deed number
 * (then the registry number, then «—»), the formatted work order, the area as entered or «—»;
 * 4) parses every area with `parseLocaleNumber` (Arabic digits and commas allowed) and prints
 * the sum with up to two decimals and «م²».
 *
 * Edge cases: one deed → `undefined`, so the report reads as it always has; any area missing or
 * unreadable → total «—» rather than a partial sum.
 */
export function caseStudyReportDeeds(
  deeds: readonly CaseStudyReportDeedSource[] | null | undefined,
): CaseStudyReportDeeds | undefined {
  const live = (deeds ?? []).filter((d) => !d.isRemoved);
  if (live.length < 2) return undefined;
  const rows: CaseStudyReportDeedRow[] = live.map((d) => {
    const registry = d.realEstateRegNumber?.trim();
    const label =
      d.identifierType === "real_estate_reg" && registry
        ? registry
        : d.deedNumber.trim() || registry || "—";
    return {
      propertyId: d.propertyId,
      label,
      poNumber: d.poNumber.trim() ? formatPoDisplay(d.poNumber) : "—",
      area: d.area?.trim() || "—",
    };
  });
  const areas = live.map((d) => parseLocaleNumber(d.area ?? ""));
  const totalArea = areas.every((a) => Number.isFinite(a))
    ? `${fmtMax(areas.reduce((sum, a) => sum + a, 0), 2)} م²`
    : "—";
  return { rows, totalArea };
}

const SECTION_TITLES: Record<CaseStudyQuestionSection, string> = {
  deed: "بيانات الصك والعقار",
  survey: "الرفع المساحي والطبيعة",
  comp: "مكونات العقار",
  occ: "الإشغال والإيجار",
  extra: "ملاحظات إضافية",
};

const METER_LABELS: Record<string, string> = {
  electronic: "إلكتروني",
  analog: "مؤرشف",
  none: "لا يوجد",
};

function resolveRequestDateIso(
  poRecord: Pick<
    PoIntakeRecord,
    "receivedFromEnfathAt" | "promulgationDate"
  > | null | undefined,
  draft: CaseStudyReportDraft,
): string {
  return (
    poRecord?.receivedFromEnfathAt?.slice(0, 10) ||
    poRecord?.promulgationDate?.slice(0, 10) ||
    draft.requestDate?.slice(0, 10) ||
    ""
  );
}

/**
 * The approval block at the foot of the case-study report (provider, declaration, deed,
 * approver, report date, request number).
 *
 * How it works: deed = every deed label joined with « ، » when `deeds` is given (a transaction
 * with several deeds), else the property's deed display, else the draft's deed number or «—»;
 * request number = the task's work order, else the draft's; report date from
 * `resolveRequestDateIso`.
 *
 * Edge cases: phase 4 (decision 2026-10-19) — the study is one for the whole transaction, so the
 * approval names all its deeds, not only the deed the workspace was opened on.
 */
function buildCaseStudyReportApproval(
  task: WorkflowTask,
  property: PoPropertyIntake | null,
  poRecord: Pick<
    PoIntakeRecord,
    "assignmentSpecialist" | "receivedFromEnfathAt" | "promulgationDate"
  > | null | undefined,
  draft: CaseStudyReportDraft,
  deeds: CaseStudyReportDeeds | undefined,
): CaseStudyReportApproval {
  // Several deeds: the report names them all — the study is one for the whole property.
  const deedNumber = deeds
    ? deeds.rows.map((d) => d.label).join(" ، ")
    : property
      ? formatPropertyDeedDisplay(property)
      : draft.deedNumber.trim() || "—";
  const requestNumber = task.poNumber.trim()
    ? formatPoDisplay(task.poNumber)
    : draft.requestNumber.trim() || "—";
  const reportDateIso = resolveRequestDateIso(poRecord, draft);

  return {
    providerName: caseStudyProviderName(),
    declarationText: `نقر ${caseStudyProviderName()} بصحة ما ورد في التقرير أعلاه مع تحمل كافة المسؤولية نحو ذلك.`,
    deedNumber,
    approverName: caseStudyApproverName(),
    reportDate: reportDateIso ? formatDateAr(reportDateIso) : "—",
    reportDateIso,
    requestNumber,
  };
}

function buildSectionRows(
  section: CaseStudyQuestionSection,
  answers: Record<string, CaseStudyReportAnswer | null>,
  sectionQuestions: CaseStudyQuestionCatalog["sectionQuestions"],
  answerNotes?: Record<string, string>,
): CaseStudyReportQuestionRow[] {
  const headers = CASE_STUDY_TABLE_HEADERS[section];
  const questions = sectionQuestions[section];
  return questions.map((question, i) => {
    const key = caseStudyAnswerKey(section, i);
    const val = answers[key] ?? null;
    const note = answerNotes?.[key]?.trim() || undefined;
    return {
      question,
      colAHeader: headers.colA,
      colBHeader: headers.colB,
      colNaHeader: headers.colNa,
      markA: val === "A",
      markB: val === "B",
      markNa: val === "NA",
      note,
    };
  });
}

function meterExtras(draft: CaseStudyReportDraft): string[] {
  const lines: string[] = [];
  const meterLabel = draft.meterType
    ? METER_LABELS[draft.meterType] ?? draft.meterType
    : "";
  const meterNum = draft.meterNumber.trim();
  if (meterLabel || meterNum) {
    const numPart = meterNum ? meterNum : "—";
    lines.push(
      `عداد الكهرباء رقم (${numPart})${meterLabel ? ` — ${meterLabel}` : ""}`,
    );
  }
  return lines;
}

export function buildCaseStudyReportModel(
  draft: CaseStudyReportDraft,
  property: PoPropertyIntake | null,
  task: WorkflowTask,
  poRecord: Pick<
    PoIntakeRecord,
    | "assignmentSpecialist"
    | "receivedFromEnfathAt"
    | "promulgationDate"
  > | null | undefined,
  catalog: CaseStudyQuestionCatalog = DEFAULT_CASE_STUDY_QUESTION_CATALOG,
  deeds?: CaseStudyReportDeeds,
): CaseStudyReportModel {
  const requestDateIso = resolveRequestDateIso(poRecord, draft);
  const approval = buildCaseStudyReportApproval(
    task,
    property,
    poRecord,
    draft,
    deeds,
  );
  const assignmentSpecialist =
    poRecord?.assignmentSpecialist?.trim() || "—";

  const sections: CaseStudyReportSection[] = (
    Object.keys(SECTION_TITLES) as CaseStudyQuestionSection[]
  ).map((id) => {
    const headers = CASE_STUDY_TABLE_HEADERS[id];
    const section: CaseStudyReportSection = {
      id,
      title: SECTION_TITLES[id],
      colAHeader: headers.colA,
      colBHeader: headers.colB,
      colNaHeader: headers.colNa,
      rows: buildSectionRows(
        id,
        draft.answers,
        catalog.sectionQuestions,
        draft.answerNotes,
      ),
    };

    if (id === "deed" && draft.deedRemarks.trim()) {
      section.remarks = draft.deedRemarks.trim();
    }
    if (id === "survey" && draft.surveyRemarks.trim()) {
      section.remarks = draft.surveyRemarks.trim();
    }
    if (id === "comp") {
      section.extras = meterExtras(draft);
      if (draft.componentsRemarks.trim()) {
        section.remarks = draft.componentsRemarks.trim();
      }
    }
    if (id === "occ") {
      const occExtras: string[] = [];
      if (draft.hoaFee.trim()) {
        occExtras.push(
          `قيمة اشتراك اتحاد الملاك: ${draft.hoaFee.trim()} ر.س`,
        );
      }
      section.extras = occExtras;
      if (draft.occupancyRemarks.trim()) {
        section.remarks = draft.occupancyRemarks.trim();
      }
    }

    return section;
  });

  return {
    title: CASE_STUDY_REPORT_TITLE,
    providerName: caseStudyProviderName(),
    requestNumber: approval.requestNumber,
    requestDate: requestDateIso ? formatDateAr(requestDateIso) : "—",
    requestDateIso,
    deedNumber: approval.deedNumber,
    assignmentSpecialist,
    propertyLocation: property ? formatPropertyLocation(property) : "",
    propertyType: property ? formatPropertyTypeLine(property) : "",
    sections,
    approval,
    deeds,
  };
}
