import { queryOptions } from "@tanstack/react-query";
import { loadPropertyEnfazRevenue } from "@platform/app-shared/app-data/enfaz-billing-api";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";

/**
 * Infath revenue for one property (finance tab, «إيراد إنفاذ»). Shared by the tab
 * and the tab bar's hover prefetch so both hit the same cache entry — kept out
 * of the tab's file so the prefetch does not pull the tab chunk into the page.
 */
export function propertyEnfazRevenueQueryOptions(
  poNumber: string,
  propertyId: string,
) {
  return queryOptions({
    queryKey: [...appDataKeys.all, "enfaz-billing", poNumber, propertyId],
    queryFn: () => loadPropertyEnfazRevenue(poNumber, propertyId),
    enabled: Boolean(propertyId),
  });
}
