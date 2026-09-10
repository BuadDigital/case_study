import { getApiBase } from "./api-base";
import { repositoryFetch as fetch } from "./write-repository";

/** The organization's uploaded logos — public (login page, app shell). */
export type OrganizationBrandLogosDto = {
  logoColorUrl: string | null;
  logoWhiteUrl: string | null;
  updatedAt: string | null;
};

/**
 * An uploaded logo, or null when the value is empty or still the built-in default file —
 * the default files are the same artwork as the inline Ejadah mark, which renders sharper.
 */
export function customBrandLogoUrl(
  url: string | null | undefined,
  defaultUrl: string | null | undefined,
): string | null {
  const value = url?.trim();
  if (!value) return null;
  return value === defaultUrl?.trim() ? null : value;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

/** Anonymous read — returns null when the service is unreachable. */
export async function getOrganizationBrandLogos(
  baseUrl?: string,
): Promise<OrganizationBrandLogosDto | null> {
  try {
    const res = await fetch(
      `${baseUrl ?? getApiBase()}/api/organization-settings/brand-logos`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) return null;
    const raw = (await res.json()) as Record<string, unknown>;
    return {
      logoColorUrl: text(raw.logoColorUrl ?? raw.LogoColorUrl),
      logoWhiteUrl: text(raw.logoWhiteUrl ?? raw.LogoWhiteUrl),
      updatedAt: text(raw.updatedAt ?? raw.UpdatedAt),
    };
  } catch {
    return null;
  }
}
