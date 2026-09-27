import { describe, expect, it } from "vitest";
import { safeReturnPath } from "../login-ui";

describe("safeReturnPath", () => {
  it("keeps a same-origin relative path", () => {
    expect(safeReturnPath("/active-primary-data?tab=1")).toBe(
      "/active-primary-data?tab=1",
    );
  });

  it("rejects protocol-relative and backslash hosts", () => {
    expect(safeReturnPath("//evil.example")).toBeNull();
    expect(safeReturnPath("/\\evil.example")).toBeNull();
  });

  it("rejects login and root loops", () => {
    expect(safeReturnPath("/login")).toBeNull();
    expect(safeReturnPath("/")).toBeNull();
  });
});
