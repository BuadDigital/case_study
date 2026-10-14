import { describe, expect, it } from "vitest";
import { createReloadSequence } from "../reload-sequence";

describe("createReloadSequence", () => {
  it("numbers reloads monotonically and only the latest may apply", () => {
    const seq = createReloadSequence();
    const a = seq.begin("p1", { silent: true, scope: "derived" });
    const b = seq.begin("p1", { silent: true, scope: "derived" });
    expect(b.seq).toBeGreaterThan(a.seq);
    // Two quick saves: the older reload's responses are dropped even if they land last.
    expect(seq.isLatest(a, "p1")).toBe(false);
    expect(seq.isLatest(b, "p1")).toBe(true);
  });

  it("drops results once the property changed under the reload", () => {
    const seq = createReloadSequence();
    const a = seq.begin("p1");
    expect(seq.isLatest(a, "p2")).toBe(false);
    const b = seq.begin("p2");
    expect(seq.isLatest(a, "p1")).toBe(false);
    expect(seq.isLatest(b, "p2")).toBe(true);
  });

  it("a finished reload stays latest until the next one begins", () => {
    const seq = createReloadSequence();
    const a = seq.begin("p1");
    seq.finish(a);
    expect(seq.isLatest(a, "p1")).toBe(true);
  });

  it("hands what a superseded in-flight reload owed to its replacement", () => {
    const seq = createReloadSequence();
    seq.begin("p1"); // full, not silent — still in flight
    const b = seq.begin("p1", { silent: true, scope: "derived" });
    expect(b.opts).toEqual({ silent: false, scope: "full" });

    const c = seq.begin("p1", { silent: true, scope: "derived" });
    expect(c.opts).toEqual({ silent: false, scope: "full" });
  });

  it("does not merge after the previous reload finished, or across properties", () => {
    const seq = createReloadSequence();
    seq.finish(seq.begin("p1"));
    expect(seq.begin("p1", { silent: true, scope: "derived" }).opts).toEqual({
      silent: true,
      scope: "derived",
    });

    seq.begin("p1"); // in flight
    expect(seq.begin("p2", { silent: true }).opts).toEqual({ silent: true });
  });

  it("two silent derived reloads stay silent and derived", () => {
    const seq = createReloadSequence();
    seq.begin("p1", { silent: true, scope: "derived" });
    expect(seq.begin("p1", { silent: true, scope: "derived" }).opts).toEqual({
      silent: true,
      scope: "derived",
    });
  });
});
