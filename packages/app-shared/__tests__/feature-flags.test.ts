import { describe, expect, it } from "vitest";
import { isFeatureEnabled } from "../src/feature-flags";

describe("feature flags", () => {
  it("enables live queue polling by default", () => {
    expect(isFeatureEnabled("liveQueuePolling")).toBe(true);
  });
});
