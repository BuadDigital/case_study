/**
 * Pure tab rules behind `PoPropertyDetailTabs`: the tab catalog, the per-role
 * visible sets, and the document-row labels. No React, no queries.
 */
import type { PropertyDetailDocumentEntry } from "../../lib/app-data/property-detail-documents";

/**
 * Decision 2026-10-19: the page is the transaction's (المعاملة). A tab is either about the
 * transaction as a whole (its study, valuation, links, log, notes) or about one deed (its
 * data, documents, survey, inspection, photos, court visits, keys, failures, Enfaz upload,
 * finance). The order below is the single-deed order; a transaction with several deeds shows
 * the transaction tabs first, then the deed tabs behind the deed switcher.
 */
export const TABS = [
  { id: "basic", label: "البيانات الأساسية", scope: "deed" },
  { id: "documents", label: "مستندات العقار", scope: "deed" },
  { id: "linked", label: "العقارات المرتبطة", scope: "transaction" },
  { id: "survey", label: "التقرير المساحي", scope: "deed" },
  { id: "inspection", label: "معاينة العقار", scope: "deed" },
  { id: "photos", label: "صور العقار", scope: "deed" },
  { id: "government", label: "المراجعات الحكومية", scope: "deed" },
  { id: "keys", label: "مفاتيح العقار", scope: "deed" },
  { id: "appraisal", label: "تقييم العقار", scope: "transaction" },
  { id: "failures", label: "التعذّرات", scope: "deed" },
  { id: "report", label: "دراسة العقار", scope: "transaction" },
  { id: "enfath-upload", label: "الرفع على إنفاذ", scope: "deed" },
  { id: "finance", label: "المالية", scope: "deed" },
  { id: "log", label: "السجل والتدقيق", scope: "transaction" },
  { id: "survey-notes", label: "ملاحظات", scope: "transaction" },
] as const;

export type TabId = (typeof TABS)[number]["id"];

export type TabScope = (typeof TABS)[number]["scope"];

export type PropertyDetailTab = (typeof TABS)[number];

/**
 * The tab bar's groups for a transaction with several deeds: transaction tabs first, then the
 * deed tabs. Each group keeps the catalog order. A single-deed transaction uses the flat list.
 *
 * How it works (decision 2026-10-19): takes the tabs already allowed for the role, splits them
 * by `scope` into «المعاملة» (study, valuation, links, log, notes) and «الصك» (the per-deed
 * tabs), and returns the two groups in that order.
 *
 * Edge cases: a group left empty by the role filter (e.g. a role that sees no transaction tab)
 * is dropped, so the bar never shows an empty group heading.
 */
export function groupPropertyDetailTabs(
  tabs: readonly PropertyDetailTab[],
): { scope: TabScope; label: string; tabs: PropertyDetailTab[] }[] {
  const transaction = tabs.filter((t) => t.scope === "transaction");
  const deed = tabs.filter((t) => t.scope === "deed");
  return [
    { scope: "transaction", label: "المعاملة", tabs: transaction },
    { scope: "deed", label: "الصك", tabs: deed },
  ].filter((g) => g.tabs.length > 0) as { scope: TabScope; label: string; tabs: PropertyDetailTab[] }[];
}

/** Government reviewer: only the tabs they need for court-visit / keys work. */
const GOVERNMENT_REVIEWER_TAB_IDS: readonly TabId[] = [
  "basic",
  "government",
  "keys",
  "survey-notes",
];

/**
 * Real-estate appraiser: study + valuation workspace only
 * (no survey package, court/keys, enfaz upload, finance, or audit log).
 */
const REAL_ESTATE_APPRAISER_TAB_IDS: readonly TabId[] = [
  "basic",
  "documents",
  "linked",
  "inspection",
  "photos",
  "appraisal",
  "failures",
  "report",
  "survey-notes",
];

/** Engineering office: survey package + dues/notes. */
const ENGINEERING_OFFICE_TAB_IDS: readonly TabId[] = [
  "basic",
  "survey",
  "failures",
  "finance",
  "survey-notes",
];

/** Field inspector: inspection media + dues/notes. */
const FIELD_INSPECTOR_TAB_IDS: readonly TabId[] = [
  "basic",
  "documents",
  "linked",
  "inspection",
  "photos",
  "failures",
  "finance",
  "survey-notes",
];

const ROLE_PROPERTY_DETAIL_TABS: Readonly< Partial<Record<string, readonly TabId[]>>> = {
  "government-reviewer": GOVERNMENT_REVIEWER_TAB_IDS,
  "real-estate-appraiser": REAL_ESTATE_APPRAISER_TAB_IDS,
  "engineering-office": ENGINEERING_OFFICE_TAB_IDS,
  "field-inspector": FIELD_INSPECTOR_TAB_IDS,
};

export function propertyDetailTabsForRole(
  role: string,
): readonly PropertyDetailTab[] {
  const allowed = ROLE_PROPERTY_DETAIL_TABS[role];
  if (!allowed) return TABS;
  return TABS.filter((t) => (allowed as readonly string[]).includes(t.id));
}

export function isAllowedPropertyTab(
  role: string,
  tabId: string | null | undefined,
): tabId is TabId {
  if (!tabId) return false;
  return propertyDetailTabsForRole(role).some((t) => t.id === tabId);
}

/** Arabic kind label for the row badge — no file extensions in the UI. */
export function docKindLabel(doc: PropertyDetailDocumentEntry): string {
  if (doc.kind === "pdf") return "مستند";
  if (doc.kind === "image") return "صورة";
  return "ملف";
}

/** Generated storage names (UUIDs, hashes) carry no meaning for the specialist; hide them. */
export function isGeneratedFileName(fileName: string): boolean {
  const stem = fileName.trim().replace(/\.[a-z0-9]+$/i, "");
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const hash = /^[0-9a-f]{24,}$/i;
  return uuid.test(stem) || hash.test(stem);
}

/** Case Study.html logPanel — always green ✓ circle. */
export function logIconGlyph(): string {
  return "✓";
}

export function logIconClass(): string {
  return "bg-[color-mix(in_srgb,#3f8f5f_10%,transparent)] text-[#2f7a4d]";
}
