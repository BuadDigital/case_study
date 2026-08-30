import { describe, expect, it } from "vitest";
import { cx, thClassName } from "../table-classes";

describe("table cx override", () => {
  it("lets text-center win over default text-start", () => {
    const merged = cx(thClassName, "text-center");
    expect(merged).toContain("text-center");
    expect(merged).not.toMatch(/\btext-start\b/);
  });

  it("keeps unrelated utilities", () => {
    const merged = cx(thClassName, "text-center text-primary");
    expect(merged).toContain("text-center");
    expect(merged).toContain("text-primary");
    expect(merged).toContain("border-gold");
  });
});
