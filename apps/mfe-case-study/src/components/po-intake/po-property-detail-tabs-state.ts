/**
 * Pure tab rules behind `PoPropertyDetailTabs`: the tab catalog, the per-role
 * visible sets, and the document-row labels. No React, no queries.
 */
import type { PropertyDetailDocumentEntry } from "../../lib/app-data/property-detail-documents";

export const TABS = [
  { id: "basic", label: "البيانات الأساسية" },
  { id: "documents", label: "مستندات العقار" },
  { id: "linked", label: "العقارات المرتبطة" },
  { id: "survey", label: "التقرير المساحي" },
  { id: "inspection", label: "معاينة العقار" },
  { id: "photos", label: "صور العقار" },
  { id: "government", label: "المراجعات الحكومية" },
  { id: "keys", label: "مفاتيح العقار" },
  { id: "appraisal", label: "تقييم العقار" },
  { id: "failures", label: "التعذرات" },
  { id: "report", label: "دراسة العقار" },
  { id: "enfath-upload", label: "الرفع على انفاذ" },
  { id: "finance", label: "المالية" },
  { id: "log", label: "السجل والتدقيق" },
  { id: "survey-notes", label: "ملاحظات" },
] as const;

export type TabId = (typeof TABS)[number]["id"];

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
): readonly (typeof TABS)[number][] {
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
