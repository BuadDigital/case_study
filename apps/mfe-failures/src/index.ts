/** @failures/mfe — إدارة التعذرات (failure queue + property failure reports). */

export { FailuresView } from "./views/FailuresView";
export { FailureTypesView } from "./views/FailureTypesView";
export { FailureReportForm } from "./components/failures/FailureReportForm";
export { FailureRaisePanel } from "./components/failures/FailureRaisePanel";
export { FailureRaiseFields } from "./components/failures/FailureRaiseFields";
export {
  FAILURE_RAISER_SPECIALIST,
  FAILURE_RAISER_SUPERVISOR,
  failureRaiserRoleForParty,
} from "./lib/failure-party-roles";

export * from "./lib/failures-types";
export * from "./lib/failures-events";
export * from "./lib/failures-repository";
export {
  failureSeverityLabel,
  failureStatusLabel,
  failureRecordTitle,
  failureOccurrenceSuffix,
  groupSimilarFailureRecords,
  isPanelBlockingFailure,
} from "./lib/failures-labels";
export type { GroupedFailureRow } from "./lib/failures-labels";
export * from "./lib/failure-types-data";
export * from "./lib/failure-property-match";
export * from "./lib/failure-types-storage";
export * from "./lib/failures-api";
export * from "./query/failures-queries";
export * from "./query/failure-types-queries";
