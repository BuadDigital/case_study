import type { RoleId } from "@platform/types";
import {
  CASE_STUDY_FORM_STEPS,
  CASE_STUDY_SECTION_QUESTIONS,
  caseStudyAnswerKey,
  type CaseStudyQuestionSection,
} from "@case-study/mfe/lib/prototype/case-study-form-data";

/** طرف في مصفوفة علاقة المستخدم بالمعلومة */
export type CaseStudyInfoPartyId =
  | "specA"
  | "insp"
  | "gov"
  | "val"
  | "eng"
  | "sup";

export type CaseStudyInfoRoleType =
  | "primary"
  | "secondary"
  | "verify"
  | "none";

export type CaseStudyInfoParty = {
  id: CaseStudyInfoPartyId;
  name: string;
  abbr: string;
  color: string;
  roleId: RoleId;
};

export const CASE_STUDY_INFO_PARTIES: CaseStudyInfoParty[] = [
  {
    id: "specA",
    name: "أخصائي دراسة الحالة",
    abbr: "أخ",
    color: "#7C3AED",
    roleId: "case-specialist",
  },
  {
    id: "insp",
    name: "المعاين العقاري",
    abbr: "مع",
    color: "#102b4e",
    roleId: "field-inspector",
  },
  {
    id: "gov",
    name: "المراجع الحكومي",
    abbr: "حك",
    color: "#0284C7",
    roleId: "government-reviewer",
  },
  {
    id: "val",
    name: "المقيم العقاري",
    abbr: "قم",
    color: "#DC2626",
    roleId: "real-estate-appraiser",
  },
  {
    id: "eng",
    name: "المكتب الهندسي",
    abbr: "هن",
    color: "#D97706",
    roleId: "engineering-office",
  },
  {
    id: "sup",
    name: "مشرف دراسة الحالة",
    abbr: "مش",
    color: "#0D9488",
    roleId: "section-supervisor",
  },
];

export const CASE_STUDY_INFO_ROLE_TYPES: {
  id: CaseStudyInfoRoleType;
  label: string;
  bg: string;
  color: string;
  icon: string;
}[] = [
  { id: "primary", label: "أصيل", bg: "#F3EEFF", color: "#5B21B6", icon: "أ" },
  { id: "secondary", label: "ثانوي", bg: "#ECFDF5", color: "#065F46", icon: "ث" },
  { id: "verify", label: "معتمد", bg: "#FFF7ED", color: "#92400E", icon: "م" },
  { id: "none", label: "لا دور", bg: "#F8FAFD", color: "#94A3B8", icon: "×" },
];

export type CaseStudyQuestionCatalogItem = {
  key: string;
  section: CaseStudyQuestionSection;
  sectionLabel: string;
  index: number;
  text: string;
};

const SECTION_LABELS: Record<CaseStudyQuestionSection, string> = {
  deed: "بيانات الصك والعقار",
  survey: "الرفع المساحي والطبيعة",
  comp: "مكونات العقار",
  occ: "الإشغال والإيجار",
  extra: "ملاحظات إضافية",
};

export function buildCaseStudyQuestionCatalog(): CaseStudyQuestionCatalogItem[] {
  const items: CaseStudyQuestionCatalogItem[] = [];
  (
    Object.keys(CASE_STUDY_SECTION_QUESTIONS) as CaseStudyQuestionSection[]
  ).forEach((section) => {
    CASE_STUDY_SECTION_QUESTIONS[section].forEach((text, index) => {
      items.push({
        key: caseStudyAnswerKey(section, index),
        section,
        sectionLabel: SECTION_LABELS[section],
        index,
        text,
      });
    });
  });
  return items;
}

export const CASE_STUDY_QUESTION_CATALOG = buildCaseStudyQuestionCatalog();

export const CASE_STUDY_INFO_SECTIONS = CASE_STUDY_FORM_STEPS.map((s, i) => {
  const sectionIds: CaseStudyQuestionSection[] = [
    "deed",
    "survey",
    "comp",
    "occ",
    "extra",
  ];
  const id = sectionIds[i];
  return {
    id,
    label: s.label,
    color:
      id === "deed"
        ? "#0284C7"
        : id === "survey"
          ? "#102b4e"
          : id === "comp"
            ? "#D97706"
            : id === "occ"
              ? "#7C3AED"
              : "#DC2626",
    questionCount: CASE_STUDY_SECTION_QUESTIONS[id].length,
  };
});

export function partyIdForRoleId(roleId: RoleId): CaseStudyInfoPartyId | null {
  return (
    CASE_STUDY_INFO_PARTIES.find((p) => p.roleId === roleId)?.id ?? null
  );
}

export function partyById(id: CaseStudyInfoPartyId): CaseStudyInfoParty {
  const p = CASE_STUDY_INFO_PARTIES.find((x) => x.id === id);
  if (!p) throw new Error(`Unknown party ${id}`);
  return p;
}
