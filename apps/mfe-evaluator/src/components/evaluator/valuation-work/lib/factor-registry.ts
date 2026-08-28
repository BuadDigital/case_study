/**
 * سجل عوامل التسوية — الوصف الكامل لكل عامل في مدخل بيانات واحد،
 * فإضافة عامل جديد = صف هنا لا فروعاً شرطية في جدول التسويات.
 */

/** كيف تُملأ خانة «العقار محل التقييم» في صف العامل. */
export type FactorSubjectCell = "valuation-date" | "ideal-area" | "location";

/** أي ملاحظة تظهر تحت خلية المقارن في صف العامل. */
export type FactorCompNote = "deal-age" | "kind-suggested";

export type FactorDescriptor = {
  label: string;
  hint: string;
  tip: string;
  /** تسلسلية (ضربية بالترتيب) أم من عوامل الاختلاف. */
  sequential?: boolean;
  /** حاضر دوماً ولو غاب من بيانات الأسطر (ظروف السوق مرساة الجدول). */
  alwaysPresent?: boolean;
  /** التسلسلية القابلة للحذف — ظروف السوق لا تُحذف. */
  deletable?: boolean;
  /** خلية وصف/عمود عقار قابلة للتحرير (الموقع يُقرأ من المدينة/الحي). */
  specCell?: boolean;
  subjectCell?: FactorSubjectCell;
  compNote?: FactorCompNote;
};

export const AUTO_AREA_KEY = "area";

export const FACTOR_REGISTRY: Record<string, FactorDescriptor> = {
  financing: {
    label: "تسوية شروط التمويل",
    hint: "نسبة ٪ — تسلسلية",
    tip: "أثر شروط البيع والتمويل غير النقدية على السعر المرصود.",
    sequential: true,
    deletable: true,
  },
  market: {
    label: "تسوية ظروف السوق",
    hint: "تُدخل يدوياً — يظهر عمر الصفقة للاستدلال",
    tip: "فرق الزمن بين تاريخ المقارن وتاريخ التقييم — يقدّرها المقيّم يدوياً.",
    sequential: true,
    alwaysPresent: true,
    subjectCell: "valuation-date",
    compNote: "deal-age",
  },
  transaction_type: {
    label: "تسوية نوع المقارن",
    hint: "صفقة / عرض / حد / سوم",
    tip: "الفرق بين سعر المقارن وسعر السوق بحسب نوعه.",
    sequential: true,
    deletable: true,
    compNote: "kind-suggested",
  },
  area: {
    label: "المساحة",
    hint: "آلية",
    tip: "فرق مساحة القطعة عن مساحة المقارن، مقيساً بطريقة المضاعف أو الأمثال. المقارن الأصغر يأخذ تسوية سالبة والأكبر موجبة.",
  },
  ideal_area: {
    label: "المساحة المثالية",
    hint: "قرب المساحة من السائد في الحي",
    tip: "قرب مساحة القطعة من المساحة السائدة للاستخدام في الحي. لا يشمل الفرق العددي في المساحة.",
    subjectCell: "ideal-area",
  },
  location: {
    label: "الموقع",
    hint: "أفضلية الحي أو المنطقة",
    tip: "أفضلية الحي أو المنطقة مقارنةً بغيرها. لا يشمل القرب من معلم محدد.",
    specCell: false,
    subjectCell: "location",
  },
  attraction: {
    label: "عامل الجذب للموقع",
    hint: "القرب من معلم أو مرفق يرفع الطلب",
    tip: "القرب من معلم أو مرفق محدد يرفع الطلب.",
  },
  access: {
    label: "سهولة الوصول",
    hint: "موضع القطعة داخل نسيج الحي",
    tip: "موضع القطعة داخل نسيج الحي وسهولة بلوغها.",
  },
  street_count: {
    label: "عدد الشوارع",
    hint: "عدد الواجهات المطلة",
    tip: "عدد الشوارع المطلة عليها القطعة. لا يشمل عرضها.",
  },
  street_lengths: {
    label: "أطوال الشوارع",
    hint: "عرض الشوارع وأطوال الواجهات",
    tip: "عرض الشوارع المطلة على القطعة وأطوال واجهاتها عليها.",
  },
};

export const SEQUENTIAL_KEYS = Object.entries(FACTOR_REGISTRY)
  .filter(([, d]) => d.sequential)
  .map(([k]) => k);

export const SEQUENTIAL_SET = new Set(SEQUENTIAL_KEYS);

export function factorDescriptor(factorKey: string): FactorDescriptor | undefined {
  return FACTOR_REGISTRY[factorKey];
}

/** العنوان/التلميح — تسمية الكتالوج (من الخادم) أولى إن وُجدت. */
export function factorMeta(factorKey: string, labelAr?: string) {
  const d = FACTOR_REGISTRY[factorKey];
  return {
    label: labelAr || d?.label || factorKey,
    hint: d?.hint ?? "",
    tip: d?.tip ?? "",
  };
}

/** عامل جديد من الكتالوج بلا مدخل هنا = عامل اختلاف قياسي بخلية وصف. */
export function factorHasSpecCell(factorKey: string): boolean {
  return FACTOR_REGISTRY[factorKey]?.specCell !== false;
}
