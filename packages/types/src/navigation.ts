/** Shell navigation contract — shared when splitting MFE remotes later. */
export type PageId =
  | "dashboard"
  | "active-primary-data"
  | "active-distribution"
  | "active-case-study"
  | "system-upload"
  | "po"
  | "all-transactions"
  | "property-map"
  | "favorites"
  | "bourse-inquiry"
  | "keys"
  | "failures"
  | "suspended-transactions"
  | "valuation-requests"
  | "comparable-properties"
  | "property-inspection"
  | "active-inspection"
  | "operations-tasks"
  | "property-appraisal"
  | "active-survey"
  | "survey"
  | "party-fees"
  | "system-fields-catalog"
  | "system-screen-catalog"
  | "financial"
  | "users"
  | "courts"
  | "location-pending"
  | "failure-types"
  | "case-study-info-roles"
  | "audit-log"
  | "fee-pricing"
  | "organization-settings"
  | "attachment-print-dictionary"
  | "difference-factor-catalog"
  | "clients"
  | "field-sync-board"
  | "profile";

export type RoleId =
  | "cdo"
  | "general-manager"
  | "section-supervisor"
  | "case-specialist"
  | "real-estate-appraiser"
  | "field-inspector"
  | "government-reviewer"
  | "engineering-office"
  | "financial-officer";

export type NavItem = {
  id: PageId;
  label: string;
  icon: string;
  grp: string | null;
  badge?: string;
  /** Prototype / not implemented — red in sidebar */
  placeholder?: boolean;
};

export type RoleDef = {
  name: string;
  dept: string;
  init: string;
  bg: string;
  tc: string;
  pages: PageId[];
};
