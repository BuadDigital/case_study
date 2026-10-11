import {
  listInspectorFees,
  patchInspectorFee,
  transitionInspectorFee,
  type InspectorFeeRowDto,
  type InspectorFeesSummaryDto,
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

type InspectorFeeMutationResult<T> = MutationResult<T>;

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
