import { describe, expect, it } from "vitest";
import { buildPropertyDetailTabActivity } from "../property-detail-tab-activity";
import { propertyTabHasNewDot } from "../property-detail-local-ui";
import type { PropertyDetailPartySubmissionsMap } from "../property-detail-party-submissions";
import type { PropertyDetailPartySubmission } from "../property-detail-party-submission-types";

function emptySub(
  roleKey: PropertyDetailPartySubmission["roleKey"],
): PropertyDetailPartySubmission {
  return {
    roleKey,
    hasData: false,
    fields: [],
    answers: [],
    remarks: [],
  };
}

function partyMap(
  overrides: Partial<PropertyDetailPartySubmissionsMap>,
): PropertyDetailPartySubmissionsMap {
  return {
    specialist: emptySub("specialist"),
    inspection: emptySub("inspection"),
    survey: emptySub("survey"),
    appraisal: emptySub("appraisal"),
    ...overrides,
  };
}

describe("buildPropertyDetailTabActivity", () => {
  it("flags survey/inspection/appraisal when package is submitted and not accepted", () => {
    const activity = buildPropertyDetailTabActivity({
      parties: partyMap({
        survey: {
          ...emptySub("survey"),
          hasData: true,
          packageStatus: "submitted",
          submittedAtUtc: "2026-08-01T10:00:00Z",
        },
        inspection: {
          ...emptySub("inspection"),
          hasData: true,
          packageStatus: "submitted",
          submittedAtUtc: "2026-08-01T11:00:00Z",
        },
      }),
    });
    expect(activity.survey).toContain("submitted");
    expect(activity.inspection).toContain("submitted");
    expect(activity.photos).toBe(activity.inspection);
    expect(activity.documents).toBeTruthy();
    expect(activity.appraisal).toBeNull();
  });

  it("clears package attention once accepted", () => {
    const activity = buildPropertyDetailTabActivity({
      parties: partyMap({
        survey: {
          ...emptySub("survey"),
          hasData: true,
          packageStatus: "submitted",
          submittedAtUtc: "2026-08-01T10:00:00Z",
          acceptedAtUtc: "2026-08-02T10:00:00Z",
        },
      }),
    });
    expect(activity.survey).toBeNull();
    expect(activity["enfath-upload"]).toContain("accepted");
  });

  it("flags open failures and fee attention statuses", () => {
    const activity = buildPropertyDetailTabActivity({
      failures: [
        { id: "f1", status: "pending", updatedAt: "2026-08-01" },
        { id: "f2", status: "approved", updatedAt: "2026-08-01" },
      ],
      feeRows: [
        {
          workflowTaskId: "t1",
          billingStatus: "at-finance",
          updatedAtUtc: "2026-08-03",
        },
      ],
    });
    expect(activity.failures).toContain("f1");
    expect(activity.failures).not.toContain("f2");
    expect(activity.finance).toContain("at-finance");
  });
});

describe("propertyTabHasNewDot", () => {
  it("shows only when fingerprint is new for that tab", () => {
    expect(propertyTabHasNewDot("survey", "pkg:submitted:a", {})).toBe(true);
    expect(
      propertyTabHasNewDot("survey", "pkg:submitted:a", {
        survey: "pkg:submitted:a",
      }),
    ).toBe(false);
    expect(
      propertyTabHasNewDot("survey", "pkg:submitted:b", {
        survey: "pkg:submitted:a",
      }),
    ).toBe(true);
    expect(propertyTabHasNewDot("survey", null, {})).toBe(false);
  });
});
