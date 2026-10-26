import { describe, expect, it } from "vitest";
import type { TransactionTimelineEventDto } from "@platform/api-client";
import { mapTransactionTimelineDtos } from "../property-detail-timeline";

function event(id: string, at: string, propertyId: string, deedLabel: string): TransactionTimelineEventDto {
  return { id, at, title: id, detail: "", tone: "done", propertyId, deedLabel } as TransactionTimelineEventDto;
}

describe("mapTransactionTimelineDtos (deed tags)", () => {
  it("keeps every event on its own deed when an event without a time is dropped", () => {
    // Found 2026-10-26: the tags were paired by index after the timeless event was dropped,
    // so every later event slid onto the previous event's deed.
    const rows = mapTransactionTimelineDtos([
      event("a", "2026-10-20T08:00:00Z", "deed-1", "111"),
      event("no-time", "", "deed-2", "222"),
      event("b", "2026-10-20T09:00:00Z", "deed-3", "333"),
      event("c", "2026-10-20T10:00:00Z", "deed-1", "111"),
    ]);

    expect(rows.map((r) => [r.id, r.propertyId, r.deedLabel])).toEqual([
      ["a", "deed-1", "111"],
      ["b", "deed-3", "333"],
      ["c", "deed-1", "111"],
    ]);
  });

  it("turns blank deed tags into undefined", () => {
    const [row] = mapTransactionTimelineDtos([event("a", "2026-10-20T08:00:00Z", " ", "")]);
    expect(row.propertyId).toBeUndefined();
    expect(row.deedLabel).toBeUndefined();
  });
});
