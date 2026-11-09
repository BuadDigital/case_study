import { describe, expect, it } from "vitest";
import {
  pagesFromPermissions,
  roleSeesAllTransactionsPage,
} from "../permissions-pages";

describe("roleSeesAllTransactionsPage", () => {
  it("shows «المعاملات النشطة» to the case-study staff only (2026-11-05)", () => {
    expect(roleSeesAllTransactionsPage("cdo")).toBe(true);
    expect(roleSeesAllTransactionsPage("general-manager")).toBe(true);
    expect(roleSeesAllTransactionsPage("case-specialist")).toBe(true);
    expect(roleSeesAllTransactionsPage("section-supervisor")).toBe(true);
    expect(roleSeesAllTransactionsPage("field-inspector")).toBe(false);
    expect(roleSeesAllTransactionsPage("real-estate-appraiser")).toBe(false);
  });
});

describe("pagesFromPermissions", () => {
  it("keeps all-transactions for the staff and strips it from party roles", () => {
    for (const prototypeRole of ["cdo", "case-specialist", "section-supervisor"]) {
      expect(pagesFromPermissions(["po", "all-transactions"], { prototypeRole })).toContain("all-transactions");
    }
    const party = pagesFromPermissions(["po", "all-transactions"], { prototypeRole: "field-inspector" });
    expect(party).toContain("po");
    expect(party).not.toContain("all-transactions");
  });

  it("keeps dashboard for every prototype role", () => {
    expect(
      pagesFromPermissions(["dashboard", "po"], {
        prototypeRole: "field-inspector",
      }),
    ).toContain("dashboard");
    expect(
      pagesFromPermissions(["dashboard", "financial"], {
        prototypeRole: "financial-officer",
      }),
    ).toContain("dashboard");
  });
});
