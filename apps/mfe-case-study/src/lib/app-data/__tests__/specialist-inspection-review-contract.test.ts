import { describe, expect, it } from "vitest";
import {
  createInspectorWorkspaceDraft,
  preserveInspectorOwnedFeatureValues,
} from "../inspector-workspace-data";
import {
  draftToPayload,
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
});
