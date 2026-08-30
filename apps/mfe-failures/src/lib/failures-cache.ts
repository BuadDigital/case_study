import { activeFailureForProperty } from "./failure-property-match";
import type { FailureRecord } from "./failures-types";

let listCache: FailureRecord[] = [];
// Lazy index by work-order number — getCachedPropertyFailure is called per property when loading
// lists, and a full cache scan was O(properties × failures) (js-index-maps).
// Cleared on every write and rebuilt on the next read.
let byPoIndex: Map<string, FailureRecord[]> | null = null;

function indexByPo(): Map<string, FailureRecord[]> {
  if (byPoIndex) return byPoIndex;
  const map = new Map<string, FailureRecord[]>();
  for (const failure of listCache) {
    const key = failure.poNumber.trim();
    const bucket = map.get(key);
    if (bucket) bucket.push(failure);
    else map.set(key, [failure]);
  }
  byPoIndex = map;
  return map;
}

export function getCachedFailuresList(): FailureRecord[] {
  return listCache;
}

export function setCachedFailuresList(list: FailureRecord[]): void {
  listCache = list;
  byPoIndex = null;
}

export function getCachedPropertyFailure(
  poNumber: string,
  propertyId: string,
  deedNumber?: string,
): FailureRecord | null {
  const bucket = indexByPo().get(poNumber.trim());
  if (!bucket) return null;
  return activeFailureForProperty(bucket, {
    poNumber,
    propertyId,
    deedNumber,
  });
}

export function upsertCachedFailure(record: FailureRecord): void {
  byPoIndex = null;
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
  byPoIndex = null;
  const n = poNumber.trim();
  listCache = listCache.filter((f) => f.poNumber.trim() !== n);
}
