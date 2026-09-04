export const appDataKeys = {
  all: ["app-data"] as const,
  poListRows: () => [...appDataKeys.all, "po-list-rows"] as const,
  /** One server page of the PO list — see docs/architecture/pagination-contract.md §1. */
  poListRowsPage: (query: Record<string, unknown>) =>
    [...appDataKeys.poListRows(), "page", query] as const,
  /** The PO list KPI counts for one filter set — pagination-contract §1.1. */
  poListCounts: (query: Record<string, unknown>) =>
    [...appDataKeys.all, "po-list-counts", query] as const,
  workOrderDtos: () => [...appDataKeys.all, "work-order-dtos"] as const,
  poRecords: () => [...appDataKeys.all, "po-records"] as const,
  propertyListItems: () => [...appDataKeys.all, "property-list-items"] as const,
  poRecord: (poNumber: string) =>
    [...appDataKeys.all, "po-record", poNumber] as const,
  workflowTasks: () => [...appDataKeys.all, "workflow-tasks"] as const,
  /** Server-filtered workflow tasks (all matching rows) — pagination-contract §2. */
  workflowTasksFiltered: (query: Record<string, unknown>) =>
    [...appDataKeys.workflowTasks(), "filtered", query] as const,
  /** One server page of workflow tasks — pagination-contract §2. */
  workflowTasksPage: (query: Record<string, unknown>) =>
    [...appDataKeys.workflowTasks(), "page", query] as const,
  operationsTasks: () => [...appDataKeys.all, "operations-tasks"] as const,
  /** Server-filtered operations tasks (all matching rows) — pagination-contract §3. */
  operationsTasksFiltered: (query: Record<string, unknown>) =>
    [...appDataKeys.operationsTasks(), "filtered", query] as const,
  /** One server page of operations tasks — pagination-contract §3. */
  operationsTasksPage: (query: Record<string, unknown>) =>
    [...appDataKeys.operationsTasks(), "page", query] as const,
  courtVisitFees: (query?: { creditAssigneeId?: string }) =>
    [...appDataKeys.all, "court-visit-fees", query ?? {}] as const,
  pendingBourseItems: () =>
    [...appDataKeys.all, "pending-bourse-items"] as const,
  failures: () => [...appDataKeys.all, "failures"] as const,
  failureTypes: () => [...appDataKeys.all, "failure-types"] as const,
  fieldDictionary: () => [...appDataKeys.all, "field-dictionary"] as const,
  surveyOffices: () => [...appDataKeys.all, "survey-offices"] as const,
  propertyKeys: () => [...appDataKeys.all, "property-keys"] as const,
  keyEnvelopes: () => [...appDataKeys.all, "key-envelopes"] as const,
  keyEnvelopeFees: () => [...appDataKeys.all, "key-envelope-fees"] as const,
  propertyCourtAccess: () =>
    [...appDataKeys.all, "property-court-access"] as const,
  valuationRequests: () => [...appDataKeys.all, "valuation-requests"] as const,
  suspendedTransactions: () =>
    [...appDataKeys.all, "suspended-transactions"] as const,
  courtsCatalog: () => [...appDataKeys.all, "courts-catalog"] as const,
  caseStudyInfoRoles: () =>
    [...appDataKeys.all, "case-study-info-roles"] as const,
  staffUsers: () => [...appDataKeys.all, "staff-users"] as const,
  distributionAssignees: () =>
    [...appDataKeys.all, "distribution-assignees"] as const,
  propertyDetailPartySubmissions: (parentTaskId: string) =>
    [...appDataKeys.all, "property-detail-party-submissions", parentTaskId] as const,
  propertyTimeline: (poNumber: string, propertyId: string) =>
    [...appDataKeys.all, "property-timeline", poNumber, propertyId] as const,
  inspectorFees: (query: {
    assigneeId?: string;
    workflowTaskId?: string;
    submittedOnly?: boolean;
    taskKind?: string;
    billingStatus?: string;
  }) => [...appDataKeys.all, "inspector-fees", query] as const,
  fieldInspectionWorkspaces: () =>
    [...appDataKeys.all, "field-inspection-workspaces"] as const,
};
