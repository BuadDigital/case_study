import {
  CASE_STUDY_FORM_STEPS,
  CASE_STUDY_TABLE_HEADERS,
  caseStudyFormSummary,
  type CaseStudyFormAnswer,
  type CaseStudyQuestionSection,
} from "./case-study-form-data";
import {
  DEFAULT_CASE_STUDY_QUESTION_CATALOG,
  questionLabelFromCatalog,
} from "./case-study-question-catalog";
import {
  type CaseStudyFormDraft,
  type CaseStudyFormStatus,
} from "./case-study-form-storage";
import { childTasksForCaseStudyParent } from "./case-study-party-answers";
import {
  INSPECTOR_FEATURE_FIELDS,
  inspectorWorkspaceStatusLabel,
} from "./inspector-workspace-data";
import type { InspectorWorkspaceSnapshot } from "./inspector-workspace-storage";
import type { PropertyDetailPartyRoleKey } from "./property-detail-parties";
import {
  migrateDistribution,
  type WorkflowTask,
  type WorkflowTaskKind,
  type WorkflowTaskStatus,
} from "./tasks-storage";
import { formatDateAr } from "./po-intake-data";
import { INFATH_FIELD_LABELS } from "./infath-field-labels";
import {
  appraiserOnlyCaseStudyChecklistItems,
  caseStudyAnswerDisplayLabel,
  isEvaluatorChecklistQuestionAssignedToAppraiser,
  type EvaluatorChecklistBooleanKey,
} from "@evaluator/mfe/lib/evaluator/evaluator-checklist-case-study-sync";
import type { EvaluatorChecklistAnswers } from "@evaluator/mfe/lib/evaluator/evaluator-window-data";
import type { CaseStudyInfoRolesMatrix } from "@settings/mfe";
import { formatGovernmentReviewKeysProofLabel } from "./government-review-work-data";
import type {
  EngineeringSurveyChecklistAnswer,
  EngineeringSurveyChecklistRow,
  EngineeringSurveySubmissionSnapshot,
  EvaluatorChecklist,
  EvaluatorSubmissionSnapshot,
  GovernmentReviewSubmissionSnapshot,
  PartyAnswerRow,
  PropertyDetailPartySubmission,
  ValuationCoordinationSubmissionSnapshot,
} from "./property-detail-party-submission-types";

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

export function formStatusLabel(status: CaseStudyFormStatus): string {
  if (status === "submitted") return "مُقدَّم";
  if (status === "draft") return "مسودة";
  return "جديد";
}

export function workflowStatusLabel(status: WorkflowTaskStatus): string {
  if (status === "completed") return "مكتمل";
  if (status === "blocked") return "معلّق";
  return "قيد التنفيذ";
}

export function answerDisplay(
  section: CaseStudyQuestionSection,
  value: CaseStudyFormAnswer,
): string {
  const headers = CASE_STUDY_TABLE_HEADERS[section];
  return value === "A" ? headers.colA : headers.colB;
}

export function questionLabelFromKey(key: string): string | null {
  const label = questionLabelFromCatalog(
    DEFAULT_CASE_STUDY_QUESTION_CATALOG,
    key,
    "",
  );
  return label || null;
}

export function answeredRows(
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

export function nonEmptyRemarks(draft: CaseStudyFormDraft): { label: string; value: string }[] {
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

export function childForRole(
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

export function evaluatorStatusLabel(status: string): string {
  if (status === "draft") return "مسودة";
  if (status === "submitted") return "مُرسَل للأخصائي";
  if (status === "reopened") return "مُعاد للتعديل";
  if (status === "completed") return "مكتمل";
  return status;
}

export function engineeringSurveyStatusLabel(
  status: EngineeringSurveySubmissionSnapshot["status"],
): string {
  if (status === "submitted") return "مُرسَل";
  if (status === "reopened") return "مُعاد للتصحيح";
  return "قيد العمل";
}

export function engineeringSurveyAnswerLabel(
  value: EngineeringSurveyChecklistAnswer,
): string {
  if (value === "yes") return "نعم";
  if (value === "no") return "لا";
  return "—";
}

export function checklistAnswerLabel(value: boolean | null): string {
  if (value === true) return "نعم";
  if (value === false) return "لا";
  return "—";
}

export function evaluatorChecklistRows(
  checklist: EvaluatorChecklist,
  matrix?: CaseStudyInfoRolesMatrix,
  caseStudyAnswers?: Record<string, CaseStudyFormAnswer | null | undefined>,
): PartyAnswerRow[] {
  const labels: Record<EvaluatorChecklistBooleanKey, string> = {
    q_plan_match: "هل رقم المخطط مطابق للصك؟",
    q_excess_zoning: "هل القطعة زائدة تنظيمية؟",
    q_land_waqf: "هل الأرض موقوفة؟",
    q_property_waqf: "هل العقار موقوف؟",
    q_expropriation: "هل يوجد نزع على منطقة العقار؟",
    q_property_use_verified: "هل تم التأكد من استخدام العقار؟",
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
  for (const [id, label] of Object.entries(labels) as [
    EvaluatorChecklistBooleanKey,
    string,
  ][]) {
    if (
      matrix &&
      !isEvaluatorChecklistQuestionAssignedToAppraiser(matrix, id)
    ) {
      continue;
    }
    const value = checklist[id];
    rows.push({
      question: label,
      answer: checklistAnswerLabel(
        typeof value === "boolean" ? value : null,
      ),
    });
  }

  if (matrix) {
    for (const item of appraiserOnlyCaseStudyChecklistItems(matrix)) {
      rows.push({
        question: item.label,
        answer: caseStudyAnswerDisplayLabel(
          caseStudyAnswers?.[item.caseStudyKey],
        ),
      });
    }
  }

  if (
    checklist.q_shared_deed === true &&
    (!matrix ||
      isEvaluatorChecklistQuestionAssignedToAppraiser(matrix, "q_shared_deed"))
  ) {
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
  if (
    techNotes &&
    (!matrix ||
      isEvaluatorChecklistQuestionAssignedToAppraiser(
        matrix,
        "q_technical_notes_exists",
      ))
  ) {
    rows.push({ question: "الملاحظات الفنية", answer: techNotes });
  }

  return rows;
}

export function engineeringSurveyChecklistRows(
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

export function engineeringSurveyChecklistRemarks(
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

export function formatCoordsDisplay(lat: string, lng: string): string {
  const latTrim = lat.trim();
  const lngTrim = lng.trim();
  if (!latTrim && !lngTrim) return "";
  if (latTrim && lngTrim) return `${latTrim}، ${lngTrim}`;
  return latTrim || lngTrim;
}

export function buildFromEngineeringSurvey(
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
    submittedAtUtc: submission.submittedAtUtc ?? null,
    fields,
    answers,
    remarks,
  };
}

export function formatPriceDisplay(raw: string): string {
  const n = Number.parseFloat(raw.replace(/,/g, ""));
  if (!Number.isFinite(n) || n <= 0) return "";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "SAR",
    maximumFractionDigits: 2,
  }).format(n);
}

export function buildFromFormDraft(
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
    submittedAtUtc:
      draft.status === "submitted" ? draft.savedAtUtc?.trim() || null : null,
    fields,
    answers,
    remarks,
  };
}

export function buildFromEvaluator(
  submission: EvaluatorSubmissionSnapshot,
  matrix?: CaseStudyInfoRolesMatrix,
  caseStudyAnswers?: Record<string, CaseStudyFormAnswer | null | undefined>,
): PropertyDetailPartySubmission {
  const answers = evaluatorChecklistRows(
    submission.checklist,
    matrix,
    caseStudyAnswers,
  );
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
    submittedAtUtc: submission.submittedAtUtc,
    fields,
    answers,
    remarks,
  };
}

export function buildFromFieldInspection(
  submission: InspectorWorkspaceSnapshot,
  childTask?: WorkflowTask | null,
): PropertyDetailPartySubmission {
  const fields: PropertyDetailPartySubmission["fields"] = [
    {
      label: "حالة المعاينة",
      value: inspectorWorkspaceStatusLabel(submission.status),
    },
  ];

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
  pushInspectionField("وقت المعاينة", submission.inspectionTime, true);
  if (submission.mapLatitude.trim() || submission.mapLongitude.trim()) {
    pushInspectionField(
      INFATH_FIELD_LABELS.mapCoords,
      `${submission.mapLatitude.trim()}, ${submission.mapLongitude.trim()}`,
      true,
    );
  }

  for (const field of INSPECTOR_FEATURE_FIELDS) {
    pushInspectionField(field.label, submission.featureValues[field.key] ?? "");
  }

  pushInspectionField(INFATH_FIELD_LABELS.streetName, submission.streetName);
  pushInspectionField(INFATH_FIELD_LABELS.mainStreet, submission.mainStreetName);
  pushInspectionField(INFATH_FIELD_LABELS.streetWidth, submission.streetWidthM, true);
  pushInspectionField(INFATH_FIELD_LABELS.roomCount, submission.roomCount, true);
  pushInspectionField(INFATH_FIELD_LABELS.hallCount, submission.hallCount, true);
  pushInspectionField(INFATH_FIELD_LABELS.unitCount, submission.unitCount, true);
  pushInspectionField(
    INFATH_FIELD_LABELS.bathroomCount,
    submission.bathroomCount,
    true,
  );
  pushInspectionField(
    INFATH_FIELD_LABELS.propertyAge,
    submission.propertyAgeYears,
    true,
  );
  pushInspectionField(
    INFATH_FIELD_LABELS.showroomCount,
    submission.showroomCount,
    true,
  );
  pushInspectionField(INFATH_FIELD_LABELS.wellCount, submission.wellCount, true);
  pushInspectionField(INFATH_FIELD_LABELS.towerCount, submission.towerCount, true);
  pushInspectionField(INFATH_FIELD_LABELS.builtArea, submission.builtArea, true);
  pushInspectionField(
    INFATH_FIELD_LABELS.buildingFloors,
    submission.buildingFloors,
    true,
  );
  pushInspectionField(
    INFATH_FIELD_LABELS.basementTotal,
    submission.basementTotal,
    true,
  );
  pushInspectionField(INFATH_FIELD_LABELS.annexTotal, submission.annexTotal, true);
  pushInspectionField(
    INFATH_FIELD_LABELS.buildingsTotal,
    submission.buildingsTotal,
    true,
  );
  pushInspectionField(
    INFATH_FIELD_LABELS.services,
    submission.services.join("، "),
  );
  pushInspectionField(
    INFATH_FIELD_LABELS.amenities,
    submission.amenities.join("، "),
  );

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

  for (const obs of submission.observations) {
    if (!obs.text.trim()) continue;
    remarks.push({
      label: obs.category.trim() || "ملاحظة موثّقة",
      value: obs.text.trim(),
    });
  }

  const hasData =
    submission.status !== "draft" ||
    fields.length > 1 ||
    remarks.length > 0;

  return {
    roleKey: "inspection",
    hasData,
    emptyReason: hasData ? undefined : "لم يُقدَّم بعد",
    statusLabel: inspectorWorkspaceStatusLabel(submission.status),
    taskStatusLabel: childTask
      ? workflowStatusLabel(childTask.status)
      : undefined,
    submittedAtUtc: submission.submittedAtUtc ?? null,
    fields,
    answers: [],
    remarks,
  };
}

export function buildFromGovernmentReview(
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
  if (submission.keyHandedToInspector) {
    fields.push({
      label: "تسليم المفتاح للمعاين",
      value:
        submission.keyHandedToInspector === "yes"
          ? "نعم — تم التسليم"
          : "لا — لم يُسلَّم بعد",
    });
  }
  if (submission.propertyZoneStatus?.trim()) {
    fields.push({
      label: INFATH_FIELD_LABELS.zoneStatus,
      value: submission.propertyZoneStatus.trim(),
    });
  }
  const keysProofLabel = formatGovernmentReviewKeysProofLabel(
    submission.keysProofFiles ?? [],
  );
  if (keysProofLabel) {
    fields.push({
      label: INFATH_FIELD_LABELS.keysProof,
      value: keysProofLabel,
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
    submittedAtUtc: submission.submittedAtUtc,
    fields,
    answers: [],
    remarks,
  };
}

export function buildFromValuationCoordination(
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
    submittedAtUtc: submission.submittedAtUtc,
    fields,
    answers: [],
    remarks,
  };
}

export function buildCoordinatorSubmission(
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
    submittedAtUtc:
      child?.status === "completed" ? child.updatedAt || null : null,
    fields,
    answers: [],
    remarks: [],
  };
}

export function emptySubmission(
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