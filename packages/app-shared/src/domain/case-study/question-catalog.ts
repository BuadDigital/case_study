import { getFieldDictionary, type FieldDictionaryFieldDto } from "@platform/api-client";
import { PROPERTY_FIELDS_CATALOG } from "@platform/app-shared/app-data/property-fields-catalog";
import { workOrdersApiConfig } from "@platform/app-shared/app-data/work-orders-api-config";

export type CaseStudyQuestionSection =
  | "deed"
  | "survey"
  | "comp"
  | "occ"
  | "extra";

const SECTION_GROUP_IDS: Record<CaseStudyQuestionSection, string> = {
  deed: "case-study-deed",
  survey: "case-study-survey",
  comp: "case-study-comp",
  occ: "case-study-occ",
  extra: "case-study-extra",
};

const CASE_STUDY_QUESTION_KEY = /^(deed|survey|comp|occ|extra)_\d+$/;

export type CaseStudyQuestionCatalog = {
  labelsByKey: Record<string, string>;
  sectionKeys: Record<CaseStudyQuestionSection, readonly string[]>;
  sectionQuestions: Record<CaseStudyQuestionSection, readonly string[]>;
};

function fieldsForSection(section: CaseStudyQuestionSection) {
  const group = PROPERTY_FIELDS_CATALOG.find(
    (entry) => entry.id === SECTION_GROUP_IDS[section],
  );
  return group?.fields ?? [];
}

function buildSectionMaps(
  labelsByKey: Record<string, string>,
): Pick<CaseStudyQuestionCatalog, "sectionKeys" | "sectionQuestions"> {
  const sectionKeys = {} as Record<CaseStudyQuestionSection, readonly string[]>;
  const sectionQuestions = {} as Record<
    CaseStudyQuestionSection,
    readonly string[]
  >;

  for (const section of Object.keys(SECTION_GROUP_IDS) as CaseStudyQuestionSection[]) {
    const keys = fieldsForSection(section).map((field) => field.key);
    sectionKeys[section] = keys;
    sectionQuestions[section] = keys.map(
      (key) => labelsByKey[key] ?? key,
    );
  }

  return { sectionKeys, sectionQuestions };
}

export function buildDefaultCaseStudyQuestionCatalog(): CaseStudyQuestionCatalog {
  const labelsByKey: Record<string, string> = {};
  for (const section of Object.keys(SECTION_GROUP_IDS) as CaseStudyQuestionSection[]) {
    for (const field of fieldsForSection(section)) {
      labelsByKey[field.key] = field.label;
    }
  }
  return {
    labelsByKey,
    ...buildSectionMaps(labelsByKey),
  };
}

export const DEFAULT_CASE_STUDY_QUESTION_CATALOG =
  buildDefaultCaseStudyQuestionCatalog();

export function mergeFieldDictionaryIntoCaseStudyCatalog(
  base: CaseStudyQuestionCatalog,
  fields: readonly FieldDictionaryFieldDto[],
): CaseStudyQuestionCatalog {
  const labelsByKey = { ...base.labelsByKey };

  for (const field of fields) {
    if (!CASE_STUDY_QUESTION_KEY.test(field.key)) continue;
    const label = field.name?.trim();
    if (label) labelsByKey[field.key] = label;
  }

  return {
    labelsByKey,
    ...buildSectionMaps(labelsByKey),
  };
}

export function questionLabelFromCatalog(
  catalog: CaseStudyQuestionCatalog,
  key: string,
  fallback = key,
): string {
  return catalog.labelsByKey[key] ?? fallback;
}

export async function loadCaseStudyQuestionCatalog(): Promise<CaseStudyQuestionCatalog> {
  const base = DEFAULT_CASE_STUDY_QUESTION_CATALOG;
  const config = workOrdersApiConfig();
  if (!config) return base;

  const result = await getFieldDictionary(config);
  if (!result.ok || result.data.fields.length === 0) return base;

  return mergeFieldDictionaryIntoCaseStudyCatalog(base, result.data.fields);
}

/** Stable answer key for a question: `<section>_<index>`. */
export function caseStudyAnswerKey(
  section: CaseStudyQuestionSection,
  index: number,
): string {
  return `${section}_${index}`;
}

/** Wizard steps for the case-study form. */
export const CASE_STUDY_FORM_STEPS = [
  { id: 1, label: "بيانات الصك والعقار" },
  { id: 2, label: "الرفع المساحي والطبيعة" },
  { id: 3, label: "مكونات العقار" },
  { id: 4, label: "الإشغال والإيجار" },
  { id: 5, label: "ملاحظات إضافية" },
] as const;

/** Default question bank per section. */
export const CASE_STUDY_SECTION_QUESTIONS =
  DEFAULT_CASE_STUDY_QUESTION_CATALOG.sectionQuestions;
