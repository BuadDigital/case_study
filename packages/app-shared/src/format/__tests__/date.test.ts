import { afterEach, describe, expect, it, vi } from "vitest";
import { localDateIso, todayIso } from "../date";

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
