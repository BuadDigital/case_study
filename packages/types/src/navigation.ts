/** Shell navigation contract — shared when splitting MFE remotes later. */
export type PageId =
  | "dashboard"
  | "my-work"
  | "active-primary-data"
  | "active-distribution"
  | "active-receipt"
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
  | "comparable-properties"
  | "property-inspection"
  | "active-inspection"
  | "operations-tasks"
  | "property-appraisal"
  | "active-survey"
  | "party-fees"
  | "system-fields-catalog"
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
  | "clients"
  | "field-sync-board"
  | "profile"
  | "admin-panel";

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

/**
 * The case specialist's sub-roles (ruling 2026-11-02): coordination («التنسيق»), property study
 * («دراسة العقار») and review + approval + Enfaz upload («المراجعة والاعتماد والرفع»).
 */
export type CaseSpecialistSubRole = "coordination" | "study" | "review";

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
