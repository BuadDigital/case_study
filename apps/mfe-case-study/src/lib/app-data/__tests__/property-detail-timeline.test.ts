import { describe, expect, it } from "vitest";
import {
  formatTimelineDate,
  mapPropertyTimelineDtos,
} from "../property-detail-timeline";

describe("property detail timeline", () => {
  it("keeps the server order (oldest first) and does not merge rows", () => {
    const events = mapPropertyTimelineDtos([
      { id: "a", at: "2026-09-20", title: "استلام أمر العمل من إنفاذ", tone: "done" },
      { id: "b", at: "2026-09-21T08:00:00.0000000Z", title: "تسجيل تعذر", detail: "أ", tone: "warn" },
      { id: "c", at: "2026-09-22T08:00:00.0000000Z", title: "تسجيل تعذر", detail: "ب", tone: "warn" },
    ]);
    expect(events.map((e) => e.id)).toEqual(["a", "b", "c"]);
    expect(events.filter((e) => e.title === "تسجيل تعذر")).toHaveLength(2);
  });

  it("drops rows without a date and blank details", () => {
    const events = mapPropertyTimelineDtos([
      { id: "a", at: "", title: "بلا تاريخ", tone: "done" },
      { id: "b", at: "2026-09-21", title: "حدث", detail: "  ", tone: "done" },
    ]);
    expect(events).toHaveLength(1);
    expect(events[0]!.detail).toBeUndefined();
  });

  it("shows a date without a time as a date only", () => {
    expect(formatTimelineDate("2026-09-20")).toBe("20/09/2026");
    expect(formatTimelineDate("2026-09-20")).not.toContain(":");
  });
});
