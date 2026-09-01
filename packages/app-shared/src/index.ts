export { PrototypeProvider, usePrototype } from "./contexts/PrototypeContext";
export { Can, useCapability } from "./components/Can";
export { useAuth } from "./hooks/useAuth";
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
export * from "./prototype/assignment-valuation-defaults";
export * from "./prototype/constants";
export * from "./prototype/po-list-status";
export * from "./prototype/active-transactions";
export * from "./prototype/party-task-pages";
export * from "./prototype/prototype-role-access";
export * from "./prototype/runtime-access";
export * from "./prototype/permissions-pages";
export * from "./prototype/page-access";
export * from "./prototype/settings-nav";
export * from "./prototype/system-fields-nav";
export * from "./prototype/system-settings-nav";
export * from "./prototype/financial-nav";
export * from "./prototype/orphan-screens-nav";
export * from "./prototype/property-fields-catalog";
export * from "./prototype/prototype-modules-api-config";
export * from "./prototype/task-attachments-api";
export * from "./prototype/party-submission-changed-event";
export * from "./prototype/party-task-recall-storage";
export * from "./prototype/party-workflow-events";
export * from "./prototype/screen-catalog";
export { prototypeKeys } from "./query/prototype-keys";
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
