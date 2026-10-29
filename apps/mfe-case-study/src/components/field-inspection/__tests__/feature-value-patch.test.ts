import { describe, expect, it } from "vitest";
import {
  createInspectorWorkspaceDraft,
  visibleInspectorFeatureFields,
} from "../../../lib/app-data/inspector-workspace-data";
import {
  mergeInspectorWorkspacePatch,
  resolveInspectorWorkspacePatch,
} from "../../../lib/app-data/inspector-workspace-model";
import { featureValuePatch } from "../InspectorFeaturesSection";

const fields = visibleInspectorFeatureFields(false);
const field = (key: string) => fields.find((f) => f.key === key)!;

describe("a feature tap is built on the saved draft, not the rendered one", () => {
  it("keeps a value the screen has not re-rendered yet", () => {
    const empty = createInspectorWorkspaceDraft({ taskId: "t", propertyId: "p", poNumber: "PO" });
    // The first tap reached the saved draft…
    const saved = mergeInspectorWorkspacePatch(
      empty,
      resolveInspectorWorkspacePatch(empty, (c) => featureValuePatch(c, field("zoneStatus"), "غير موقوفة")),
    );
    // …the second tap is applied to it, whatever the screen still shows.
    const next = mergeInspectorWorkspacePatch(
      saved,
      resolveInspectorWorkspacePatch(saved, (c) => featureValuePatch(c, field("propertyCondition"), "مستخدم")),
    );

    expect(next.featureValues.zoneStatus).toBe("غير موقوفة");
    expect(next.featureValues.propertyCondition).toBe("مستخدم");
  });
});
