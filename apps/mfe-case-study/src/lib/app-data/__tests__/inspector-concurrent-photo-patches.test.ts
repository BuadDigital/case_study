import { describe, expect, it } from "vitest";
import { createInspectorWorkspaceDraft } from "../inspector-workspace-data";
import { allocateInspectorPhotoId } from "../inspector-photo-id";
import {
  featurePhotoPatch,
  mergeInspectorWorkspacePatch,
  resolveInspectorWorkspacePatch,
  type InspectorWorkspacePatchInput,
} from "../inspector-workspace-model";

const attachment = (id: string) => ({ attachmentId: id, fileName: `${id}.jpg`, mimeType: "image/jpeg" });

function apply(
  draft: ReturnType<typeof createInspectorWorkspaceDraft>,
  input: InspectorWorkspacePatchInput,
) {
  return mergeInspectorWorkspacePatch(draft, resolveInspectorWorkspacePatch(draft, input));
}

describe("two photo uploads that finish close together", () => {
  const base = createInspectorWorkspaceDraft({ taskId: "t-1", propertyId: "p-1", poNumber: "PO-1" });

  it("keeps both when each patch is built from the latest draft", () => {
    // Both uploads started from `base`; each one's patch is applied when ITS upload ends.
    const afterFirst = apply(base, featurePhotoPatch("hasFence", attachment("fence")));
    const afterSecond = apply(afterFirst, featurePhotoPatch("hasTanks", attachment("tanks")));

    expect(Object.keys(afterSecond.featurePhotoAttachments).sort()).toEqual(["hasFence", "hasTanks"]);
  });

  it("is what a patch built from the starting draft got wrong: the second erased the first", () => {
    const stale = { featurePhotoAttachments: { ...base.featurePhotoAttachments, hasTanks: attachment("tanks") } };
    const afterFirst = apply(base, featurePhotoPatch("hasFence", attachment("fence")));
    const afterSecond = mergeInspectorWorkspacePatch(afterFirst, stale);

    expect(afterSecond.featurePhotoAttachments.hasFence).toBeUndefined();
  });

  it("clears one photo without touching the others", () => {
    const withBoth = apply(
      apply(base, featurePhotoPatch("hasFence", attachment("fence"))),
      featurePhotoPatch("hasTanks", attachment("tanks")),
    );
    const cleared = apply(withBoth, featurePhotoPatch("hasFence", null));

    expect(cleared.featurePhotoAttachments.hasFence).toBeNull();
    expect(cleared.featurePhotoAttachments.hasTanks?.attachmentId).toBe("tanks");
  });
});

describe("photo ids handed out while uploads are in flight", () => {
  it("never repeats an id for the same task, even before the photo is saved in the draft", () => {
    const draft = createInspectorWorkspaceDraft({ taskId: "t-ids", propertyId: "p", poNumber: "PO" });
    const first = allocateInspectorPhotoId(draft);
    const second = allocateInspectorPhotoId(draft);
    const third = allocateInspectorPhotoId(draft);

    expect(new Set([first, second, third]).size).toBe(3);
    expect(second).toBeGreaterThan(first);
  });

  it("counts per task", () => {
    const a = allocateInspectorPhotoId(createInspectorWorkspaceDraft({ taskId: "t-a", propertyId: "p", poNumber: "PO" }));
    const b = allocateInspectorPhotoId(createInspectorWorkspaceDraft({ taskId: "t-b", propertyId: "p", poNumber: "PO" }));
    expect(a).toBe(1);
    expect(b).toBe(1);
  });
});
