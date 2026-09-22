import { describe, expect, it } from "vitest";
import {
  approvedInspectorPropertyDescription,
  propertyDescriptionStaffAttribution,
  reportInspectorPropertyDescription,
  isLandInspectionContext,
  preserveInspectorOwnedFeatureValues,
  resolvedInspectorAssetSubject,
  sanitizeInspectorDraftForLand,
  submittedInspectorAssetIsLand,
  type InspectorWorkspaceDraft,
} from "../inspector-workspace-data";

function draft(
  patch: Partial<InspectorWorkspaceDraft> & {
    featureValues?: Record<string, string>;
  },
): InspectorWorkspaceDraft {
  return {
    taskId: "t1",
    propertyId: "p1",
    poNumber: "PO-1",
    vacantLand: false,
    featureValues: {},
    featurePhotoAttachments: {},
    ...patch,
  } as InspectorWorkspaceDraft;
}

describe("isLandInspectionContext", () => {
  it("treats a villa origin as a building even when the PO type is vacant land", () => {
    expect(
      isLandInspectionContext({
        assetSubject: "فيلا",
        propertyType: "ارض",
        classification: "سكني",
      }),
    ).toBe(false);
  });

  it("keeps vacant-land origin and the vacant-land flag as land", () => {
    expect(
      isLandInspectionContext({
        assetSubject: "أرض",
        propertyType: "فيلا",
      }),
    ).toBe(true);
    expect(
      isLandInspectionContext({
        vacantLand: true,
        assetSubject: "فيلا",
      }),
    ).toBe(true);
  });

  it("falls back to the PO type only before the inspector chooses an origin", () => {
    expect(
      isLandInspectionContext({
        assetSubject: "",
        propertyType: "ارض",
      }),
    ).toBe(true);
  });
});

describe("submitted inspector type ownership", () => {
  it("uses the initial type until the inspector submits", () => {
    expect(
      resolvedInspectorAssetSubject({
        status: "draft",
        assetSubject: "أرض",
        initialAssetSubject: "فيلا",
      }),
    ).toBe("فيلا");
    expect(
      resolvedInspectorAssetSubject({
        status: "reopened",
        assetSubject: "أرض",
        initialAssetSubject: "فيلا",
      }),
    ).toBe("فيلا");
  });

  it("uses the inspector type only for a submitted package", () => {
    expect(
      submittedInspectorAssetIsLand({
        status: "submitted",
        assetSubject: "أرض",
        initialAssetSubject: "فيلا",
      }),
    ).toBe(true);
    expect(
      submittedInspectorAssetIsLand({
        status: "draft",
        assetSubject: "أرض",
        initialAssetSubject: "فيلا",
      }),
    ).toBe(false);
  });

  it("preserves assetSubject while applying specialist feature corrections", () => {
    expect(
      preserveInspectorOwnedFeatureValues(
        { assetSubject: "أرض", zoneStatus: "غير موقوفة" },
        { assetSubject: "فيلا", zoneStatus: "موقوفة" },
      ),
    ).toEqual({ assetSubject: "أرض", zoneStatus: "موقوفة" });
  });

  it("exposes property description to appraisers only after specialist accept", () => {
    expect(
      approvedInspectorPropertyDescription({
        propertyDescription: "وصف المعاين",
        acceptedAtUtc: null,
      }),
    ).toBe("");
    expect(
      approvedInspectorPropertyDescription({
        propertyDescription: "وصف المعاين",
        acceptedAtUtc: "  ",
      }),
    ).toBe("");
    expect(
      approvedInspectorPropertyDescription({
        propertyDescription: "  وصف معتمد  ",
        acceptedAtUtc: "2026-09-09T08:00:00.000Z",
      }),
    ).toBe("وصف معتمد");
  });

  it("shows a description the case-study staff wrote or corrected before acceptance, with attribution", () => {
    const specialistEdited = {
      propertyDescription: "فلة سكنية في حي الأندلس",
      acceptedAtUtc: null,
      fieldProvenance: {
        propertyDescription: {
          writtenByName: "أحمد سعيد",
          writtenByRole: "field-inspector",
          editedByName: "أسامة الصالحي",
          editedByRole: "case-specialist",
        },
      },
    };
    expect(approvedInspectorPropertyDescription(specialistEdited)).toBe(
      "فلة سكنية في حي الأندلس",
    );
    expect(propertyDescriptionStaffAttribution(specialistEdited)).toBe(
      "عدّله أسامة الصالحي (أخصائي دراسة الحالة)",
    );
    expect(reportInspectorPropertyDescription(specialistEdited)).toBe(
      "فلة سكنية في حي الأندلس — عدّله أسامة الصالحي (أخصائي دراسة الحالة)",
    );

    const specialistWrote = {
      propertyDescription: "وصف الأخصائي",
      acceptedAtUtc: null,
      fieldProvenance: {
        propertyDescription: { writtenByName: "أسامة الصالحي", writtenByRole: "case-specialist" },
      },
    };
    expect(reportInspectorPropertyDescription(specialistWrote)).toBe(
      "وصف الأخصائي — كتبه أسامة الصالحي (أخصائي دراسة الحالة)",
    );

    const inspectorOnly = {
      propertyDescription: "وصف المعاين",
      acceptedAtUtc: null,
      fieldProvenance: {
        propertyDescription: { writtenByName: "أحمد سعيد", writtenByRole: "field-inspector" },
      },
    };
    expect(approvedInspectorPropertyDescription(inspectorOnly)).toBe("");
    expect(reportInspectorPropertyDescription(inspectorOnly)).toBe("");

    const acceptedInspectorText = { ...inspectorOnly, acceptedAtUtc: "2026-09-09T08:00:00.000Z" };
    expect(reportInspectorPropertyDescription(acceptedInspectorText)).toBe("وصف المعاين");
  });
});

describe("sanitizeInspectorDraftForLand", () => {
  it("does not wipe حالة البناء when the inspector recorded a villa on a land PO", () => {
    const saved = draft({
      featureValues: { assetSubject: "فيلا", buildState: "جيد" },
    });
    expect(
      sanitizeInspectorDraftForLand(saved, {
        propertyType: "ارض",
        classification: "سكني",
      }).featureValues.buildState,
    ).toBe("جيد");
  });
});
