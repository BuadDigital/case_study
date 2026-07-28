/** PO intake wizard — steps and reference lists (from متطلبات النظام v1.2). */

export const PO_INTAKE_FLOW = {
  flowClass: "reg-flow-po",
  dept: "قسم دراسة الحالة",
  title: "استلام أمر عمل جديد",
} as const;

/** PO label without duplicating prefix (e.g. PO-2025-0001, not PO PO-2025-0001). */
export function formatPoDisplay(poNumber: string): string {
  const n = poNumber.trim();
  if (!n) return "";
  if (/^PO[-\s]/i.test(n)) return n;
  return `PO-${n}`;
}

export const PO_INTAKE_STEPS = ["بيانات أمر العمل"] as const;

export const ASSIGNMENT_TYPE_OPTIONS = [
  "تنفيذ",
  "تركات",
  "قطاع خاص",
] as const;

export type AssignmentType = (typeof ASSIGNMENT_TYPE_OPTIONS)[number];

export function requiresAssignmentDecree(type: AssignmentType): boolean {
  return type === "تنفيذ";
}

/** محكمة ودائرة — لكل أنواع الإسناد (مطلوبة قبل توزيع المراجعة الحكومية). */
export function showsCourtFields(_type: AssignmentType): boolean {
  return true;
}

export const DEED_STATUS_OPTIONS = ["فعال", "موقوف", "قيد التحقق"] as const;

/** بيانات البورصة — فعالية الصك قبل إكمال المسار. */
export type BourseDeedVitality = "active" | "inactive";

export const BOURSE_DEED_VITALITY_ACTIVE = "الصك فعال";
export const BOURSE_DEED_VITALITY_INACTIVE = "الصك غير فعال";
export const BOURSE_OBSTRUCTION_LABEL = "متعذر";

export const RESTRICTIONS_PRESENT_OPTIONS = [
  { value: "yes", label: "توجد قيود" },
  { value: "no", label: "لا توجد قيود" },
] as const;

export const RESTRICTION_TYPE_OPTIONS = [
  { value: "mortgaged", label: "مرهون" },
  { value: "seized", label: "محجوز" },
  { value: "suspended", label: "موقوف" },
  { value: "other", label: "أخرى" },
] as const;

export const BOUNDARIES_AVAILABILITY_OPTIONS = [
  { value: "deed", label: "موضحة في الصك" },
  { value: "bourse", label: "موضحة في البورصة" },
  { value: "doc", label: "مستند خارجي" },
  { value: "no", label: "غير متوفرة" },
] as const;

/** محاكاة محاكم ودوائر — تُستبدل بقائمة يديرها المشرف. */
export const COURTS_BY_CITY: Record<
  string,
  { court: string; circuits: string[] }[]
> = {
  "مكة المكرمة": [
    {
      court: "محكمة التنفيذ بمكة المكرمة",
      circuits: ["الدائرة الأولى", "الدائرة الثانية"],
    },
    {
      court: "محكمة الاستئناف بمكة المكرمة",
      circuits: ["دائرة الأحوال"],
    },
  ],
  جدة: [
    {
      court: "محكمة التنفيذ بجدة",
      circuits: ["الدائرة الأولى", "الدائرة الثانية", "الدائرة الثالثة"],
    },
  ],
  الرياض: [
    {
      court: "محكمة التنفيذ بالرياض",
      circuits: ["الدائرة الأولى", "الدائرة الثانية"],
    },
  ],
  الطائف: [
    { court: "محكمة التنفيذ بالطائف", circuits: ["الدائرة الأولى"] },
  ],
};

/** 5 تصنيفات — 47 نوع (المتطلبات). */
export const PROPERTY_CLASSIFICATIONS: Record<string, string[]> = {
  أرض: ["سكنية", "تجارية", "صناعية", "زراعية", "مختلطة"],
  "مبنى مفرد": [
    "فيلا",
    "عمارة",
    "منزل",
    "بيت شعبي",
    "قصر",
    "برج",
    "مستودع",
    "مصنع",
    "ورشة",
    "فندق",
    "محطة بنزين",
    "مزرعة",
    "شاليه",
    "منتجع",
    "عيادة",
    "مواقف سيارات",
  ],
  مجمع: [
    "سكني",
    "تجاري",
    "فلل",
    "تعليمي",
    "حكومي",
    "عيادات",
    "ترفيهي",
    "رياضي",
    "متعدد الاستخدامات",
  ],
  "وحدة داخل مبنى": ["شقة سكنية", "محل تجاري", "معرض", "مكتب", "دور"],
  "مرفق عام": [
    "مستشفى",
    "مركز صحي",
    "مركز شرطة",
    "استراحة",
    "قاعة أفراح",
    "سوق",
    "مسجد",
    "مقبرة",
    "محطة تحلية",
    "محطة كهرباء",
    "برج اتصالات",
    "مطار",
  ],
};

export const CLASSIFICATION_OPTIONS = Object.keys(PROPERTY_CLASSIFICATIONS);

export const CITY_OPTIONS = [
  "مكة المكرمة",
  "جدة",
  "الرياض",
  "الطائف",
  "المدينة المنورة",
  "الدمام",
  "أخرى",
] as const;

/** رقم تجريبي — يعرض حالة «ناقص» في قائمة العقارات. */
export const INCOMPLETE_CONTACT_MARKER_PHONE = "0500000000";

export const CONTACT_ROLE_OPTIONS = [
  "مالك",
  "وكيل",
  "ممثل قانوني",
  "وارث",
  "وصي",
  "شاهد",
  "أخرى",
] as const;

export type PoContact = {
  name: string;
  /** صفة الضابط — مطلوب */
  role: string;
  phone: string;
};

/** الرفع المساحي غير مطلوب لوحدة داخل مبنى. */
export function classificationRequiresSurvey(classification: string): boolean {
  return classification.trim() !== "وحدة داخل مبنى";
}

export type PropertyIdentifierType = "deed" | "real_estate_reg" | "bourse_inquiry";

export const BOURSE_INQUIRY_IDENTIFIER_STATUS = "قيد الدراسة";

export function isBourseInquiryIdentifier(
  type: PropertyIdentifierType,
): boolean {
  return type === "bourse_inquiry";
}

/** تسجيل عيني — يتخطى البورصة وينتقل مباشرة لتوزيع المعاملات. */
export function skipsBourseForIdentifier(
  type: PropertyIdentifierType,
): boolean {
  return type === "real_estate_reg";
}

/** تجاوز البورصة عند تعبئة رقم التسجيل العيني. */
export function propertySkipsBourse(property: {
  realEstateRegNumber: string;
  identifierType: PropertyIdentifierType;
}): boolean {
  return (
    property.realEstateRegNumber.trim().length > 0 ||
    skipsBourseForIdentifier(property.identifierType)
  );
}

export function parsePropertyIdentifierType(
  value: string | undefined,
): PropertyIdentifierType {
  if (value === "real_estate_reg") return "real_estate_reg";
  if (value === "bourse_inquiry") return "bourse_inquiry";
  return "deed";
}

export function identifierTypeLabel(type: PropertyIdentifierType): string {
  if (type === "real_estate_reg") return "تسجيل عيني";
  if (type === "bourse_inquiry") return "البورصة العقاريه";
  return "صك ملكية";
}

/** Display label — رقم الصك، وإلا التسجيل العيني؛ «قيد الدراسة» لمسار البورصة الفارغ. */
export function formatPropertyDeedDisplay(
  property: Pick<
    PoPropertyIntake,
    "identifierType" | "deedNumber" | "realEstateRegNumber"
  >,
): string {
  const deed = property.deedNumber.trim();
  if (deed && !deed.startsWith("INQ-")) return deed;
  const reg = property.realEstateRegNumber?.trim() ?? "";
  if (reg) return reg;
  if (
    isBourseInquiryIdentifier(property.identifierType) ||
    deed.startsWith("INQ-")
  ) {
    return BOURSE_INQUIRY_IDENTIFIER_STATUS;
  }
  return deed || "—";
}

export function formatPendingBourseDeedDisplay(item: {
  identifierType?: string;
  deedNumber: string;
  realEstateRegNumber?: string;
}): string {
  return formatPropertyDeedDisplay({
    identifierType: parsePropertyIdentifierType(item.identifierType),
    deedNumber: item.deedNumber,
    realEstateRegNumber: item.realEstateRegNumber ?? "",
  });
}

export const DEED_NUMBER_DIGIT_LENGTH = 12;
export const REAL_ESTATE_REG_NUMBER_DIGIT_LENGTH = 16;

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

function toLatinDigits(value: string): string {
  return value.replace(/[٠-٩]/g, (ch) => String(ARABIC_DIGITS.indexOf(ch)));
}

export function requiredPropertyIdentifierDigitLength(
  identifierType: PropertyIdentifierType,
): number {
  return identifierType === "real_estate_reg"
    ? REAL_ESTATE_REG_NUMBER_DIGIT_LENGTH
    : DEED_NUMBER_DIGIT_LENGTH;
}

export function propertyIdentifierFieldLabel(
  identifierType: PropertyIdentifierType,
): string {
  return identifierType === "real_estate_reg"
    ? "تسجيل عيني"
    : "رقم الصك";
}

/** Digits only — used while typing (max length enforced). */
export function sanitizePropertyIdentifierInput(
  value: string,
  identifierType: PropertyIdentifierType,
): string {
  const maxLen = requiredPropertyIdentifierDigitLength(identifierType);
  return toLatinDigits(value).replace(/\D/g, "").slice(0, maxLen);
}

export function normalizePropertyIdentifierNumber(
  value: string,
  identifierType: PropertyIdentifierType,
): string {
  return sanitizePropertyIdentifierInput(value, identifierType);
}

export function validatePropertyIdentifierNumber(
  identifierType: PropertyIdentifierType,
  value: string,
): string | undefined {
  const label = propertyIdentifierFieldLabel(identifierType);
  const requiredLen = requiredPropertyIdentifierDigitLength(identifierType);
  const digits = normalizePropertyIdentifierNumber(value, identifierType);
  if (!digits) return `${label} مطلوب`;
  if (digits.length !== requiredLen) {
    return `${label} يجب أن يكون ${requiredLen} رقماً`;
  }
  return undefined;
}

export function restrictionsPresentLabel(value: string): string {
  const v = value.trim();
  if (!v) return "";
  return (
    RESTRICTIONS_PRESENT_OPTIONS.find((o) => o.value === v)?.label ?? v
  );
}

export function restrictionTypeLabel(value: string): string {
  const v = value.trim().toLowerCase();
  if (!v) return "";
  return RESTRICTION_TYPE_OPTIONS.find((o) => o.value === v)?.label ?? v;
}

/** عرض موحّد للقيود + نوع القيد + سبب أخرى. */
export function formatPropertyRestrictionsLine(
  property: Pick<
    PoPropertyIntake,
    "restrictionsPresent" | "restrictionType" | "restrictionOtherReason"
  >,
): string {
  const present = property.restrictionsPresent.trim().toLowerCase();
  if (present === "no") return "لا توجد قيود";
  if (present !== "yes") return restrictionsPresentLabel(property.restrictionsPresent);

  const typeLabel = restrictionTypeLabel(property.restrictionType);
  if (!typeLabel) return "توجد قيود";
  if (property.restrictionType.trim().toLowerCase() === "other") {
    const reason = property.restrictionOtherReason.trim();
    return reason ? `أخرى — ${reason}` : "أخرى";
  }
  return typeLabel;
}

export function boundariesAvailabilityLabel(value: string): string {
  const v = value.trim();
  if (!v) return "";
  return (
    BOUNDARIES_AVAILABILITY_OPTIONS.find((o) => o.value === v)?.label ?? v
  );
}

/** موضحة في الصك / البورصة / مستند خارجي — تفاصيل الحدود اختيارية. */
export function boundariesDetailFieldsOptional(value: string): boolean {
  const v = value.trim().toLowerCase();
  return v === "deed" || v === "bourse" || v === "doc";
}

export function boundariesMarkedUnavailable(value: string): boolean {
  return value.trim().toLowerCase() === "no";
}

/** صفوف إدخال الحدود والأطوال — مرحلة البورصة (الأخصائي). */
export const PROPERTY_BOUNDARY_ROWS = [
  {
    descKey: "northBoundary",
    lenKey: "northBoundaryLengthM",
    label: "الحد الشمالي",
  },
  {
    descKey: "southBoundary",
    lenKey: "southBoundaryLengthM",
    label: "الحد الجنوبي",
  },
  {
    descKey: "eastBoundary",
    lenKey: "eastBoundaryLengthM",
    label: "الحد الشرقي",
  },
  {
    descKey: "westBoundary",
    lenKey: "westBoundaryLengthM",
    label: "الحد الغربي",
  },
] as const;

export type PropertyBoundaryDescKey =
  (typeof PROPERTY_BOUNDARY_ROWS)[number]["descKey"];
export type PropertyBoundaryLenKey =
  (typeof PROPERTY_BOUNDARY_ROWS)[number]["lenKey"];

function formatBoundaryRow(
  property: Pick<PoPropertyIntake, PropertyBoundaryDescKey | PropertyBoundaryLenKey>,
  descKey: PropertyBoundaryDescKey,
  lenKey: PropertyBoundaryLenKey,
  label: string,
): string {
  const desc = property[descKey].trim();
  const len = property[lenKey].trim();
  if (!desc && !len) return "";
  const lenPart = len ? `${len} م` : "";
  if (desc && lenPart) return `${label}: ${desc} (${lenPart})`;
  if (desc) return `${label}: ${desc}`;
  return `${label}: ${lenPart}`;
}

/** الأطوال والأبعاد — من حقول الحدود في بيانات البورصة. */
export function formatPropertyBoundaryDimensions(
  property: Pick<PoPropertyIntake, PropertyBoundaryDescKey | PropertyBoundaryLenKey>,
): string {
  return PROPERTY_BOUNDARY_ROWS.map((row) =>
    formatBoundaryRow(property, row.descKey, row.lenKey, row.label),
  )
    .filter(Boolean)
    .join(" · ");
}

/** واجهات الأرض — أوصاف الحدود عند توفرها. */
export function formatPropertyLandFrontages(
  property: Pick<PoPropertyIntake, PropertyBoundaryDescKey>,
): string {
  return PROPERTY_BOUNDARY_ROWS.map((row) => {
    const desc = property[row.descKey].trim();
    return desc ? `${row.label}: ${desc}` : "";
  })
    .filter(Boolean)
    .join(" · ");
}

/** رقم القطعة / المخطط. */
export function formatPropertyPlotPlanNumber(
  property: Pick<PoPropertyIntake, "plotNumber" | "planNumber">,
): string {
  const parts = [
    property.planNumber.trim()
      ? `المخطط: ${property.planNumber.trim()}`
      : "",
    property.plotNumber.trim()
      ? `القطعة: ${property.plotNumber.trim()}`
      : "",
  ].filter(Boolean);
  return parts.join(" · ");
}

type PropertyBoundarySurveyFields = Pick<
  PoPropertyIntake,
  | PropertyBoundaryDescKey
  | PropertyBoundaryLenKey
  | "boundariesAvailability"
  | "boundariesExternalDocName"
  | "bourseDataCompleted"
>;

/** Empty-state label for مساحية fields on property detail. */
export function propertySurveyEmptyLabel(
  property: Pick<PoPropertyIntake, "bourseDataCompleted" | "boundariesAvailability">,
  field: "dimensions" | "frontages" | "plot",
): string {
  if (field === "plot") {
    return property.bourseDataCompleted
      ? "لم يُسجّل في البورصة"
      : "غير محدد";
  }
  if (property.boundariesAvailability === "no") return "غير متوفرة";
  return property.bourseDataCompleted
    ? "لم تُدخل التفاصيل بعد"
    : "غير محدد";
}

/** الأطوال والأبعاد — مع تلميح عند توفر الحدود دون إدخال تفصيلي. */
export function formatPropertyBoundaryDimensionsDisplay(
  property: PropertyBoundarySurveyFields,
): string {
  const dims = formatPropertyBoundaryDimensions(property);
  if (dims) return dims;
  const avail = property.boundariesAvailability.trim();
  if (avail === "no") return "غير متوفرة";
  if (avail === "doc" && property.boundariesExternalDocName.trim()) {
    return `مستند خارجي: ${property.boundariesExternalDocName.trim()}`;
  }
  if (avail) return `حسب «${boundariesAvailabilityLabel(avail)}»`;
  return "";
}

/** واجهات الأرض — مع تلميح عند توفر الحدود دون أوصاف. */
export function formatPropertyLandFrontagesDisplay(
  property: PropertyBoundarySurveyFields,
): string {
  const frontages = formatPropertyLandFrontages(property);
  if (frontages) return frontages;
  const avail = property.boundariesAvailability.trim();
  if (avail === "no") return "غير متوفرة";
  if (avail) return `حسب «${boundariesAvailabilityLabel(avail)}»`;
  return "";
}

/** رابط خريطة تقريبي من المدينة والحي (حتى يُزوَّد رابط موقع دقيق). */
export function approximatePropertyMapSearchUrl(
  property: Pick<PoPropertyIntake, "city" | "district">,
): string | null {
  const query = [property.district.trim(), property.city.trim(), "السعودية"]
    .filter(Boolean)
    .join("، ");
  if (!query) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

const CITY_GEO: Record<string, [number, number]> = {
  الرياض: [24.7136, 46.6753],
  جدة: [21.4858, 39.1925],
  "مكة المكرمة": [21.3891, 39.8579],
  مكة: [21.3891, 39.8579],
  الطائف: [21.2703, 40.4158],
  الدمام: [26.4207, 50.0888],
  المدينة: [24.5247, 39.5692],
  "المدينة المنورة": [24.5247, 39.5692],
  الخبر: [26.2172, 50.1971],
  أبها: [18.2164, 42.5053],
  تبوك: [28.3838, 36.555],
  حائل: [27.5114, 41.7208],
  بريدة: [26.326, 43.975],
  نجران: [17.5656, 44.2289],
  جازان: [16.8894, 42.5706],
};

/**
 * Approximate lat/lng for OSM embed (city centroid + deed-based jitter).
 * Matches Case Study.html CITY_GEO heuristic until real coordinates exist.
 */
export function approximatePropertyGeo(
  property: Pick<PoPropertyIntake, "city" | "deedNumber">,
): { lat: number; lng: number } | null {
  const city = property.city.trim();
  if (!city) return null;
  const base = CITY_GEO[city] ?? [24.7136, 46.6753];
  let seed = 0;
  const deed = property.deedNumber.trim() || city;
  for (let i = 0; i < deed.length; i += 1) {
    seed += deed.charCodeAt(i) * (i + 1);
  }
  return {
    lat: base[0] + ((seed % 37) - 18) / 1000,
    lng: base[1] + ((seed % 53) - 26) / 1000,
  };
}

function formatDmsComponent(dec: number, pos: string, neg: string): string {
  const a = Math.abs(dec);
  const d = Math.floor(a);
  const m = Math.floor((a - d) * 60);
  const s = ((a - d) * 60 - m) * 60;
  return `${d}°${m}'${s.toFixed(1)}"${dec >= 0 ? pos : neg}`;
}

/** Case Study.html coord DMS line under the map. */
export function formatGeoDms(lat: number, lng: number): string {
  return `${formatDmsComponent(lat, "N", "S")} ${formatDmsComponent(lng, "E", "W")}`;
}

/** Decimal coords for display / clipboard (HTML coord-copy). */
export function formatGeoDec(lat: number, lng: number): string {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

/** Short property description under the main photo (HTML «وصف العقار»). */
export function buildPropertyDescriptionLine(
  property: Pick<
    PoPropertyIntake,
    "propertyType" | "classification" | "area" | "district" | "bourseDataCompleted"
  >,
  inspectorDescription?: string,
): string {
  const fromInspector = inspectorDescription?.trim();
  if (fromInspector) return fromInspector;
  if (!property.bourseDataCompleted) {
    return "يُحدَّث وصف العقار بعد اكتمال استعلام البورصة وتقرير المعاين.";
  }
  const parts = [
    property.propertyType.trim(),
    property.classification.trim(),
  ].filter(Boolean);
  const head = parts.join(" ");
  const area = property.area.trim()
    ? `مساحة ${property.area.trim()} م²`
    : "";
  const district = property.district.trim()
    ? `بحي ${property.district.trim()}`
    : "";
  const body = [head, area, district].filter(Boolean).join("، ");
  if (!body) return "يُحدَّث الوصف التفصيلي من تقرير المعاين.";
  return `${body}. يُحدَّث الوصف التفصيلي من تقرير المعاين.`;
}

/** Case Study.html PSTATUS labels for the property hero. */
export type PropertyUiStatus =
  | "new"
  | "progress"
  | "done"
  | "fail"
  | "incomplete";

export function propertyUiStatusLabel(status: PropertyUiStatus): string {
  switch (status) {
    case "progress":
      return "قيد العمل";
    case "done":
      return "مكتمل";
    case "fail":
      return "متعذر";
    case "incomplete":
      return "ناقص";
    default:
      return "جديد";
  }
}

export function propertyUiStatusTone(
  status: PropertyUiStatus,
): "teal" | "amber" | "red" | "gray" {
  if (status === "done") return "teal";
  if (status === "fail") return "red";
  if (status === "progress" || status === "incomplete") return "amber";
  return "gray";
}

/** @deprecated use approximatePropertyMapSearchUrl */
export function propertyLocationMapUrl(
  property: Pick<PoPropertyIntake, "city" | "district">,
): string | null {
  return approximatePropertyMapSearchUrl(property);
}

/** حالة الملك — مشتقة مؤقتاً حتى يُضاف حقل مستقل في الـ API. */
export function ownershipStatusLabel(
  property: Pick<PoPropertyIntake, "ownerName" | "deedStatus">,
): string {
  if (property.deedStatus.trim()) return property.deedStatus.trim();
  if (property.ownerName.trim()) return "مسجّل";
  return "";
}

export function clearPropertyBoundaryFields(): Pick<
  PoPropertyIntake,
  PropertyBoundaryDescKey | PropertyBoundaryLenKey
> {
  return {
    northBoundary: "",
    northBoundaryLengthM: "",
    southBoundary: "",
    southBoundaryLengthM: "",
    eastBoundary: "",
    eastBoundaryLengthM: "",
    westBoundary: "",
    westBoundaryLengthM: "",
  };
}

/** Any field filled on استعلام بورصة (even before حفظ وإكمال). */
export function hasBourseDetailFields(
  property: Pick<
    PoPropertyIntake,
    | "city"
    | "district"
    | "classification"
    | "propertyType"
    | "area"
    | "deedStatus"
    | "restrictionsPresent"
    | "boundariesAvailability"
    | "boundariesExternalDocName"
    | "planNumber"
    | "plotNumber"
    | PropertyBoundaryDescKey
    | PropertyBoundaryLenKey
  >,
): boolean {
  return Boolean(
    property.city.trim() ||
      property.district.trim() ||
      property.classification.trim() ||
      property.propertyType.trim() ||
      property.area.trim() ||
      property.deedStatus.trim() ||
      property.restrictionsPresent.trim() ||
      property.boundariesAvailability.trim() ||
      property.boundariesExternalDocName.trim() ||
      property.planNumber.trim() ||
      property.plotNumber.trim() ||
      property.northBoundary.trim() ||
      property.northBoundaryLengthM.trim() ||
      property.southBoundary.trim() ||
      property.southBoundaryLengthM.trim() ||
      property.eastBoundary.trim() ||
      property.eastBoundaryLengthM.trim() ||
      property.westBoundary.trim() ||
      property.westBoundaryLengthM.trim(),
  );
}

export function formatPropertyLocation(
  property: Pick<PoPropertyIntake, "city" | "district" | "bourseDataCompleted">,
): string {
  const loc = [property.city, property.district]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" · ");
  if (loc) return loc;
  if (!property.bourseDataCompleted) return "بانتظار البورصة";
  return "";
}

export function formatPropertyTypeLine(property: Pick<
  PoPropertyIntake,
  "classification" | "propertyType"
>): string {
  const typeLabel = property.propertyType.trim() || property.classification.trim();
  if (property.classification.trim() && property.propertyType.trim()) {
    return `${property.classification.trim()} · ${property.propertyType.trim()}`;
  }
  return typeLabel || "";
}

export type PoPropertyIntake = {
  id: string;
  identifierType: PropertyIdentifierType;
  deedNumber: string;
  requestNumber: string;
  /** عند false يمكن تجاوز رقم الطلب (غير إلزامي). */
  hasRequestNumber: boolean;
  assignmentMandateNumber: string;
  assignmentMandateDate: string;
  deedDate: string;
  /** رقم التسجيل العيني — مسار السجل العقاري. */
  realEstateRegNumber: string;
  /** تاريخ التسجيل العيني — مسار السجل العقاري. */
  realEstateRegDate: string;
  ownerName: string;
  restrictionsPresent: string;
  restrictionType: string;
  restrictionOtherReason: string;
  boundariesAvailability: string;
  boundariesExternalDocName: string;
  northBoundary: string;
  northBoundaryLengthM: string;
  southBoundary: string;
  southBoundaryLengthM: string;
  eastBoundary: string;
  eastBoundaryLengthM: string;
  westBoundary: string;
  westBoundaryLengthM: string;
  city: string;
  district: string;
  deedStatus: string;
  area: string;
  court: string;
  circuit: string;
  /** دليل المحاكم — مرجع المحكمة (اختياري). */
  courtId: string;
  /** دليل المحاكم — مرجع الدائرة (اختياري). */
  circuitId: string;
  classification: string;
  propertyType: string;
  assignmentDocFileNames: string[];
  delegationLetterFileNames: string[];
  otherDocumentFileNames: string[];
  realEstateRegFileName: string;
  planNumber: string;
  plotNumber: string;
  locationMapUrl: string;
  bourseDataCompleted: boolean;
  /** Soft-deleted from active queues — still listed on PO properties. */
  isRemoved: boolean;
  removalReason: string;
  removedAtUtc: string;
  contacts: PoContact[];
};

export type PoIntakeRecord = {
  id: string;
  poNumber: string;
  assignmentType: AssignmentType;
  promulgationDate: string;
  receivedFromEnfathAt: string;
  /** وقت الاستلام (HH:mm) — اختياري؛ يُستخدم في حساب تاريخ الاستحقاق */
  receivedFromEnfathTime: string;
  assignmentSpecialist: string;
  assignmentSpecialistEmail: string;
  expectedPropertyCount: number;
  /** وصف نصي اختياري — منطقة العقارات */
  propertiesRegion: string;
  /** وصف نصي اختياري — وصف أمر العمل */
  workOrderDescription: string;
  dueDateAt: string;
  properties: PoPropertyIntake[];
  createdAtUtc: string;
};

function newPropertyId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `p-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function emptyProperty(): PoPropertyIntake {
  return {
    id: newPropertyId(),
    identifierType: "deed",
    deedNumber: "",
    requestNumber: "",
    hasRequestNumber: true,
    assignmentMandateNumber: "",
    assignmentMandateDate: "",
    deedDate: "",
    realEstateRegNumber: "",
    realEstateRegDate: "",
    ownerName: "",
    restrictionsPresent: "",
    restrictionType: "",
    restrictionOtherReason: "",
    boundariesAvailability: "",
    boundariesExternalDocName: "",
    ...clearPropertyBoundaryFields(),
    city: "",
    district: "",
    deedStatus: "",
    area: "",
    court: "",
    circuit: "",
    courtId: "",
    circuitId: "",
    classification: "",
    propertyType: "",
    assignmentDocFileNames: [],
    delegationLetterFileNames: [],
    otherDocumentFileNames: [],
    realEstateRegFileName: "",
    planNumber: "",
    plotNumber: "",
    locationMapUrl: "",
    bourseDataCompleted: false,
    isRemoved: false,
    removalReason: "",
    removedAtUtc: "",
    contacts: [{ name: "", role: "", phone: "" }],
  };
}

const WORKDAY_START_HOUR = 8;
const WORKDAY_END_HOUR = 17;
const BUSINESS_DAYS_REQUIRED = 4;

export function isBusinessDay(d: Date): boolean {
  const day = d.getDay();
  return day >= 0 && day <= 4;
}

function isWithinBusinessHours(d: Date): boolean {
  const h = d.getHours();
  return h >= WORKDAY_START_HOUR && h < WORKDAY_END_HOUR;
}

function parseReceivedDateTime(receivedIso: string, time?: string): Date | null {
  if (!receivedIso) return null;
  const parts = receivedIso.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  const [y, m, day] = parts;
  const t = time?.trim() || "10:00";
  const [hh, mm] = t.split(":").map(Number);
  const hour = Number.isFinite(hh) ? hh : 10;
  const minute = Number.isFinite(mm) ? mm : 0;
  const d = new Date(y, m - 1, day, hour, minute, 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatLocalIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** نقطة البداية: استلام خارج الدوام/عطلة → أول يوم عمل (لاحقاً). */
export function getEffectiveStartDate(received: Date): Date {
  if (isBusinessDay(received) && isWithinBusinessHours(received)) {
    const start = new Date(received);
    start.setHours(0, 0, 0, 0);
    return start;
  }
  const cursor = new Date(received);
  if (!isBusinessDay(cursor) || received.getHours() >= WORKDAY_END_HOUR) {
    cursor.setDate(cursor.getDate() + 1);
  }
  while (!isBusinessDay(cursor)) {
    cursor.setDate(cursor.getDate() + 1);
  }
  cursor.setHours(0, 0, 0, 0);
  return cursor;
}

/** 4 أيام عمل (أحد–خميس) — يوم الاستلام يوم 1 إن كان قبل 17:00؛ بعد 17:00 لا يُحسب. */
function addBusinessDaysFromEffectiveStart(start: Date, count: number): Date {
  const d = new Date(start);
  let remaining = count;
  while (remaining > 0) {
    if (isBusinessDay(d)) remaining -= 1;
    if (remaining > 0) d.setDate(d.getDate() + 1);
  }
  return d;
}

/** 4 أيام عمل (أحد–خميس) من تاريخ/وقت الاستلام من إنفاذ. */
export function computeBusinessDueDate(
  receivedIso: string,
  receivedTime?: string,
): string {
  const received = parseReceivedDateTime(receivedIso, receivedTime);
  if (!received) return "";
  const effective = getEffectiveStartDate(received);
  const due = addBusinessDaysFromEffectiveStart(
    effective,
    BUSINESS_DAYS_REQUIRED,
  );
  return formatLocalIsoDate(due);
}

/** SLA deadline on the due business day — end of workday (17:00 local). */
export function dueDateToDeadline(dueIso: string): Date | null {
  const trimmed = dueIso.trim();
  if (!trimmed) return null;
  const parts = trimmed.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  const [y, m, day] = parts;
  const d = new Date(y, m - 1, day, WORKDAY_END_HOUR, 0, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function isPastDue(dueIso: string): boolean {
  if (!dueIso) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${dueIso}T12:00:00`);
  return due < today;
}

/** DD/MM/YYYY with Western digits (0-9) for Arabic UI. */
export function formatDateAr(iso: string): string {
  if (!iso) return "—";
  const day = iso.trim().slice(0, 10);
  const parts = day.split("-").map(Number);
  if (parts.length === 3 && !parts.some((n) => Number.isNaN(n))) {
    const [y, m, d] = parts;
    const dd = String(d).padStart(2, "0");
    const mm = String(m).padStart(2, "0");
    return `${dd}/${mm}/${y}`;
  }
  const parsed = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return iso;
  const dd = String(parsed.getDate()).padStart(2, "0");
  const mm = String(parsed.getMonth() + 1).padStart(2, "0");
  const y = parsed.getFullYear();
  return `${dd}/${mm}/${y}`;
}

export function assignmentTypeBadgeClass(type: string): string {
  if (type === "تنفيذ") return "b-survey";
  if (type === "تركات") return "b-prog";
  if (type === "قطاع خاص") return "b-key";
  return "b-cancel";
}
