import { describe, expect, it } from "vitest";
import { timelineEventColor } from "../key-envelope-detail-state";

const GREEN = "#2f7a4d";
const RED = "#d9694f";

describe("timelineEventColor", () => {
  it("shows a mismatch in red although the word contains «match»", () => {
    expect(timelineEventColor("keys_mismatch")).toBe(RED);
    expect(timelineEventColor("KeysMismatch")).toBe(RED);
  });

  it("keeps matches and confirmations green", () => {
    expect(timelineEventColor("keys_match")).toBe(GREEN);
    expect(timelineEventColor("receipt_confirmed")).toBe(GREEN);
  });

  it("shows missing and evicted keys in red", () => {
    expect(timelineEventColor("envelope_missing")).toBe(RED);
    expect(timelineEventColor("evicted")).toBe(RED);
  });
});
