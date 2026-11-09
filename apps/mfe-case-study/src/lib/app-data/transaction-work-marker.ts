import { markTransactionWorking } from "@platform/api-client";
import { workOrdersApiConfig } from "@platform/app-shared/app-data/work-orders-api-config";

/** How long a «يعمل عليها الآن» mark stays shown (minutes). */
export const WORK_MARKER_FRESH_MINUTES = 30;

/** At most one heartbeat per transaction in this window, whatever the screen does (ms). */
const HEARTBEAT_THROTTLE_MS = 2 * 60_000;

const lastBeatAt = new Map<string, number>();

/**
 * Sends the «يعمل عليها الآن» heartbeat for a transaction (ruling 2026-11-02 — information only).
 *
 * How it works: fire-and-forget POST, at most once per transaction every two minutes per tab.
 * Edge cases: no transaction id or no session → nothing; a failed call is swallowed by the client.
 */
export function beatTransactionWork(transactionId: string | null | undefined, nowMs = Date.now()): boolean {
  const id = transactionId?.trim();
  if (!id) return false;
  const last = lastBeatAt.get(id);
  if (last !== undefined && nowMs - last < HEARTBEAT_THROTTLE_MS) return false;
  const config = workOrdersApiConfig();
  if (!config) return false;
  lastBeatAt.set(id, nowMs);
  void markTransactionWorking(config, id);
  return true;
}

/**
 * The «يعمل عليها الآن: فلان» line, or null when nobody else touched the transaction lately.
 *
 * Edge cases: the viewer's own mark is never shown to him; a mark older than
 * `WORK_MARKER_FRESH_MINUTES` or with an unreadable time is stale.
 */
export function workMarkerLine(
  marker: { workingByUserId?: string | null; workingByName?: string | null; workingAtUtc?: string | null },
  viewerUserId: string | null,
  nowMs = Date.now(),
): string | null {
  const name = marker.workingByName?.trim();
  if (!name || !marker.workingAtUtc) return null;
  if (viewerUserId && marker.workingByUserId === viewerUserId) return null;
  const at = Date.parse(marker.workingAtUtc);
  if (Number.isNaN(at) || nowMs - at > WORK_MARKER_FRESH_MINUTES * 60_000) return null;
  return `يعمل عليها الآن: ${name}`;
}

/** Test seam: forget the throttle. */
export function resetTransactionWorkBeats(): void {
  lastBeatAt.clear();
}
