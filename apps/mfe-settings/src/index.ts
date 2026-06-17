/** @settings/mfe — الإعدادات + جميع حقول النظام (users, courts, info-roles, حقول النظام). */

export {
  SETTINGS_MFE_PAGE_IDS,
  isSettingsMfePage,
} from "./routes";

export { CourtsView } from "./views/CourtsView";
export { UsersView } from "./views/UsersView";
export { UsersOrganizationView } from "./views/users/UsersOrganizationView";
export { CaseStudyInfoRolesView } from "./views/CaseStudyInfoRolesView";
export { SystemFieldsCatalogView } from "./views/SystemFieldsCatalogView";
export { SystemScreenCatalogView } from "./views/SystemScreenCatalogView";
export { CustomAssignedScreenView, CustomAssignedScreenPage } from "./views/CustomAssignedScreenView";

export * from "./lib/settings-api-config";
export * from "./lib/settings-roles";
export * from "./lib/users-api";
export * from "./lib/users-org-api";
export * from "./lib/prototype/courts-storage";
export * from "./lib/prototype/case-study-info-roles-data";
export * from "./lib/prototype/case-study-info-roles-storage";
export * from "./lib/clear-all-system-data";
export * from "./query/settings-queries";
export * from "./query/custom-screens-queries";
