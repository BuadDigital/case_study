/**
 * Request sequence behind `useValuationWorkData.reload`. Every reload takes a
 * ticket; only the latest ticket, still on the property it started for, may
 * write its responses. Two quick saves fire two silent reloads, and switching
 * property mid-load starts a new one — without this the older responses could
 * land last and overwrite newer data (or property A's data land on property B).
 * Pure: no React, no I/O.
 */

export type ReloadOptions = { silent?: boolean; scope?: "full" | "derived" };

export type ReloadTicket = {
  readonly seq: number;
  readonly propertyId: string;
  /** What this reload owes — merged with any reload it superseded (see `begin`). */
  readonly opts: ReloadOptions;
};

type ReloadSequence = {
  begin(propertyId: string, opts?: ReloadOptions): ReloadTicket;
  isLatest(ticket: ReloadTicket, currentPropertyId: string): boolean;
  finish(ticket: ReloadTicket): void;
};

/**
 * A superseded reload's results are dropped, so the one replacing it takes over
 * what it still owed on the same property: a skeleton/draft reseed (not silent)
 * and the full scope (settings + bank), not just the derived batches.
 */
function mergeOwed(prev: ReloadOptions, next: ReloadOptions): ReloadOptions {
  return {
    silent: !!prev.silent && !!next.silent,
    scope: prev.scope === "derived" && next.scope === "derived" ? "derived" : "full",
  };
}

export function createReloadSequence(): ReloadSequence {
  let latest: ReloadTicket | null = null;
  let inFlight = false;
  return {
    begin(propertyId, opts = {}) {
      const owed =
        latest && inFlight && latest.propertyId === propertyId
          ? mergeOwed(latest.opts, opts)
          : opts;
      latest = { seq: (latest?.seq ?? 0) + 1, propertyId, opts: owed };
      inFlight = true;
      return latest;
    },
    isLatest(ticket, currentPropertyId) {
      return ticket === latest && ticket.propertyId === currentPropertyId;
    },
    finish(ticket) {
      if (ticket === latest) inFlight = false;
    },
  };
}

/** For side batches whose failure just leaves the previous rows on screen. */
export const ignoreSideFailure = (): void => {};

/**
 * Run one reload under a fresh ticket. A rejection reaches `onRejected` only
 * while that ticket is still the latest on the current property — a superseded
 * reload's failure is as stale as its data.
 */
export async function runReload(
  seq: ReloadSequence,
  start: { propertyId: string; opts?: ReloadOptions },
  currentPropertyId: () => string,
  load: (ticket: ReloadTicket) => Promise<void>,
  onRejected: () => void,
): Promise<void> {
  const ticket = seq.begin(start.propertyId, start.opts);
  try {
    await load(ticket);
  } catch {
    if (seq.isLatest(ticket, currentPropertyId())) onRejected();
  } finally {
    seq.finish(ticket);
  }
}
