/**
 * The inspector's «جدول الحصر» offline: queue the full-replace PUT, keep a device copy of
 * the table for opening it without a connection, and never let a stale copy be written back.
 *
 * - Reads: a write still waiting in the outbox wins (it is the newest thing the inspector
 *   typed); otherwise the server; when the server cannot be reached, the copy cached on the
 *   device. With no copy at all the table stays closed — an empty table saved from there
 *   would replace (delete) lines the inspector never saw.
 * - Writes: online they go straight to the API (and drop any older queued write); offline
 *   or on a network failure they join the queue — one waiting row per property, last wins —
 *   and replay before the inspection's submit (`sync.ts`).
 */
import {
  getBuildingInventory,
  saveBuildingInventory,
  type ApiErr,
  type ApiOk,
  type BuildingInventoryDto,
  type SaveBuildingInventoryRequest,
  type WorkOrdersApiConfig,
} from "@platform/api-client";
import {
  beginOfflineLease,
  deleteOutboxItemsByKind,
  enqueueBuildingInventoryLocally,
  readQueuedBuildingInventory,
} from "@platform/offline-client";
import { isOfflineFieldSession } from "./offline-access-cache";
import { currentOfflineUserId, isBrowserOffline } from "./offline-write";
import { readPrefetchedJson, savePrefetchedJson } from "./prefetch-read";

export const BUILDING_INVENTORY_PREFETCH_ID = (userId: string, propertyId: string) =>
  `building-inventory:${userId}:${propertyId.trim()}`;

/** `/api/work-orders/{po}/properties/{id}/building-inventory` → its two ids (else null). */
export function parseBuildingInventoryPath(
  path: string,
): { poNumber: string; propertyId: string } | null {
  const match = path.match(
    /\/api\/work-orders\/([^/?#]+)\/properties\/([^/?#]+)\/building-inventory\/?(?:[?#].*)?$/i,
  );
  if (!match) return null;
  try {
    return {
      poNumber: decodeURIComponent(match[1]!),
      propertyId: decodeURIComponent(match[2]!),
    };
  } catch {
    return null;
  }
}

/** What the table looks like on the device right after a write was queued (ids stay as typed). */
export function inventoryDtoFromBody(
  propertyId: string,
  body: Record<string, unknown>,
  previous?: BuildingInventoryDto | null,
): BuildingInventoryDto {
  const lines = Array.isArray(body.lines)
    ? (body.lines as BuildingInventoryDto["lines"])
    : [];
  return {
    propertyId,
    hasStructuresToValue: lines.length > 0 ? "yes" : "no",
    componentsText:
      typeof body.componentsText === "string"
        ? body.componentsText
        : (previous?.componentsText ?? ""),
    lines,
  };
}

async function cachedInventory(
  userId: string,
  propertyId: string,
): Promise<BuildingInventoryDto | null> {
  return readPrefetchedJson<BuildingInventoryDto>(
    BUILDING_INVENTORY_PREFETCH_ID(userId, propertyId),
  );
}

/** Keep the device copy in step with what the server (or the queue) now holds. */
export async function rememberBuildingInventory(
  propertyId: string,
  dto: BuildingInventoryDto,
): Promise<void> {
  const userId = currentOfflineUserId();
  if (!userId || !propertyId.trim()) return;
  try {
    await savePrefetchedJson(
      BUILDING_INVENTORY_PREFETCH_ID(userId, propertyId),
      "building-inventory",
      dto,
    );
  } catch {
    /* storage unavailable — the table still works online */
  }
}

/**
 * Downloads the table of each assigned property while online, so the inspector can open and
 * edit it with no connection. A property whose table is waiting in the queue keeps the
 * queued edits (the read prefers them), and one the server refuses is skipped quietly.
 */
export async function prefetchBuildingInventories(
  config: WorkOrdersApiConfig | null,
  properties: ReadonlyArray<{ poNumber: string; propertyId: string }>,
): Promise<void> {
  if (!config) return;
  await Promise.allSettled(
    properties.map(async ({ poNumber, propertyId }) => {
      const res = await getBuildingInventory(config, poNumber, propertyId);
      if (res.ok) await rememberBuildingInventory(propertyId, res.data);
    }),
  );
}

/**
 * Queue the inspector's write for replay. False when the session cannot queue (not a field
 * role, signed out) — the caller then reports the failure instead.
 */
export async function queueBuildingInventoryWrite(input: {
  poNumber: string;
  propertyId: string;
  taskId?: string;
  body: Record<string, unknown>;
}): Promise<boolean> {
  const userId = currentOfflineUserId();
  if (!userId || !isOfflineFieldSession()) return false;
  await enqueueBuildingInventoryLocally({ userId, ...input });
  await beginOfflineLease(userId);
  await rememberBuildingInventory(
    input.propertyId,
    inventoryDtoFromBody(
      input.propertyId,
      input.body,
      await cachedInventory(userId, input.propertyId),
    ),
  );
  return true;
}

export type BuildingInventoryRead = ApiOk<BuildingInventoryDto> & {
  /** Served from the device (queued edits or the downloaded copy), not the server. */
  fromDevice?: boolean;
};

/** Reads the table: queued edits first, then the server, then the downloaded copy. */
export async function loadBuildingInventoryWithOffline(
  config: WorkOrdersApiConfig | null,
  poNumber: string,
  propertyId: string,
): Promise<BuildingInventoryRead | ApiErr> {
  const userId = currentOfflineUserId();
  const field = Boolean(userId) && isOfflineFieldSession();

  if (userId && field) {
    const queued = await readQueuedBuildingInventory(userId, propertyId);
    if (queued) {
      return {
        ok: true,
        fromDevice: true,
        data: inventoryDtoFromBody(
          propertyId,
          queued.body,
          await cachedInventory(userId, propertyId),
        ),
      };
    }
  }

  if (config && !isBrowserOffline()) {
    const res = await getBuildingInventory(config, poNumber, propertyId);
    if (res.ok) {
      if (field) await rememberBuildingInventory(propertyId, res.data);
      return res;
    }
    if (res.kind !== "network" || !field) return res;
  } else if (!field) {
    return { ok: false, kind: "network" };
  }

  const cached = userId ? await cachedInventory(userId, propertyId) : null;
  return cached
    ? { ok: true, fromDevice: true, data: cached }
    : { ok: false, kind: "network" };
}

export type BuildingInventorySaveResult =
  | (ApiOk<BuildingInventoryDto> & { queued: boolean })
  | ApiErr;

/** Writes the table: straight to the API online; into the queue offline or without a link. */
export async function saveBuildingInventoryWithOffline(
  config: WorkOrdersApiConfig | null,
  poNumber: string,
  propertyId: string,
  body: SaveBuildingInventoryRequest,
  taskId?: string,
): Promise<BuildingInventorySaveResult> {
  const userId = currentOfflineUserId();
  const field = Boolean(userId) && isOfflineFieldSession();
  const queue = async (): Promise<BuildingInventorySaveResult | null> => {
    const queued = await queueBuildingInventoryWrite({
      poNumber,
      propertyId,
      taskId,
      body: body as unknown as Record<string, unknown>,
    });
    if (!queued) return null;
    return {
      ok: true,
      queued: true,
      data: inventoryDtoFromBody(propertyId, body as unknown as Record<string, unknown>),
    };
  };

  if ((!config || isBrowserOffline()) && field) {
    const queued = await queue();
    if (queued) return queued;
  }
  if (!config) return { ok: false, kind: "auth" };

  const res = await saveBuildingInventory(config, poNumber, propertyId, body);
  if (res.ok) {
    if (userId && field) {
      // The server now holds this write: an older queued one must not replay over it.
      await deleteOutboxItemsByKind(userId, "building-inventory-save", propertyId);
      await rememberBuildingInventory(propertyId, res.data);
    }
    return { ...res, queued: false };
  }
  if (res.kind === "network" && field) {
    const queued = await queue();
    if (queued) return queued;
  }
  return res;
}
