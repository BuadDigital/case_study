import { describe, expect, it } from "vitest";
import {
  filterPagesBySubRoles,
  holdsSubRole,
  staffAccessOf,
  subRolesFromPermissions,
} from "../case-specialist-sub-roles";

describe("case-specialist sub-roles (ruling 2026-11-02)", () => {
  it("reads the permissions, and an old specialist answer holds all three", () => {
    expect(subRolesFromPermissions("case-specialist", ["review", "Study"])).toEqual([
      "study",
      "review",
    ]);
    expect(subRolesFromPermissions("case-specialist", undefined)).toEqual([
      "coordination",
      "study",
      "review",
    ]);
    expect(subRolesFromPermissions("section-supervisor", ["study"])).toEqual([]);
    expect(subRolesFromPermissions(null, ["study"])).toEqual([]);
  });

  it("only a case specialist holds a sub-role", () => {
    expect(holdsSubRole(staffAccessOf("case-specialist", ["study"]), "study")).toBe(true);
    expect(holdsSubRole(staffAccessOf("case-specialist", ["study"]), "review")).toBe(false);
    expect(holdsSubRole({ role: "cdo", subRoles: ["study"] }, "study")).toBe(false);
  });

  it("keeps only the queue pages of the held sub-roles", () => {
    const pages = ["dashboard", "active-primary-data", "active-case-study", "system-upload", "po"] as const;
    expect(filterPagesBySubRoles("case-specialist", ["study"], pages)).toEqual([
      "dashboard",
      "active-case-study",
      "po",
    ]);
    expect(filterPagesBySubRoles("case-specialist", ["coordination", "review"], pages)).toEqual([
      "dashboard",
      "active-primary-data",
      "system-upload",
      "po",
    ]);
    expect(filterPagesBySubRoles("section-supervisor", [], pages)).toEqual([...pages]);
  });
});
