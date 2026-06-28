import {
  CASE_STUDY_PROVIDER_NAME,
  CASE_STUDY_REPORT_APPROVER_NAME,
  CASE_STUDY_REPORT_TITLE,
  CASE_STUDY_SECTION_QUESTIONS,
  CASE_STUDY_TABLE_HEADERS,
  caseStudyAnswerKey,
  type CaseStudyFormAnswer,
  type CaseStudyQuestionSection,
} from "./case-study-form-data";
import type { CaseStudyFormDraft } from "./case-study-form-storage";
import {
  formatDateAr,
  formatPoDisplay,
  formatPropertyDeedDisplay,
  formatPropertyLocation,
  formatPropertyTypeLine,
  type PoIntakeRecord,
  type PoPropertyIntake,
} from "./po-intake-data";
import type { WorkflowTask } from "./tasks-storage";

export type CaseStudyReportQuestionRow = {
  question: string;
  colAHeader: string;
  colBHeader: string;
  markA: boolean;
  markB: boolean;
};

export type CaseStudyReportSection = {
  id: CaseStudyQuestionSection;
  title: string;
  colAHeader: string;
  colBHeader: string;
  rows: CaseStudyReportQuestionRow[];
  remarks?: string;
  /** Extra lines below the table (meter, HOA, etc.) */
  extras?: string[];
};

export type CaseStudyReportApproval = {
  providerName: string;
  declarationText: string;
  deedNumber: string;
  approverName: string;
  reportDate: string;
  reportDateIso: string;
  requestNumber: string;
};

export type CaseStudyReportModel = {
  title: string;
  providerName: string;
  requestNumber: string;
  requestDate: string;
  requestDateIso: string;
  deedNumber: string;
  /** أخصائي الإسناد من إنفاذ (مثلاً سعد محارب) — للعرض في الترويسة فقط. */
  assignmentSpecialist: string;
  propertyLocation: string;
  propertyType: string;
  sections: CaseStudyReportSection[];
  approval: CaseStudyReportApproval;
};

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
  draft: CaseStudyFormDraft,
): string {
  return (
    poRecord?.receivedFromEnfathAt?.slice(0, 10) ||
    poRecord?.promulgationDate?.slice(0, 10) ||
    draft.requestDate?.slice(0, 10) ||
    ""
  );
}

export function buildCaseStudyReportApproval(
  task: WorkflowTask,
  property: PoPropertyIntake | null,
  poRecord: Pick<
    PoIntakeRecord,
    "assignmentSpecialist" | "receivedFromEnfathAt" | "promulgationDate"
  > | null | undefined,
  draft: CaseStudyFormDraft,
): CaseStudyReportApproval {
  const deedNumber = property
    ? formatPropertyDeedDisplay(property)
    : draft.deedNumber.trim() || "—";
  const requestNumber = task.poNumber.trim()
    ? formatPoDisplay(task.poNumber)
    : draft.requestNumber.trim() || "—";
  const reportDateIso = resolveRequestDateIso(poRecord, draft);

  return {
    providerName: CASE_STUDY_PROVIDER_NAME,
    declarationText: `نقر ${CASE_STUDY_PROVIDER_NAME} بصحة ما ورد في النموذج أعلاه مع تحمل كافة المسؤولية نحو ذلك.`,
    deedNumber,
    approverName: CASE_STUDY_REPORT_APPROVER_NAME,
    reportDate: reportDateIso ? formatDateAr(reportDateIso) : "—",
    reportDateIso,
    requestNumber,
  };
}

function buildSectionRows(
  section: CaseStudyQuestionSection,
  answers: Record<string, CaseStudyFormAnswer | null>,
): CaseStudyReportQuestionRow[] {
  const headers = CASE_STUDY_TABLE_HEADERS[section];
  const questions = CASE_STUDY_SECTION_QUESTIONS[section];
  return questions.map((question, i) => {
    const key = caseStudyAnswerKey(section, i);
    const val = answers[key] ?? null;
    return {
      question,
      colAHeader: headers.colA,
      colBHeader: headers.colB,
      markA: val === "A",
      markB: val === "B",
    };
  });
}

function meterExtras(draft: CaseStudyFormDraft): string[] {
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
  draft: CaseStudyFormDraft,
  property: PoPropertyIntake | null,
  task: WorkflowTask,
  poRecord: Pick<
    PoIntakeRecord,
    | "assignmentSpecialist"
    | "receivedFromEnfathAt"
    | "promulgationDate"
  > | null | undefined,
): CaseStudyReportModel {
  const requestDateIso = resolveRequestDateIso(poRecord, draft);
  const approval = buildCaseStudyReportApproval(
    task,
    property,
    poRecord,
    draft,
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
      rows: buildSectionRows(id, draft.answers),
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
          `قيمة اشتراك اتحاد الملاك: ${draft.hoaFee.trim()} ريال سعودي`,
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
    providerName: CASE_STUDY_PROVIDER_NAME,
    requestNumber: approval.requestNumber,
    requestDate: requestDateIso ? formatDateAr(requestDateIso) : "—",
    requestDateIso,
    deedNumber: approval.deedNumber,
    assignmentSpecialist,
    propertyLocation: property ? formatPropertyLocation(property) : "",
    propertyType: property ? formatPropertyTypeLine(property) : "",
    sections,
    approval,
  };
}
