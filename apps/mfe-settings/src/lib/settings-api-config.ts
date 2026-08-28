import type {
  CaseStudyInfoRolesApiConfig,
  CourtsApiConfig,
  OrganizationSettingsApiConfig,
  RegionsApiConfig,
} from "@platform/api-client";
import { apiConfig } from "@platform/app-shared/auth/api-config";

// أسماء لكل مجال بالنوع المطابق — البناء نفسه من المصدر الموحّد.
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

// كانت نسخة متشعبة تُسقط فرعي forbidden/conflict فتبتلع 403/409 —
// الرسائل من المصدر الموحّد في app-shared.
export { apiErrorMessage } from "@platform/app-shared/prototype/work-orders-api-config";
