import {
  getOfflineLease,
  setOfflineLease,
} from "./store";
import {
  OFFLINE_LEASE_EVENT,
  OFFLINE_LEASE_MS,
  OFFLINE_WARN_1H_MS,
  OFFLINE_WARN_2H_MS,
  type OfflineLease,
} from "./types";

export type OfflineLeaseTickResult = {
  lease: OfflineLease;
  warn1h: boolean;
  warn2h: boolean;
  lockedNow: boolean;
};

export async function beginOfflineLease(userId: string): Promise<OfflineLease> {
  const existing = await getOfflineLease(userId);
  if (existing?.offlineSinceUtc && !existing.locked) {
    return existing;
  }
  const now = Date.now();
  const lease: OfflineLease = {
    userId,
    offlineSinceUtc: new Date(now).toISOString(),
    leaseExpiresAtUtc: new Date(now + OFFLINE_LEASE_MS).toISOString(),
    warned1h: false,
    warned2h: false,
    locked: false,
  };
  await setOfflineLease(lease);
  return lease;
}

export async function clearOfflineLease(userId: string): Promise<void> {
  await setOfflineLease({
    userId,
    offlineSinceUtc: null,
    leaseExpiresAtUtc: null,
    warned1h: false,
    warned2h: false,
    locked: false,
  });
}

export async function tickOfflineLease(
  userId: string,
): Promise<OfflineLeaseTickResult | null> {
  const lease = await getOfflineLease(userId);
  if (!lease?.offlineSinceUtc || !lease.leaseExpiresAtUtc) return null;

  const since = Date.parse(lease.offlineSinceUtc);
  const expires = Date.parse(lease.leaseExpiresAtUtc);
  if (Number.isNaN(since) || Number.isNaN(expires)) return null;

  const elapsed = Date.now() - since;
  let next = { ...lease };
  let warn1h = false;
  let warn2h = false;
  let lockedNow = false;

  if (!next.warned1h && elapsed >= OFFLINE_WARN_1H_MS) {
    next.warned1h = true;
    warn1h = true;
  }
  if (!next.warned2h && elapsed >= OFFLINE_WARN_2H_MS) {
    next.warned2h = true;
    warn2h = true;
  }
  if (!next.locked && Date.now() >= expires) {
    next.locked = true;
    lockedNow = true;
  }

  if (
    next.warned1h !== lease.warned1h ||
    next.warned2h !== lease.warned2h ||
    next.locked !== lease.locked
  ) {
    await setOfflineLease(next);
  }

  if (typeof window !== "undefined" && (warn1h || warn2h || lockedNow)) {
    window.dispatchEvent(
      new CustomEvent(OFFLINE_LEASE_EVENT, {
        detail: { lease: next, warn1h, warn2h, lockedNow },
      }),
    );
  }

  return { lease: next, warn1h, warn2h, lockedNow };
}
