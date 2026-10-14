import { getPropertyKeyGate, type PropertyKeyGateDto } from "@platform/api-client";
import { prototypeModulesApiConfig } from "../app-data/modules-api-config";
import { currentOfflineUserId } from "./offline-write";
import { readPrefetchedJson, savePrefetchedJson } from "./prefetch-read";

type PropertyKeyGateParams = {
  propertyId?: string | null;
  poNumber?: string | null;
  deedNumber?: string | null;
  requestNumber?: string | null;
};

/** One device copy per property — the inspector's submit needs the key status on site, offline. */
function keyGatePrefetchId(params: PropertyKeyGateParams): string | null {
  const ref =
    params.propertyId?.trim() ||
    params.poNumber?.trim() ||
    params.deedNumber?.trim() ||
    params.requestNumber?.trim();
  const userId = currentOfflineUserId();
  return ref && userId ? `key-gate:${userId}:${ref}` : null;
}

/**
 * Reads the key gate and keeps the last good answer on the device (encrypted
 * like every prefetch row). Only an unreachable server falls back to that copy;
 * a server or auth failure throws, so it is never read as «no key».
 * `null` without a modules-API session.
 */
export async function loadPropertyKeyGate(
  params: PropertyKeyGateParams,
): Promise<PropertyKeyGateDto | null> {
  const config = prototypeModulesApiConfig();
  if (!config) return null;
  const prefetchId = keyGatePrefetchId(params);
  const result = await getPropertyKeyGate(config, params);
  if (result.ok) {
    if (prefetchId) {
      await savePrefetchedJson(prefetchId, "key-gate", result.data).catch(() => {
        /* best-effort device copy (no secure context / IndexedDB) */
      });
    }
    return result.data;
  }
  if (result.kind === "network" && prefetchId) {
    const copy = await readPrefetchedJson<PropertyKeyGateDto>(prefetchId).catch(
      () => null,
    );
    if (copy) return copy;
  }
  throw new Error("تعذّر تحميل حالة المفتاح");
}
