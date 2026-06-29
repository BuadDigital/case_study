/** Seed catalog from docs/_تعذرات_وثيقة_مراجعة.html — six categories, eleven problem types. */

export type FailureTypeCategory = {
  id: string;
  label: string;
  order: number;
};

export type FailureProblemType = {
  id: string;
  categoryId: string;
  label: string;
  description?: string;
  order: number;
};

export const FAILURE_TYPE_CATEGORIES: FailureTypeCategory[] = [
  { id: "deed-documents", label: "مشاكل الصك والوثائق", order: 1 },
  { id: "location", label: "مشاكل تحديد الموقع والحدود", order: 2 },
  {
    id: "ownership",
    label: "مشاكل الملكية والحدود المساحية",
    order: 3,
  },
  { id: "access", label: "مشاكل الدخول والتمكين", order: 4 },
  { id: "contents", label: "مشاكل محتوى العقار", order: 5 },
  { id: "parties", label: "مشاكل الأطراف والتعاون", order: 6 },
];

export const FAILURE_PROBLEM_TYPES: FailureProblemType[] = [
  {
    id: "deed-suspended",
    categoryId: "deed-documents",
    label: "الصك موقوف",
    order: 1,
  },
  {
    id: "deed-inactive",
    categoryId: "deed-documents",
    label: "الصك غير فعال",
    order: 2,
  },
  {
    id: "unknown-location",
    categoryId: "location",
    label: "عدم معرفة موقع العقار",
    description:
      "بدون قطعة / بدون مخطط في الصك، والمالك لا يعرف الموقع",
    order: 3,
  },
  {
    id: "unknown-boundaries",
    categoryId: "location",
    label: "عدم معرفة حدود العقار",
    order: 4,
  },
  {
    id: "property-overlap",
    categoryId: "ownership",
    label: "تداخل العقار",
    description: "جزء من العقار داخل على حدود عقار آخر أو العكس",
    order: 5,
  },
  {
    id: "shared-property",
    categoryId: "ownership",
    label: "عقار مشترك",
    description: "مبنى واحد على أرضين، فقط إحداهما مُسندة للمعاملة",
    order: 6,
  },
  {
    id: "key-wont-open",
    categoryId: "access",
    label: "مفتاح العقار لا يفتح",
    order: 7,
  },
  {
    id: "access-denied",
    categoryId: "access",
    label: "عدم تمكين دخول العقار",
    description:
      "رفض دخول أو سكان بدون محظر تمكين أو عقد إيجار",
    order: 8,
  },
  {
    id: "movables-present",
    categoryId: "contents",
    label: "وجود منقولات في العقار",
    description: "منقولات ذات قيمة أو مركبات",
    order: 9,
  },
  {
    id: "party-uncooperative",
    categoryId: "parties",
    label: "عدم تعاون أحد أطراف التنفيذ",
    description: "عدم الرد، المماطلة، أو التهرب",
    order: 10,
  },
  {
    id: "location-declaration-refused",
    categoryId: "parties",
    label: "رفض توقيع إقرار صحة الموقع",
    description: "من أحد أطراف التنفيذ أو من ينوبهم",
    order: 11,
  },
];

export function getFailureProblemType(
  id: string,
): FailureProblemType | undefined {
  return FAILURE_PROBLEM_TYPES.find((t) => t.id === id);
}

export function getFailureCategory(
  categoryId: string,
): FailureTypeCategory | undefined {
  return FAILURE_TYPE_CATEGORIES.find((c) => c.id === categoryId);
}

export function failureProblemTypeLabel(
  problemTypeId: string,
  fallbackTitle?: string,
): string {
  const type = getFailureProblemType(problemTypeId);
  if (type) return type.label;
  return fallbackTitle?.trim() || "تعذر";
}

export const DEED_INACTIVE_RESOLVED_LABEL =
  "الصك كان غير فعال سابقاً لكن تم حل المشكلة";

/** Free-text problems entered by the user instead of catalog pickers. */
export const FREE_TEXT_FAILURE_PROBLEM_TYPE_ID = "free-text";
