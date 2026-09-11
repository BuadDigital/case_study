/**
 * Valuation requests store only the case-study property id. The list shows the deed number and
 * work order instead, read from the shared property rows; a request whose property no longer
 * exists is labelled as such rather than printing the raw id.
 */

import type { PropertyListItem } from "@platform/app-shared/app-data/work-orders-read";

export type ValuationRequestProperty = {
  deed: string;
  poNumber: string;
  type: string;
};

export function valuationRequestPropertiesById(
  items: readonly PropertyListItem[],
): Map<string, ValuationRequestProperty> {
  const byId = new Map<string, ValuationRequestProperty>();
  for (const item of items) {
    const id = item.propertyId.trim();
    if (!id) continue;
    byId.set(id, {
      deed: item.row.id.trim(),
      poNumber: item.poNumber.trim(),
      type: item.row.type.trim(),
    });
  }
  return byId;
}

const EMPTY = new Set(["", "—", "-"]);

/** Type saved on the request when set, else the property's current type. */
export function valuationRequestTypeLabel(
  storedType: string,
  property: ValuationRequestProperty | null | undefined,
): string {
  const stored = storedType.trim();
  if (!EMPTY.has(stored)) return stored;
  return property?.type && !EMPTY.has(property.type) ? property.type : "—";
}

/** Search text for one request row: request number, deed, work order, area, type, appraiser. */
export function valuationRequestSearchText(
  request: { id: string; propId: string; area: string; type: string; appraiser: string },
  property: ValuationRequestProperty | null | undefined,
): string {
  return [
    request.id,
    property?.deed ?? request.propId,
    property?.poNumber ?? "",
    request.area,
    valuationRequestTypeLabel(request.type, property),
    request.appraiser,
  ].join(" ");
}
