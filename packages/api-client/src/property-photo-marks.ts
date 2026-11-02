import { putPropertyPart } from "./building-inventory";
import type { ApiErr, ApiOk, WorkOrdersApiConfig } from "./work-orders";

/** The case specialist's marks on the inspector's photos, by attachment id. */
export type PropertyPhotoMarksDto = {
  main: string | null;
  electricity: string[];
  water: string[];
  /** The photos the report prints; empty = the first ones in the automatic order. */
  report: string[];
};

/**
 * PUT the property's whole set of marks. The marks are read back with the property, in the
 * work-order response. A refused save (an issued study, the report's limit) is `validation`
 * with the reason under `errors`.
 */
export function savePropertyPhotoMarks(
  config: WorkOrdersApiConfig,
  poNumber: string,
  propertyId: string,
  body: PropertyPhotoMarksDto,
): Promise<ApiOk<PropertyPhotoMarksDto> | ApiErr> {
  return putPropertyPart(config, poNumber, propertyId, "photo-marks", body);
}
