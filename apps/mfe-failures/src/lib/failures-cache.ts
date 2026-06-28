import { activeFailureForProperty } from "./failure-property-match";
import type { FailureRecord } from "./failures-types";

let listCache: FailureRecord[] = [];

export function getCachedFailuresList(): FailureRecord[] {
  return listCache;
}

export function setCachedFailuresList(list: FailureRecord[]): void {
  listCache = list;
}

export function getCachedPropertyFailure(
  poNumber: string,
  propertyId: string,
  deedNumber?: string,
): FailureRecord | null {
  return activeFailureForProperty(listCache, {
    poNumber,
    propertyId,
    deedNumber,
  });
}

export function upsertCachedFailure(record: FailureRecord): void {
  const idx = listCache.findIndex((f) => f.id === record.id);
  if (idx >= 0) {
    listCache = [
      ...listCache.slice(0, idx),
      record,
      ...listCache.slice(idx + 1),
    ];
    return;
  }
  listCache = [record, ...listCache];
}

export function removeCachedFailuresForPo(poNumber: string): void {
  const n = poNumber.trim();
  listCache = listCache.filter((f) => f.poNumber.trim() !== n);
}
