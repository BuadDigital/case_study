/** @settings/mfe — الإعدادات + جميع حقول النظام (users, courts, info-roles, حقول النظام). */

export { CourtsView } from "./views/CourtsView";
export { LocationsPendingView } from "./views/LocationsPendingView";
export { UsersView } from "./views/UsersView";
export { OrganizationSettingsView } from "./views/OrganizationSettingsView";
export { ClientsView } from "./views/ClientsView";
export { AttachmentPrintDictionaryView } from "./views/AttachmentPrintDictionaryView";
export { DifferenceFactorCatalogView } from "./views/DifferenceFactorCatalogView";
export { ProfileView } from "./views/ProfileView";
export { CaseStudyInfoRolesView } from "./views/CaseStudyInfoRolesView";
export { SystemFieldsCatalogView } from "./views/SystemFieldsCatalogView";
export { SystemScreenCatalogView } from "./views/SystemScreenCatalogView";

export * from "./lib/settings-api-config";
export * from "./lib/users-api";
export * from "./lib/prototype/courts-storage";
export * from "./lib/prototype/case-study-info-roles-data";
export * from "./lib/prototype/case-study-info-roles-storage";
export * from "./query/settings-queries";
