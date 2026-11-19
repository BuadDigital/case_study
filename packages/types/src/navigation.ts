/** Shell navigation contract — shared when splitting MFE remotes later. */
export const Pages = {
  Dashboard: "dashboard",
  MyWork: "my-work",
  ActivePrimaryData: "active-primary-data",
  ActiveDistribution: "active-distribution",
  ActiveReceipt: "active-receipt",
  ActiveCaseStudy: "active-case-study",
  SystemUpload: "system-upload",
  Po: "po",
  AllTransactions: "all-transactions",
  PropertyMap: "property-map",
  Favorites: "favorites",
  BourseInquiry: "bourse-inquiry",
  Keys: "keys",
  Failures: "failures",
  SuspendedTransactions: "suspended-transactions",
  ComparableProperties: "comparable-properties",
  ValuationReportImports: "valuation-report-imports",
  ActiveInspection: "active-inspection",
  OperationsTasks: "operations-tasks",
  PropertyAppraisal: "property-appraisal",
  ActiveSurvey: "active-survey",
  PartyFees: "party-fees",
  SystemFieldsCatalog: "system-fields-catalog",
  Financial: "financial",
  Users: "users",
  Courts: "courts",
  LocationPending: "location-pending",
  FailureTypes: "failure-types",
  CaseStudyInfoRoles: "case-study-info-roles",
  AuditLog: "audit-log",
  FeePricing: "fee-pricing",
  OrganizationSettings: "organization-settings",
  AttachmentPrintDictionary: "attachment-print-dictionary",
  Clients: "clients",
  FieldSyncBoard: "field-sync-board",
  Profile: "profile",
  AdminPanel: "admin-panel",
} as const;
export type PageId = (typeof Pages)[keyof typeof Pages];

export const Roles = {
  Cdo: "cdo",
  GeneralManager: "general-manager",
  SectionSupervisor: "section-supervisor",
  CaseSpecialist: "case-specialist",
  RealEstateAppraiser: "real-estate-appraiser",
  FieldInspector: "field-inspector",
  GovernmentReviewer: "government-reviewer",
  EngineeringOffice: "engineering-office",
  FinancialOfficer: "financial-officer",
} as const;
export type RoleId = (typeof Roles)[keyof typeof Roles];

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
