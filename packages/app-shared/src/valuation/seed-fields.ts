/**
 * Valuation field seed — typed port of docs/ejadah-cursor-package-v1/seed-fields-v3.js
 * sourceKind / correction model for catalog prep.
 * Full 118+ field list remains in the package JS; this module exports the contract + helpers.
 */

export type ValuationSourceKind =
  | "دور بشري"
  | "تلقائي من منصة خارجية"
  | "موروث"
  | "محسوب"
  | "نص ثابت"
  | "مشتق قابل للتحرير";

export type ValuationCorrection =
  | "تعديل مباشر"
  | "إرجاع للمصدر"
  | "اعتراض فقط"
  | "توليد أولي + تحرير حر";

export type ValuationSeedField = {
  label: string;
  section: string;
  type: string;
  unit?: string;
  sourceKind: ValuationSourceKind;
  sourceRef: string;
  responsible: string[];
  correction: ValuationCorrection;
  tags: string[];
  required: boolean;
  disabled?: boolean;
};

/** Core fields wired into the live product first. */
export const CORE_VALUATION_SEED_FIELDS: ValuationSeedField[] = [
  {
    label: "نوع الصك",
    section: "البيانات الأساسية",
    type: "قائمة اختيار",
    sourceKind: "دور بشري",
    sourceRef: "تفريغ الصك — تقليدي / سجل عيني",
    responsible: ["أخصائي دراسة الحالة"],
    correction: "تعديل مباشر",
    tags: ["تقييم", "مساحية"],
    required: true,
  },
  {
    label: "مخرج مطابقة الصك على الطبيعة",
    section: "دراسة الحالة",
    type: "قائمة اختيار",
    sourceKind: "دور بشري",
    sourceRef: "دارس حالة العقار (الأخصائي)",
    responsible: ["أخصائي دراسة الحالة"],
    correction: "تعديل مباشر",
    tags: ["تقييم", "بوابة جودة"],
    required: true,
  },
  {
    label: "مساحة الأرض",
    section: "البيانات الأساسية",
    type: "رقم",
    unit: "م²",
    sourceKind: "موروث",
    sourceRef: "الصك (التفريغ المنظم)",
    responsible: ["أخصائي دراسة الحالة"],
    correction: "اعتراض فقط",
    tags: ["تقييم", "مساحية"],
    required: true,
  },
  {
    label: "هل توجد مبانٍ/إنشاءات يجب تقييمها؟",
    section: "إعدادات التقييم",
    type: "نعم/لا",
    sourceKind: "دور بشري",
    sourceRef: "سؤال وجوبي — نعم يفتح حصر الإنشاءات والتكلفة",
    responsible: ["معاين", "مقيم عقاري"],
    correction: "تعديل مباشر",
    tags: ["تقييم", "أسلوب التكلفة"],
    required: true,
  },
  {
    label: "حصر الإنشاءات (أسطر)",
    section: "إعدادات التقييم",
    type: "جدول",
    unit: "م²",
    sourceKind: "دور بشري",
    sourceRef: "معاين ميداني — دور / سور / ملحق / قبو / أخرى",
    responsible: ["معاين"],
    correction: "تعديل مباشر",
    tags: ["تقييم", "أسلوب التكلفة"],
    required: false,
  },
  {
    label: "نوع مرفق التقرير",
    section: "المرفقات",
    type: "قائمة اختيار",
    sourceKind: "دور بشري",
    sourceRef: "قاموس مرفقات التقرير — يُصنّف من المكتبة",
    responsible: ["مقيم عقاري", "أخصائي دراسة الحالة"],
    correction: "تعديل مباشر",
    tags: ["تقييم", "مرفقات"],
    required: false,
  },
  {
    label: "يُطبع في التقرير",
    section: "المرفقات",
    type: "نعم/لا",
    sourceKind: "دور بشري",
    sourceRef: "علامة على المرفق المصنّف — مكتبة المعاملة ≠ مرفقات التقرير",
    responsible: ["مقيم عقاري"],
    correction: "تعديل مباشر",
    tags: ["تقييم", "مرفقات"],
    required: false,
  },
  {
    label: "سجل المقيمين",
    section: "إعدادات المنشأة",
    type: "جدول",
    sourceKind: "دور بشري",
    sourceRef: "إعدادات المنشأة — اسم / مسمى / فئة ورقم عضوية / فرع / توقيع",
    responsible: ["مشرف القسم"],
    correction: "تعديل مباشر",
    tags: ["تقييم", "هوية"],
    required: true,
  },
  {
    label: "بنك العقارات المقارنة",
    section: "العقارات المقارنة",
    type: "جدول",
    sourceKind: "دور بشري",
    sourceRef: "بنك مشترك — تاريخ العملية إلزامي؛ بطاقة المصدر مشتقة",
    responsible: ["مقيم عقاري", "معاين"],
    correction: "تعديل مباشر",
    tags: ["تقييم", "طريقة المقارنة"],
    required: false,
  },
];

export function isObjectOnlyCorrection(field: ValuationSeedField): boolean {
  return field.correction === "اعتراض فقط";
}
