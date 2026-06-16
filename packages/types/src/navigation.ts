/** Shell navigation contract — shared when splitting MFE remotes later. */
export type PageId =
  | "dashboard"
  | "active-primary-data"
  | "active-distribution"
  | "active-case-study"
  | "po"
  | "bourse-inquiry"
  | "survey"
  | "keys"
  | "failures"
  | "suspended-transactions"
  | "valuation-requests"
  | "property-inspection"
  | "government-review"
  | "valuation-coordination"
  | "property-appraisal"
  | "active-survey"
  | "system-fields-catalog"
  | "system-screen-catalog"
  | "financial"
  | "kpi"
  | "users"
  | "courts"
  | "failure-types"
  | "case-study-info-roles";

export type RoleId =
  | "cdo"
  | "hr-admin"
  | "proc-admin"
  | "crm-admin"
  | "general-manager"
  | "section-supervisor"
  | "case-specialist"
  | "valuation-coordinator"
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

export function isRoleId(value: string): value is RoleId {
  return value in ROLE_ID_SET;
}

const ROLE_ID_SET: Record<RoleId, true> = {
  cdo: true,
  "hr-admin": true,
  "proc-admin": true,
  "crm-admin": true,
  "general-manager": true,
  "section-supervisor": true,
  "case-specialist": true,
  "valuation-coordinator": true,
  "real-estate-appraiser": true,
  "field-inspector": true,
  "government-reviewer": true,
  "engineering-office": true,
  "financial-officer": true,
};

export function isPageId(value: string): value is PageId {
  return (
    value === "dashboard" ||
    value === "active-primary-data" ||
    value === "active-distribution" ||
    value === "active-case-study" ||
    value === "po" ||
    value === "bourse-inquiry" ||
    value === "survey" ||
    value === "keys" ||
    value === "failures" ||
    value === "suspended-transactions" ||
    value === "valuation-requests" ||
    value === "property-inspection" ||
    value === "government-review" ||
    value === "valuation-coordination" ||
    value === "property-appraisal" ||
    value === "active-survey" ||
    value === "system-fields-catalog" ||
    value === "system-screen-catalog" ||
    value === "financial" ||
    value === "kpi" ||
    value === "users" ||
    value === "courts" ||
    value === "failure-types" ||
    value === "case-study-info-roles"
  );
}
