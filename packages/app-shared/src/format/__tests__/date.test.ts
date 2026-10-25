import { afterEach, describe, expect, it, vi } from "vitest";
import { formatArDateTime, localDateIso, todayIso } from "../date";

// Dates are built with the local-time constructor, so these hold in any machine TZ.
describe("localDateIso", () => {
  it("returns the local calendar date just after midnight", () => {
    expect(localDateIso(new Date(2026, 0, 1, 1, 30))).toBe("2026-01-01");
  });

  it("returns the local calendar date just before midnight", () => {
    expect(localDateIso(new Date(2026, 11, 31, 23, 59))).toBe("2026-12-31");
  });

  it("pads month and day", () => {
    expect(localDateIso(new Date(2026, 2, 5, 12, 0))).toBe("2026-03-05");
  });
});

describe("todayIso", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("is the local calendar date of now", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2027, 0, 1, 0, 15));
    expect(todayIso()).toBe("2027-01-01");
  });
});

describe("formatArDateTime", () => {
  it("keeps the date in one piece — Latin digits and no bidi marks between its parts", () => {
    const text = formatArDateTime(new Date(2026, 9, 25, 10, 31), {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      calendar: "gregory",
    });
    expect(text).not.toMatch(/[‎‏؜]/);
    expect(text).not.toMatch(/[٠-٩]/);
    expect(text).toContain("25/10/2026");
  });

  it("returns «—» for a value that is not a date", () => {
    expect(formatArDateTime("not a date")).toBe("—");
  });
});
