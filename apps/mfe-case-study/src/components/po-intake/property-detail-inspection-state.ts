/**
 * Pure rules behind the inspection-tab parts (`PropertyDetailInspectionParts`):
 * accepted-date formatting, photo-tile flag mapping, calendar-popup placement,
 * and the component-count → documentary-photo rules. No React, no DOM.
 */
import { formatDateAr } from "../../lib/app-data/po-intake-data";
import type { InspectorWorkspacePatch } from "../../lib/app-data/inspector-workspace-model";
import {
  parseInspectorCount,
  type InspectorComponentPhotoAttachments,
  type InspectorComponentPhotoKey,
  type InspectorPhotoAttachment,
} from "../../lib/app-data/inspector-workspace-data";
import { photoLocationFlagLabel } from "@platform/app-shared/media/photo-location";

export function formatAcceptedDate(iso: string): string {
  const day = iso.trim().slice(0, 10);
  return day ? formatDateAr(day) : iso.trim();
}

/* ------------------------------------------------------------------ */
/* Photo tile                                                          */
/* ------------------------------------------------------------------ */

/** Placeholder text on an unfilled tile. */
export function photoTileEmptyLabel(none?: boolean): string {
  return none ? "غير متوفر" : "بانتظار الرفع";
}

/** Badge background for a location flag; `null` when the flag draws no badge. */
export function photoTileFlagTone(locationFlag: string | null | undefined): string | null {
  return locationFlag === "outside_property"
    ? "bg-amber-600"
    : locationFlag === "location_unavailable"
      ? "bg-slate-600"
      : locationFlag === "match"
        ? "bg-emerald-700"
        : null;
}

export type PhotoTileFlagBadge = {
  tone: string;
  /** Tooltip — raw distance, as recorded. */
  title: string;
  /** Visible text — rounded distance. */
  text: string;
};

/** The location badge drawn over a photo tile, or `null` when nothing is shown. */
export function photoTileFlagBadge(
  locationFlag: string | null | undefined,
  distanceM?: number | null,
): PhotoTileFlagBadge | null {
  const tone = photoTileFlagTone(locationFlag);
  const label = photoLocationFlagLabel(locationFlag);
  if (!tone || !label) return null;
  return {
    tone,
    title: distanceM != null ? `${label} · ${distanceM} م` : label,
    text: distanceM != null ? `${label} · ${Math.round(distanceM)}م` : label,
  };
}

/* ------------------------------------------------------------------ */
/* Dual-calendar popup placement                                       */
/* ------------------------------------------------------------------ */

export const CALENDAR_PANEL_WIDTH = 288;
export const CALENDAR_PANEL_EST_HEIGHT = 330;
export const CALENDAR_VIEWPORT_MARGIN = 8;
export const CALENDAR_PANEL_GAP = 4;

export type PanelAnchorRect = { top: number; bottom: number; right: number };
export type ViewportSize = { width: number; height: number };

/**
 * Fixed-position offset for the calendar popup: right-aligned under the
 * trigger, clamped to the viewport, flipped above when it would overflow the
 * bottom and there is room above.
 */
export function dualCalendarPanelPlacement(
  anchor: PanelAnchorRect,
  viewport: ViewportSize,
  panelWidth = CALENDAR_PANEL_WIDTH,
  panelHeight = CALENDAR_PANEL_EST_HEIGHT,
): { top: number; left: number } {
  let left = anchor.right - panelWidth;
  left = Math.max(
    CALENDAR_VIEWPORT_MARGIN,
    Math.min(left, viewport.width - panelWidth - CALENDAR_VIEWPORT_MARGIN),
  );

  let top = anchor.bottom + CALENDAR_PANEL_GAP;
  if (top + panelHeight > viewport.height - CALENDAR_VIEWPORT_MARGIN) {
    const above = anchor.top - panelHeight - CALENDAR_PANEL_GAP;
    if (above >= CALENDAR_VIEWPORT_MARGIN) top = above;
  }

  return { top, left };
}

/* ------------------------------------------------------------------ */
/* Component count with documentary photo (showroom / well)            */
/* ------------------------------------------------------------------ */

export function componentPhotoRef(photoKey: InspectorComponentPhotoKey): string {
  return `component:${photoKey}`;
}

export function componentCountKey(
  photoKey: InspectorComponentPhotoKey,
): "showroomCount" | "wellCount" {
  return photoKey === "showroom" ? "showroomCount" : "wellCount";
}

/** Arabic noun used in «صورة … مرفقة». */
export function componentPhotoNoun(photoKey: InspectorComponentPhotoKey): string {
  return photoKey === "showroom" ? "المعرض" : "البئر";
}

/** A documentary photo is required once the count is above zero. */
export function componentNeedsPhoto(countValue: string): boolean {
  return parseInspectorCount(countValue) > 0;
}

export function componentPhotoAttachmentPatch(
  photoKey: InspectorComponentPhotoKey,
  attachments: InspectorComponentPhotoAttachments,
  attachment: InspectorPhotoAttachment | null,
): InspectorWorkspacePatch {
  return {
    componentPhotoAttachments: { ...attachments, [photoKey]: attachment },
  };
}

/**
 * Patch for a count edit. Dropping the count to zero also detaches the photo
 * (`clearsPhoto` tells the caller to drop the cached data URL as well).
 */
export function componentCountPatch(
  photoKey: InspectorComponentPhotoKey,
  value: string,
  attachments: InspectorComponentPhotoAttachments,
): { patch: InspectorWorkspacePatch; clearsPhoto: boolean } {
  const countKey = componentCountKey(photoKey);
  if (parseInspectorCount(value) === 0) {
    return {
      patch: {
        [countKey]: value,
        ...componentPhotoAttachmentPatch(photoKey, attachments, null),
      },
      clearsPhoto: true,
    };
  }
  return { patch: { [countKey]: value }, clearsPhoto: false };
}
