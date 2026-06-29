import {
  getPoEnfazBilling,
  getPropertyEnfazRevenue,
  issuePoEnfazInvoice,
  listEnfazTracking,
  listReadyEnfazPoSummaries,
  savePoEnfazBilling,
  type PoEnfazBillingDto,
  type PropertyEnfazRevenueDto,
  type SavePoEnfazBillingRequest,
} from "@platform/api-client";
import { workOrdersApiConfig } from "./work-orders-api-config";

export async function loadReadyEnfazPoSummaries() {
  const config = workOrdersApiConfig();
  if (!config) return [];
  const result = await listReadyEnfazPoSummaries(config);
  return result.ok ? result.data : [];
}

export async function loadPoEnfazBilling(
  poNumber: string,
): Promise<PoEnfazBillingDto | null> {
  const config = workOrdersApiConfig();
  if (!config) return null;
  const result = await getPoEnfazBilling(config, poNumber);
  return result.ok ? result.data : null;
}

export async function savePoEnfazBillingData(
  poNumber: string,
  body: SavePoEnfazBillingRequest,
): Promise<PoEnfazBillingDto | null> {
  const config = workOrdersApiConfig();
  if (!config) return null;
  const result = await savePoEnfazBilling(config, poNumber, body);
  return result.ok ? result.data : null;
}

export async function loadEnfazTracking() {
  const config = workOrdersApiConfig();
  if (!config) return [];
  const result = await listEnfazTracking(config);
  return result.ok ? result.data : [];
}

export async function issueEnfazInvoice(poNumber: string) {
  const config = workOrdersApiConfig();
  if (!config) return null;
  const result = await issuePoEnfazInvoice(config, poNumber);
  return result.ok ? result.data : null;
}

export async function loadPropertyEnfazRevenue(
  poNumber: string,
  propertyId: string,
): Promise<PropertyEnfazRevenueDto> {
  const config = workOrdersApiConfig();
  if (!config) return { hasEnfazRevenue: false, enfazFeeSar: null };
  const result = await getPropertyEnfazRevenue(config, poNumber, propertyId);
  return result.ok ? result.data : { hasEnfazRevenue: false, enfazFeeSar: null };
}
