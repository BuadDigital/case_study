import { describe, expect, it } from "vitest";
import {
  MY_WORK_PIN_LIMIT,
  pinnedFirst,
  prunePins,
  togglePin,
  unpinProperty,
  type MyWorkPin,
} from "../my-work-pins";

const NOW = "2026-11-12T09:00:00.000Z";
const row = (key: string, stage: MyWorkPin["stage"] = "study") => ({ key, stage });
const pinsOf = (...rows: { key: string; stage: MyWorkPin["stage"] }[]) =>
  rows.reduce<readonly MyWorkPin[]>((pins, r) => togglePin(pins, r, NOW).pins, []);

describe("togglePin — pin and unpin a row of «أعمالي» (Omar 2026-11-12)", () => {
  it("pins an unpinned row and unpins a pinned one", () => {
    const pinned = togglePin([], row("study:t1"), NOW);
    expect(pinned.result).toBe("pinned");
    expect(pinned.pins).toEqual([{ key: "study:t1", stage: "study", pinnedAtUtc: NOW }]);
    const unpinned = togglePin(pinned.pins, row("study:t1"), NOW);
    expect(unpinned).toEqual({ pins: [], result: "unpinned" });
  });

  it("holds five pins in a stage and refuses the sixth, leaving the pins as they were", () => {
    expect(MY_WORK_PIN_LIMIT).toBe(5);
    const five = pinsOf(...[1, 2, 3, 4, 5].map((n) => row(`study:t${n}`)));
    const sixth = togglePin(five, row("study:t6"), NOW);
    expect(sixth.result).toBe("full");
    expect(sixth.pins).toBe(five);
  });

  it("counts each stage on its own", () => {
    const five = pinsOf(...[1, 2, 3, 4, 5].map((n) => row(`study:t${n}`)));
    expect(togglePin(five, row("review:t9", "review"), NOW).result).toBe("pinned");
  });

  it("still unpins in a full stage", () => {
    const five = pinsOf(...[1, 2, 3, 4, 5].map((n) => row(`study:t${n}`)));
    expect(togglePin(five, row("study:t3"), NOW).result).toBe("unpinned");
  });
});

describe("prunePins — a pin ends once its transaction is sent on", () => {
  it("drops the pin whose row left the stage and keeps the rest", () => {
    const pins = pinsOf(row("study:t1"), row("study:t2"));
    // t1 was sent to review: its study row is gone, a review row took its place.
    const kept = prunePins(pins, [{ key: "study:t2" }, { key: "review:t1" }]);
    expect(kept.map((pin) => pin.key)).toEqual(["study:t2"]);
  });

  it("returns the same list when every pin still has its row", () => {
    const pins = pinsOf(row("study:t1"));
    expect(prunePins(pins, [{ key: "study:t1" }, { key: "study:t2" }])).toBe(pins);
  });

  it("frees a place in the stage for a new pin", () => {
    const five = pinsOf(...[1, 2, 3, 4, 5].map((n) => row(`study:t${n}`)));
    const afterSend = prunePins(five, [2, 3, 4, 5, 6].map((n) => ({ key: `study:t${n}` })));
    expect(togglePin(afterSend, row("study:t6"), NOW).result).toBe("pinned");
  });
});

describe("pinnedFirst — the pinned rows rise to the top", () => {
  const rows = ["a", "b", "c", "d"].map((key) => ({ key }));

  it("puts the pinned rows first, each group in the order the list gave it", () => {
    expect(pinnedFirst(rows, new Set(["c", "a"])).map((r) => r.key)).toEqual(["a", "c", "b", "d"]);
  });

  it("leaves the list as it is when nothing is pinned, and ignores a pin with no row", () => {
    expect(pinnedFirst(rows, new Set()).map((r) => r.key)).toEqual(["a", "b", "c", "d"]);
    expect(pinnedFirst(rows, new Set(["gone"])).map((r) => r.key)).toEqual(["a", "b", "c", "d"]);
  });
});

describe("a pinned transaction is listed in «المفضلة» (Omar 2026-11-12)", () => {
  const pinned = togglePin([], { key: "study:t1", stage: "study", poNumber: " PO-1 ", propertyId: "p1" }, NOW).pins;

  it("keeps the transaction on the pin, so the favourites page can list it", () => {
    expect(pinned[0]).toMatchObject({ key: "study:t1", poNumber: "PO-1", propertyId: "p1" });
  });

  it("pins a row with no deed yet without a transaction", () => {
    const [pin] = togglePin([], { key: "intake:t9", stage: "intake", poNumber: "PO-1" }, NOW).pins;
    expect(pin).toEqual({ key: "intake:t9", stage: "intake", pinnedAtUtc: NOW });
  });

  it("removes a transaction's pins from the favourites page, and only its own", () => {
    const two = togglePin(pinned, { key: "study:t2", stage: "study", poNumber: "PO-1", propertyId: "p2" }, NOW).pins;
    expect(unpinProperty(two, "PO-1", "p1").map((pin) => pin.key)).toEqual(["study:t2"]);
    expect(unpinProperty(two, "PO-9", "p1")).toBe(two);
  });
});
