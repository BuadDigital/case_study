import {
  listInspectorFees,
  type InspectorFeesSummaryDto,
  type ListInspectorFeesQuery,
} from "@platform/api-client";
import { workOrdersApiConfig } from "@platform/app-shared/prototype/work-orders-api-config";

const EMPTY_SUMMARY: InspectorFeesSummaryDto = {
  netPreBillingSar: 0,
  totalDiscountsSar: 0,
  invoicedSar: 0,
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
