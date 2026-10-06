import { describe, expect, it } from "vitest";
import {
  createInspectorWorkspaceDraft,
  preserveInspectorOwnedFeatureValues,
} from "../inspector-workspace-data";
import {
  draftToPayload,
  mergeInspectorWorkspacePatch,
  payloadToDraft,
} from "../inspector-workspace-model";

describe("specialist inspection review contract", () => {
  it("keeps inspector-owned assetSubject while other feature corrections apply", () => {
    expect(
      preserveInspectorOwnedFeatureValues(
        { assetSubject: "فيلا", facade: "شمالية", zoneStatus: "غير موقوفة" },
        { assetSubject: "أرض", facade: "جنوبية", zoneStatus: "موقوفة" },
      ),
    ).toEqual({
      assetSubject: "فيلا",
      facade: "جنوبية",
      zoneStatus: "موقوفة",
    });
  });

  it("persists specialist edits to unlocked fields on the same payload", () => {
    const draft = createInspectorWorkspaceDraft({
      taskId: "task-1",
      propertyId: "prop-1",
      poNumber: "PO-1",
    });
    draft.status = "submitted";
    draft.featureValues.assetSubject = "فيلا";
    draft.propertyDescription = "وصف المعاين الأولي";
    draft.inspectionDate = "2026-09-01";
    draft.inspectionTime = "10:15";
    draft.districtProsCons = "حي هادئ";
    draft.assetNotes = "ملاحظة أصل";

    const specialistDraft = {
      ...draft,
      propertyDescription: "الوصف بعد مراجعة الأخصائي",
      inspectionDate: "2026-09-02",
      inspectionTime: "11:30",
      districtProsCons: "حي هادئ مع قرب خدمات",
      assetNotes: "ملاحظة معدّلة",
      featureValues: preserveInspectorOwnedFeatureValues(
        draft.featureValues,
        {
          ...draft.featureValues,
          assetSubject: "أرض",
          facade: "غربية",
        },
      ),
    };

    const payload = draftToPayload(specialistDraft);
    expect(payload.propertyDescription).toBe("الوصف بعد مراجعة الأخصائي");
    expect(payload.inspectionDate).toBe("2026-09-02");
    expect(payload.inspectionTime).toBe("11:30");
    expect(payload.districtProsCons).toBe("حي هادئ مع قرب خدمات");
    expect(payload.assetNotes).toBe("ملاحظة معدّلة");
    expect(
      (payload.featureValues as Record<string, string>).assetSubject,
    ).toBe("فيلا");
    expect((payload.featureValues as Record<string, string>).facade).toBe(
      "غربية",
    );

    const reloaded = payloadToDraft({
      taskId: draft.taskId,
      propertyId: draft.propertyId,
      poNumber: draft.poNumber,
      kind: "field-inspection",
      status: "submitted",
      payload,
      updatedAtUtc: "2026-09-02T11:30:00Z",
    });
    expect(reloaded.propertyDescription).toBe("الوصف بعد مراجعة الأخصائي");
    expect(reloaded.inspectionDate).toBe("2026-09-02");
    expect(reloaded.inspectionTime).toBe("11:30");
    expect(reloaded.featureValues.assetSubject).toBe("فيلا");
  });

  it("persists inspector-entered deed boundary text and length", () => {
    const draft = createInspectorWorkspaceDraft({
      taskId: "task-1",
      propertyId: "prop-1",
      poNumber: "PO-1",
    });
    draft.boundaryMatches.north = {
      ...draft.boundaryMatches.north,
      deedDesc: "شارع عرض 15م",
      deedLength: "25.00",
    };

    const payload = draftToPayload(draft);
    const matches = payload.boundaryMatches as Record<
      string,
      { deedDesc?: string; deedLength?: string }
    >;
    expect(matches.north.deedDesc).toBe("شارع عرض 15م");
    expect(matches.north.deedLength).toBe("25.00");

    const reloaded = payloadToDraft({
      taskId: draft.taskId,
      propertyId: draft.propertyId,
      poNumber: draft.poNumber,
      kind: "field-inspection",
      status: "draft",
      payload,
      updatedAtUtc: "2026-09-20T12:00:00Z",
    });
    expect(reloaded.boundaryMatches.north.deedDesc).toBe("شارع عرض 15م");
    expect(reloaded.boundaryMatches.north.deedLength).toBe("25.00");
  });
});

describe("inspector deed-match verdict payload", () => {
  const dto = (payload: Record<string, unknown>) => ({
    taskId: "task-1",
    propertyId: "prop-1",
    poNumber: "PO-1",
    kind: "field-inspection" as const,
    status: "submitted" as const,
    payload,
    updatedAtUtc: "2026-09-02T11:30:00Z",
  });

  it("round-trips deedMatchesNature and an untouched table stays untouched", () => {
    const draft = createInspectorWorkspaceDraft({ taskId: "task-1", propertyId: "prop-1", poNumber: "PO-1" });
    expect(draft.deedMatchesNature).toBe("");
    expect(draft.boundaryMatches.north.matches).toBeNull();
    const payload = draftToPayload({ ...draft, deedMatchesNature: "no" });
    expect(payload.deedMatchesNature).toBe("no");
    const reloaded = payloadToDraft(dto(payload));
    expect(reloaded.deedMatchesNature).toBe("no");
    expect(reloaded.boundaryMatches.south.matches).toBeNull();
  });

  it("reads a legacy payload's explicit booleans and leaves the verdict empty", () => {
    const reloaded = payloadToDraft(
      dto({
        boundaryMatches: {
          north: { matches: true },
          south: { matches: false, mismatchNote: "فرق" },
        },
      }),
    );
    expect(reloaded.deedMatchesNature).toBe("");
    expect(reloaded.boundaryMatches.north.matches).toBe(true);
    expect(reloaded.boundaryMatches.south.matches).toBe(false);
    expect(reloaded.boundaryMatches.east.matches).toBeNull();
  });

  it("ignores an unknown verdict value", () => {
    expect(payloadToDraft(dto({ deedMatchesNature: "maybe" })).deedMatchesNature).toBe("");
  });

  it("round-trips landHasValuableStructures; missing or unknown reads as not answered", () => {
    const draft = createInspectorWorkspaceDraft({ taskId: "task-1", propertyId: "prop-1", poNumber: "PO-1" });
    expect(draft.landHasValuableStructures).toBe("");
    expect(draftToPayload(draft).landHasValuableStructures).toBe("");
    for (const answer of ["yes", "no"] as const) {
      const payload = draftToPayload({ ...draft, landHasValuableStructures: answer });
      expect(payload.landHasValuableStructures).toBe(answer);
      expect(payloadToDraft(dto(payload)).landHasValuableStructures).toBe(answer);
    }
    expect(payloadToDraft(dto({})).landHasValuableStructures).toBe("");
    expect(payloadToDraft(dto({ landHasValuableStructures: "maybe" })).landHasValuableStructures).toBe("");
  });

  it("merges the land answer like any other patch", () => {
    const draft = createInspectorWorkspaceDraft({ taskId: "task-1", propertyId: "prop-1", poNumber: "PO-1" });
    const merged = mergeInspectorWorkspacePatch(draft, { landHasValuableStructures: "yes" });
    expect(merged.landHasValuableStructures).toBe("yes");
  });
});
