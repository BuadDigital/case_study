/**
 * Governed property document types — the documents the system recognises on a property.
 * Mirror of backend `PropertyDocumentTypes.cs`; both sides are pinned to
 * `docs/architecture/property-document-types.json` (see the sibling test).
 * Keys are fixed in code; admins edit label / requiredness / property types through the
 * valuation `attachments` list.
 */

export type PropertyDocumentGroup =
  | "ownership"
  | "assignment"
  | "contracts"
  | "engineering"
  | "movables"
  | "photos"
  | "outputs"
  | "unlisted";

export type PropertyDocumentApplicability = "all" | "built" | "land";

export type PropertyDocumentReviewStatus = "pending" | "approved" | "rejected";

export type PropertyDocumentType = {
  key: string;
  labelAr: string;
  group: PropertyDocumentGroup;
  appliesTo: PropertyDocumentApplicability;
  defaultRequired: boolean;
  /** False for documents another party produces (survey, inspection photos, report). */
  uploadableFromTab: boolean;
  pdfOnly: boolean;
  /** Requirement this type also satisfies — the bourse deed image counts as the deed. */
  countsAs: string | null;
  /** Upload scopes that imply this type (pre-registry per-field uploads). */
  legacyScopes: readonly string[];
};

/** Upload scope of the documents tab — the server requires a registry type on it. */
export const PROPERTY_DOCUMENT_GOVERNED_SCOPE = "property-document";

export const UNLISTED_DOCUMENT_KEY = "unlisted";

export const PROPERTY_DOCUMENT_REVIEW_STATUSES: readonly PropertyDocumentReviewStatus[] = [
  "pending",
  "approved",
  "rejected",
];

export const PROPERTY_DOCUMENT_GROUPS: readonly {
  key: PropertyDocumentGroup;
  titleAr: string;
}[] = [
  { key: "ownership", titleAr: "الملكية والنظامية" },
  { key: "assignment", titleAr: "التكليف والأطراف" },
  { key: "contracts", titleAr: "التعاقدية" },
  { key: "engineering", titleAr: "الهندسية والتنظيمية" },
  { key: "movables", titleAr: "المنقولات" },
  { key: "photos", titleAr: "صور المعاينة" },
  { key: "outputs", titleAr: "مخرجات التقييم" },
  { key: "unlisted", titleAr: "مستندات غير معرّفة" },
];

export const BUILT_PROPERTY_TYPES: readonly string[] = [
  "فيلا",
  "شقة",
  "عمارة",
  "محل تجاري",
  "مستودع",
];

export const LAND_PROPERTY_TYPES: readonly string[] = ["أرض"];

/** Free-text aliases admins used for "any built property" before the list was typed. */
const BUILT_ALIASES = new Set(["مبني", "مبنى", "مباني", "مبانٍ", "مبان"]);

function t(
  key: string,
  labelAr: string,
  group: PropertyDocumentGroup,
  options: Partial<
    Pick<
      PropertyDocumentType,
      "appliesTo" | "defaultRequired" | "uploadableFromTab" | "pdfOnly" | "countsAs" | "legacyScopes"
    >
  > = {},
): PropertyDocumentType {
  return {
    key,
    labelAr,
    group,
    appliesTo: options.appliesTo ?? "all",
    defaultRequired: options.defaultRequired ?? false,
    uploadableFromTab: options.uploadableFromTab ?? true,
    pdfOnly: options.pdfOnly ?? false,
    countsAs: options.countsAs ?? null,
    legacyScopes: options.legacyScopes ?? [],
  };
}

export const PROPERTY_DOCUMENT_TYPES: readonly PropertyDocumentType[] = [
  t("deed", "صك الملكية", "ownership", {
    defaultRequired: true,
    legacyScopes: ["property-deed-ownership"],
  }),
  t("bourse-deed", "صورة الصك من البورصة", "ownership", {
    countsAs: "deed",
    legacyScopes: ["property-bourse-deed"],
  }),
  t("real-estate-registry", "السجل العقاري", "ownership", {
    countsAs: "deed",
    legacyScopes: ["property-registry"],
  }),
  t("boundaries-document", "مستند الحدود", "ownership", {
    legacyScopes: ["property-boundaries"],
  }),

  t("assignment-letter", "خطاب الإسناد", "assignment", {
    legacyScopes: ["property-decree"],
  }),
  t("delegation-letter", "خطاب التفويض", "assignment", {
    legacyScopes: ["property-delegation"],
  }),
  t("owner-identity", "هوية المالك / الوكالة", "assignment"),

  t("lease-contract", "عقد الإيجار", "contracts", { appliesTo: "built" }),

  t("survey", "التقرير المساحي", "engineering", {
    appliesTo: "land",
    defaultRequired: true,
    uploadableFromTab: false,
    pdfOnly: true,
    legacyScopes: ["engineering-survey-report"],
  }),
  t("site-letter", "خطاب إقرار صحة الموقع", "engineering", {
    uploadableFromTab: false,
    pdfOnly: true,
    legacyScopes: ["engineering-site-letter"],
  }),
  t("building-permit", "رخصة البناء", "engineering", { appliesTo: "built" }),
  t("zoning-sketch", "الكروكي التنظيمي", "engineering"),
  t("completion-certificate", "شهادة إتمام البناء", "engineering", {
    appliesTo: "built",
  }),
  t("utility-bills", "فواتير الخدمات", "engineering", { appliesTo: "built" }),

  t("movables-inventory", "قائمة حصر المنقولات", "movables", {
    appliesTo: "built",
  }),
  t("movables-valuation-report", "تقرير تقييم المنقولات", "movables", {
    appliesTo: "built",
  }),

  t("inspection-photo", "صور المعاينة", "photos", {
    uploadableFromTab: false,
    legacyScopes: ["field-inspection-photo"],
  }),

  t("valuation-report", "تقرير التقييم", "outputs", {
    uploadableFromTab: false,
    pdfOnly: true,
    legacyScopes: ["evaluator-report"],
  }),
  t("deposit-certificate", "شهادة الإيداع", "outputs", {
    uploadableFromTab: false,
    legacyScopes: ["evaluator-deposit-certificate"],
  }),

  t(UNLISTED_DOCUMENT_KEY, "مستند غير معرّف", "unlisted", {
    legacyScopes: ["property-other"],
  }),
];

const BY_KEY = new Map(PROPERTY_DOCUMENT_TYPES.map((type) => [type.key, type]));

const BY_LEGACY_SCOPE = new Map(
  PROPERTY_DOCUMENT_TYPES.flatMap((type) =>
    type.legacyScopes.map((scope) => [scope, type] as const),
  ),
);

const INSPECTION_PHOTO_SCOPE = "field-inspection-photo";
const BUILDING_PERMIT_PHOTO_REF_SUFFIX = ":component:buildLicense";

export function findPropertyDocumentType(
  key: string | null | undefined,
): PropertyDocumentType | null {
  const normalized = key?.trim().toLowerCase();
  return normalized ? (BY_KEY.get(normalized) ?? null) : null;
}

/** Type implied by an older per-field upload scope (inspector permit photo by its photo ref). */
export function propertyDocumentTypeFromScope(
  scope: string | null | undefined,
  scopeKey?: string | null,
): PropertyDocumentType | null {
  const s = scope?.trim() ?? "";
  if (!s) return null;
  if (
    s === INSPECTION_PHOTO_SCOPE &&
    (scopeKey ?? "").trim().endsWith(BUILDING_PERMIT_PHOTO_REF_SUFFIX)
  ) {
    return BY_KEY.get("building-permit") ?? null;
  }
  return BY_LEGACY_SCOPE.get(s) ?? null;
}

/** Stored type first, then the type the upload scope implies. */
export function resolvePropertyDocumentType(
  documentTypeKey: string | null | undefined,
  scope: string | null | undefined,
  scopeKey?: string | null,
): PropertyDocumentType | null {
  return (
    findPropertyDocumentType(documentTypeKey) ??
    propertyDocumentTypeFromScope(scope, scopeKey)
  );
}

export function propertyDocumentRequirementKey(type: PropertyDocumentType): string {
  return type.countsAs ?? type.key;
}

/** Appears in the admin attachments list — photos, outputs and unlisted do not. */
export function isConfigurablePropertyDocumentType(type: PropertyDocumentType): boolean {
  return type.group !== "photos" && type.group !== "outputs" && type.group !== "unlisted";
}

export function defaultPropertyTypeKeys(type: PropertyDocumentType): readonly string[] {
  if (type.appliesTo === "built") return BUILT_PROPERTY_TYPES;
  if (type.appliesTo === "land") return LAND_PROPERTY_TYPES;
  return [];
}

/** Trims, drops «الكل», and expands the free-text "built" aliases to the real types. */
export function normalizePropertyTypeKeys(
  keys: readonly (string | null | undefined)[],
): string[] {
  const result: string[] = [];
  for (const raw of keys) {
    const key = raw?.trim() ?? "";
    if (!key || key === "الكل") continue;
    const expanded = BUILT_ALIASES.has(key) ? BUILT_PROPERTY_TYPES : [key];
    for (const value of expanded) {
      if (!result.includes(value)) result.push(value);
    }
  }
  return result;
}

export function propertyDocumentGroupTitle(group: PropertyDocumentGroup): string {
  return PROPERTY_DOCUMENT_GROUPS.find((g) => g.key === group)?.titleAr ?? group;
}
