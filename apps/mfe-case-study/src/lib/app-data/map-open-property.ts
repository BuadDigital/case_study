import type { PoIntakeRecord } from "./po-intake-data";
import { poPropertyPath } from "@platform/app-shared/domain/po-routes";

/** Temporary deed lookup until map points link directly by poNumber/propertyId. */
export function findPropertyPathByDeed(
  records: PoIntakeRecord[] | undefined,
  deedNo: string,
): string | null {
  const needle = deedNo.trim();
  if (!needle || !records?.length) return null;
  for (const record of records) {
    const property = record.properties.find(
      (p) => p.deedNumber.trim() === needle,
    );
    if (property) return poPropertyPath(record.poNumber, property.id);
  }
  return null;
}
