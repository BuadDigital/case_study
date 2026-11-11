import { describe, expect, it } from "vitest";
import { defaultLandingPath } from "../../app-data/page-access";
import { roleFromPermissions, rolePagesFromPermissions } from "../app-access-role";

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

describe("rolePagesFromPermissions — the pages the app and the login both go by", () => {
  it("adds the role's baseline to the server's pages, server first", () => {
    const pages = rolePagesFromPermissions({
      prototypeRole: "real-estate-appraiser",
      identityRoles: [],
      pages: ["po", "property-appraisal"],
    });
    expect(pages.slice(0, 2)).toEqual(["po", "property-appraisal"]);
    expect(pages).toContain("my-work");
  });

  // 2026-11-11: a server older than the app's role list sent the appraiser to «تقييم العقار».
  it("lands the appraiser on «أعمالي» even when the server has not granted the page yet", () => {
    expect(
      defaultLandingPath(
        rolePagesFromPermissions({
          prototypeRole: "real-estate-appraiser",
          identityRoles: [],
          pages: ["po", "property-map", "favorites", "operations-tasks", "property-appraisal"],
        }),
      ),
    ).toBe("/my-work");
  });

  it("trims a case specialist's baseline to the sub-roles he holds", () => {
    const pages = rolePagesFromPermissions({
      prototypeRole: "case-specialist",
      identityRoles: [],
      subRoles: ["study"],
      pages: ["my-work", "active-case-study"],
    });
    expect(pages).toContain("active-case-study");
    expect(pages).not.toContain("active-distribution");
    expect(pages).not.toContain("system-upload");
  });

  it("keeps «المعاملات النشطة» away from a party role and gives no page to an unknown role", () => {
    expect(
      rolePagesFromPermissions({ prototypeRole: "field-inspector", identityRoles: [], pages: ["all-transactions", "po"] }),
    ).not.toContain("all-transactions");
    expect(rolePagesFromPermissions({ prototypeRole: "nobody", identityRoles: [], pages: ["po"] })).toEqual([]);
    expect(rolePagesFromPermissions(undefined)).toEqual([]);
  });

  it("falls back to the baseline alone when the server sent no page", () => {
    expect(rolePagesFromPermissions({ prototypeRole: "real-estate-appraiser", identityRoles: [], pages: [] })[0]).toBe(
      "my-work",
    );
  });
});
