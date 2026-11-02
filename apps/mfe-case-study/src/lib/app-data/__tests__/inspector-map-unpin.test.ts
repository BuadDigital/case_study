import { describe, expect, it } from "vitest";
import { draftToPayload, payloadToDraft } from "../inspector-workspace-model";

const submitted = (payload: Record<string, unknown>) =>
  payloadToDraft({
    taskId: "task-1",
    kind: "field-inspection",
    status: "submitted",
    payload: { mapLatitude: "24.451345", mapLongitude: "39.6102", ...payload },
    updatedAtUtc: "",
  });

describe("«تم الوقوف على العقار عن طريق»", () => {
  it("is read back apart from the access contact", () => {
    const draft = submitted({ siteAttendedBy: "سعد المالكي", accessContactName: "ضابط الاتصال" });
    expect(draft.siteAttendedBy).toBe("سعد المالكي");
    expect(draftToPayload(draft).siteAttendedBy).toBe("سعد المالكي");
    expect(draft.accessContactName).toBe("ضابط الاتصال");
  });
});

/** 2026-11-01: «إلغاء التثبيت» on a submitted package came straight back pinned. */
describe("the map pin of a submitted inspection", () => {
  it("stays unpinned once the specialist unpinned it, so the coordinates can be edited", () => {
    expect(submitted({ mapPinned: false }).mapPinned).toBe(false);
  });

  it("keeps a saved pin", () => {
    expect(submitted({ mapPinned: true }).mapPinned).toBe(true);
  });

  it("still counts a package older than the field as pinned by its GPS", () => {
    expect(submitted({}).mapPinned).toBe(true);
  });
});
