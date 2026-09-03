import { jeddahDefaultCoords } from "@platform/app-shared/domain/jeddah-default-coords";

/** Field verification checklist — 13 items (from engineering_office_screen.html). */
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
   * Does the deed match nature?
   * Yes → use deed boundaries and lengths only
   * No → open extra «per nature» fields
   */
  deedMatchesNature: "yes" | "no" | null;
  /** Boundaries and lengths per deed (always) */
  onSiteAreaSqm: string;
  northBoundary: string;
  northBoundaryLengthM: string;
  southBoundary: string;
  southBoundaryLengthM: string;
  eastBoundary: string;
  eastBoundaryLengthM: string;
  westBoundary: string;
  westBoundaryLengthM: string;
  /** Boundaries and lengths per nature (when deedMatchesNature = no) */
  natureOnSiteAreaSqm: string;
  natureNorthBoundary: string;
  natureNorthBoundaryLengthM: string;
  natureSouthBoundary: string;
  natureSouthBoundaryLengthM: string;
  natureEastBoundary: string;
  natureEastBoundaryLengthM: string;
  natureWestBoundary: string;
  natureWestBoundaryLengthM: string;
  /** Survey notes inside the survey tab (HTML `d.notes`). */
  surveyNotes: string;
  /** Transaction note in the note tab (HTML `d.note`). */
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

  // 13 rows created only on the fallback path — were allocated then discarded on the common path.
  return emptyChecklistRows();
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
