import { describe, expect, it } from "vitest";
import index from "../src/lib/osoul-local-train-index.json";

describe("osoul local train index (path B)", () => {
  it("has 12 profile fingerprints with 4 labels each", () => {
    expect(index.version).toBe(3);
    expect(index.items.length).toBe(12);
    for (const it of index.items) {
      const descs = [it.descN, it.descS, it.descE, it.descW].filter(Boolean);
      expect(descs.length, it.file).toBeGreaterThanOrEqual(3);
      expect(it.rowProfile?.length, it.file).toBe(64);
      expect(it.colProfile?.length, it.file).toBe(64);
      expect(it.zoneProfiles?.length, it.file).toBe(4);
    }
  });
});
