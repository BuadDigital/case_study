import { describe, expect, it } from "vitest";
import type {
  ValuationComparableAdjustmentLineDto,
  ValuationComparableSelectionDto,
} from "@platform/api-client";
import {
  createComparableMarketWriteQueue,
  type MarketWrite,
} from "../comparable-market-write-queue";
import {
  linesWithCellPercent,
  linesWithDescription,
  linesWithRationaleOverride,
} from "../market-commands-state";
import { rationaleMinimumError } from "../rationale-minimum";

type Item = ValuationComparableSelectionDto;
type Put = { ok: true; data: Item } | { ok: false };

const FACTOR_ROWS = [
  { factorKey: "market", labelAr: "السوق" },
  { factorKey: "location", labelAr: "عامل الجذب للموقع" },
  { factorKey: "access", labelAr: "سهولة الوصول" },
];

function line(factorKey: string, percent: number): ValuationComparableAdjustmentLineDto {
  return {
    id: `line-${factorKey}`,
    factorKey,
    labelAr: factorKey,
    percent,
    rationale: "",
    descriptionAr: null,
    isIncluded: true,
    sortOrder: 0,
  };
}

function comparable(id: string): Item {
  return {
    id,
    market: {
      adjustmentLines: FACTOR_ROWS.map((f) => line(f.factorKey, 0)),
      suggestedAreaAdjustmentPct: 0,
      weightIsManual: false,
    },
  } as unknown as Item;
}

/**
 * A server that stores whatever line list each PUT carries and answers with the
 * stored comparable — but only when the test lets the PUT finish (`finishNext`),
 * so a second edit can be made while the first save is still in flight.
 */
function fakeServer(initial: Item[]) {
  const stored = new Map(initial.map((i) => [i.id, i]));
  const waiting: Array<() => void> = [];
  const bodies: MarketWrite[] = [];
  function put(item: Item, write: MarketWrite): Promise<Put> {
    bodies.push(write);
    return new Promise((resolve) => {
      waiting.push(() => {
        const next = {
          ...item,
          market: {
            ...item.market!,
            adjustmentLines: write.lines.map((l, i) => ({
              ...l,
              id: `saved-${l.factorKey}`,
              sortOrder: i,
            })),
          },
        } as Item;
        stored.set(item.id, next);
        resolve({ ok: true, data: next });
      });
    });
  }
  async function finishNext() {
    // Let the queue reach the PUT before releasing it.
    for (let i = 0; i < 5 && waiting.length === 0; i++) await Promise.resolve();
    waiting.shift()?.();
    await new Promise((r) => setTimeout(r, 0));
  }
  return { stored, put, bodies, finishNext };
}

function storedLine(item: Item | undefined, factorKey: string) {
  return item?.market?.adjustmentLines.find((l) => l.factorKey === factorKey);
}

/** The matrix commands as the hook sends them: the item the screen rendered, lines built from the fresh copy. */
function commands(screen: Map<string, Item>, put: (item: Item, w: MarketWrite) => Promise<Put>) {
  const queue = createComparableMarketWriteQueue((id) => screen.get(id));
  const settle = async (r: (Put | null)[]) => r.every((x) => x?.ok);
  return {
    percent: (item: Item, factorKey: string, pct: number) =>
      queue.write({
        items: [item],
        build: (fresh) => ({
          lines: linesWithCellPercent(fresh, factorKey, pct, FACTOR_ROWS),
        }),
        put,
        settle,
      }),
    description: (item: Item, factorKey: string, text: string) =>
      queue.write({
        items: [item],
        build: (fresh) => ({ lines: linesWithDescription(fresh, factorKey, text) }),
        put,
        settle,
      }),
    /** The rationale override: a short text on a non-zero % (read from the fresh copy) is declined. */
    rationale: (item: Item, factorKey: string, text: string) =>
      queue.write({
        items: [item],
        build: (fresh) => {
          const percent = storedLine(fresh, factorKey)?.percent ?? 0;
          if (percent !== 0 && rationaleMinimumError("مبرر التسوية للمقارن", text)) return null;
          return { lines: linesWithRationaleOverride(fresh, factorKey, text, FACTOR_ROWS) };
        },
        put,
        settle,
      }),
  };
}

describe("comparable market write queue", () => {
  it("keeps a cell % when its description is saved before the % save returns", async () => {
    const rendered = comparable("c1");
    const server = fakeServer([rendered]);
    const screen = new Map([["c1", rendered]]);
    const cmd = commands(screen, server.put);

    const pct = cmd.percent(rendered, "location", 5);
    const desc = cmd.description(rendered, "location", "قريب من الطريق");
    await server.finishNext();
    await server.finishNext();
    await Promise.all([pct, desc]);

    const saved = storedLine(server.stored.get("c1"), "location");
    expect(saved?.percent).toBe(5);
    expect(saved?.descriptionAr).toBe("قريب من الطريق");
    expect(server.bodies).toHaveLength(2);
  });

  it("keeps a description when a % is saved right after it", async () => {
    const rendered = comparable("c1");
    const server = fakeServer([rendered]);
    const cmd = commands(new Map([["c1", rendered]]), server.put);

    const desc = cmd.description(rendered, "access", "شارعان");
    const pct = cmd.percent(rendered, "access", -3);
    await server.finishNext();
    await server.finishNext();
    await Promise.all([desc, pct]);

    const saved = storedLine(server.stored.get("c1"), "access");
    expect(saved?.percent).toBe(-3);
    expect(saved?.descriptionAr).toBe("شارعان");
  });

  it("keeps both cells when two factors of one comparable are entered quickly", async () => {
    const rendered = comparable("c1");
    const server = fakeServer([rendered]);
    const cmd = commands(new Map([["c1", rendered]]), server.put);

    const a = cmd.percent(rendered, "location", 5);
    const b = cmd.percent(rendered, "access", 2);
    await server.finishNext();
    await server.finishNext();
    await Promise.all([a, b]);

    expect(storedLine(server.stored.get("c1"), "location")?.percent).toBe(5);
    expect(storedLine(server.stored.get("c1"), "access")?.percent).toBe(2);
  });

  it("builds from the screen again once the screen copy has been refreshed", async () => {
    const rendered = comparable("c1");
    const server = fakeServer([rendered]);
    const screen = new Map([["c1", rendered]]);
    const cmd = commands(screen, server.put);

    const first = cmd.percent(rendered, "location", 5);
    await server.finishNext();
    await first;
    // Another command changed the comparable on the server and the reload rendered it.
    const refreshed = {
      ...server.stored.get("c1")!,
      market: {
        ...server.stored.get("c1")!.market!,
        adjustmentLines: server.stored
          .get("c1")!
          .market!.adjustmentLines.map((l) =>
            l.factorKey === "market" ? { ...l, percent: 7 } : l,
          ),
      },
    } as Item;
    screen.set("c1", refreshed);

    const second = cmd.description(refreshed, "location", "وصف");
    await server.finishNext();
    await second;

    const saved = server.stored.get("c1");
    expect(storedLine(saved, "market")?.percent).toBe(7);
    expect(storedLine(saved, "location")?.percent).toBe(5);
    expect(storedLine(saved, "location")?.descriptionAr).toBe("وصف");
  });

  it("declines a short rationale when the % typed just before is still in flight", async () => {
    const rendered = comparable("c1");
    const server = fakeServer([rendered]);
    const cmd = commands(new Map([["c1", rendered]]), server.put);

    const pct = cmd.percent(rendered, "location", 5);
    const short = cmd.rationale(rendered, "location", "قريب");
    await server.finishNext();
    expect(await pct).toBe(true);
    expect(await short).toBe(false);

    expect(server.bodies).toHaveLength(1);
    expect(storedLine(server.stored.get("c1"), "location")?.percent).toBe(5);
  });

  it("saves a short rationale while the % is still 0", async () => {
    const rendered = comparable("c1");
    const server = fakeServer([rendered]);
    const cmd = commands(new Map([["c1", rendered]]), server.put);

    const saved = cmd.rationale(rendered, "location", "قريب");
    await server.finishNext();
    expect(await saved).toBe(true);
    expect(storedLine(server.stored.get("c1"), "location")?.rationale).toBe("قريب");
  });

  it("does not adopt a failed save as the fresh copy", async () => {
    const rendered = comparable("c1");
    const queue = createComparableMarketWriteQueue(() => rendered);
    const seen: Item[] = [];
    const put = async (item: Item): Promise<Put> => {
      seen.push(item);
      return { ok: false };
    };
    const settle = async () => undefined;
    const build = (fresh: Item) => ({ lines: linesWithDescription(fresh, "location", "x") });
    await queue.write({ items: [rendered], build, put, settle });
    await queue.write({ items: [rendered], build, put, settle });
    expect(seen).toEqual([rendered, rendered]);
  });
});
