import type { PartyFieldProvenanceEntry } from "@platform/api-client";
import { INSPECTOR_FEATURE_FIELDS } from "./inspector-workspace-data";
import { INFATH_FIELD_LABELS as L } from "./infath-field-labels";

/**
 * Field catalogue for the «تعديل العقار» party-data cards: what the inspector, the engineering
 * office and the appraiser wrote into their party-task payloads, labelled and typed so the
 * specialist can review and correct it. Keys are payload keys, or `parent.child` for one level of
 * nesting — the same keys the server stamps provenance under.
 */

export type PartyDataKind =
  | "field-inspection"
  | "engineering-survey"
  | "property-appraisal";

export type PartyFieldInput =
  | "text"
  | "textarea"
  | "select"
  | "checkbox"
  | "readonly";

export type PartyFieldDef = {
  key: string;
  label: string;
  input: PartyFieldInput;
  options?: readonly string[];
  ltr?: boolean;
};

export type PartyDataSectionDef = {
  kind: PartyDataKind;
  title: string;
  /** Arabic name of the party that owns this section. */
  roleLabel: string;
  fields: PartyFieldDef[];
};

const text = (key: string, label: string, ltr = false): PartyFieldDef => ({
  key,
  label,
  input: "text",
  ltr,
});
const area = (key: string, label: string): PartyFieldDef => ({
  key,
  label,
  input: "textarea",
});
const yesNo = (key: string, label: string): PartyFieldDef => ({
  key,
  label,
  input: "select",
  options: ["نعم", "لا"],
});
const flag = (key: string, label: string): PartyFieldDef => ({
  key,
  label,
  input: "checkbox",
});
const readonly = (key: string, label: string): PartyFieldDef => ({
  key,
  label,
  input: "readonly",
});

/** The inspector owns the property type — the server rejects a staff change to it. */
const INSPECTOR_OWNED_FEATURE_KEYS = new Set(["assetSubject"]);

const INSPECTOR_FEATURE_DEFS: PartyFieldDef[] = INSPECTOR_FEATURE_FIELDS.map(
  (f): PartyFieldDef =>
    INSPECTOR_OWNED_FEATURE_KEYS.has(f.key)
      ? readonly(`featureValues.${f.key}`, f.label)
      : {
          key: `featureValues.${f.key}`,
          label: f.label,
          input: "select",
          options: f.options,
        },
);

export const FIELD_INSPECTION_SECTION: PartyDataSectionDef = {
  kind: "field-inspection",
  title: "بيانات المعاينة الميدانية",
  roleLabel: "المعاين",
  fields: [
    text("inspectionDate", L.inspectionDate, true),
    text("inspectionTime", "وقت المعاينة", true),
    text("mapLatitude", "خط العرض", true),
    text("mapLongitude", "خط الطول", true),
    ...INSPECTOR_FEATURE_DEFS,
    text("streetName", L.streetName),
    text("mainStreetName", L.mainStreet),
    text("streetWidthM", L.streetWidth, true),
    text("accessContactName", "اسم من أتاح الوصول"),
    text("accessContactPhone", "جوال من أتاح الوصول", true),
    text("accessContactRole", "صفة من أتاح الوصول"),
    text("accessContactNationalId", "هوية من أتاح الوصول", true),
    text("roomCount", L.roomCount, true),
    text("hallCount", L.hallCount, true),
    text("unitCount", L.unitCount, true),
    text("bathroomCount", L.bathroomCount, true),
    text("showroomCount", L.showroomCount, true),
    text("wellCount", L.wellCount, true),
    text("towerCount", L.towerCount, true),
    text("jacuzziCount", "عدد الجاكوزي", true),
    text("diningCount", "عدد غرف الطعام", true),
    text("majlisCount", "عدد المجالس", true),
    text("maidRoomCount", "عدد غرف الخادمة", true),
    text("guardRoomCount", "عدد غرف الحارس", true),
    text("parkingCount", "عدد المواقف", true),
    text("playgroundCount", "عدد الملاعب", true),
    text("storeCount", "عدد المستودعات", true),
    text("builtArea", L.builtArea, true),
    text("buildingFloors", L.buildingFloors, true),
    text("basementTotal", L.basementTotal, true),
    yesNo("hasAnnex", "يوجد ملحق"),
    text("annexTotal", "إجمالي مساحة الملحق (م²)", true),
    text("propertyAgeYears", L.propertyAge, true),
    text("buildLicenseNumber", L.buildLicenseNumber, true),
    text("buildLicenseDate", L.buildLicenseDate, true),
    text("electricityMeterCount", "عدد عدادات الكهرباء", true),
    text("electricityMeterNumbers", "أرقام عدادات الكهرباء", true),
    text("waterMeterCount", "عدد عدادات المياه", true),
    text("waterMeterNumbers", "أرقام عدادات المياه", true),
    yesNo("hasViolations", "توجد مخالفات"),
    text("violationsCount", "عدد المخالفات", true),
    area("violationsDescription", "وصف المخالفات"),
    area("propertyDescription", L.propertyDescription),
    area("districtProsCons", L.districtProsCons),
    area("assetNotes", L.assetNotes),
    readonly("services", L.services),
    readonly("amenities", L.amenities),
    readonly("freePhotos", "الصور الحرة"),
    readonly("observations", "الملاحظات الميدانية"),
    flag("clientDeclarationSigned", "إقرار صحة الموقع موقَّع"),
    flag("inspectionConfirmed", "تأكيد المعاينة"),
  ],
};

export const ENGINEERING_SURVEY_SECTION: PartyDataSectionDef = {
  kind: "engineering-survey",
  title: "بيانات الرفع المساحي",
  roleLabel: "المكتب الهندسي",
  fields: [
    text("latitude", "خط العرض", true),
    text("longitude", "خط الطول", true),
    readonly("surveyReportFileName", L.surveyFile),
    readonly("siteLetterFileName", "خطاب الموقع"),
    flag("siteConfirmed", "إقرار الموقع"),
    {
      key: "deedMatchesNature",
      label: "هل الصك مطابق للطبيعة؟",
      input: "select",
      options: ["yes", "no"],
    },
    text("onSiteAreaSqm", L.onSiteArea, true),
    text("northBoundary", L.northBoundary),
    text("northBoundaryLengthM", L.northLength, true),
    text("southBoundary", L.southBoundary),
    text("southBoundaryLengthM", L.southLength, true),
    text("eastBoundary", L.eastBoundary),
    text("eastBoundaryLengthM", L.eastLength, true),
    text("westBoundary", L.westBoundary),
    text("westBoundaryLengthM", L.westLength, true),
    text("natureOnSiteAreaSqm", "المساحة على الطبيعة (م²)", true),
    text("natureNorthBoundary", "الحد الشمالي — على الطبيعة"),
    text("natureNorthBoundaryLengthM", "طول الحد الشمالي — على الطبيعة (م)", true),
    text("natureSouthBoundary", "الحد الجنوبي — على الطبيعة"),
    text("natureSouthBoundaryLengthM", "طول الحد الجنوبي — على الطبيعة (م)", true),
    text("natureEastBoundary", "الحد الشرقي — على الطبيعة"),
    text("natureEastBoundaryLengthM", "طول الحد الشرقي — على الطبيعة (م)", true),
    text("natureWestBoundary", "الحد الغربي — على الطبيعة"),
    text("natureWestBoundaryLengthM", "طول الحد الغربي — على الطبيعة (م)", true),
    area("surveyNotes", L.surveyNotes),
    area("transactionNote", "ملاحظة على المعاملة"),
    readonly("checklist", "قائمة التحقق"),
  ],
};

export const PROPERTY_APPRAISAL_SECTION: PartyDataSectionDef = {
  kind: "property-appraisal",
  title: "بيانات التقييم",
  roleLabel: "المقيّم",
  fields: [
    text("evaluatorPrice", "سعر التقييم", true),
    readonly("reportNo", L.reportNumber),
    text("appraisalDate", L.appraisalDate, true),
    text("valuationMethod", L.valuationMethod),
    text("valueBasis", L.valueBasis),
    text("demandLevel", L.demandLevel),
    text("landValue", L.landValue, true),
    text("buildingValue", L.buildingValue, true),
    text("forcedSaleDiscountPct", L.forcedDiscount, true),
    text("appraiserAddress", L.appraiserAddress),
    text("appraiserPhone", L.appraiserPhone, true),
    text("reportIssueDate", L.reportIssueDate, true),
    text("depositCode", L.depositCode, true),
    area("evaluatorNotes", "ملاحظات على العقار"),
    area("searchScopeNotes", L.searchScope),
    area("assetDataVarianceNotes", "ملاحظات التباين"),
    area("checklist.technical_notes_text", "ملاحظات فنية"),
    flag("assetDataConfirmed", L.assetDataConfirmed),
    flag("independenceDeclared", "إقرار الاستقلالية وعدم تضارب المصالح"),
    readonly("reportWorkers", "العاملون على التقرير"),
  ],
};

export const PARTY_DATA_SECTIONS: readonly PartyDataSectionDef[] = [
  FIELD_INSPECTION_SECTION,
  ENGINEERING_SURVEY_SECTION,
  PROPERTY_APPRAISAL_SECTION,
];

const DEED_MATCH_LABELS: Record<string, string> = { yes: "نعم", no: "لا" };

/** Arabic label for a select option's stored value (engineering deed-match uses yes/no). */
export function partyOptionLabel(key: string, value: string): string {
  return key === "deedMatchesNature" ? (DEED_MATCH_LABELS[value] ?? value) : value;
}

const ROLE_LABELS: Record<string, string> = {
  "field-inspector": "المعاين",
  "engineering-office": "المكتب الهندسي",
  "real-estate-appraiser": "المقيّم",
  "case-specialist": "أخصائي دراسة الحالة",
  "section-supervisor": "مشرف القسم",
  "general-manager": "مدير الإدارة",
  cdo: "مسؤول التحول الرقمي",
};

export function partyRoleLabel(role: string | undefined): string {
  const key = role?.trim().toLowerCase() ?? "";
  return ROLE_LABELS[key] ?? "";
}

/** Value at `key` — `a.b` reads one level into `payload.a`. */
export function readPartyPayloadValue(
  payload: Record<string, unknown>,
  key: string,
): unknown {
  const dot = key.indexOf(".");
  if (dot < 0) return payload[key];
  const parent = payload[key.slice(0, dot)];
  if (typeof parent !== "object" || parent === null || Array.isArray(parent)) {
    return undefined;
  }
  return (parent as Record<string, unknown>)[key.slice(dot + 1)];
}

/** Text shown in an input (or a read-only summary) for a payload value. */
export function partyValueText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "نعم" : "";
  if (Array.isArray(value)) {
    if (value.length === 0) return "";
    if (value.every((v) => typeof v === "string")) return value.join("، ");
    return `${value.length} عنصر`;
  }
  return "";
}

/** Returns a copy of `payload` with every edit applied (`a.b` writes into a copied `payload.a`). */
export function applyPartyFieldEdits(
  payload: Record<string, unknown>,
  edits: Readonly<Record<string, string | boolean>>,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...payload };
  for (const [key, value] of Object.entries(edits)) {
    const dot = key.indexOf(".");
    if (dot < 0) {
      next[key] = value;
      continue;
    }
    const parentKey = key.slice(0, dot);
    const existing = next[parentKey];
    const parent =
      typeof existing === "object" && existing !== null && !Array.isArray(existing)
        ? { ...(existing as Record<string, unknown>) }
        : {};
    parent[key.slice(dot + 1)] = value;
    next[parentKey] = parent;
  }
  return next;
}

export type PartyProvenanceLines = {
  written: string | null;
  edited: string | null;
};

function stampText(
  name: string | undefined,
  role: string | undefined,
  atUtc: string | undefined,
): string {
  const who = name?.trim() || "غير معروف";
  const roleText = partyRoleLabel(role);
  const at = atUtc ? formatStamp(atUtc) : "";
  return [roleText ? `${who} (${roleText})` : who, at].filter(Boolean).join(" · ");
}

function formatStamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("ar-SA-u-nu-latn", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** «كتبه …» / «عدّله …» lines for a field; both null when nothing was recorded. */
export function partyProvenanceLines(
  entry: PartyFieldProvenanceEntry | undefined,
): PartyProvenanceLines {
  if (!entry) return { written: null, edited: null };
  const hasWriter = Boolean(entry.writtenByName || entry.writtenByUserId);
  const hasEditor = Boolean(entry.editedByName || entry.editedByUserId);
  return {
    written: hasWriter
      ? `كتبه ${stampText(entry.writtenByName, entry.writtenByRole, entry.writtenAtUtc)}`
      : hasEditor
        ? "الكاتب الأصلي غير مسجَّل"
        : null,
    edited: hasEditor
      ? `عدّله ${stampText(entry.editedByName, entry.editedByRole, entry.editedAtUtc)}`
      : null,
  };
}
