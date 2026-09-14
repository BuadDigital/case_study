import { describe, expect, it } from "vitest";
import { initialsFromDisplayName } from "../display-name-initials";

describe("initialsFromDisplayName", () => {
  it("uses first and last word", () => {
    expect(initialsFromDisplayName("أحمد سعيد")).toBe("أس");
  });

  it("uses up to two chars for a single word", () => {
    expect(initialsFromDisplayName("أحمد")).toBe("أح");
  });

  it("returns empty for blank input", () => {
    expect(initialsFromDisplayName("")).toBe("");
    expect(initialsFromDisplayName(null)).toBe("");
  });
});
