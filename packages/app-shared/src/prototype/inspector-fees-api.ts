import {
  batchTransitionInspectorFees,
  createDisbursementBatch,
  listInspectorFees,
  listInspectorFeeTransitions,
  patchInspectorFee,
  transitionInspectorFee,
  type BatchInspectorFeeTransitionRequest,
  type CreateDisbursementBatchRequest,
  type CreateDisbursementBatchResult,
  type InspectorFeeRowDto,
  type InspectorFeesSummaryDto,
  type InspectorFeeTransitionRequest,
  type ListInspectorFeesQuery,
  type PatchInspectorFeeRequest,
} from "@platform/api-client";
import { workOrdersApiConfig } from "./work-orders-api-config";

const EMPTY_SUMMARY: InspectorFeesSummaryDto = {
  netDraftSar: 0,
  supReviewSar: 0,
  atFinanceSar: 0,
  disbReqSar: 0,
  disbursedSar: 0,
  totalDiscountsSar: 0,
  rows: [],
};

export async function loadInspectorFeesSummary(
  query: ListInspectorFeesQuery,
): Promise<InspectorFeesSummaryDto> {
  const config = workOrdersApiConfig();
  if (!config) return EMPTY_SUMMARY;

  const result = await listInspectorFees(config, query);
  if (!result.ok) return EMPTY_SUMMARY;
  return result.data;
}

export async function saveInspectorFeePatch(
  workflowTaskId: string,
  body: PatchInspectorFeeRequest,
): Promise<InspectorFeeRowDto | null> {
  const config = workOrdersApiConfig();
  if (!config) return null;

  const result = await patchInspectorFee(config, workflowTaskId, body);
  return result.ok ? result.data : null;
}

export async function runInspectorFeeTransition(
  workflowTaskId: string,
  body: InspectorFeeTransitionRequest,
): Promise<InspectorFeeRowDto | null> {
  const config = workOrdersApiConfig();
  if (!config) return null;

  const result = await transitionInspectorFee(config, workflowTaskId, body);
  return result.ok ? result.data : null;
}

export async function runInspectorFeeBatchTransition(
  body: BatchInspectorFeeTransitionRequest,
) {
  const config = workOrdersApiConfig();
  if (!config) return null;

  const result = await batchTransitionInspectorFees(config, body);
  return result.ok ? result.data : null;
}

export async function runCreateDisbursementBatch(
  body: CreateDisbursementBatchRequest,
): Promise<CreateDisbursementBatchResult | null> {
  const config = workOrdersApiConfig();
  if (!config) return null;

  const result = await createDisbursementBatch(config, body);
  return result.ok ? result.data : null;
}

export async function loadInspectorFeeTransitions(workflowTaskId: string) {
  const config = workOrdersApiConfig();
  if (!config) return [];
  const result = await listInspectorFeeTransitions(config, workflowTaskId);
  return result.ok ? result.data : [];
}
