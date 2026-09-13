import type { PoPropertyIntake } from "./po-intake-data";
import type { InspectorWorkspaceDraft } from "@platform/app-shared/app-data/inspector-workspace-data";

/** Fields for the contact-officer site-accuracy acknowledgment letter. */
export type SiteLocationAckLetter = {
  deedNumber: string;
  dateHijri: string;
  dateGreg: string;
  contactName: string;
  /** National / civil ID — optional; blank when not collected. */
  civilId: string;
  contactPhone: string;
  capacity: string;
  requestNumber: string;
  city: string;
  district: string;
  planNumber: string;
  plotNumber: string;
  /** Latitude (شماليات). */
  north: string;
  /** Longitude (شرقيات). */
  east: string;
  /** Combined display / map label. */
  coords: string;
};

export const SITE_LOCATION_ACK_REQUIRES_PIN_MESSAGE =
  "ثبّت الموقع أولاً عبر «تثبيت الموقع» قبل طباعة إقرار صحة الموقع.";

export const SITE_LOCATION_ACK_POPUP_BLOCKED_MESSAGE =
  "تعذّر فتح خطاب الإقرار — اسمح بالنوافذ المنبثقة ثم أعد المحاولة.";

/** Print is allowed only after the inspector pins the map location. */
export function canPrintSiteLocationAck(mapPinned: boolean): boolean {
  return mapPinned;
}

function dash(value: string | null | undefined): string {
  const v = value?.trim() ?? "";
  return v || "—";
}

function formatGregAr(d: Date): string {
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} م`;
}

function formatHijriAr(d: Date): string {
  if (Number.isNaN(d.getTime())) return "—";
  try {
    const parts = new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
    }).formatToParts(d);
    const y = parts.find((p) => p.type === "year")?.value;
    const m = parts.find((p) => p.type === "month")?.value;
    const day = parts.find((p) => p.type === "day")?.value;
    if (y && m && day) return `${y}/${m}/${day} هـ`;
  } catch {
    /* fall through */
  }
  return "—";
}

function letterDate(draft: InspectorWorkspaceDraft): Date {
  const raw = draft.inspectionDate.trim();
  if (raw) {
    const parsed = new Date(`${raw}T12:00:00`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

/** Build the letter model from the inspection draft + property intake. */
export function buildSiteLocationAckLetter(
  draft: InspectorWorkspaceDraft,
  property: PoPropertyIntake | null | undefined,
): SiteLocationAckLetter {
  const lat = draft.mapLatitude.trim();
  const lng = draft.mapLongitude.trim();
  const when = letterDate(draft);
  return {
    deedNumber: dash(property?.deedNumber),
    dateHijri: formatHijriAr(when),
    dateGreg: formatGregAr(when),
    contactName: dash(draft.accessContactName),
    civilId: "—",
    contactPhone: dash(draft.accessContactPhone),
    capacity: dash(draft.accessContactRole),
    requestNumber: dash(property?.requestNumber),
    city: dash(property?.city),
    district: dash(property?.district),
    planNumber: dash(property?.planNumber),
    plotNumber: dash(property?.plotNumber),
    north: dash(lat),
    east: dash(lng),
    coords: lat && lng ? `${lat}, ${lng}` : "—",
  };
}
