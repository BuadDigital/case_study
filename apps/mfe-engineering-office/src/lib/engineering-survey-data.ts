import { jeddahDefaultCoords } from "./jeddah-default-coords";

/** نموذج التحقق الميداني — 13 بنداً (من engineering_office_screen.html). */
export const ENGINEERING_SURVEY_CHECKLIST_ITEMS = [
  "هل الصك مطابق للرفع المساحي (الأطوال والمساحة)",
  "هل تم الوقوف على الموقع من قِبل طالب التنفيذ وتوقيع إقرار صحة الاستدلال على الموقع",
  "هل يوجد اختلاف في رقم القطعة / المخطط / البلوك / اسم الحي / اسم المدينة للمستكشف",
  "هل يوجد اختلاف في مساحة / أطوال الصك عن الطبيعة",
  "هل يوجد شوارع محتزلة / شطفات على الأصل في المخطط ولم يذكر في الصك",
  "هل يوجد تداخل في الصك أو أجزاء مشتركة ظاهرياً",
  "هل تم ذكر المرجع المعتمد عليه في الاستدلال على استخدام العقار",
  "هل الموقع أرض فضاء",
  "هل يوجد غرفة كهرباء داخل / خارج حدود الموقع",
  "هل يوجد صناديق خدمات كهربائية / اتصالات / أخرى داخل أو خارج حدود العقار",
  "هل تم تطبيق جميع التعليمات الصادرة من المركز في الرفع المساحي",
  "هل يوجد أسوار داخلية وخارجية بمحيط المبنى القائم بالموقع",
  "هل يوجد اختلاف في الحدود / الصك أو الأفادة من المستكشف",
] as const;

export type ChecklistAnswer = "yes" | "no" | null;

export type EngineeringSurveyChecklistRow = {
  answer: ChecklistAnswer;
  note: string;
};

export type EngineeringSurveySubmissionStatus =
  | "draft"
  | "submitted"
  | "reopened";

export type EngineeringSurveySubmission = {
  taskId: string;
  propertyId: string;
  poNumber: string;
  status: EngineeringSurveySubmissionStatus;
  latitude: string;
  longitude: string;
  surveyReportFileName: string;
  siteLetterFileName: string;
  siteConfirmed: boolean;
  /** Once true, clearing contact phone later must not re-lock declaration. */
  declarationPhoneSatisfied: boolean;
  checklist: EngineeringSurveyChecklistRow[];
  returnNote?: string;
  /**
   * هل الصك مطابق للطبيعة؟
   * نعم → تُعتمد حدود وأطوال حسب الصك فقط
   * لا → تُفتح حقول إضافية «حسب الطبيعة»
   */
  deedMatchesNature: "yes" | "no" | null;
  /** الحدود والأطوال حسب الصك (دائماً) */
  onSiteAreaSqm: string;
  northBoundary: string;
  northBoundaryLengthM: string;
  southBoundary: string;
  southBoundaryLengthM: string;
  eastBoundary: string;
  eastBoundaryLengthM: string;
  westBoundary: string;
  westBoundaryLengthM: string;
  /** الحدود والأطوال حسب الطبيعة (عند deedMatchesNature = no) */
  natureOnSiteAreaSqm: string;
  natureNorthBoundary: string;
  natureNorthBoundaryLengthM: string;
  natureSouthBoundary: string;
  natureSouthBoundaryLengthM: string;
  natureEastBoundary: string;
  natureEastBoundaryLengthM: string;
  natureWestBoundary: string;
  natureWestBoundaryLengthM: string;
  /** ملاحظات الرفع المساحي داخل تبويب الرفع (HTML `d.notes`). */
  surveyNotes: string;
  /** ملاحظة على المعاملة في تبويب الملاحظة (HTML `d.note`). */
  transactionNote: string;
  updatedAtUtc: string;
  submittedAtUtc?: string;
  /** Set once a specialist accepts the outputs; drives the fee-accrued panel state. */
  acceptedAtUtc?: string;
  /**
   * From party-task-submission API (server). Sibling field-inspection completed.
   * Undefined until DTO is loaded from the network.
   */
  fieldInspectionCompleted?: boolean;
};

function emptyChecklistRows(): EngineeringSurveyChecklistRow[] {
  return ENGINEERING_SURVEY_CHECKLIST_ITEMS.map(() => ({
    answer: null,
    note: "",
  }));
}

function parseChecklistRow(raw: unknown): EngineeringSurveyChecklistRow {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { answer: null, note: "" };
  }
  const row = raw as Record<string, unknown>;
  const ans = row.answer;
  const answer: ChecklistAnswer =
    ans === "yes" || ans === true
      ? "yes"
      : ans === "no" || ans === false
        ? "no"
        : null;
  return {
    answer,
    note: typeof row.note === "string" ? row.note : "",
  };
}

/** API / legacy payloads may store checklist as a non-array object. */
export function normalizeEngineeringSurveyChecklist(
  raw: unknown,
): EngineeringSurveyChecklistRow[] {
  const defaults = emptyChecklistRows();

  if (Array.isArray(raw)) {
    return ENGINEERING_SURVEY_CHECKLIST_ITEMS.map((_, index) =>
      parseChecklistRow(raw[index]),
    );
  }

  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const numericKeys = Object.keys(obj).filter((k) => /^\d+$/.test(k));
    if (numericKeys.length > 0) {
      const sorted = numericKeys.sort((a, b) => Number(a) - Number(b));
      return normalizeEngineeringSurveyChecklist(
        sorted.map((key) => obj[key]),
      );
    }
  }

  return defaults;
}

export function createEngineeringSurveyDraft(input: {
  taskId: string;
  propertyId: string;
  poNumber: string;
}): EngineeringSurveySubmission {
  const now = new Date().toISOString();
  const { latitude, longitude } = jeddahDefaultCoords();
  return {
    ...input,
    status: "draft",
    latitude,
    longitude,
    surveyReportFileName: "",
    siteLetterFileName: "",
    siteConfirmed: false,
    declarationPhoneSatisfied: false,
    checklist: emptyChecklistRows(),
    deedMatchesNature: null,
    onSiteAreaSqm: "",
    northBoundary: "",
    northBoundaryLengthM: "",
    southBoundary: "",
    southBoundaryLengthM: "",
    eastBoundary: "",
    eastBoundaryLengthM: "",
    westBoundary: "",
    westBoundaryLengthM: "",
    natureOnSiteAreaSqm: "",
    natureNorthBoundary: "",
    natureNorthBoundaryLengthM: "",
    natureSouthBoundary: "",
    natureSouthBoundaryLengthM: "",
    natureEastBoundary: "",
    natureEastBoundaryLengthM: "",
    natureWestBoundary: "",
    natureWestBoundaryLengthM: "",
    surveyNotes: "",
    transactionNote: "",
    updatedAtUtc: now,
  };
}

export function isEngineeringSurveyFormLocked(
  status: EngineeringSurveySubmissionStatus,
): boolean {
  return status === "submitted";
}
