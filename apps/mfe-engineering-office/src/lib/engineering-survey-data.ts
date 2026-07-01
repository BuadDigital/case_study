import { jeddahDefaultCoords } from "./jeddah-default-coords";

/** نموذج التحقق الميداني — 13 بنداً (من engineering_office_screen.html). */
export const ENGINEERING_SURVEY_CHECKLIST_ITEMS = [
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
  checklist: EngineeringSurveyChecklistRow[];
  returnNote?: string;
  /** حقول الرفع لإنفاذ — المكتب الهندسي */
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

export function emptyChecklistRows(): EngineeringSurveyChecklistRow[] {
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
    checklist: emptyChecklistRows(),
    onSiteAreaSqm: "",
    northBoundary: "",
    northBoundaryLengthM: "",
    southBoundary: "",
    southBoundaryLengthM: "",
    eastBoundary: "",
    eastBoundaryLengthM: "",
    westBoundary: "",
    westBoundaryLengthM: "",
    surveyNotes: "",
    updatedAtUtc: now,
  };
}

export function isEngineeringSurveyFormLocked(
  status: EngineeringSurveySubmissionStatus,
): boolean {
  return status === "submitted";
}
