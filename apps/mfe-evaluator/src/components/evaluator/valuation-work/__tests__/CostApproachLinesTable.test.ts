import { describe, expect, it } from "vitest";
import { tableWrapClassName } from "@platform/ui-kit";
import { COST_LINES_TABLE_WRAP_CLASS } from "../CostApproachLinesTable";

describe("cost lines table at 1440px (round 2)", () => {
  it("scrolls inside its card instead of stretching it past the clipped page column", () => {
    // The ui-kit wrapper scrolls horizontally; inline-size containment stops the 1160px table's
    // min-content width from widening the card (and every flex/grid ancestor) beyond the column.
    expect(tableWrapClassName).toContain("overflow-x-auto");
    expect(COST_LINES_TABLE_WRAP_CLASS).toContain("[contain:inline-size]");
  });
});
