import type {
  CaseStudyInfoRolesApiConfig,
  CourtsApiConfig,
  OrganizationSettingsApiConfig,
  RegionsApiConfig,
} from "@platform/api-client";
import { apiConfig } from "@platform/app-shared/auth/api-config";

// Names per domain with matching type — same construction from the unified source.
export function courtsApiConfig(): CourtsApiConfig | null {
  return apiConfig();
}

export function regionsApiConfig(): RegionsApiConfig | null {
  return apiConfig();
}

export function caseStudyInfoRolesApiConfig(): CaseStudyInfoRolesApiConfig | null {
  return apiConfig();
}

export function organizationSettingsApiConfig(): OrganizationSettingsApiConfig | null {
  return apiConfig();
}

// A forked copy dropped forbidden/conflict branches and swallowed 403/409 —
// messages come from the unified source in app-shared.
export { apiErrorMessage } from "@platform/app-shared/prototype/work-orders-api-config";
