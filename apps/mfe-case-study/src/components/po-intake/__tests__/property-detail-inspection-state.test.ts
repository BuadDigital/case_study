import { describe, expect, it } from "vitest";
import {
  CALENDAR_PANEL_EST_HEIGHT,
  CALENDAR_PANEL_GAP,
  CALENDAR_PANEL_WIDTH,
  CALENDAR_VIEWPORT_MARGIN,
  componentCountKey,
  componentCountPatch,
  componentNeedsPhoto,
  componentPhotoAttachmentPatch,
  componentPhotoNoun,
  componentPhotoRef,
  dualCalendarPanelPlacement,
  formatAcceptedDate,
  photoTileEmptyLabel,
  photoTileFlagBadge,
  photoTileFlagTone,
} from "../property-detail-inspection-state";
import type { InspectorPhotoAttachment } from "../../../lib/app-data/inspector-workspace-data";

describe("formatAcceptedDate", () => {
  it("formats the day part of an ISO stamp", () => {
    expect(formatAcceptedDate("2026-03-05T10:20:00Z")).toBe(
      formatAcceptedDate("2026-03-05"),
    );
    expect(formatAcceptedDate("2026-03-05")).not.toBe("");
  });

  it("returns the trimmed input when there is no day part", () => {
    expect(formatAcceptedDate("   ")).toBe("");
  });
});

describe("photo tile flags", () => {
  it("labels an empty tile by availability", () => {
    expect(photoTileEmptyLabel()).toBe("بانتظار الرفع");
    expect(photoTileEmptyLabel(true)).toBe("غير متوفر");
  });

  it("maps known flags to a tone and hides unknown ones", () => {
    expect(photoTileFlagTone("outside_property")).toBe("bg-amber-600");
    expect(photoTileFlagTone("location_unavailable")).toBe("bg-slate-600");
    expect(photoTileFlagTone("match")).toBe("bg-emerald-700");
    expect(photoTileFlagTone("something_else")).toBeNull();
    expect(photoTileFlagTone(null)).toBeNull();
  });

  it("draws no badge without a tone", () => {
    expect(photoTileFlagBadge(null, 12)).toBeNull();
    expect(photoTileFlagBadge("unknown_flag", 12)).toBeNull();
  });

  it("keeps the raw distance in the tooltip and rounds it in the text", () => {
    const badge = photoTileFlagBadge("match", 12.6);
    expect(badge).not.toBeNull();
    expect(badge!.tone).toBe("bg-emerald-700");
    expect(badge!.title.endsWith(" · 12.6 م")).toBe(true);
    expect(badge!.text.endsWith(" · 13م")).toBe(true);
  });

  it("omits the distance when it is unknown", () => {
    const badge = photoTileFlagBadge("outside_property");
    expect(badge).not.toBeNull();
    expect(badge!.title).toBe(badge!.text);
    expect(badge!.text.includes("·")).toBe(false);
  });
});

describe("dualCalendarPanelPlacement", () => {
  const viewport = { width: 1200, height: 800 };

  it("right-aligns under the trigger by default", () => {
    const anchor = { top: 100, bottom: 130, right: 600 };
    expect(dualCalendarPanelPlacement(anchor, viewport)).toEqual({
      top: 130 + CALENDAR_PANEL_GAP,
      left: 600 - CALENDAR_PANEL_WIDTH,
    });
  });

  it("clamps the left edge to the viewport margin", () => {
    const anchor = { top: 100, bottom: 130, right: 50 };
    expect(dualCalendarPanelPlacement(anchor, viewport).left).toBe(
      CALENDAR_VIEWPORT_MARGIN,
    );
  });

  it("clamps the right edge to the viewport margin", () => {
    const anchor = { top: 100, bottom: 130, right: 5000 };
    expect(dualCalendarPanelPlacement(anchor, viewport).left).toBe(
      viewport.width - CALENDAR_PANEL_WIDTH - CALENDAR_VIEWPORT_MARGIN,
    );
  });

  it("flips above the trigger when the panel would overflow the bottom", () => {
    const anchor = { top: 700, bottom: 730, right: 600 };
    expect(dualCalendarPanelPlacement(anchor, viewport).top).toBe(
      700 - CALENDAR_PANEL_EST_HEIGHT - CALENDAR_PANEL_GAP,
    );
  });

  it("stays below when there is no room above either", () => {
    const small = { width: 400, height: 300 };
    const anchor = { top: 200, bottom: 230, right: 300 };
    expect(dualCalendarPanelPlacement(anchor, small).top).toBe(
      230 + CALENDAR_PANEL_GAP,
    );
  });

  it("honours a measured panel size", () => {
    const anchor = { top: 100, bottom: 130, right: 600 };
    expect(dualCalendarPanelPlacement(anchor, viewport, 100, 50).left).toBe(500);
  });
});

describe("component count with photo", () => {
  const attachment: InspectorPhotoAttachment = {
    fileName: "showroom.jpg",
  } as InspectorPhotoAttachment;
  const attachments = { showroom: attachment, well: null };

  it("derives keys, refs and nouns per component", () => {
    expect(componentPhotoRef("showroom")).toBe("component:showroom");
    expect(componentCountKey("showroom")).toBe("showroomCount");
    expect(componentCountKey("well")).toBe("wellCount");
    expect(componentPhotoNoun("showroom")).toBe("المعرض");
    expect(componentPhotoNoun("well")).toBe("البئر");
  });

  it("requires a photo only for a positive count", () => {
    expect(componentNeedsPhoto("0")).toBe(false);
    expect(componentNeedsPhoto("")).toBe(false);
    expect(componentNeedsPhoto("2")).toBe(true);
  });

  it("replaces one attachment without touching the other", () => {
    const patch = componentPhotoAttachmentPatch("well", attachments, attachment);
    expect(patch.componentPhotoAttachments).toEqual({
      showroom: attachment,
      well: attachment,
    });
    expect(attachments.well).toBeNull();
  });

  it("keeps the photo while the count stays positive", () => {
    expect(componentCountPatch("showroom", "3", attachments)).toEqual({
      patch: { showroomCount: "3" },
      clearsPhoto: false,
    });
  });

  it("detaches the photo when the count drops to zero", () => {
    expect(componentCountPatch("showroom", "0", attachments)).toEqual({
      patch: {
        showroomCount: "0",
        componentPhotoAttachments: { showroom: null, well: null },
      },
      clearsPhoto: true,
    });
  });
});
