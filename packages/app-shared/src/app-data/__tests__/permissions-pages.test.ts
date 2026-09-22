import { describe, expect, it } from "vitest";
import {
  pagesFromPermissions,
  roleSeesAllTransactionsPage,
} from "../permissions-pages";

describe("roleSeesAllTransactionsPage", () => {
  it("allows CDO and the case specialist", () => {
    expect(roleSeesAllTransactionsPage("cdo")).toBe(true);
    expect(roleSeesAllTransactionsPage("case-specialist")).toBe(true);
    expect(roleSeesAllTransactionsPage("section-supervisor")).toBe(false);
    expect(roleSeesAllTransactionsPage("field-inspector")).toBe(false);
  });
});

describe("pagesFromPermissions", () => {
  it("keeps all-transactions for the case specialist", () => {
    expect(
      pagesFromPermissions(["po", "all-transactions"], {
        prototypeRole: "case-specialist",
      }),
    ).toEqual(expect.arrayContaining(["po", "all-transactions"]));
  });

  it("strips all-transactions for other non-CDO roles", () => {
    expect(
      pagesFromPermissions(["po", "all-transactions"], {
        prototypeRole: "section-supervisor",
      }),
    ).not.toContain("all-transactions");
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
