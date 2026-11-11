"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getOpenValuationRequestByProperty,
  getValuationApproachSettings,
  getValuationCostApproach,
  getValuationReconciliation,
  listComparableProperties,
  listValuationComparableSelections,
} from "@platform/api-client";
import { requireWorkOrdersApiConfig, unwrapApiResult } from "../app-data/work-orders-api-config";
import {
  NO_VALUATION_FIGURES,
  districtLandRates,
  valuationFigures,
  type DistrictLandRates,
  type ValuationFigures,
} from "../domain/valuation-figures";
import { appDataKeys } from "./app-data-keys";

/** The district's comparables asked for in one read — the mean is taken over them. */
const DISTRICT_BANK_TAKE = 1000;
/**
 * How often the figures are read again while the page is on screen: the appraiser may be working
 * on another screen (the specialist's pages). On the appraiser's own page every save refreshes
 * them at once — the valuation screen invalidates `appDataKeys.propertyValuationFigures`.
 */
const FIGURES_REFRESH_MS = 30_000;

/**
 * The valuation's land, buildings and property values for a property, as saved so far.
 *
 * How it works: the property's open valuation request, then its settings, cost approach and final
 * opinion (and the market table for a land) — four light reads.
 * Edge cases: no open valuation request (not sent to valuation yet, or closed after the final
 * report) gives no figures, not an error; one part that fails to load leaves its figures empty
 * and the rest show.
 */
export function usePropertyValuationFiguresQuery(propertyId: string | null | undefined) {
  const property = propertyId?.trim() ?? "";
  return useQuery<ValuationFigures>({
    queryKey: appDataKeys.propertyValuationFigures(property),
    queryFn: async () => {
      const config = requireWorkOrdersApiConfig();
      const open = unwrapApiResult(
        await getOpenValuationRequestByProperty(config, property),
        "تعذّر تحميل قيم التقييم",
      );
      if (!open) return NO_VALUATION_FIGURES;
      const [settingsRes, costRes, reconRes] = await Promise.all([
        getValuationApproachSettings(config, open.id),
        getValuationCostApproach(config, open.id),
        getValuationReconciliation(config, open.id),
      ]);
      const settings = settingsRes.ok ? settingsRes.data : null;
      const marketRes = settings?.isLandPropertyType
        ? await listValuationComparableSelections(config, open.id, "market")
        : null;
      return valuationFigures({
        settings,
        cost: costRes.ok ? costRes.data : null,
        recon: reconRes.ok ? reconRes.data : null,
        market: marketRes?.ok ? marketRes.data : null,
      });
    },
    enabled: Boolean(property),
    staleTime: 10_000,
    refetchInterval: FIGURES_REFRESH_MS,
  });
}

/**
 * «سعر المنطقة»: the mean land rate of the bank's comparables in a district, by use.
 *
 * Edge cases: no district asks nothing; the server matches the district by «contains», so the
 * exact match is made in `districtLandRates`.
 */
export function useDistrictLandRatesQuery(place: {
  district: string | null | undefined;
  city?: string | null;
}) {
  const district = place.district?.trim() ?? "";
  const city = place.city?.trim() ?? "";
  return useQuery<DistrictLandRates>({
    queryKey: appDataKeys.districtLandRates(city, district),
    queryFn: async () => {
      const config = requireWorkOrdersApiConfig();
      const rows = unwrapApiResult(
        await listComparableProperties(config, { district, take: DISTRICT_BANK_TAKE }),
        "تعذّر تحميل سعر المنطقة",
      );
      return districtLandRates(rows, { district, city });
    },
    enabled: Boolean(district),
    staleTime: 5 * 60_000,
  });
}
