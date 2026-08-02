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
};

export type OrganizationBrandingSettings = {
  stampUrl: string;
  signatureUrl: string;
  headerUrl?: string | null;
  watermarkText: string;
};

export type OrganizationCommunicationsSettings = {
  otpProvider: string;
  defaultOtpChannel: string;
  smsSenderId?: string | null;
  emailFrom?: string | null;
};

export type OrganizationSlaSettings = {
  defaultBusinessDays: number;
  privateSectorBusinessDays: number;
};

export type OrganizationSettingsDto = {
  company: OrganizationCompanySettings;
  evaluator: OrganizationEvaluatorSettings;
  branding: OrganizationBrandingSettings;
  communications: OrganizationCommunicationsSettings;
  sla: OrganizationSlaSettings;
  updatedAtUtc: string;
};

export type SaveOrganizationSettingsRequest = {
  company?: OrganizationCompanySettings;
  evaluator?: OrganizationEvaluatorSettings;
  branding?: OrganizationBrandingSettings;
  communications?: OrganizationCommunicationsSettings;
  sla?: OrganizationSlaSettings;
};

export type OrganizationSettingsResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      kind: "network" | "server" | "auth" | "forbidden" | "validation";
      message?: string;
    };

function normalizeSettings(raw: Record<string, unknown>): OrganizationSettingsDto {
  const company = (raw.company ?? raw.Company ?? {}) as Record<string, unknown>;
  const evaluator = (raw.evaluator ?? raw.Evaluator ?? {}) as Record<string, unknown>;
  const branding = (raw.branding ?? raw.Branding ?? {}) as Record<string, unknown>;
  const communications = (raw.communications ??
    raw.Communications ??
    {}) as Record<string, unknown>;
  const sla = (raw.sla ?? raw.Sla ?? {}) as Record<string, unknown>;

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
    },
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
      watermarkText: String(branding.watermarkText ?? branding.WatermarkText ?? "EJADAH"),
    },
    communications: {
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
    },
    sla: {
      defaultBusinessDays: Number(
        sla.defaultBusinessDays ?? sla.DefaultBusinessDays ?? 4,
      ),
      privateSectorBusinessDays: Number(
        sla.privateSectorBusinessDays ?? sla.PrivateSectorBusinessDays ?? 10,
      ),
    },
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
