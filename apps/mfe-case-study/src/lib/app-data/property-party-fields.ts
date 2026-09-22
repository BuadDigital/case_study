import type { PartyFieldProvenanceEntry } from "@platform/api-client";
import {
  INSPECTOR_AMENITY_OPTIONS,
  INSPECTOR_FEATURE_FIELDS,
  INSPECTOR_OBSERVATION_CATEGORIES,
  INSPECTOR_SERVICE_OPTIONS,
  MOVABLES_DESCRIPTION_KEY,
  MOVABLES_DESCRIPTION_LABEL,
  OCCUPANCY_DESCRIPTION_KEY,
  OCCUPANCY_DESCRIPTION_LABEL,
  OTHER_ATTACHMENTS_KEY,
  OTHER_ATTACHMENTS_LABEL,
  inspectorAmenityLabel,
} from "./inspector-workspace-data";
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
  | "date"
  | "textarea"
  | "select"
  | "checkbox"
  | "multiselect"
  | "observations"
  | "readonly";

export type PartyFieldDef = {
  key: string;
  label: string;
  input: PartyFieldInput;
  options?: readonly string[];
  ltr?: boolean;
  /** Multiselect only: label of a free-text entry that adds values outside `options` (e.g. «أخرى»). */
  customLabel?: string;
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
/** Hijri/Gregorian picker — same stored format as the inspector's dual-calendar field. */
const date = (key: string, label: string): PartyFieldDef => ({
  key,
  label,
  input: "date",
  ltr: true,
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
const chips = (
  key: string,
  label: string,
  options: readonly string[],
  customLabel?: string,
): PartyFieldDef => ({ key, label, input: "multiselect", options, customLabel });
const observations = (key: string, label: string): PartyFieldDef => ({
  key,
  label,
  input: "observations",
});
const readonly = (key: string, label: string): PartyFieldDef => ({
  key,
  label,
  input: "readonly",
});

/** The inspector owns the property type — the server rejects a staff change to it. */
const INSPECTOR_OWNED_FEATURE_KEYS = new Set(["assetSubject"]);

/** Last yes/no of the «ملحقات» run (سور/مسبح/مصعد/تكييف/خزانات/تشجير) — «ملحقات أخرى» sits right after it. */
const LAST_ATTACHMENT_FEATURE_KEY = "hasLandscaping";

const INSPECTOR_FEATURE_DEFS: PartyFieldDef[] = INSPECTOR_FEATURE_FIELDS.flatMap(
  (f): PartyFieldDef[] => {
    const def: PartyFieldDef = INSPECTOR_OWNED_FEATURE_KEYS.has(f.key)
      ? readonly(`featureValues.${f.key}`, f.label)
      : {
          key: `featureValues.${f.key}`,
          label: f.label,
          input: "select",
          options: f.options,
        };
    return f.key === LAST_ATTACHMENT_FEATURE_KEY
      ? [def, text(`featureValues.${OTHER_ATTACHMENTS_KEY}`, OTHER_ATTACHMENTS_LABEL)]
      : [def];
  },
);

/** Free-text feature values that sit beside the yes/no features but are not in the feature list. */
const MOVABLES_AND_OCCUPANCY_DEFS: PartyFieldDef[] = [
  area(`featureValues.${MOVABLES_DESCRIPTION_KEY}`, MOVABLES_DESCRIPTION_LABEL),
  area(`featureValues.${OCCUPANCY_DESCRIPTION_KEY}`, OCCUPANCY_DESCRIPTION_LABEL),
];

const BOUNDARY_SIDES: readonly { key: string; label: string }[] = [
  { key: "north", label: "الشمالي" },
  { key: "south", label: "الجنوبي" },
  { key: "east", label: "الشرقي" },
  { key: "west", label: "الغربي" },
];

/** The inspector's per-side boundary check: deed text, length, facade finish, and the match verdict. */
const BOUNDARY_MATCH_DEFS: PartyFieldDef[] = BOUNDARY_SIDES.flatMap(
  ({ key, label }): PartyFieldDef[] => [
    text(`boundaryMatches.${key}.deedDesc`, `الحد ${label} حسب الصك`),
    text(`boundaryMatches.${key}.deedLength`, `طول الحد ${label} (م)`, true),
    text(`boundaryMatches.${key}.facade`, `نوع واجهة الحد ${label}`),
    flag(`boundaryMatches.${key}.matches`, `الحد ${label} مطابق للواقع`),
    text(`boundaryMatches.${key}.mismatchNote`, `ملاحظة عدم تطابق الحد ${label}`),
  ],
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
    area("accessRouteDescription", "تأكيد موقع العقار"),
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
    text("annexUpperCount", "عدد الملاحق العلوية", true),
    text("annexGroundCount", "عدد الملاحق الأرضية", true),
    readonly("buildingsTotal", "إجمالي مساحة المباني (م²)"),
    flag("vacantLand", "أرض فضاء"),
    text("propertyAgeYears", L.propertyAge, true),
    text("buildLicenseNumber", L.buildLicenseNumber, true),
    date("buildLicenseDate", L.buildLicenseDate),
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
    ...MOVABLES_AND_OCCUPANCY_DEFS,
    ...BOUNDARY_MATCH_DEFS,
    chips("services", L.services, INSPECTOR_SERVICE_OPTIONS),
    chips("amenities", `${L.amenities} (المحيط المؤثر للعقار)`, INSPECTOR_AMENITY_OPTIONS, "أخرى"),
    observations("observations", "الملاحظات الميدانية — وصف العيوب الإنشائية في التقرير"),
    readonly("freePhotos", "الصور الحرة"),
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

export { INSPECTOR_OBSERVATION_CATEGORIES };

const DEED_MATCH_LABELS: Record<string, string> = { yes: "نعم", no: "لا" };

/** Arabic label for a stored option value (deed-match yes/no; amenities use the report wording). */
export function partyOptionLabel(key: string, value: string): string {
  if (key === "deedMatchesNature") return DEED_MATCH_LABELS[value] ?? value;
  if (key === "amenities") return inspectorAmenityLabel(value);
  return value;
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

/** Value at `key` — `a.b.c` walks nested objects one segment at a time. */
export function readPartyPayloadValue(
  payload: Record<string, unknown>,
  key: string,
): unknown {
  let current: unknown = payload;
  for (const segment of key.split(".")) {
    if (typeof current !== "object" || current === null || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
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

function withNestedValue(
  target: Record<string, unknown>,
  path: readonly string[],
  value: unknown,
): Record<string, unknown> {
  const [head, ...rest] = path;
  if (rest.length === 0) return { ...target, [head!]: value };
  const existing = target[head!];
  const child =
    typeof existing === "object" && existing !== null && !Array.isArray(existing)
      ? (existing as Record<string, unknown>)
      : {};
  return { ...target, [head!]: withNestedValue(child, rest, value) };
}

/** Returns a copy of `payload` with every edit applied (`a.b.c` writes into copied parents). */
export function applyPartyFieldEdits(
  payload: Record<string, unknown>,
  edits: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  let next: Record<string, unknown> = { ...payload };
  for (const [key, value] of Object.entries(edits)) {
    next = withNestedValue(next, key.split("."), value);
  }
  return next;
}

/**
 * Provenance for `key`. The server stamps top-level keys and one level of nesting
 * (`boundaryMatches.north`), so a deeper key uses its nearest stamped ancestor.
 */
export function partyProvenanceFor(
  provenance: Record<string, PartyFieldProvenanceEntry> | undefined,
  key: string,
): PartyFieldProvenanceEntry | undefined {
  if (!provenance) return undefined;
  const parts = key.split(".");
  for (let n = parts.length; n >= 1; n--) {
    const entry = provenance[parts.slice(0, n).join(".")];
    if (entry) return entry;
  }
  return undefined;
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
