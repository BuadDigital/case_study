import {
  getOrganizationSettings,
  type OrganizationSettingsDto,
  type OrganizationSlaSettings,
} from "@platform/api-client";
import { getAuthSession } from "@platform/auth-client";

const DEFAULT_SLA: OrganizationSlaSettings = {
  defaultBusinessDays: 4,
  privateSectorBusinessDays: 10,
};

let cached: OrganizationSettingsDto | null = null;
let inflight: Promise<OrganizationSettingsDto | null> | null = null;

export function getCachedOrganizationSla(): OrganizationSlaSettings {
  return cached?.sla ?? DEFAULT_SLA;
}

export function getCachedOrganizationCompanyName(fallback: string): string {
  const name = cached?.company.name?.trim();
  return name || fallback;
}

export function getCachedOrganizationBranding() {
  return cached?.branding ?? null;
}

export function getCachedOrganizationSettings(): OrganizationSettingsDto | null {
  return cached;
}

export async function ensureOrganizationSettingsLoaded(
  options?: { force?: boolean },
): Promise<OrganizationSettingsDto | null> {
  if (options?.force) {
    cached = null;
    inflight = null;
  }
  if (cached) return cached;
  if (inflight) return inflight;

  inflight = (async () => {
    const token = getAuthSession()?.token;
    if (!token) return null;
    const result = await getOrganizationSettings({ token });
    if (!result.ok) return null;
    cached = result.data;
    return cached;
  })().finally(() => {
    inflight = null;
  });

  return inflight;
}

export function clearOrganizationSettingsCache(): void {
  cached = null;
  inflight = null;
}
