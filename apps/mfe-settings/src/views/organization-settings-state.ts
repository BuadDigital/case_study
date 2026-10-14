/**
 * Pure decisions for the organization-settings shell: tab catalogue and
 * routing, empty draft, save payload, and message mapping for load / save
 * results. No React.
 */

import {
  BRAND_IDENTITY_DEFAULTS,
  ORG_COMPANY_DEFAULTS,
  emptyValuationReportSettings,
  type OrganizationSettingsDto,
} from "@platform/api-client";

export type TabId =
  | "company"
  | "evaluator"
  | "branding"
  | "sla"
  | "report";

export const TABS: { id: TabId; label: string }[] = [
  { id: "evaluator", label: "المقيّمون" },
  { id: "sla", label: "وقت التنفيذ" },
  { id: "report", label: "تقرير التقييم المهني" },
];

/** Icon + subtitle for the tabs the generic settings card renders itself. */
export const TAB_META: Record<"sla", { icon: string; sub: string }> = {
  sla: {
    icon: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2",
    sub: "المهل الافتراضية بأيام العمل لأوامر العمل الجديدة",
  },
};

const TAB_IDS = new Set<TabId>(TABS.map((t) => t.id));

/** `?tab=` → tab id; `branding` is reachable by link only, unknown values land on company. */
export function tabFromSearch(raw: string | null): TabId {
  if (raw === "branding") return "branding";
  if (raw && TAB_IDS.has(raw as TabId)) return raw as TabId;
  return "company";
}

export function tabLabel(id: TabId): string | undefined {
  return TABS.find((t) => t.id === id)?.label;
}

export function emptySettings(): OrganizationSettingsDto {
  return {
    company: { ...ORG_COMPANY_DEFAULTS },
    evaluator: {
      name: "",
      licenseNumber: "",
      membershipNumber: "",
      membershipCategory: "",
      licenseExpiresAt: "",
      membershipExpiresAt: "",
      licenseIssuedAt: "",
      licenseExpiresHijri: "",
      title: "",
    },
    valuers: [],
    branding: { ...BRAND_IDENTITY_DEFAULTS },
    sla: { defaultBusinessDays: 4, privateSectorBusinessDays: 10 },
    valuation: {
      maxAdoptedComparables: 3,
      areaFactorPct: 5,
      annualMarketRatePct: 4,
      marketValueRoundDecimals: 4,
    },
    valuationReport: emptyValuationReportSettings(),
    updatedAtUtc: new Date().toISOString(),
  };
}

export function formatUpdatedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  try {
    return new Intl.DateTimeFormat("ar-SA", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  } catch {
    return "—";
  }
}

/** Everything the save endpoint accepts, taken from the draft (drops `updatedAtUtc`). */
export function buildSettingsSavePayload(draft: OrganizationSettingsDto) {
  return {
    company: draft.company,
    evaluator: draft.evaluator,
    valuers: draft.valuers,
    branding: draft.branding,
    sla: draft.sla,
    valuation: draft.valuation,
    valuationReport: draft.valuationReport,
  };
}

export const LOGIN_REQUIRED_MESSAGE = "يلزم تسجيل الدخول";

export function loadErrorMessage(kind: string): string {
  if (kind === "forbidden") return "لا تملك صلاحية عرض إعدادات المنشأة";
  if (kind === "network") return "تعذّر الاتصال بالخادم";
  return "تعذّر تحميل الإعدادات";
}

export function saveErrorMessage(result: { kind: string; message?: string | null }): string {
  return (
    result.message ??
    (result.kind === "forbidden"
      ? "لا تملك صلاحية حفظ الإعدادات"
      : "تعذّر حفظ الإعدادات")
  );
}

export const SAVE_SUCCESS_TOAST =
  "تم حفظ إعدادات المنشأة. المهل الجديدة تسري على المعاملات الجديدة فقط.";

/** Numeric field parsers — each keeps the original fallback when the input is blank / NaN. */
export const SETTINGS_NUMBER_FALLBACKS = {
  defaultBusinessDays: 1,
  privateSectorBusinessDays: 1,
  maxAdoptedComparables: 1,
  areaFactorPct: 5,
  annualMarketRatePct: 0,
  marketValueRoundDecimals: 0,
} as const;

export function numberOr(value: string, fallback: number): number {
  return Number(value) || fallback;
}
