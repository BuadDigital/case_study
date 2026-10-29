/**
 * Serialised per-comparable market writes that always build on the latest
 * known lines. Every matrix command (cell %, description, rationale override,
 * ✓, label, weight, bank override) PUTs the comparable's WHOLE line list, so a
 * write must be built from the comparable as it stands after every earlier
 * write — not from the item the screen held when the edit was made. No React.
 */
import type {
  SaveValuationComparableMarketRequest,
  ValuationComparableSelectionDto,
} from "@platform/api-client";
import { createKeyedWriteQueue } from "@platform/app-shared/lib/keyed-write-queue";
import type { SavedLine } from "./market-commands-state";

type Item = ValuationComparableSelectionDto;

/** What one comparable's PUT carries: its full line list plus any market fields on top. */
export type MarketWrite = {
  lines: SavedLine[];
  extra?: Partial<SaveValuationComparableMarketRequest>;
};

type PutResult = { ok: true; data: Item } | { ok: false };

/** One queued write: which comparables, how to build and send each body, and what to do after. */
type QueuedWrite<R extends PutResult, T> = {
  items: Item[];
  /** Null declines the write for that comparable — a check on the freshest copy failed. */
  build: (fresh: Item) => MarketWrite | null;
  /** Sends one comparable's body (the caller adds auth and the conflict replay). */
  put: (item: Item, write: MarketWrite) => Promise<R>;
  /** Runs outside the queue with one result per item, in order (null = declined) — toast, reload. */
  settle: (results: (R | null)[]) => Promise<T>;
};

/** One queue for every market write of a valuation — fan-outs and single cells share the order. */
const MARKET_WRITES = "market";

/**
 * Creates the queue. `current` returns the comparable as the screen holds it
 * now (undefined when it is not listed).
 *
 * How it works: `write` counts the comparables as busy, then runs its PUTs
 * after every earlier write. Each body is built inside the queue from the
 * freshest copy of the comparable — the server's answer to the last
 * successful write on it, or else the screen's copy — and a successful answer
 * becomes the new freshest copy. `settle` (toast, reload) runs outside the
 * queue; once it ends the comparable is released.
 *
 * Edge cases: the server's copy is used while any write on the comparable is
 * still running or reloading, and after that until the screen's copy changes
 * (the reload has rendered, or another command refreshed it) — then the
 * screen's copy wins again. A failed PUT leaves the freshest copy untouched.
 * A `build` that returns null sends nothing for that comparable and hands
 * `settle` a null in its place.
 *
 * Fixed: a percent typed in a cell and the description typed under it right
 * after were both built from the same pre-save item, so the description save
 * sent the old percent and erased the new one (seen 2026-10-28).
 */
export function createComparableMarketWriteQueue(
  current: (id: string) => Item | undefined,
) {
  const queue = createKeyedWriteQueue();
  /** Server copy of each comparable after its last successful write, and the screen copy seen when it settled. */
  const confirmed = new Map<string, { data: Item; seen: Item | undefined }>();
  const busy = new Map<string, number>();

  /** Drops a server copy the screen has since replaced — only when no write on it is running. */
  function prune(id: string) {
    const entry = confirmed.get(id);
    if (entry && !busy.get(id) && entry.seen !== current(id)) confirmed.delete(id);
  }

  /** The copy a new body is built from: server copy first, then the screen's, then the caller's. */
  function freshest(item: Item): Item {
    return confirmed.get(item.id)?.data ?? current(item.id) ?? item;
  }

  /** Ends one write on the comparable; the last one notes which screen copy it settled against. */
  function release(id: string) {
    const left = (busy.get(id) ?? 1) - 1;
    if (left > 0) {
      busy.set(id, left);
      return;
    }
    busy.delete(id);
    const entry = confirmed.get(id);
    if (entry) entry.seen = current(id);
  }

  /**
   * Writes the given comparables one after another, each body built by
   * `build` from that comparable's freshest copy; resolves with `settle`'s
   * answer to the PUT results.
   */
  async function write<R extends PutResult, T>({
    items,
    build,
    put,
    settle,
  }: QueuedWrite<R, T>): Promise<T> {
    for (const item of items) {
      prune(item.id);
      busy.set(item.id, (busy.get(item.id) ?? 0) + 1);
    }
    try {
      const results = await queue.enqueue(MARKET_WRITES, async () => {
        const out: (R | null)[] = [];
        for (const item of items) {
          const fresh = freshest(item);
          const body = build(fresh);
          if (!body) {
            out.push(null);
            continue;
          }
          const res = await put(fresh, body);
          if (res.ok) {
            confirmed.set(item.id, { data: res.data, seen: current(item.id) });
          }
          out.push(res);
        }
        return out;
      });
      return await settle(results);
    } finally {
      for (const item of items) release(item.id);
    }
  }

  return { write };
}

export type ComparableMarketWriteQueue = ReturnType<typeof createComparableMarketWriteQueue>;
