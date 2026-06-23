/**
 * API base URL. In the browser, uses the same host as the page (LAN-friendly).
 * Override with NEXT_PUBLIC_API_URL when needed.
 */
export function getApiBase(): string {
  const fromEnv = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  // Browser: same origin — Next.js rewrites /api/* to the backend (works on LAN).
  if (typeof window !== "undefined") {
    return window.location.origin;

  }

  const port = process.env.NEXT_PUBLIC_API_PORT ?? "5160";
  return `http://127.0.0.1:${port}`;
}

export {
  createCrmUser,
  createHrUser,
  createProcUser,
  deactivateUser,
  fetchOrganizationOverview,
  listDistributionAssignees,
  listUsers,
  updateUser,
  type CreateUserResult,
  type ListUsersResult,
  type OrganizationOverviewResult,
  type UsersApiConfig,
} from "./users";

export {
  addWorkOrderProperty,
  completePropertyBourseData,
  createWorkOrder,
  deleteWorkOrder,
  deleteWorkOrderProperty,
  findPriorDeed,
  getWorkOrder,
  getPropertyTimeline,
  listPendingBourseProperties,
  listWorkOrders,
  listWorkOrdersWithDetails,
  listPropertyListItems,
  updateWorkOrderHeader,
  updateWorkOrderProperty,
  workOrderExists,
  type ApiErr,
  type ApiOk,
  type CreateWorkOrderRequest,
  type PendingBoursePropertyDto,
  type PropertyTimelineEventDto,
  type PriorDeedRegistrationDto,
  type PropertyContactDto,
  type UpdatePropertyBourseRequest,
  type UpdateWorkOrderHeaderRequest,
  type WorkOrderDto,
  type WorkOrderListItemDto,
  type PropertyListItemDto,
  type PropertyListRowDto,
  type WorkOrderPropertyDto,
  type WorkOrdersApiConfig,
} from "./work-orders";

export {
  listCourts,
  replaceCourtsCatalog,
  type CourtCatalogEntryDto,
  type CourtsApiConfig,
  type CourtsListResult,
} from "./courts";

export {
  advanceWorkflowTaskAfterBourse,
  advanceWorkflowTaskAfterEnfath,
  confirmWorkflowTaskDistribution,
  deleteWorkflowTasksForPo,
  deleteWorkflowTasksForProperty,
  listWorkflowTasks,
  patchWorkflowTask,
  patchWorkflowTaskDistribution,
  syncWorkflowTasks,
  type ConfirmTaskDistributionResponseDto,
  type TaskDistributionDraftDto,
  type WorkflowTaskDto,
} from "./workflow-tasks";

export {
  getCaseStudyForm,
  getPartyCaseStudyForm,
  saveCaseStudyForm,
  savePartyCaseStudyForm,
  type CaseStudyFormDto,
} from "./case-study-forms";

export {
  getPartyTaskSubmission,
  listPartyTaskSubmissions,
  prefetchPartyTaskSubmissions,
  reopenPartyTaskSubmission,
  savePartyTaskSubmission,
  submitPartyTaskSubmission,
  type PartyTaskSubmissionDto,
  type ReopenPartyTaskSubmissionRequest,
  type SavePartyTaskSubmissionRequest,
} from "./party-task-submissions";

export { fetchDevLoginUsers, type DevLoginUserDto } from "./auth";

export {
  getCaseStudyInfoRoles,
  saveCaseStudyInfoRoles,
  type CaseStudyInfoRolesApiConfig,
  type CaseStudyInfoRolesConfigDto,
  type CaseStudyInfoRolesResult,
  type SaveCaseStudyInfoRolesRequest,
} from "./case-study-info-roles";

export {
  approveFailure,
  createFailure,
  deleteFailuresForPo,
  dtoToFailureRecord,
  getPropertyFailure,
  listFailures,
  reportBourseObstruction,
  resolveFailure,
  returnFailure,
  submitFailureForReview,
  suspendFailure,
  upgradeFailureToInternal,
  type BourseObstructionRequest,
  type CreateFailureRequest,
  type FailureNoteRequest,
  type FailureRecordDto,
  type FailuresApiConfig,
  type ResolveFailureRequest,
} from "./failures";



export {
  deleteAttachment,
  downloadAttachmentBlob,
  getFailureTypesCatalog,
  getFieldDictionary,
  getEvaluatorRecallApi,
  getInternalDelegationLetters,
  listAttachments,
  listEvaluatorRecallsApi,
  listPropertyKeys,
  listSurveyOffices,
  listSuspendedTransactions,
  listValuationRequests,
  approveEvaluatorRecallApi,
  patchPropertyKey,
  rejectEvaluatorRecallApi,
  requestEvaluatorRecallApi,
  saveFailureTypesCatalog,
  saveFieldDictionary,
  saveInternalDelegationLetters,
  uploadAttachment,
  type EvaluatorRecallDto,
  type FailureProblemTypeDto,
  type FailureTypeCategoryDto,
  type FailureTypesCatalogDto,
  type FieldDictionaryFieldDto,
  type FieldDictionaryStateDto,
  type FileAttachmentMetaDto,
  type InternalDelegationLetterDto,
  type PropertyKeyRecordDto,
  type PrototypeModulesApiConfig,
  type PrototypeModulesResult,
  type SaveSurveyOfficeRequest,
  type SurveyOfficeDto,
  type SuspendedTransactionDto,
  type UpdatePropertyKeyRequest,
  type UploadAttachmentRequest,
  type ValuationRequestDto,
} from "./prototype-modules";

export {
  deletePoIntakeDraft,
  getPoIntakeDraft,
  savePoIntakeDraft,
  type PoIntakeDraftDto,
} from "./po-intake-draft";

export {
  fetchFinancialSummary,
  financialApiEnabled,
  type FinancialCostRowDto,
  type FinancialRevenueRowDto,
  type FinancialSummaryDto,
} from "./financial";

export {
  fetchMe,
  fetchPermissions,
  type MeDto,
  type PermissionsApiConfig,
  type PermissionsDto,
} from "./permissions";

export {
  fetchReportingDashboard,
  fetchReportingKpi,
  type ReportingDashboardDto,
  type ReportingKpiDto,
  type ReportingKpiScoreDto,
  type ReportingSpecialistLoadDto,
  type ReportingTeamMemberDto,
} from "./reporting";

export {
  inspectorFeeStatusLabel,
  listInspectorFees,
  patchInspectorFee,
  type InspectorFeeBillingStatus,
  type InspectorFeeRowDto,
  type InspectorFeesApiConfig,
  type InspectorFeesSummaryDto,
  type ListInspectorFeesQuery,
  type PatchInspectorFeeRequest,
} from "./inspector-fees";

export {
  fetchFieldInspectionWorkspaceSummary,
  listFieldInspectionWorkspaces,
  type FieldInspectionWorkspaceListItemDto,
  type FieldInspectionWorkspacesApiConfig,
  type FieldInspectionWorkspaceSummaryDto,
} from "./field-inspection-workspaces";
