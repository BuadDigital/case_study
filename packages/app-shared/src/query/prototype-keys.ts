export const prototypeKeys = {
  all: ["prototype"] as const,
  poListRows: () => [...prototypeKeys.all, "po-list-rows"] as const,
  workOrderDtos: () => [...prototypeKeys.all, "work-order-dtos"] as const,
  poRecords: () => [...prototypeKeys.all, "po-records"] as const,
  propertyListItems: () => [...prototypeKeys.all, "property-list-items"] as const,
  poRecord: (poNumber: string) =>
    [...prototypeKeys.all, "po-record", poNumber] as const,
  workflowTasks: () => [...prototypeKeys.all, "workflow-tasks"] as const,
  pendingBourseItems: () =>
    [...prototypeKeys.all, "pending-bourse-items"] as const,
  failures: () => [...prototypeKeys.all, "failures"] as const,
  failureTypes: () => [...prototypeKeys.all, "failure-types"] as const,
  fieldDictionary: () => [...prototypeKeys.all, "field-dictionary"] as const,
  surveyOffices: () => [...prototypeKeys.all, "survey-offices"] as const,
  propertyKeys: () => [...prototypeKeys.all, "property-keys"] as const,
  valuationRequests: () => [...prototypeKeys.all, "valuation-requests"] as const,
  suspendedTransactions: () =>
    [...prototypeKeys.all, "suspended-transactions"] as const,
  courtsCatalog: () => [...prototypeKeys.all, "courts-catalog"] as const,
  caseStudyInfoRoles: () =>
    [...prototypeKeys.all, "case-study-info-roles"] as const,
  staffUsers: () => [...prototypeKeys.all, "staff-users"] as const,
  distributionAssignees: () =>
    [...prototypeKeys.all, "distribution-assignees"] as const,
  organization: () => [...prototypeKeys.all, "organization"] as const,
  propertyDetailPartySubmissions: (parentTaskId: string) =>
    [...prototypeKeys.all, "property-detail-party-submissions", parentTaskId] as const,
  propertyTimeline: (poNumber: string, propertyId: string) =>
    [...prototypeKeys.all, "property-timeline", poNumber, propertyId] as const,
  inspectorFees: (query: {
    assigneeId?: string;
    workflowTaskId?: string;
    submittedOnly?: boolean;
    taskKind?: string;
  }) => [...prototypeKeys.all, "inspector-fees", query] as const,
  fieldInspectionWorkspaces: () =>
    [...prototypeKeys.all, "field-inspection-workspaces"] as const,
};
