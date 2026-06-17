import { CASE_STUDY_FORM_STEPS, CASE_STUDY_SECTION_QUESTIONS, CASE_STUDY_TABLE_HEADERS, caseStudyFormSummary,
  type CaseStudyFormAnswer,
  type CaseStudyQuestionSection,
} from "./case-study-form-data";
import { loadCaseStudyFormDraft, loadPartyCaseStudyFormDraft,
  type CaseStudyFormDraft,
  type CaseStudyFormStatus,
} from "./case-study-form-storage";
import { childTasksForCaseStudyParent } from "./case-study-party-answers";
import {
  fieldInspectionRentalStatusLabel,
  fieldInspectionStatusLabel,
  fieldInspectionYesNoLabel,
} from "./field-inspection-data";
import {
  loadFieldInspectionSubmissionSnapshot,
  type FieldInspectionSubmissionSnapshot,
} from "./field-inspection-submission-storage";
import type { PropertyDetailPartyRoleKey } from "./property-detail-parties";
import {
  migrateDistribution,
  type WorkflowTask,
  type WorkflowTaskKind,
  type WorkflowTaskStatus,
} from "./tasks-storage";
import { formatDateAr } from "./po-intake-data";
import {
  INFATH_FIELD_LABELS,
  infathYesNoLabel,
} from "./infath-field-labels";
import { getPartyTaskSubmission, type PartyTaskSubmissionDto } from "@platform/api-client";
import { workOrdersApiConfig } from "../work-orders-api-config";
import { fetchGovernmentReviewSubmission } from "./government-review-work-storage";
import { fetchValuationCoordinationSubmission } from "./valuation-coordination-work-storage";

/** Must match `ENGINEERING_SURVEY_CHECKLIST_ITEMS` in engineering-survey-data (no circular import). */
const ENGINEERING_SURVEY_CHECKLIST_LABELS = [
  "هل الصك مطابق للرفع المساحي (الأطوال والمساحة)",
  "هل تم الوقوف على الموقع من قِبل طالب التنفيذ وتوقيع إقرار صحة الاستدلال على الموقع",
  "هل يوجد اختلاف في رقم القطعة / المخطط / البلوك / اسم الحي / اسم المدينة للمستكشف",
  "هل يوجد اختلاف في مساحة / أطوال الصك عن الطبيعة",
  "هل يوجد شوارع محتزلة / شطفات على الأصل في المخطط ولم يذكر في الصك",
  "هل يوجد تداخل في الصك أو أجزاء مشتركة ظاهرياً",
  "هل ذُكر الاستخدام حسب الصك",
  "هل الموقع أرض فضاء",
  "هل يوجد غرفة كهرباء داخل / خارج حدود الموقع",
  "هل يوجد صناديق خدمات كهربائية / اتصالات / أخرى داخل أو خارج حدود العقار",
  "هل تم تطبيق جميع التعليمات الصادرة في الرفع المساحي",
  "هل يوجد أسوار داخلية وخارجية بمحيط المبنى القائم بالموقع",
  "هل يوجد اختلاف في الحدود / الصك أو الأفادة من المستكشف",
] as const;

const ROLE_CHILD_KIND: Partial<
  Record<PropertyDetailPartyRoleKey, WorkflowTaskKind>
> = {
  inspection: "field-inspection",
  survey: "engineering-survey",
  appraisal: "property-appraisal",
  government: "government-review",
  coordinator: "valuation-coordination",
};

export type PartyAnswerRow = {
  question: string;
  answer: string;
};

export type PropertyDetailPartySubmission = {
  roleKey: PropertyDetailPartyRoleKey;
  hasData: boolean;
  emptyReason?: string;
  statusLabel?: string;
  taskStatusLabel?: string;
  fields: { label: string; value: string; ltr?: boolean }[];
  answers: PartyAnswerRow[];
  remarks: { label: string; value: string }[];
};

type EvaluatorChecklist = Record<string, boolean | null | string>;

type EvaluatorSubmissionSnapshot = {
  status: string;
  evaluatorPrice: string;
  evaluatorNotes: string;
  reportFileName: string | null;
  submittedAtUtc: string | null;
  checklist: EvaluatorChecklist;
  appraisalDate?: string;
  valuationMethod?: string;
  valueBasis?: string;
  demandLevel?: string;
  landValue?: string;
  buildingValue?: string;
  forcedSaleDiscountPct?: string;
  searchScopeNotes?: string;
  planImageFileName?: string | null;
  appraiserAddress?: string;
  appraiserPhone?: string;
  reportIssueDate?: string;
};

type EngineeringSurveyChecklistAnswer = "yes" | "no" | null;

type EngineeringSurveyChecklistRow = {
  answer: EngineeringSurveyChecklistAnswer;
  note: string;
};

type EngineeringSurveySubmissionSnapshot = {
  status: "draft" | "submitted" | "reopened";
  latitude: string;
  longitude: string;
  surveyReportFileName: string;
  siteLetterFileName: string;
  siteConfirmed: boolean;
  checklist: EngineeringSurveyChecklistRow[];
  returnNote?: string;
  onSiteAreaSqm: string;
  northBoundary: string;
  northBoundaryLengthM: string;
  southBoundary: string;
  southBoundaryLengthM: string;
  eastBoundary: string;
  eastBoundaryLengthM: string;
  westBoundary: string;
  westBoundaryLengthM: string;
  surveyNotes: string;
  updatedAtUtc: string;
  submittedAtUtc?: string;
};

type GovernmentReviewSubmissionSnapshot = {
  status: "draft" | "submitted";
  visitStatus: "completed" | "scheduled" | "blocked" | "";
  visitDate: string;
  courtName: string;
  keysStatus: "received" | "pending" | "not_required" | "";
  keysDescription: string;
  accessBlockReason: string;
  reviewNotes: string;
  propertyZoneStatus?: string;
  keysProofFileName?: string;
  submittedAtUtc: string | null;
  updatedAtUtc: string;
};

type ValuationCoordinationSubmissionSnapshot = {
  status: "draft" | "submitted";
  receiptConfirmed: boolean;
  receiptDate: string;
  inspectorName: string;
  appraiserName: string;
  priority: "normal" | "urgent";
  coordinationNotes: string;
  inspectorInstructions: string;
  appraiserInstructions: string;
  submittedAtUtc: string | null;
  updatedAtUtc: string;
};

function formStatusLabel(status: CaseStudyFormStatus): string {
  if (status === "submitted") return "مُقدَّم";
  if (status === "draft") return "مسودة";
  return "جديد";
}

function workflowStatusLabel(status: WorkflowTaskStatus): string {
  if (status === "completed") return "مكتمل";
  if (status === "blocked") return "معلّق";
  return "قيد التنفيذ";
}

function answerDisplay(
  section: CaseStudyQuestionSection,
  value: CaseStudyFormAnswer,
): string {
  const headers = CASE_STUDY_TABLE_HEADERS[section];
  return value === "A" ? headers.colA : headers.colB;
}

function questionLabelFromKey(key: string): string | null {
  const match = /^([a-z]+)_(\d+)$/.exec(key);
  if (!match) return null;
  const section = match[1] as CaseStudyQuestionSection;
  const index = Number.parseInt(match[2] ?? "", 10);
  const questions = CASE_STUDY_SECTION_QUESTIONS[section];
  if (!questions || !Number.isFinite(index)) return null;
  return questions[index] ?? null;
}

function answeredRows(
  answers: Record<string, CaseStudyFormAnswer | null | undefined>,
): PartyAnswerRow[] {
  const rows: PartyAnswerRow[] = [];
  for (const [key, value] of Object.entries(answers)) {
    if (value !== "A" && value !== "B") continue;
    const match = /^([a-z]+)_(\d+)$/.exec(key);
    if (!match) continue;
    const section = match[1] as CaseStudyQuestionSection;
    const label = questionLabelFromKey(key);
    if (!label) continue;
    rows.push({
      question: label,
      answer: answerDisplay(section, value),
    });
  }
  return rows;
}

function nonEmptyRemarks(draft: CaseStudyFormDraft): { label: string; value: string }[] {
  const defs = [
    { label: "ملاحظات الصك", value: draft.deedRemarks },
    { label: "ملاحظات الرفع المساحي", value: draft.surveyRemarks },
    { label: "ملاحظات المكونات", value: draft.componentsRemarks },
    { label: "ملاحظات الإشغال", value: draft.occupancyRemarks },
  ];
  return defs
    .map((d) => ({ ...d, value: d.value.trim() }))
    .filter((d) => d.value);
}

function childForRole(
  parentTask: WorkflowTask | null,
  allTasks: WorkflowTask[],
  roleKey: PropertyDetailPartyRoleKey,
): WorkflowTask | null {
  if (!parentTask) return null;
  const kind = ROLE_CHILD_KIND[roleKey];
  if (!kind) return null;
  return (
    childTasksForCaseStudyParent(parentTask.id, allTasks).find(
      (t) => t.kind === kind,
    ) ?? null
  );
}

function parseEvaluatorPayload(
  dto: PartyTaskSubmissionDto,
): EvaluatorSubmissionSnapshot | null {
  const payload = dto.payload ?? {};
  if (typeof payload !== "object" || payload === null) return null;
  const raw = payload as Record<string, unknown>;
  return {
    status: String(raw.status ?? dto.status ?? "draft"),
    evaluatorPrice: String(raw.evaluatorPrice ?? ""),
    evaluatorNotes: String(raw.evaluatorNotes ?? ""),
    reportFileName:
      typeof raw.reportFileName === "string" ? raw.reportFileName : null,
    submittedAtUtc:
      typeof raw.submittedAtUtc === "string"
        ? raw.submittedAtUtc
        : dto.submittedAtUtc ?? null,
    checklist: (raw.checklist ?? {}) as EvaluatorChecklist,
  };
}

async function loadEvaluatorSubmissionSnapshot(
  taskId: string,
): Promise<EvaluatorSubmissionSnapshot | null> {
  const config = workOrdersApiConfig();
  if (!config || !taskId) return null;

  const result = await getPartyTaskSubmission(config, taskId);
  if (!result.ok) return null;
  return parseEvaluatorPayload(result.data);
}

async function loadEngineeringSurveySubmissionSnapshot(
  taskId: string,
): Promise<EngineeringSurveySubmissionSnapshot | null> {
  const config = workOrdersApiConfig();
  if (!config || !taskId) return null;

  const result = await getPartyTaskSubmission(config, taskId);
  if (!result.ok) return null;

  const payload = result.data.payload ?? {};
  const status =
    (payload.status as EngineeringSurveySubmissionSnapshot["status"] | undefined)
    ?? (result.data.status as EngineeringSurveySubmissionSnapshot["status"])
    ?? "draft";

  return {
    status,
    latitude: String(payload.latitude ?? ""),
    longitude: String(payload.longitude ?? ""),
    surveyReportFileName: String(payload.surveyReportFileName ?? ""),
    siteLetterFileName: String(payload.siteLetterFileName ?? ""),
    siteConfirmed: payload.siteConfirmed === true,
    checklist: Array.isArray(payload.checklist)
      ? (payload.checklist as EngineeringSurveyChecklistRow[])
      : [],
    returnNote:
      typeof payload.returnNote === "string"
        ? payload.returnNote
        : result.data.returnNote,
    onSiteAreaSqm: String(payload.onSiteAreaSqm ?? ""),
    northBoundary: String(payload.northBoundary ?? ""),
    northBoundaryLengthM: String(payload.northBoundaryLengthM ?? ""),
    southBoundary: String(payload.southBoundary ?? ""),
    southBoundaryLengthM: String(payload.southBoundaryLengthM ?? ""),
    eastBoundary: String(payload.eastBoundary ?? ""),
    eastBoundaryLengthM: String(payload.eastBoundaryLengthM ?? ""),
    westBoundary: String(payload.westBoundary ?? ""),
    westBoundaryLengthM: String(payload.westBoundaryLengthM ?? ""),
    surveyNotes: String(payload.surveyNotes ?? ""),
    updatedAtUtc:
      typeof payload.updatedAtUtc === "string"
        ? payload.updatedAtUtc
        : result.data.updatedAtUtc,
    submittedAtUtc:
      typeof payload.submittedAtUtc === "string"
        ? payload.submittedAtUtc
        : result.data.submittedAtUtc,
  };
}

async function loadGovernmentReviewSubmissionSnapshot(
  child: WorkflowTask,
): Promise<GovernmentReviewSubmissionSnapshot | null> {
  if (!child.propertyId) return null;
  const submission = await fetchGovernmentReviewSubmission(child.id);
  if (!submission) return null;
  return {
    status: submission.status,
    visitStatus: submission.visitStatus,
    visitDate: submission.visitDate,
    courtName: submission.courtName,
    keysStatus: submission.keysStatus,
    keysDescription: submission.keysDescription,
    accessBlockReason: submission.accessBlockReason,
    reviewNotes: submission.reviewNotes,
    submittedAtUtc: submission.submittedAtUtc,
    updatedAtUtc: submission.updatedAtUtc,
  };
}

async function loadValuationCoordinationSubmissionSnapshot(
  child: WorkflowTask,
): Promise<ValuationCoordinationSubmissionSnapshot | null> {
  if (!child.propertyId) return null;
  const submission = await fetchValuationCoordinationSubmission(child.id);
  if (!submission) return null;
  return {
    status: submission.status,
    receiptConfirmed: submission.receiptConfirmed,
    receiptDate: submission.receiptDate,
    inspectorName: submission.inspectorName,
    appraiserName: submission.appraiserName,
    priority: submission.priority,
    coordinationNotes: submission.coordinationNotes,
    inspectorInstructions: submission.inspectorInstructions,
    appraiserInstructions: submission.appraiserInstructions,
    submittedAtUtc: submission.submittedAtUtc,
    updatedAtUtc: submission.updatedAtUtc,
  };
}

function evaluatorStatusLabel(status: string): string {
  if (status === "draft") return "مسودة";
  if (status === "submitted") return "مُرسَل للأخصائي";
  if (status === "reopened") return "مُعاد للتعديل";
  if (status === "completed") return "مكتمل";
  return status;
}

function engineeringSurveyStatusLabel(
  status: EngineeringSurveySubmissionSnapshot["status"],
): string {
  if (status === "submitted") return "مُرسَل";
  if (status === "reopened") return "مُعاد للتصحيح";
  return "قيد العمل";
}

function engineeringSurveyAnswerLabel(
  value: EngineeringSurveyChecklistAnswer,
): string {
  if (value === "yes") return "نعم";
  if (value === "no") return "لا";
  return "—";
}

function checklistAnswerLabel(value: boolean | null): string {
  if (value === true) return "نعم";
  if (value === false) return "لا";
  return "—";
}

function evaluatorChecklistRows(
  checklist: EvaluatorChecklist,
): PartyAnswerRow[] {
  const labels: Record<string, string> = {
    q_plan_match: "هل رقم المخطط مطابق للصك؟",
    q_excess_zoning: "هل القطعة زائدة تنظيمية؟",
    q_land_waqf: "هل الأرض موقوفة؟",
    q_property_waqf: "هل العقار موقوف؟",
    q_expropriation: "هل يوجد نزع على منطقة العقار؟",
    q_agriculture_inquiry:
      "هل تم الاستعلام من وزارة الزراعة حيال الأرض الزراعية؟",
    q_overlap: "هل يوجد تداخل في الأصل؟",
    q_shared_building: "هل يوجد على الأصل مبنى مشترك؟",
    q_environmental_factors:
      "هل هناك أي عوامل بيئية أو تنظيمية قد تؤثر على العقار؟",
    q_unregistered_additions:
      "هل العقار يحتوي على أي إضافات غير مسجلة في الصك؟",
    q_shared_deed: "هل الصك مشاع؟",
    q_lease_exists: "هل يوجد عقد إيجار؟",
    q_lease_active: "هل عقد الإيجار ساري؟",
    q_technical_notes_exists:
      "هل يوجد ملاحظات فنية قد تؤثر على قيمة العقار؟",
  };

  const rows: PartyAnswerRow[] = [];
  for (const [id, label] of Object.entries(labels)) {
    const value = checklist[id];
    if (typeof value !== "boolean") continue;
    rows.push({ question: label, answer: checklistAnswerLabel(value) });
  }

  if (checklist.q_shared_deed === true) {
    const scope =
      checklist.shared_deed_scope === "full"
        ? "كامل العقار"
        : checklist.shared_deed_scope === "part"
          ? "جزء محدد"
          : "—";
    rows.push({ question: "نطاق الصك المشاع", answer: scope });
    const pct = String(checklist.shared_deed_percentage ?? "").trim();
    if (pct) {
      rows.push({ question: "نسبة الملكية", answer: `${pct}%` });
    }
  }

  const techNotes = String(checklist.technical_notes_text ?? "").trim();
  if (techNotes) {
    rows.push({ question: "الملاحظات الفنية", answer: techNotes });
  }

  return rows;
}

function engineeringSurveyChecklistRows(
  checklist: EngineeringSurveyChecklistRow[],
): PartyAnswerRow[] {
  const rows: PartyAnswerRow[] = [];
  checklist.forEach((row, index) => {
    const label =
      ENGINEERING_SURVEY_CHECKLIST_LABELS[index] ?? `بند ${index + 1}`;
    if (row.answer === "yes" || row.answer === "no") {
      rows.push({
        question: label,
        answer: engineeringSurveyAnswerLabel(row.answer),
      });
    }
  });
  return rows;
}

function engineeringSurveyChecklistRemarks(
  checklist: EngineeringSurveyChecklistRow[],
): { label: string; value: string }[] {
  const remarks: { label: string; value: string }[] = [];
  checklist.forEach((row, index) => {
    const note = row.note.trim();
    if (!note) return;
    const label =
      ENGINEERING_SURVEY_CHECKLIST_LABELS[index] ?? `بند ${index + 1}`;
    remarks.push({ label, value: note });
  });
  return remarks;
}

function formatCoordsDisplay(lat: string, lng: string): string {
  const latTrim = lat.trim();
  const lngTrim = lng.trim();
  if (!latTrim && !lngTrim) return "";
  if (latTrim && lngTrim) return `${latTrim}، ${lngTrim}`;
  return latTrim || lngTrim;
}

function buildFromEngineeringSurvey(
  submission: EngineeringSurveySubmissionSnapshot,
  childTask?: WorkflowTask | null,
): PropertyDetailPartySubmission {
  const answers = engineeringSurveyChecklistRows(submission.checklist);
  const checklistRemarks = engineeringSurveyChecklistRemarks(submission.checklist);
  const coords = formatCoordsDisplay(submission.latitude, submission.longitude);

  const fields: PropertyDetailPartySubmission["fields"] = [
    {
      label: "حالة الرفع المساحي",
      value: engineeringSurveyStatusLabel(submission.status),
    },
  ];

  if (coords) {
    fields.push({ label: "الإحداثيات", value: coords, ltr: true });
  }
  if (submission.onSiteAreaSqm?.trim()) {
    fields.push({
      label: INFATH_FIELD_LABELS.onSiteArea,
      value: `${submission.onSiteAreaSqm.trim()} م²`,
      ltr: true,
    });
  }
  const pushEng = (label: string, value: string | undefined, ltr?: boolean) => {
    const v = value?.trim() ?? "";
    if (v) fields.push({ label, value: v, ltr });
  };
  pushEng(INFATH_FIELD_LABELS.northBoundary, submission.northBoundary);
  pushEng(INFATH_FIELD_LABELS.northLength, submission.northBoundaryLengthM, true);
  pushEng(INFATH_FIELD_LABELS.southBoundary, submission.southBoundary);
  pushEng(INFATH_FIELD_LABELS.southLength, submission.southBoundaryLengthM, true);
  pushEng(INFATH_FIELD_LABELS.eastBoundary, submission.eastBoundary);
  pushEng(INFATH_FIELD_LABELS.eastLength, submission.eastBoundaryLengthM, true);
  pushEng(INFATH_FIELD_LABELS.westBoundary, submission.westBoundary);
  pushEng(INFATH_FIELD_LABELS.westLength, submission.westBoundaryLengthM, true);
  if (submission.surveyReportFileName.trim()) {
    fields.push({
      label: INFATH_FIELD_LABELS.surveyFile,
      value: submission.surveyReportFileName.trim(),
    });
  }
  if (submission.siteLetterFileName.trim()) {
    fields.push({
      label: "خطاب الموقع",
      value: submission.siteLetterFileName.trim(),
    });
  }
  if (submission.siteConfirmed) {
    fields.push({ label: "إقرار الموقع", value: "مُوقَّع" });
  }
  if (submission.submittedAtUtc) {
    fields.push({
      label: "تاريخ الإرسال",
      value: formatDateAr(submission.submittedAtUtc.slice(0, 10)),
      ltr: true,
    });
  }
  if (submission.updatedAtUtc) {
    fields.push({
      label: "آخر تحديث",
      value: formatDateAr(submission.updatedAtUtc.slice(0, 10)),
      ltr: true,
    });
  }
  if (childTask) {
    fields.push({
      label: "حالة المهمة",
      value: workflowStatusLabel(childTask.status),
    });
  }

  const answeredCount = submission.checklist.filter(
    (row) => row.answer === "yes" || row.answer === "no",
  ).length;
  if (answeredCount > 0) {
    fields.splice(1, 0, {
      label: "البنود المكتملة",
      value: `${answeredCount} / ${ENGINEERING_SURVEY_CHECKLIST_LABELS.length}`,
    });
  }

  const returnNote = submission.returnNote?.trim() ?? "";
  const remarks = returnNote
    ? [{ label: "ملاحظة الإرجاع", value: returnNote }, ...checklistRemarks]
    : [...checklistRemarks];
  if (submission.surveyNotes?.trim()) {
    remarks.unshift({
      label: INFATH_FIELD_LABELS.surveyNotes,
      value: submission.surveyNotes.trim(),
    });
  }

  const hasData =
    submission.status !== "draft" ||
    Boolean(coords) ||
    Boolean(submission.surveyReportFileName.trim()) ||
    Boolean(submission.siteLetterFileName.trim()) ||
    answers.length > 0 ||
    remarks.length > 0;

  return {
    roleKey: "survey",
    hasData,
    emptyReason: hasData ? undefined : "لم يُقدَّم بعد",
    statusLabel: engineeringSurveyStatusLabel(submission.status),
    taskStatusLabel: childTask
      ? workflowStatusLabel(childTask.status)
      : undefined,
    fields,
    answers,
    remarks,
  };
}

function formatPriceDisplay(raw: string): string {
  const n = Number.parseFloat(raw.replace(/,/g, ""));
  if (!Number.isFinite(n) || n <= 0) return "";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "SAR",
    maximumFractionDigits: 2,
  }).format(n);
}

function buildFromFormDraft(
  roleKey: PropertyDetailPartyRoleKey,
  draft: CaseStudyFormDraft,
  childTask?: WorkflowTask | null,
): PropertyDetailPartySubmission {
  const summary = caseStudyFormSummary(draft.answers);
  const answers = answeredRows(draft.answers);
  const remarks = nonEmptyRemarks(draft);
  const step =
    CASE_STUDY_FORM_STEPS[draft.currentStep]?.label ??
    CASE_STUDY_FORM_STEPS[0]?.label ??
    "";

  const fields: PropertyDetailPartySubmission["fields"] = [
    { label: "حالة النموذج", value: formStatusLabel(draft.status) },
    { label: "الإجابات المكتملة", value: `${summary.answered} / ${summary.total}` },
  ];

  if (roleKey === "specialist") {
    fields.unshift({ label: "الخطوة الحالية", value: step });
    if (draft.requestNumber.trim()) {
      fields.push({ label: "رقم الطلب", value: draft.requestNumber, ltr: true });
    }
    if (draft.requestDate.trim()) {
      fields.push({
        label: "تاريخ الطلب",
        value: formatDateAr(draft.requestDate),
        ltr: true,
      });
    }
    if (draft.infathLinkedAssets) {
      fields.push({
        label: INFATH_FIELD_LABELS.linkedAssets,
        value: draft.infathLinkedAssets === "yes" ? "نعم" : "لا",
      });
    }
    if (draft.infathLinkedDeedNumbers?.trim()) {
      fields.push({
        label: INFATH_FIELD_LABELS.linkedDeedNumbers,
        value: draft.infathLinkedDeedNumbers.trim(),
      });
    }
    if (draft.infathLinkedAssetsNotes?.trim()) {
      remarks.push({
        label: INFATH_FIELD_LABELS.linkedAssetsNotes,
        value: draft.infathLinkedAssetsNotes.trim(),
      });
    }
    if (draft.infathOtherNotes?.trim()) {
      remarks.push({
        label: INFATH_FIELD_LABELS.otherNotes,
        value: draft.infathOtherNotes.trim(),
      });
    }
    if (draft.infathClosingNotes?.trim()) {
      remarks.push({
        label: INFATH_FIELD_LABELS.closingNotes,
        value: draft.infathClosingNotes.trim(),
      });
    }
  }

  if (childTask) {
    fields.push({
      label: "حالة المهمة",
      value: workflowStatusLabel(childTask.status),
    });
  }

  const hasData =
    answers.length > 0 ||
    remarks.length > 0 ||
    draft.status !== "new" ||
    summary.answered > 0;

  return {
    roleKey,
    hasData,
    emptyReason: hasData ? undefined : "لم يُقدَّم بعد",
    statusLabel: formStatusLabel(draft.status),
    taskStatusLabel: childTask
      ? workflowStatusLabel(childTask.status)
      : undefined,
    fields,
    answers,
    remarks,
  };
}

function buildFromEvaluator(
  submission: EvaluatorSubmissionSnapshot,
): PropertyDetailPartySubmission {
  const answers = evaluatorChecklistRows(submission.checklist);
  const price = formatPriceDisplay(submission.evaluatorPrice);
  const notes = submission.evaluatorNotes.trim();

  const fields: PropertyDetailPartySubmission["fields"] = [
    { label: "حالة التقييم", value: evaluatorStatusLabel(submission.status) },
  ];
  if (price) fields.push({ label: "سعر التقييم", value: price, ltr: true });
  if (submission.reportFileName?.trim()) {
    fields.push({
      label: "تقرير التقييم",
      value: submission.reportFileName.trim(),
    });
  }
  if (submission.submittedAtUtc) {
    fields.push({
      label: "تاريخ الإرسال",
      value: formatDateAr(submission.submittedAtUtc.slice(0, 10)),
      ltr: true,
    });
  }

  const pushEval = (label: string, value: string | undefined, ltr?: boolean) => {
    const v = value?.trim() ?? "";
    if (v) fields.push({ label, value: v, ltr });
  };
  if (submission.appraisalDate?.trim()) {
    pushEval(
      INFATH_FIELD_LABELS.appraisalDate,
      formatDateAr(submission.appraisalDate),
      true,
    );
  }
  pushEval(INFATH_FIELD_LABELS.valuationMethod, submission.valuationMethod);
  pushEval(INFATH_FIELD_LABELS.valueBasis, submission.valueBasis);
  pushEval(INFATH_FIELD_LABELS.demandLevel, submission.demandLevel);
  pushEval(INFATH_FIELD_LABELS.landValue, submission.landValue, true);
  pushEval(INFATH_FIELD_LABELS.buildingValue, submission.buildingValue, true);
  pushEval(INFATH_FIELD_LABELS.forcedDiscount, submission.forcedSaleDiscountPct, true);
  pushEval(INFATH_FIELD_LABELS.appraiserAddress, submission.appraiserAddress);
  pushEval(INFATH_FIELD_LABELS.appraiserPhone, submission.appraiserPhone, true);
  if (submission.reportIssueDate?.trim()) {
    pushEval(
      INFATH_FIELD_LABELS.reportIssueDate,
      formatDateAr(submission.reportIssueDate),
      true,
    );
  }
  pushEval(INFATH_FIELD_LABELS.planPhoto, submission.planImageFileName ?? undefined);
  if (submission.reportFileName?.trim()) {
    fields.push({
      label: INFATH_FIELD_LABELS.signedAppraisal,
      value: submission.reportFileName.trim(),
    });
  }

  const remarks = notes
    ? [{ label: "ملاحظات المقيّم", value: notes }]
    : [];
  if (submission.searchScopeNotes?.trim()) {
    remarks.push({
      label: INFATH_FIELD_LABELS.searchScope,
      value: submission.searchScopeNotes.trim(),
    });
  }

  const hasData =
    submission.status !== "draft" ||
    Boolean(price) ||
    Boolean(notes) ||
    Boolean(submission.reportFileName?.trim()) ||
    answers.length > 0;

  return {
    roleKey: "appraisal",
    hasData,
    emptyReason: hasData ? undefined : "لم يُقدَّم بعد",
    statusLabel: evaluatorStatusLabel(submission.status),
    fields,
    answers,
    remarks,
  };
}

function buildFromFieldInspection(
  submission: FieldInspectionSubmissionSnapshot,
  childTask?: WorkflowTask | null,
): PropertyDetailPartySubmission {
  const fields: PropertyDetailPartySubmission["fields"] = [
    {
      label: "حالة المعاينة",
      value: fieldInspectionStatusLabel(submission.status),
    },
  ];

  if (submission.propertyType.trim()) {
    fields.push({ label: "نوع العقار", value: submission.propertyType.trim() });
  }
  if (submission.areaDistrict.trim()) {
    fields.push({ label: "المنطقة / الحي", value: submission.areaDistrict.trim() });
  }
  if (submission.actualAreaSqm.trim()) {
    fields.push({
      label: "المساحة الفعلية",
      value: `${submission.actualAreaSqm.trim()} م²`,
      ltr: true,
    });
  }
  if (submission.structuralCondition.trim()) {
    fields.push({
      label: "الحالة الإنشائية",
      value: submission.structuralCondition.trim(),
    });
  }
  if (submission.hasMovableItems !== null) {
    fields.push({
      label: "منقولات داخل العقار",
      value: fieldInspectionYesNoLabel(submission.hasMovableItems),
    });
  }
  if (submission.isCurrentlyRented) {
    fields.push({
      label: "العقار مؤجر",
      value: fieldInspectionRentalStatusLabel(submission.isCurrentlyRented),
    });
  }
  if (submission.accessDifficulty.trim()) {
    fields.push({
      label: "إمكانية الوصول",
      value: submission.accessDifficulty.trim(),
    });
  }
  if (submission.avgPricePerSqm.trim()) {
    fields.push({
      label: "متوسط سعر م²",
      value: `${submission.avgPricePerSqm.trim()} ر.س`,
      ltr: true,
    });
  }
  if (submission.marketActivityLevel.trim()) {
    fields.push({
      label: "نشاط السوق",
      value: submission.marketActivityLevel.trim(),
    });
  }
  if (submission.responsiblePersonName.trim()) {
    fields.push({
      label: "المسؤول عن التوقيع",
      value: submission.responsiblePersonName.trim(),
    });
  }
  if (submission.responsiblePersonRole.trim()) {
    fields.push({
      label: "صفة المسؤول",
      value: submission.responsiblePersonRole.trim(),
    });
  }
  if (submission.submittedAtUtc) {
    fields.push({
      label: "تاريخ الإرسال",
      value: formatDateAr(submission.submittedAtUtc.slice(0, 10)),
      ltr: true,
    });
  }

  const pushInspectionField = (label: string, value: string, ltr?: boolean) => {
    const v = value.trim();
    if (v) fields.push({ label, value: v, ltr });
  };

  if (submission.inspectionDate.trim()) {
    pushInspectionField(
      INFATH_FIELD_LABELS.inspectionDate,
      formatDateAr(submission.inspectionDate),
      true,
    );
  }
  pushInspectionField(INFATH_FIELD_LABELS.assetSubject, submission.propertyType);
  pushInspectionField(INFATH_FIELD_LABELS.facade, submission.facade);
  pushInspectionField(INFATH_FIELD_LABELS.streetWidth, submission.streetWidthM, true);
  pushInspectionField(INFATH_FIELD_LABELS.builtArea, submission.builtAreaSqm, true);
  pushInspectionField(INFATH_FIELD_LABELS.propertyUsage, submission.propertyUsage);
  pushInspectionField(INFATH_FIELD_LABELS.streetName, submission.streetName);
  pushInspectionField(INFATH_FIELD_LABELS.mainStreet, submission.mainStreetName);
  if (submission.mapLatitude.trim() || submission.mapLongitude.trim()) {
    pushInspectionField(
      INFATH_FIELD_LABELS.mapCoords,
      `${submission.mapLatitude.trim()}, ${submission.mapLongitude.trim()}`,
      true,
    );
  }
  pushInspectionField(INFATH_FIELD_LABELS.roomCount, submission.roomCount, true);
  pushInspectionField(INFATH_FIELD_LABELS.hallCount, submission.hallCount, true);
  pushInspectionField(INFATH_FIELD_LABELS.unitCount, submission.unitCount, true);
  pushInspectionField(INFATH_FIELD_LABELS.bathroomCount, submission.bathroomCount, true);
  pushInspectionField(INFATH_FIELD_LABELS.propertyAge, submission.propertyAgeYears, true);
  pushInspectionField(INFATH_FIELD_LABELS.showroomCount, submission.showroomCount, true);
  pushInspectionField(INFATH_FIELD_LABELS.towerCount, submission.towerCount, true);
  pushInspectionField(INFATH_FIELD_LABELS.wellCount, submission.wellCount, true);
  pushInspectionField(INFATH_FIELD_LABELS.kitchen, infathYesNoLabel(submission.hasKitchen));
  pushInspectionField(INFATH_FIELD_LABELS.carEntrance, infathYesNoLabel(submission.hasCarEntrance));
  pushInspectionField(INFATH_FIELD_LABELS.hasBasement, infathYesNoLabel(submission.hasBasement));
  pushInspectionField(INFATH_FIELD_LABELS.hasElevator, infathYesNoLabel(submission.hasElevator));
  pushInspectionField(INFATH_FIELD_LABELS.hasPool, infathYesNoLabel(submission.hasPool));
  pushInspectionField(INFATH_FIELD_LABELS.buildState, submission.structuralCondition);
  if (submission.isCurrentlyRented) {
    pushInspectionField(
      INFATH_FIELD_LABELS.occupancyState,
      fieldInspectionRentalStatusLabel(submission.isCurrentlyRented),
    );
  }
  pushInspectionField(INFATH_FIELD_LABELS.districtState, submission.districtState);
  if (submission.hasMovableItems !== null) {
    pushInspectionField(
      INFATH_FIELD_LABELS.movables,
      fieldInspectionYesNoLabel(submission.hasMovableItems),
    );
  }
  pushInspectionField(INFATH_FIELD_LABELS.services, submission.availableServices);
  pushInspectionField(INFATH_FIELD_LABELS.amenities, submission.surroundingAmenities);
  pushInspectionField(INFATH_FIELD_LABELS.buildingFloors, submission.buildingFloors, true);
  pushInspectionField(INFATH_FIELD_LABELS.basementTotal, submission.basementTotalSqm, true);
  pushInspectionField(INFATH_FIELD_LABELS.annexTotal, submission.annexTotalSqm, true);
  pushInspectionField(INFATH_FIELD_LABELS.buildingsTotal, submission.buildingsTotalSqm, true);
  pushInspectionField(INFATH_FIELD_LABELS.exteriorPhotos, submission.exteriorPhotosPdf);
  pushInspectionField(INFATH_FIELD_LABELS.interiorPhotos, submission.interiorPhotosPdf);

  if (childTask) {
    fields.push({
      label: "حالة المهمة",
      value: workflowStatusLabel(childTask.status),
    });
  }

  const remarks: PropertyDetailPartySubmission["remarks"] = [];
  if (submission.marketNotes.trim()) {
    remarks.push({ label: "ملاحظات سوقية", value: submission.marketNotes.trim() });
  }
  if (submission.generalNotes.trim()) {
    remarks.push({ label: "ملاحظات عامة", value: submission.generalNotes.trim() });
  }
  if (submission.propertyDescription.trim()) {
    remarks.push({
      label: INFATH_FIELD_LABELS.propertyDescription,
      value: submission.propertyDescription.trim(),
    });
  }
  if (submission.districtProsCons.trim()) {
    remarks.push({
      label: INFATH_FIELD_LABELS.districtProsCons,
      value: submission.districtProsCons.trim(),
    });
  }
  if (submission.accessRouteDescription.trim()) {
    remarks.push({
      label: INFATH_FIELD_LABELS.accessRoute,
      value: submission.accessRouteDescription.trim(),
    });
  }
  if (submission.assetNotes.trim()) {
    remarks.push({
      label: INFATH_FIELD_LABELS.assetNotes,
      value: submission.assetNotes.trim(),
    });
  }

  const signedPhotos = submission.signedDocumentPhotos.filter((p) => p.trim());
  if (signedPhotos.length > 0) {
    remarks.push({
      label: "صور المستندات",
      value: signedPhotos.join("، "),
    });
  }

  const propertyPhotos = Object.values(submission.propertyPhotos).filter((p) =>
    p.trim(),
  );
  if (propertyPhotos.length > 0) {
    remarks.push({
      label: "صور العقار",
      value: propertyPhotos.join("، "),
    });
  }

  const hasData =
    submission.status !== "draft" ||
    Boolean(submission.propertyType.trim()) ||
    Boolean(submission.structuralCondition.trim()) ||
    remarks.length > 0;

  return {
    roleKey: "inspection",
    hasData,
    emptyReason: hasData ? undefined : "لم يُقدَّم بعد",
    statusLabel: fieldInspectionStatusLabel(submission.status),
    taskStatusLabel: childTask
      ? workflowStatusLabel(childTask.status)
      : undefined,
    fields,
    answers: [],
    remarks,
  };
}

function buildFromGovernmentReview(
  submission: GovernmentReviewSubmissionSnapshot,
  childTask?: WorkflowTask | null,
): PropertyDetailPartySubmission {
  const visitLabels: Record<string, string> = {
    completed: "تمت الزيارة",
    scheduled: "بانتظار الموعد",
    blocked: "تعذر الوصول",
  };
  const keysLabels: Record<string, string> = {
    received: "تم استلام المفاتيح",
    pending: "لم تُسلَّم بعد",
    not_required: "غير مطلوبة",
  };

  const fields: PropertyDetailPartySubmission["fields"] = [
    {
      label: "حالة المراجعة",
      value: submission.status === "submitted" ? "مُرسَل" : "قيد العمل",
    },
  ];

  if (submission.visitStatus) {
    fields.push({
      label: "حالة الزيارة",
      value: visitLabels[submission.visitStatus] ?? submission.visitStatus,
    });
  }
  if (submission.visitDate.trim()) {
    fields.push({
      label: "تاريخ الزيارة",
      value: formatDateAr(submission.visitDate),
      ltr: true,
    });
  }
  if (submission.courtName.trim()) {
    fields.push({ label: "المحكمة", value: submission.courtName.trim() });
  }
  if (submission.keysStatus) {
    fields.push({
      label: INFATH_FIELD_LABELS.keysReceived,
      value:
        submission.keysStatus === "received"
          ? "نعم"
          : submission.keysStatus === "pending"
            ? "لا"
            : keysLabels[submission.keysStatus] ?? submission.keysStatus,
    });
    fields.push({
      label: "حالة المفاتيح",
      value: keysLabels[submission.keysStatus] ?? submission.keysStatus,
    });
  }
  if (submission.propertyZoneStatus?.trim()) {
    fields.push({
      label: INFATH_FIELD_LABELS.zoneStatus,
      value: submission.propertyZoneStatus.trim(),
    });
  }
  if (submission.keysProofFileName?.trim()) {
    fields.push({
      label: INFATH_FIELD_LABELS.keysProof,
      value: submission.keysProofFileName.trim(),
    });
  }
  if (submission.submittedAtUtc) {
    fields.push({
      label: "تاريخ الإرسال",
      value: formatDateAr(submission.submittedAtUtc.slice(0, 10)),
      ltr: true,
    });
  }
  if (childTask) {
    fields.push({
      label: "حالة المهمة",
      value: workflowStatusLabel(childTask.status),
    });
  }

  const remarks: PropertyDetailPartySubmission["remarks"] = [];
  if (submission.keysDescription.trim()) {
    remarks.push({
      label: "المفاتيح / موقع الحفظ",
      value: submission.keysDescription.trim(),
    });
  }
  if (submission.accessBlockReason.trim()) {
    remarks.push({
      label: "سبب التعذر / المتابعة",
      value: submission.accessBlockReason.trim(),
    });
  }
  if (submission.reviewNotes.trim()) {
    remarks.push({
      label: "ملاحظات المراجعة",
      value: submission.reviewNotes.trim(),
    });
  }

  const hasData =
    submission.status !== "draft" ||
    Boolean(submission.visitStatus) ||
    Boolean(submission.keysStatus) ||
    remarks.length > 0;

  return {
    roleKey: "government",
    hasData,
    emptyReason: hasData ? undefined : "لم يُقدَّم بعد",
    statusLabel: submission.status === "submitted" ? "مُرسَل" : "مسودة",
    taskStatusLabel: childTask
      ? workflowStatusLabel(childTask.status)
      : undefined,
    fields,
    answers: [],
    remarks,
  };
}

function buildFromValuationCoordination(
  submission: ValuationCoordinationSubmissionSnapshot,
  childTask?: WorkflowTask | null,
): PropertyDetailPartySubmission {
  const fields: PropertyDetailPartySubmission["fields"] = [
    {
      label: "حالة الاستلام",
      value: submission.status === "submitted" ? "مُستلَم" : "قيد التنسيق",
    },
  ];

  if (submission.receiptDate.trim()) {
    fields.push({
      label: "تاريخ الاستلام",
      value: formatDateAr(submission.receiptDate),
      ltr: true,
    });
  }
  if (submission.inspectorName.trim()) {
    fields.push({
      label: "المعاين الميداني",
      value: submission.inspectorName.trim(),
    });
  }
  if (submission.appraiserName.trim()) {
    fields.push({
      label: "المقيم العقاري",
      value: submission.appraiserName.trim(),
    });
  }
  fields.push({
    label: "الأولوية",
    value: submission.priority === "urgent" ? "عاجلة" : "عادية",
  });
  if (submission.submittedAtUtc) {
    fields.push({
      label: "تاريخ التأكيد",
      value: formatDateAr(submission.submittedAtUtc.slice(0, 10)),
      ltr: true,
    });
  }
  if (childTask) {
    fields.push({
      label: "حالة المهمة",
      value: workflowStatusLabel(childTask.status),
    });
  }

  const remarks: PropertyDetailPartySubmission["remarks"] = [];
  if (submission.coordinationNotes.trim()) {
    remarks.push({
      label: "ملاحظات التنسيق",
      value: submission.coordinationNotes.trim(),
    });
  }
  if (submission.inspectorInstructions.trim()) {
    remarks.push({
      label: "تعليمات للمعاين",
      value: submission.inspectorInstructions.trim(),
    });
  }
  if (submission.appraiserInstructions.trim()) {
    remarks.push({
      label: "تعليمات للمقيم",
      value: submission.appraiserInstructions.trim(),
    });
  }

  const hasData =
    submission.status !== "draft" ||
    submission.receiptConfirmed ||
    remarks.length > 0;

  return {
    roleKey: "coordinator",
    hasData,
    emptyReason: hasData ? undefined : "لم يُقدَّم بعد",
    statusLabel: submission.status === "submitted" ? "مُستلَم" : "مسودة",
    taskStatusLabel: childTask
      ? workflowStatusLabel(childTask.status)
      : undefined,
    fields,
    answers: [],
    remarks,
  };
}

function buildCoordinatorSubmission(
  parentTask: WorkflowTask | null,
  allTasks: WorkflowTask[],
  coordinatorName: string,
): PropertyDetailPartySubmission {
  const distribution = migrateDistribution(parentTask?.distribution);
  const child = childForRole(parentTask, allTasks, "coordinator");

  const fields: PropertyDetailPartySubmission["fields"] = [
    {
      label: "قسم التقييم",
      value: distribution.valuationDepartment ? "مفعّل" : "غير مفعّل",
    },
  ];

  if (coordinatorName.trim()) {
    fields.push({ label: "المنسق المعيّن", value: coordinatorName.trim() });
  }
  if (child) {
    fields.push({
      label: "حالة الاستلام",
      value: workflowStatusLabel(child.status),
    });
    fields.push({
      label: "تاريخ التحديث",
      value: formatDateAr(child.updatedAt.slice(0, 10)),
      ltr: true,
    });
  }

  const hasData =
    distribution.valuationDepartment && Boolean(coordinatorName.trim());

  return {
    roleKey: "coordinator",
    hasData,
    emptyReason: hasData ? undefined : "لم يُقدَّم بعد",
    taskStatusLabel: child ? workflowStatusLabel(child.status) : undefined,
    fields,
    answers: [],
    remarks: [],
  };
}

function emptySubmission(
  roleKey: PropertyDetailPartyRoleKey,
  reason: string,
): PropertyDetailPartySubmission {
  return {
    roleKey,
    hasData: false,
    emptyReason: reason,
    fields: [],
    answers: [],
    remarks: [],
  };
}

export const PROPERTY_DETAIL_PARTY_ROLE_KEYS = [
  "specialist",
  "inspection",
  "survey",
  "appraisal",
  "government",
  "coordinator",
] as const satisfies readonly PropertyDetailPartyRoleKey[];

export type PropertyDetailPartySubmissionsMap = Record<
  PropertyDetailPartyRoleKey,
  PropertyDetailPartySubmission
>;

/** Load all party-role submissions in parallel (forms + party task submissions via API). */
export async function loadPropertyDetailPartySubmissions(input: {
  parentTask: WorkflowTask | null;
  allTasks: WorkflowTask[];
  coordinatorName?: string;
}): Promise<PropertyDetailPartySubmissionsMap> {
  const entries = await Promise.all(
    PROPERTY_DETAIL_PARTY_ROLE_KEYS.map(async (roleKey) => {
      const submission = await loadPropertyDetailPartySubmission({
        roleKey,
        ...input,
      });
      return [roleKey, submission] as const;
    }),
  );
  return Object.fromEntries(entries) as PropertyDetailPartySubmissionsMap;
}

/** Load submission snapshot for one party role on the property detail page. */
export async function loadPropertyDetailPartySubmission(input: {
  roleKey: PropertyDetailPartyRoleKey;
  parentTask: WorkflowTask | null;
  allTasks: WorkflowTask[];
  coordinatorName?: string;
}): Promise<PropertyDetailPartySubmission> {
  const { roleKey, parentTask, allTasks, coordinatorName = "" } = input;

  if (roleKey === "coordinator") {
    const child = childForRole(parentTask, allTasks, "coordinator");
    if (child) {
      const submission = await loadValuationCoordinationSubmissionSnapshot(child);
      if (submission) {
        return buildFromValuationCoordination(submission, child);
      }
    }
    return buildCoordinatorSubmission(parentTask, allTasks, coordinatorName);
  }

  if (!parentTask) {
    return emptySubmission(roleKey, "لم تُبدأ دراسة الحالة بعد");
  }

  if (roleKey === "specialist") {
    const draft = await loadCaseStudyFormDraft(parentTask.id);
    if (!draft) {
      return emptySubmission(roleKey, "لم يُقدَّم بعد");
    }
    return buildFromFormDraft(roleKey, draft);
  }

  const child = childForRole(parentTask, allTasks, roleKey);
  if (!child) {
    return emptySubmission(roleKey, "لم يُعيَّن بعد");
  }

  if (roleKey === "appraisal") {
    const submission = await loadEvaluatorSubmissionSnapshot(child.id);
    if (!submission) {
      return emptySubmission(roleKey, "لم يُقدَّم بعد");
    }
    return buildFromEvaluator(submission);
  }

  if (roleKey === "survey") {
    const submission = await loadEngineeringSurveySubmissionSnapshot(child.id);
    if (!submission) {
      return emptySubmission(roleKey, "لم يُقدَّم بعد");
    }
    return buildFromEngineeringSurvey(submission, child);
  }

  if (roleKey === "government") {
    const submission = await loadGovernmentReviewSubmissionSnapshot(child);
    if (!submission) {
      return emptySubmission(roleKey, "لم يُقدَّم بعد");
    }
    return buildFromGovernmentReview(submission, child);
  }

  if (roleKey === "inspection") {
    const submission = await loadFieldInspectionSubmissionSnapshot(child.id);
    if (!submission) {
      return emptySubmission(roleKey, "لم يُقدَّم بعد");
    }
    return buildFromFieldInspection(submission, child);
  }

  const draft = await loadPartyCaseStudyFormDraft(child.id);
  if (!draft) {
    return emptySubmission(roleKey, "لم يُقدَّم بعد");
  }
  return buildFromFormDraft(roleKey, draft, child);
}
