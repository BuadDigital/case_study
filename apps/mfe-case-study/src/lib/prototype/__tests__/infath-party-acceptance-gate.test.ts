import { describe, expect, it } from "vitest";
import { partyPackageFeedsInfath } from "../infath-upload-model";
import {
  inspectorWorkspaceStatusLabel,
  isInspectorWorkspaceAccepted,
} from "../inspector-workspace-data";
import type { PropertyDetailPartySubmission } from "../property-detail-party-submission-types";

function inspectionParty(
  patch: Partial<PropertyDetailPartySubmission> = {},
): PropertyDetailPartySubmission {
  return {
    roleKey: "inspection",
    hasData: true,
    fields: [{ label: "تاريخ المعاينة", value: "2020-07-28" }],
    answers: [],
    remarks: [],
    ...patch,
  };
}

describe("inspection → إنفاذ acceptance gate", () => {
  it("suppresses inspection package until acceptedAtUtc is set", () => {
    expect(partyPackageFeedsInfath(inspectionParty())).toBeNull();
    expect(
      partyPackageFeedsInfath(
        inspectionParty({ acceptedAtUtc: "  " }),
      ),
    ).toBeNull();
  });

  it("feeds إنفاذ only after specialist accept stamp", () => {
    const party = inspectionParty({
      acceptedAtUtc: "2026-08-10T10:00:00.000Z",
      acceptedByName: "أخصائي",
    });
    expect(partyPackageFeedsInfath(party)).toBe(party);
  });

  it("feeds EN / EV / MA packages only after accept stamp", () => {
    const inspection = partyPackageFeedsInfath(
      inspectionParty({ acceptedAtUtc: "2026-08-10T10:00:00.000Z" }),
    );
    const survey = partyPackageFeedsInfath(
      inspectionParty({
        roleKey: "survey",
        acceptedAtUtc: "2026-08-10T10:00:00.000Z",
      }),
    );
    const appraisal = partyPackageFeedsInfath(
      inspectionParty({
        roleKey: "appraisal",
        acceptedAtUtc: undefined,
      }),
    );
    expect(inspection).not.toBeNull();
    expect(survey).not.toBeNull();
    expect(appraisal).toBeNull();
  });

  it("status labels distinguish pending vs accepted submit", () => {
    expect(inspectorWorkspaceStatusLabel("submitted")).toBe(
      "مُرسَل — بانتظار الاعتماد",
    );
    expect(
      inspectorWorkspaceStatusLabel("submitted", { accepted: true }),
    ).toBe("معتمد");
    expect(isInspectorWorkspaceAccepted({ acceptedAtUtc: null })).toBe(false);
    expect(
      isInspectorWorkspaceAccepted({
        acceptedAtUtc: "2026-08-10T10:00:00.000Z",
      }),
    ).toBe(true);
  });
});
