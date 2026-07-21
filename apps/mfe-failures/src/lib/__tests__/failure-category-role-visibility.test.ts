import { describe, expect, it } from "vitest";
import type { RoleId } from "@platform/types";
import {
  canRoleSeeFailureCategory,
  filterFailureCategoriesForRole,
} from "../failure-category-role-visibility";
import { FAILURE_TYPE_CATEGORIES } from "../failure-types-data";

const ALL_CATEGORY_IDS = FAILURE_TYPE_CATEGORIES.map((c) => c.id);

/** Roles that only see universal categories (deed + ownership). */
const DEED_OWNERSHIP_ONLY: RoleId[] = [
  "government-reviewer",
  "real-estate-appraiser",
  "valuation-coordinator",
  "general-manager",
  "financial-officer",
];

describe("failure category role visibility — full matrix", () => {
  it("shows all categories to section supervisor and CDO", () => {
    for (const role of ["section-supervisor", "cdo"] as RoleId[]) {
      const visible = filterFailureCategoriesForRole(
        role,
        FAILURE_TYPE_CATEGORIES,
      );
      expect(visible.map((c) => c.id)).toEqual(ALL_CATEGORY_IDS);
    }
  });

  it("field inspector sees every category", () => {
    for (const id of ALL_CATEGORY_IDS) {
      expect(canRoleSeeFailureCategory("field-inspector", id)).toBe(true);
    }
  });

  it("case specialist: deed, ownership, contents — not location/access/parties", () => {
    expect(canRoleSeeFailureCategory("case-specialist", "deed-documents")).toBe(
      true,
    );
    expect(canRoleSeeFailureCategory("case-specialist", "ownership")).toBe(
      true,
    );
    expect(canRoleSeeFailureCategory("case-specialist", "contents")).toBe(true);
    expect(canRoleSeeFailureCategory("case-specialist", "location")).toBe(
      false,
    );
    expect(canRoleSeeFailureCategory("case-specialist", "access")).toBe(false);
    expect(canRoleSeeFailureCategory("case-specialist", "parties")).toBe(false);
  });

  it("engineering office: location + parties among restricted; not access/contents", () => {
    expect(canRoleSeeFailureCategory("engineering-office", "deed-documents")).toBe(
      true,
    );
    expect(canRoleSeeFailureCategory("engineering-office", "ownership")).toBe(
      true,
    );
    expect(canRoleSeeFailureCategory("engineering-office", "location")).toBe(
      true,
    );
    expect(canRoleSeeFailureCategory("engineering-office", "parties")).toBe(
      true,
    );
    expect(canRoleSeeFailureCategory("engineering-office", "access")).toBe(
      false,
    );
    expect(canRoleSeeFailureCategory("engineering-office", "contents")).toBe(
      false,
    );
  });

  it.each(DEED_OWNERSHIP_ONLY)(
    "%s only sees deed-documents and ownership among known categories",
    (role) => {
      expect(canRoleSeeFailureCategory(role, "deed-documents")).toBe(true);
      expect(canRoleSeeFailureCategory(role, "ownership")).toBe(true);
      expect(canRoleSeeFailureCategory(role, "location")).toBe(false);
      expect(canRoleSeeFailureCategory(role, "access")).toBe(false);
      expect(canRoleSeeFailureCategory(role, "contents")).toBe(false);
      expect(canRoleSeeFailureCategory(role, "parties")).toBe(false);
    },
  );
});
