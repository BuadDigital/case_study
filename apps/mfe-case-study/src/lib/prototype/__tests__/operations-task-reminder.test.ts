import { describe, expect, it } from "vitest";
import { nextReminderTs } from "../operations-task-display";

/** Build a UTC epoch for a Riyadh wall-clock instant (UTC+3, no DST). */
function riyadhUtcMs(
  y: number,
  m: number,
  d: number,
  h: number,
  min = 0,
): number {
  return Date.UTC(y, m - 1, d, h - 3, min, 0, 0);
}

describe("nextReminderTs (Asia/Riyadh parity)", () => {
  it("high priority advances to the next Riyadh work hour", () => {
    // Sunday 2026-07-26 10:20 Riyadh → next hour 11:00 Riyadh
    const now = riyadhUtcMs(2026, 7, 26, 10, 20);
    const next = nextReminderTs("high", now);
    expect(next).toBe(riyadhUtcMs(2026, 7, 26, 11, 0));
  });

  it("medium priority uses noon then end-of-day checkpoints in Riyadh", () => {
    // Sunday 09:00 Riyadh → noon
    expect(nextReminderTs("medium", riyadhUtcMs(2026, 7, 26, 9, 0))).toBe(
      riyadhUtcMs(2026, 7, 26, 12, 0),
    );
    // Sunday 13:00 Riyadh → 17:00
    expect(nextReminderTs("medium", riyadhUtcMs(2026, 7, 26, 13, 0))).toBe(
      riyadhUtcMs(2026, 7, 26, 17, 0),
    );
  });

  it("low priority skips the weekend to next workday noon", () => {
    // Friday 2026-07-24 10:00 Riyadh → Sunday noon
    const now = riyadhUtcMs(2026, 7, 24, 10, 0);
    expect(nextReminderTs("low", now)).toBe(riyadhUtcMs(2026, 7, 26, 12, 0));
  });
});
