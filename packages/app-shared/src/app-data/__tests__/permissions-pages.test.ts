import { describe, expect, it } from "vitest";
import {
  pagesFromPermissions,
  roleSeesAllTransactionsPage,
} from "../permissions-pages";

describe("roleSeesAllTransactionsPage", () => {
  it("hides the page from every role, CDO and the case specialist included", () => {
    expect(roleSeesAllTransactionsPage("cdo")).toBe(false);
    expect(roleSeesAllTransactionsPage("case-specialist")).toBe(false);
    expect(roleSeesAllTransactionsPage("section-supervisor")).toBe(false);
    expect(roleSeesAllTransactionsPage("field-inspector")).toBe(false);
  });
});

describe("pagesFromPermissions", () => {
  it("strips all-transactions even when the API grants it", () => {
    for (const prototypeRole of ["cdo", "case-specialist", "section-supervisor"]) {
      const pages = pagesFromPermissions(["po", "all-transactions"], { prototypeRole });
      expect(pages).toContain("po");
      expect(pages).not.toContain("all-transactions");
    }
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
