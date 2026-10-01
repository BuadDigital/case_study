import { describe, expect, it } from "vitest";
import { createInspectorWorkspaceDraft } from "@platform/app-shared/app-data/inspector-workspace-data";
import { movablesPhotosResetPatch } from "../../../components/field-inspection/inspector-wizard-state";
import { validateInspectorWorkspace } from "../inspector-workspace-validation";

const att = { fileName: "a.jpg", mimeType: "image/jpeg", attachmentId: "11111111-1111-1111-1111-111111111111" };
const slot = { "feature:movables": { none: false, photos: [{ id: 1, approved: true, ...att }] } };

function check(extra: object) {
  const base = createInspectorWorkspaceDraft({ taskId: "t", propertyId: "p", poNumber: "po" });
  return validateInspectorWorkspace(
    {
      ...base,
      ...extra,
      featureValues: { ...base.featureValues, movables: "نعم", movablesDescription: "أثاث" },
    } as never,
    {},
  ).featurePhotos;
}

describe("«يوجد منقولات» photos", () => {
  it("any one photo — new slot or the old single proof — satisfies the gate", () => {
    expect(check({})).toContain("توثيقية");
    expect(check({ definedPhotos: slot })).toBeUndefined();
    expect(check({ featurePhotoAttachments: { movables: att } })).toBeUndefined();
  });

  it("a slot photo that never reached the server does not count", () => {
    const local = { "feature:movables": { none: false, photos: [{ id: 1, approved: true, fileName: "a.jpg", mimeType: "image/jpeg" }] } };
    expect(check({ definedPhotos: local })).toContain("توثيقية");
  });

  it("switching away from «نعم» drops the photos; staying on «نعم» keeps them", () => {
    const draft = { definedPhotos: slot } as never;
    expect(movablesPhotosResetPatch(draft, "movables", "لا").definedPhotos?.["feature:movables"]?.photos).toEqual([]);
    expect(movablesPhotosResetPatch(draft, "movables", "نعم")).toEqual({});
    expect(movablesPhotosResetPatch(draft, "kitchen", "لا")).toEqual({});
  });
});
