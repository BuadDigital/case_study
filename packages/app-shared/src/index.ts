export { AppAccessProvider, useAppAccess } from "./contexts/AppAccessContext";
export { Can, useCapability } from "./components/Can";
export { useAuth } from "./hooks/useAuth";
export { useIdempotentAction } from "./hooks/use-idempotent-action";
export type { IdempotentActionResult } from "./hooks/use-idempotent-action";
export { useCommandMutation } from "./hooks/use-command-mutation";
export { ensureFreshAuthSession } from "./auth/ensure-fresh-session";
export {
  currentOfflineUserId,
  evaluateOfflineLease,
  isBrowserOffline,
  isOfflineCapableRole,
  loadQueuedDraftPayload,
  saveDraftWithOfflineFallback,
  submitWithOfflineFallback,
  syncOfflineQueue,
  uploadAttachmentWithOfflineFallback,
} from "./offline/offline-write";
export { installOfflineWriteInterceptor } from "./offline/install-offline-write-interceptor";
export {
  BASIC_DOC_PREFETCH_SCOPES,
  BASIC_DOCS_PREFETCH_ID,
  OPS_TASKS_PREFETCH_ID,
  PARTY_SUBMISSIONS_PREFETCH_ID,
  WORKFLOW_TASKS_PREFETCH_ID,
  mergePrefetchedOperationsTaskPatch,
  readPrefetchedBasicDocMap,
  readPrefetchedJson,
  readPrefetchedOperationsTasks,
  readPrefetchedPartySubmissions,
  readPrefetchedPoRecord,
  readPrefetchedPoRecords,
  readPrefetchedWorkflowTasks,
  savePrefetchedOperationsTasks,
  type BasicDocPrefetchEntry,
} from "./offline/prefetch-read";
export {
  buildEvidenceStampLines,
  compressEvidenceImage,
  extractEvidenceExif,
  processEvidencePhoto,
  type EvidencePhotoExif,
  type ProcessedEvidencePhoto,
} from "./media/process-evidence-photo";
export {
  evaluatePhotoLocation,
  parseCoord,
  photoLocationFlagLabel,
} from "./media/photo-location";
export {
  useAuthSession,
  useValidAuthSession,
} from "./auth/use-auth-session";
export { useOnlineStatus } from "./hooks/useOnlineStatus";
export { isFeatureEnabled, type FeatureFlag } from "./feature-flags";
export { LIVE_QUEUE_POLL_INTERVAL_MS } from "./query/live-query";
export { NotificationProvider, useNotifications } from "./notifications/NotificationProvider";
export {
  pushNotification,
  type AppNotification,
  type NotificationCategory,
  type NotificationEntityType,
  type PushNotificationInput,
} from "./notifications/notification-store";
export { formatNotificationTime } from "./notifications/format-notification-time";
export {
  filterNotificationsForRole,
  isEngineeringOfficeRole,
  shouldDeliverDomainNotification,
  shouldShowNotificationToast,
} from "./notifications/role-notification-policy";
export { useSyncedNotifications } from "./notifications/useSyncedNotifications";
export { exportRowsToCsv } from "./export/export-csv";
export * from "./domain/form/field-errors";
export * from "./form-ux";
export * from "./app-data/assignment-valuation-defaults";
export * from "./app-data/constants";
export * from "./app-data/po-list-status";
export * from "./app-data/active-transactions";
export * from "./app-data/party-task-pages";
export * from "./app-data/role-access";
export * from "./app-data/runtime-access";
export * from "./app-data/permissions-pages";
export * from "./app-data/page-access";
export * from "./app-data/settings-nav";
export * from "./app-data/system-fields-nav";
export * from "./app-data/system-settings-nav";
export * from "./app-data/financial-nav";
export * from "./app-data/orphan-screens-nav";
export * from "./app-data/property-fields-catalog";
export * from "./app-data/modules-api-config";
export * from "./app-data/task-attachments-api";
export * from "./app-data/party-submission-changed-event";
export * from "./app-data/party-task-recall-storage";
export * from "./app-data/party-workflow-events";
export * from "./app-data/screen-catalog";
export { appDataKeys } from "./query/app-data-keys";
export {
  optimisticPatchListItem,
  restoreOptimisticPatch,
  restoreQueryData,
} from "./query/optimistic-list";
export type { OptimisticPatchResult } from "./query/optimistic-list";
export { usePermissionsQuery } from "./query/permissions-queries";
export * from "./workflow/task-types";
export {
  registerEvaluatorRuntimeBridge,
  getEvaluatorRuntimeBridge,
  tryGetEvaluatorRuntimeBridge,
  withEvaluatorBridge,
  type EvaluatorRuntimeBridge,
} from "./party-appraisal/evaluator-runtime-bridge";
export {
  hydrateDomainStore,
  loadDomainJsonSync,
  saveDomainJsonSync,
  loadDomainStringSync,
  saveDomainStringSync,
  removeDomainStringSync,
} from "./storage/browser-domain-store";
