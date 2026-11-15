import { describe, expect, it, vi } from "vitest";
import { shareInFlight } from "./in-flight";

// 2026-11-15: two panels asked for the same attachment list within milliseconds.
describe("shareInFlight", () => {
  it("runs one request for concurrent identical reads", async () => {
    let resolve!: (v: number) => void;
    const run = vi.fn(() => new Promise<number>((r) => (resolve = r)));
    const a = shareInFlight("k", run);
    const b = shareInFlight("k", run);
    resolve(7);
    expect(await a).toBe(7);
    expect(await b).toBe(7);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("fetches fresh once the first request settled — nothing is cached", async () => {
    const run = vi.fn(async () => 1);
    await shareInFlight("k2", run);
    await shareInFlight("k2", run);
    expect(run).toHaveBeenCalledTimes(2);
  });
});
