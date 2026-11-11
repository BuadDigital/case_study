import { describe, expect, it } from "vitest";
import { ROLES } from "../constants";
import { canAccessPathname, defaultLandingPage, defaultLandingPath } from "../page-access";
import { filterPagesBySubRoles } from "../case-specialist-sub-roles";
import type { CaseSpecialistSubRole } from "@platform/types";

const specialistPages = (subRoles: CaseSpecialistSubRole[]) =>
  filterPagesBySubRoles("case-specialist", subRoles, ROLES["case-specialist"].pages);

describe("defaultLandingPage", () => {
  it("lands CDO on dashboard", () => {
    expect(defaultLandingPath(ROLES.cdo.pages)).toBe("/dashboard");
  });

  // Omar 2026-11-09: whoever holds «أعمالي» lands on it — the general manager too (was the PO list).
  it("lands the general manager and the section supervisor on «أعمالي»", () => {
    expect(defaultLandingPath(ROLES["general-manager"].pages)).toBe("/my-work");
    expect(defaultLandingPath(ROLES["section-supervisor"].pages)).toBe("/my-work");
  });

  // Omar 2026-11-10: the appraiser enters his transactions from «أعمالي» like the specialists;
  // his full list «تقييم العقار» stays in the menu.
  it("lands appraiser on «أعمالي», keeping property-appraisal in his pages", () => {
    expect(defaultLandingPage(ROLES["real-estate-appraiser"].pages)).toBe("my-work");
    expect(ROLES["real-estate-appraiser"].pages).toContain("property-appraisal");
  });

  it("lands field inspector on active-inspection", () => {
    expect(defaultLandingPage(ROLES["field-inspector"].pages)).toBe(
      "active-inspection",
    );
  });

  it("lands engineering office on active-survey", () => {
    expect(defaultLandingPage(ROLES["engineering-office"].pages)).toBe(
      "active-survey",
    );
  });

  it("keeps government reviewer on operations-tasks", () => {
    expect(defaultLandingPage(ROLES["government-reviewer"].pages)).toBe(
      "operations-tasks",
    );
  });

  it("lands case specialist on «أعمالي»", () => {
    expect(defaultLandingPath(ROLES["case-specialist"].pages)).toBe("/my-work");
  });

  it("lands financial officer on financial", () => {
    expect(defaultLandingPath(ROLES["financial-officer"].pages)).toBe(
      "/financial",
    );
  });

  it("keeps work-queue landings when dashboard is also granted", () => {
    expect(defaultLandingPage(["dashboard", "active-inspection"])).toBe(
      "active-inspection",
    );
    expect(defaultLandingPage(["dashboard", "po", "active-case-study"])).toBe(
      "po",
    );
    expect(defaultLandingPage(["dashboard", "operations-tasks", "keys"])).toBe(
      "operations-tasks",
    );
  });

  it.each<[string, CaseSpecialistSubRole[]]>([
    ["coordination only", ["coordination"]],
    ["study only", ["study"]],
    ["review only", ["review"]],
    ["coordination + review", ["coordination", "review"]],
    ["study + review", ["study", "review"]],
  ])("lands a case specialist with %s on «أعمالي», never the operations hub", (_name, subRoles) => {
    expect(defaultLandingPath(specialistPages(subRoles))).toBe("/my-work");
  });
});

describe("canAccessPathname — case-study workspace", () => {
  it.each<CaseSpecialistSubRole[]>([["coordination"], ["study"], ["review"]])(
    "opens /case-study/{task} for a specialist holding %s",
    (...subRoles) => {
      expect(canAccessPathname("/case-study/t-1", specialistPages(subRoles))).toBe(true);
    },
  );

  it("still refuses it to a role with no case-study queue", () => {
    expect(canAccessPathname("/case-study/t-1", ROLES["government-reviewer"].pages)).toBe(false);
  });
});
