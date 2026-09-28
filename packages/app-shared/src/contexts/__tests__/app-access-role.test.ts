import { describe, expect, it } from "vitest";
import { roleFromPermissions } from "../app-access-role";

describe("roleFromPermissions", () => {
  it("maps a known prototype role", () => {
    expect(roleFromPermissions("case-specialist", [])).toBe("case-specialist");
  });

  it("treats CDO identity as cdo even without a prototype", () => {
    expect(roleFromPermissions(null, ["Editor", "CDO"])).toBe("cdo");
  });

  it("does not fall back to general-manager", () => {
    expect(roleFromPermissions(undefined, [])).toBeNull();
    expect(roleFromPermissions("unknown-role", ["Editor"])).toBeNull();
  });
});
