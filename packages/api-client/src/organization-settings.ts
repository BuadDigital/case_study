import { getApiBase } from "./index";
import { repositoryFetch as fetch } from "./write-repository";
import { ApiAuthError } from "./permissions";

export type OrganizationSettingsApiConfig = {
  baseUrl?: string;
  token: string;
};

export type OrganizationCompanySettings = {
  name: string;
  taxNumber?: string | null;
  address?: string | null;
};

export type OrganizationEvaluatorSettings = {
  name?: string | null;
  licenseNumber?: string | null;
  membershipNumber?: string | null;
  membershipCategory?: string | null;
  licenseExpiresAt?: string | null;
  membershipExpiresAt?: string | null;
};

export const VALUER_MEMBERSHIP_CATEGORIES = [
  { value: "fellow", label: "زميل" },
  { value: "associate", label: "منتسب" },
  { value: "affiliate", label: "منتسب فني" },
  { value: "student", label: "طالب" },
] as const;

/** Additional valuers for report participants — certified singleton stays on `evaluator`. */
export type OrganizationValuerRosterEntry = {
  id: string;
  nameAr: string;
  licenseNumber?: string | null;
  membershipNumber?: string | null;
  membershipCategory?: string | null;
  licenseExpiresAt?: string | null;
  membershipExpiresAt?: string | null;
  /** certified | assistant | reviewer */
  role: string;
  isActive: boolean;
};

export type OrganizationBrandingSettings = {
  stampUrl: string;
  signatureUrl: string;
  headerUrl?: string | null;
  /** Report letterhead image — rendered as 3 slices (header 41mm / footer 27mm / sidebar 13mm). */
  letterheadUrl?: string | null;
  watermarkText: string;
};

export type OrganizationCommunicationsSettings = {
  otpProvider: string;
  defaultOtpChannel: string;
  smsSenderId?: string | null;
  emailFrom?: string | null;
  smsApiUrl?: string | null;
  smsApiKey?: string | null;
  smsApiKeyConfigured?: boolean;
  smtpHost?: string | null;
  smtpPort?: number;
  smtpUsername?: string | null;
  smtpPassword?: string | null;
  smtpPasswordConfigured?: boolean;
};

export type OrganizationSlaSettings = {
  defaultBusinessDays: number;
  privateSectorBusinessDays: number;
};

/** «حد أقصى قابل للضبط» — P2-5 approved 2026-08-16. */
export type OrganizationValuationSettings = {
  maxAdoptedComparables: number;
  /** ق-4: عتبة الفارق الزمني بالأشهر لتنبيه تسوية الزمن (m20). */
  comparableTimeGapMonths: number;
};

/** تبويب «تقرير التقييم» (القرار 25 طبقة ب) — ثوابت ونصوص تُعبَّأ مرة. */
export type OrganizationValuationReportSettings = {
  reportType: string;
  currency: string;
  valuationBranch: string;
  keyInputsText: string;
  professionalStandards: string;
  independence: string;
  researchScopeText: string;
  terms: string;
  restrictions: string;
  ivsStandards: string;
  glossary: string;
  finishingLuxury: string;
  finishingMedium: string;
  finishingOrdinary: string;
  specialAssumptionLibrary: string[];
};

export function emptyValuationReportSettings(): OrganizationValuationReportSettings {
  return {
    reportType: "",
    currency: "",
    valuationBranch: "",
    keyInputsText: "",
    professionalStandards: "",
    independence: "",
    researchScopeText: "",
    terms: "",
    restrictions: "",
    ivsStandards: "",
    glossary: "",
    finishingLuxury: "",
    finishingMedium: "",
    finishingOrdinary: "",
    specialAssumptionLibrary: [],
  };
}

export type OrganizationSettingsDto = {
  company: OrganizationCompanySettings;
  evaluator: OrganizationEvaluatorSettings;
  valuers: OrganizationValuerRosterEntry[];
  branding: OrganizationBrandingSettings;
  communications: OrganizationCommunicationsSettings;
  sla: OrganizationSlaSettings;
  valuation: OrganizationValuationSettings;
  valuationReport: OrganizationValuationReportSettings;
  updatedAtUtc: string;
};

export type SaveOrganizationSettingsRequest = {
  company?: OrganizationCompanySettings;
  evaluator?: OrganizationEvaluatorSettings;
  valuers?: OrganizationValuerRosterEntry[];
  branding?: OrganizationBrandingSettings;
  communications?: OrganizationCommunicationsSettings;
  sla?: OrganizationSlaSettings;
  valuation?: OrganizationValuationSettings;
  valuationReport?: OrganizationValuationReportSettings;
};

export type OrganizationSettingsResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      kind: "network" | "server" | "auth" | "forbidden" | "validation";
      message?: string;
    };

function normalizeCommunications(
  communications: Record<string, unknown>,
): OrganizationCommunicationsSettings {
  return {
    otpProvider: String(
      communications.otpProvider ?? communications.OtpProvider ?? "dev-log",
    ),
    defaultOtpChannel: String(
      communications.defaultOtpChannel ??
        communications.DefaultOtpChannel ??
        "sms",
    ),
    smsSenderId: (communications.smsSenderId ??
      communications.SmsSenderId ??
      null) as string | null,
    emailFrom: (communications.emailFrom ??
      communications.EmailFrom ??
      null) as string | null,
    smsApiUrl: (communications.smsApiUrl ??
      communications.SmsApiUrl ??
      null) as string | null,
    smsApiKey: null,
    smsApiKeyConfigured: Boolean(
      communications.smsApiKeyConfigured ??
        communications.SmsApiKeyConfigured ??
        false,
    ),
    smtpHost: (communications.smtpHost ??
      communications.SmtpHost ??
      null) as string | null,
    smtpPort: Number(communications.smtpPort ?? communications.SmtpPort ?? 587),
    smtpUsername: (communications.smtpUsername ??
      communications.SmtpUsername ??
      null) as string | null,
    smtpPassword: null,
    smtpPasswordConfigured: Boolean(
      communications.smtpPasswordConfigured ??
        communications.SmtpPasswordConfigured ??
        false,
    ),
  };
}

function normalizeValuers(raw: unknown): OrganizationValuerRosterEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: OrganizationValuerRosterEntry[] = [];
  for (const item of raw) {
    const v = (item ?? {}) as Record<string, unknown>;
    const nameAr = String(v.nameAr ?? v.NameAr ?? "").trim();
    if (!nameAr) continue;
    out.push({
      id:
        String(v.id ?? v.Id ?? "").trim() ||
        `v-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      nameAr,
      licenseNumber: (v.licenseNumber ?? v.LicenseNumber ?? null) as string | null,
      membershipNumber: (v.membershipNumber ??
        v.MembershipNumber ??
        null) as string | null,
      membershipCategory: (v.membershipCategory ??
        v.MembershipCategory ??
        null) as string | null,
      licenseExpiresAt: (v.licenseExpiresAt ?? v.LicenseExpiresAt ?? null) as
        | string
        | null,
      membershipExpiresAt: (v.membershipExpiresAt ??
        v.MembershipExpiresAt ??
        null) as string | null,
      role: String(v.role ?? v.Role ?? "assistant").trim() || "assistant",
      isActive: Boolean(v.isActive ?? v.IsActive ?? true),
    });
  }
  return out;
}

function pickStr(
  raw: Record<string, unknown>,
  camel: string,
  pascal: string,
): string {
  const value = raw[camel] ?? raw[pascal];
  return typeof value === "string" ? value : "";
}

function normalizeValuationReport(
  raw: Record<string, unknown>,
): OrganizationValuationReportSettings {
  const libraryRaw =
    raw.specialAssumptionLibrary ?? raw.SpecialAssumptionLibrary;
  const library = Array.isArray(libraryRaw)
    ? libraryRaw.filter((item): item is string => typeof item === "string")
    : [];
  return {
    reportType: pickStr(raw, "reportType", "ReportType"),
    currency: pickStr(raw, "currency", "Currency"),
    valuationBranch: pickStr(raw, "valuationBranch", "ValuationBranch"),
    keyInputsText: pickStr(raw, "keyInputsText", "KeyInputsText"),
    professionalStandards: pickStr(
      raw,
      "professionalStandards",
      "ProfessionalStandards",
    ),
    independence: pickStr(raw, "independence", "Independence"),
    researchScopeText: pickStr(raw, "researchScopeText", "ResearchScopeText"),
    terms: pickStr(raw, "terms", "Terms"),
    restrictions: pickStr(raw, "restrictions", "Restrictions"),
    ivsStandards: pickStr(raw, "ivsStandards", "IvsStandards"),
    glossary: pickStr(raw, "glossary", "Glossary"),
    finishingLuxury: pickStr(raw, "finishingLuxury", "FinishingLuxury"),
    finishingMedium: pickStr(raw, "finishingMedium", "FinishingMedium"),
    finishingOrdinary: pickStr(raw, "finishingOrdinary", "FinishingOrdinary"),
    specialAssumptionLibrary: library,
  };
}

function normalizeSettings(raw: Record<string, unknown>): OrganizationSettingsDto {
  const company = (raw.company ?? raw.Company ?? {}) as Record<string, unknown>;
  const evaluator = (raw.evaluator ?? raw.Evaluator ?? {}) as Record<string, unknown>;
  const branding = (raw.branding ?? raw.Branding ?? {}) as Record<string, unknown>;
  const communications = (raw.communications ??
    raw.Communications ??
    {}) as Record<string, unknown>;
  const sla = (raw.sla ?? raw.Sla ?? {}) as Record<string, unknown>;
  const valuation = (raw.valuation ?? raw.Valuation ?? {}) as Record<string, unknown>;

  return {
    company: {
      name: String(company.name ?? company.Name ?? "شركة إجادة المهنية للتقييم"),
      taxNumber: (company.taxNumber ?? company.TaxNumber ?? null) as string | null,
      address: (company.address ?? company.Address ?? null) as string | null,
    },
    evaluator: {
      name: (evaluator.name ?? evaluator.Name ?? null) as string | null,
      licenseNumber: (evaluator.licenseNumber ??
        evaluator.LicenseNumber ??
        null) as string | null,
      membershipNumber: (evaluator.membershipNumber ??
        evaluator.MembershipNumber ??
        null) as string | null,
      membershipCategory: (evaluator.membershipCategory ??
        evaluator.MembershipCategory ??
        null) as string | null,
      licenseExpiresAt: (evaluator.licenseExpiresAt ??
        evaluator.LicenseExpiresAt ??
        null) as string | null,
      membershipExpiresAt: (evaluator.membershipExpiresAt ??
        evaluator.MembershipExpiresAt ??
        null) as string | null,
    },
    valuers: normalizeValuers(raw.valuers ?? raw.Valuers),
    branding: {
      stampUrl: String(
        branding.stampUrl ?? branding.StampUrl ?? "/case-study/ejadah-stamp.png",
      ),
      signatureUrl: String(
        branding.signatureUrl ??
          branding.SignatureUrl ??
          "/case-study/ejadah-signature.png",
      ),
      headerUrl: (branding.headerUrl ?? branding.HeaderUrl ?? null) as string | null,
      letterheadUrl: (branding.letterheadUrl ?? branding.LetterheadUrl ?? null) as
        | string
        | null,
      watermarkText: String(branding.watermarkText ?? branding.WatermarkText ?? "EJADAH"),
    },
    communications: normalizeCommunications(communications),
    sla: {
      defaultBusinessDays: Number(
        sla.defaultBusinessDays ?? sla.DefaultBusinessDays ?? 4,
      ),
      privateSectorBusinessDays: Number(
        sla.privateSectorBusinessDays ?? sla.PrivateSectorBusinessDays ?? 10,
      ),
    },
    valuation: {
      maxAdoptedComparables: Number(
        valuation.maxAdoptedComparables ?? valuation.MaxAdoptedComparables ?? 3,
      ),
      comparableTimeGapMonths: Number(
        valuation.comparableTimeGapMonths ?? valuation.ComparableTimeGapMonths ?? 6,
      ),
    },
    valuationReport: normalizeValuationReport(
      (raw.valuationReport ?? raw.ValuationReport ?? {}) as Record<string, unknown>,
    ),
    updatedAtUtc: String(raw.updatedAtUtc ?? raw.UpdatedAtUtc ?? new Date().toISOString()),
  };
}

export async function getOrganizationSettings(
  config: OrganizationSettingsApiConfig,
): Promise<OrganizationSettingsResult<OrganizationSettingsDto>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/organization-settings`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.token}`,
      },
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 403) return { ok: false, kind: "forbidden" };
    if (!res.ok) return { ok: false, kind: "server" };
    const raw = (await res.json()) as Record<string, unknown>;
    return { ok: true, data: normalizeSettings(raw) };
  } catch (err) {
    if (err instanceof ApiAuthError) return { ok: false, kind: "auth" };
    return { ok: false, kind: "network" };
  }
}

export async function saveOrganizationSettings(
  config: OrganizationSettingsApiConfig,
  body: SaveOrganizationSettingsRequest,
): Promise<OrganizationSettingsResult<OrganizationSettingsDto>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/organization-settings`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.token}`,
      },
      body: JSON.stringify(body),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 403) return { ok: false, kind: "forbidden" };
    if (res.status === 400) {
      const payload = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      return {
        ok: false,
        kind: "validation",
        message: payload?.error ?? "بيانات غير صالحة",
      };
    }
    if (!res.ok) return { ok: false, kind: "server" };
    const raw = (await res.json()) as Record<string, unknown>;
    return { ok: true, data: normalizeSettings(raw) };
  } catch (err) {
    if (err instanceof ApiAuthError) return { ok: false, kind: "auth" };
    return { ok: false, kind: "network" };
  }
}

export async function testOrganizationCommunication(
  config: OrganizationSettingsApiConfig,
  body: { channel: string; destination: string },
): Promise<
  OrganizationSettingsResult<{ ok: boolean; provider: string; detail?: string | null }>
> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/organization-settings/test-communication`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.token}`,
      },
      body: JSON.stringify(body),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 403) return { ok: false, kind: "forbidden" };
    if (res.status === 400) {
      const payload = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      return {
        ok: false,
        kind: "validation",
        message: payload?.error ?? "بيانات غير صالحة",
      };
    }
    if (!res.ok) return { ok: false, kind: "server" };
    const raw = (await res.json()) as Record<string, unknown>;
    return {
      ok: true,
      data: {
        ok: Boolean(raw.ok ?? raw.Ok),
        provider: String(raw.provider ?? raw.Provider ?? ""),
        detail: (raw.detail ?? raw.Detail ?? null) as string | null,
      },
    };
  } catch (err) {
    if (err instanceof ApiAuthError) return { ok: false, kind: "auth" };
    return { ok: false, kind: "network" };
  }
}
