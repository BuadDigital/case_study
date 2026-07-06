import {
  batchTransitionInspectorFees,
  createDisbursementBatch,
  listInspectorFees,
  listInspectorFeeTransitions,
  patchInspectorFee,
  transitionInspectorFee,
  type BatchInspectorFeeTransitionRequest,
  type BatchInspectorFeeTransitionResult,
  type CreateDisbursementBatchRequest,
  type CreateDisbursementBatchResult,
  type InspectorFeeRowDto,
  type InspectorFeesSummaryDto,
  type InspectorFeeAuditEntryDto,
  type InspectorFeeTransitionRequest,
  type ListInspectorFeesQuery,
  type PatchInspectorFeeRequest,
} from "@platform/api-client";
import {
  apiErrorMessage,
  mutationFromApiResult,
  requireWorkOrdersApiConfig,
  unwrapApiResult,
  workOrdersApiConfig,
  type MutationResult,
} from "./work-orders-api-config";

export type InspectorFeeMutationResult<T> = MutationResult<T>;

export async function loadInspectorFeesSummary(
  query: ListInspectorFeesQuery,
): Promise<InspectorFeesSummaryDto> {
  const config = requireWorkOrdersApiConfig();
  const result = await listInspectorFees(config, query);
  return unwrapApiResult(result, "تعذّر تحميل أتعاب المعاينين");
}

export async function saveInspectorFeePatch(
  workflowTaskId: string,
  body: PatchInspectorFeeRequest,
): Promise<InspectorFeeMutationResult<InspectorFeeRowDto>> {
  const config = workOrdersApiConfig();
  if (!config) return { ok: false, error: apiErrorMessage("auth") };

  const result = await patchInspectorFee(config, workflowTaskId, body);
  return mutationFromApiResult(result, "تعذّر حفظ أتعاب المعاين");
}

export async function runInspectorFeeTransition(
  workflowTaskId: string,
  body: InspectorFeeTransitionRequest,
): Promise<InspectorFeeMutationResult<InspectorFeeRowDto>> {
  const config = workOrdersApiConfig();
  if (!config) return { ok: false, error: apiErrorMessage("auth") };

  const result = await transitionInspectorFee(config, workflowTaskId, body);
  return mutationFromApiResult(result, "تعذّر تنفيذ إجراء الأتعاب");
}

export async function runInspectorFeeBatchTransition(
  body: BatchInspectorFeeTransitionRequest,
): Promise<InspectorFeeMutationResult<BatchInspectorFeeTransitionResult>> {
  const config = workOrdersApiConfig();
  if (!config) return { ok: false, error: apiErrorMessage("auth") };

  const result = await batchTransitionInspectorFees(config, body);
  return mutationFromApiResult(result, "تعذّر تنفيذ إجراء الأتعاب الجماعي");
}

export async function runCreateDisbursementBatch(
  body: CreateDisbursementBatchRequest,
): Promise<InspectorFeeMutationResult<CreateDisbursementBatchResult>> {
  const config = workOrdersApiConfig();
  if (!config) return { ok: false, error: apiErrorMessage("auth") };

  const result = await createDisbursementBatch(config, body);
  return mutationFromApiResult(result, "تعذّر إنشاء أمر الصرف");
}

export async function loadInspectorFeeTransitions(
  workflowTaskId: string,
): Promise<InspectorFeeAuditEntryDto[]> {
  const config = requireWorkOrdersApiConfig();
  const result = await listInspectorFeeTransitions(config, workflowTaskId);
  return unwrapApiResult(result, "تعذّر تحميل سجل أتعاب المعاين");
}
