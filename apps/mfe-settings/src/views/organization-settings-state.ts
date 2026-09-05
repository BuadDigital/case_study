/**
 * Pure decisions for the organization-settings shell: tab catalogue and
 * routing, empty draft, save payload, and message mapping for load / save /
 * communication-test results. No React.
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
  | "communications"
  | "sla"
  | "report";

export const TABS: { id: TabId; label: string }[] = [
  { id: "evaluator", label: "المقيّمون" },
  { id: "communications", label: "الاتصالات" },
  { id: "sla", label: "معايير المهل" },
  { id: "report", label: "تقرير التقييم المهني" },
];

export const TAB_META: Record<TabId, { icon: string; sub: string }> = {
  company: {
    icon: "M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6",
    sub: "الاسم الرسمي والبيانات الضريبية المستخدمة في التقارير والمخرجات",
  },
  evaluator: {
    icon: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
    sub: "المقيم المعتمد لبوابات الإصدار + قائمة المشاركين في التقرير",
  },
  branding: {
    icon: "M4 16l4.6-4.6a2 2 0 0 1 2.8 0L16 16m-2-2 1.6-1.6a2 2 0 0 1 2.8 0L20 14M14 8h.01M6 20h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z",
    sub: "الختم والتوقيع والترويسة والعلامة المائية للمستندات الصادرة",
  },
  communications: {
    icon: "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6",
    sub: "قنوات إرسال رموز التحقق (OTP) والدعوات عبر SMS والبريد",
  },
  sla: {
    icon: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2",
    sub: "المهل الافتراضية بأيام العمل لأوامر العمل الجديدة",
  },
  report: {
    icon: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8",
    sub: "ثوابت ونصوص تقرير التقييم تُعبَّأ مرة وتُستهلك في كل تقرير — التعديل لا يغيّر ما سبق إصداره",
  },
};

const TAB_IDS = new Set<TabId>(TABS.map((t) => t.id));

/** `?tab=` → tab id; `branding` is reachable by link only, unknown values land on company. */
export function tabFromSearch(raw: string | null): TabId {
  if (raw === "branding") return "branding";
  if (raw && TAB_IDS.has(raw as TabId)) return raw as TabId;
  return "company";
}

export function tabHref(id: TabId): string {
  return `/organization-settings?tab=${id}`;
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
    communications: {
      otpProvider: "dev-log",
      defaultOtpChannel: "sms",
      smsSenderId: "",
      emailFrom: "",
      smsApiUrl: "",
      smsApiKey: "",
      smsApiKeyConfigured: false,
      smtpHost: "",
      smtpPort: 587,
      smtpUsername: "",
      smtpPassword: "",
      smtpPasswordConfigured: false,
    },
    sla: { defaultBusinessDays: 4, privateSectorBusinessDays: 10 },
    valuation: {
      maxAdoptedComparables: 3,
      comparableTimeGapMonths: 6,
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
    communications: draft.communications,
    sla: draft.sla,
    valuation: draft.valuation,
    valuationReport: draft.valuationReport,
  };
}

export const LOGIN_REQUIRED_MESSAGE = "يجب تسجيل الدخول أولاً";

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
export const TEST_FAILED_TOAST = "تعذّر اختبار الإرسال";

/** Communication-test outcome → toast text + tone. */
export function communicationTestToast(data: {
  ok: boolean;
  detail?: string | null;
  provider?: string | null;
}): { text: string; tone: "success" | "error" } {
  return {
    text: data.ok
      ? `${data.detail ?? "تم الإرسال"} (${data.provider})`
      : (data.detail ?? "فشل الاختبار"),
    tone: data.ok ? "success" : "error",
  };
}

/** Numeric field parsers — each keeps the original fallback when the input is blank / NaN. */
export const SETTINGS_NUMBER_FALLBACKS = {
  smtpPort: 587,
  defaultBusinessDays: 1,
  privateSectorBusinessDays: 1,
  maxAdoptedComparables: 1,
  comparableTimeGapMonths: 6,
  areaFactorPct: 5,
  annualMarketRatePct: 0,
  marketValueRoundDecimals: 0,
} as const;

export function numberOr(value: string, fallback: number): number {
  return Number(value) || fallback;
}
