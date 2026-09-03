import { describe, expect, it } from "vitest";
import { findPropertyPathByDeed } from "../map-open-property";
import type { PoIntakeRecord } from "../po-intake-data";

describe("findPropertyPathByDeed", () => {
  it("returns the live property path when a deed matches", () => {
    const records = [
      {
        poNumber: "PO-100",
        properties: [
          { id: "prop-1", deedNumber: "310112009914" },
          { id: "prop-2", deedNumber: "999" },
        ],
      },
    ] as PoIntakeRecord[];
    expect(findPropertyPathByDeed(records, "310112009914")).toBe(
      "/po/PO-100/property/prop-1",
    );
  });

  it("returns null when the deed is missing", () => {
    expect(findPropertyPathByDeed([], "310112009914")).toBeNull();
    expect(findPropertyPathByDeed(undefined, "310112009914")).toBeNull();
  });
});
