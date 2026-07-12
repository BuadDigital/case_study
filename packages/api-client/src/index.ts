/** Private LAN host (Wi‑Fi demo) — not localhost and not a public DNS name. */
function isPrivateLanHost(hostname: string): boolean {
  if (hostname === "localhost" || hostname === "127.0.0.1") return false;
  if (hostname.startsWith("192.168.")) return true;
  if (hostname.startsWith("10.")) return true;
  return /^172\.(1[6-9]|2\d|3[01])\./.test(hostname);
}

/**
 * API base URL.
 * - localhost dev: NEXT_PUBLIC_API_URL or same origin (Next.js rewrites /api/* → :5160).
 * - LAN IP dev (e.g. 192.168.x.x:3000): gateway on :5160 on the same host (CORS allows :3000).
 *   Ignores NEXT_PUBLIC_API_URL when it points at localhost — that breaks LAN teammates.
 */
export function getApiBase(): string {
  const apiPort = process.env.NEXT_PUBLIC_API_PORT ?? "5160";
  const fromEnv = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");

  if (typeof window !== "undefined") {
    const { hostname, origin, protocol } = window.location;
    if (
      process.env.NODE_ENV === "development" &&
      isPrivateLanHost(hostname)
    ) {
      return `${protocol}//${hostname}:${apiPort}`;
    }
    if (fromEnv) return fromEnv;
    return origin;
  }

  if (fromEnv) return fromEnv;
  return `http://127.0.0.1:${apiPort}`;
}

export {
  DEFAULT_LIST_PAGE_SIZE,
  fetchAllListPages,
  type FetchListPageOptions,
  type PagedResultDto,
} from "./pagination";

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
  cancelWorkOrder,
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
  stopWorkOrder,
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
  submitValuationReport,
  submitValuationImpediment,
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
  ApiAuthError,
  type MeDto,
  type PermissionsApiConfig,
  type PermissionsDto,
} from "./permissions";

export {
  clearNotifications,
  createNotification,
  deleteNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeNotificationStream,
  type CreateUserNotificationRequest,
  type NotificationsApiConfig,
  type UserNotificationDto,
} from "./notifications";

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
  batchTransitionInspectorFees,
  createDisbursementBatch,
  inspectorFeeStatusLabel,
  inspectorFeeStatusTone,
  inspectorFeeWorkStatusTone,
  listInspectorFees,
  listInspectorFeeTransitions,
  patchInspectorFee,
  transitionInspectorFee,
  type BatchInspectorFeeTransitionRequest,
  type BatchInspectorFeeTransitionResult,
  type CreateDisbursementBatchRequest,
  type CreateDisbursementBatchResult,
  type InspectorFeeAction,
  type InspectorFeeAuditEntryDto,
  type InspectorFeeBillingStatus,
  type InspectorFeeRowDto,
  type InspectorFeeTransitionRequest,
  type InspectorFeeWorkStatus,
  type InspectorFeesApiConfig,
  type InspectorFeesSummaryDto,
  type ListInspectorFeesQuery,
  type PatchInspectorFeeRequest,
} from "./inspector-fees";

export {
  getPoEnfazBilling,
  getPropertyEnfazRevenue,
  listReadyEnfazPoSummaries,
  savePoEnfazBilling,
  type EnfazBillingApiConfig,
  type EnfazReadyPoSummaryDto,
  type PoEnfazBillingDto,
  type PoEnfazRevenueLineDto,
  type EnfazTrackingRowDto,
  type PropertyEnfazRevenueDto,
  type SavePoEnfazBillingRequest,
  listEnfazTracking,
  issuePoEnfazInvoice,
  downloadPoEnfazInvoicePdf,
} from "./enfaz-billing";

export {
  fetchFieldInspectionWorkspaceSummary,
  listFieldInspectionWorkspaces,
  type FieldInspectionWorkspaceListItemDto,
  type FieldInspectionWorkspacesApiConfig,
  type FieldInspectionWorkspaceSummaryDto,
} from "./field-inspection-workspaces";
