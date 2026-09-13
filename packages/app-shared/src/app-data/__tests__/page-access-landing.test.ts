import { describe, expect, it } from "vitest";
import { ROLES } from "../constants";
import { defaultLandingPage, defaultLandingPath } from "../page-access";

describe("defaultLandingPage", () => {
  it("lands CDO on dashboard", () => {
    expect(defaultLandingPath(ROLES.cdo.pages)).toBe("/dashboard");
  });

  it("lands valuation director on PO", () => {
    expect(defaultLandingPath(ROLES["general-manager"].pages)).toBe("/po");
  });

  it("lands appraiser on property-appraisal", () => {
    expect(defaultLandingPage(ROLES["real-estate-appraiser"].pages)).toBe(
      "property-appraisal",
    );
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

  it("lands case specialist on first nav page (PO)", () => {
    expect(defaultLandingPath(ROLES["case-specialist"].pages)).toBe("/po");
  });

  it("lands financial officer on financial", () => {
    expect(defaultLandingPath(ROLES["financial-officer"].pages)).toBe(
      "/financial",
    );
  });
});
