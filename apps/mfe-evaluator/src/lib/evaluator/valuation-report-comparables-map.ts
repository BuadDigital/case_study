/** Client-side map for §18 — subject + adopted comparables (Google Maps or SVG fallback). */

import { escHtml } from "./html-escape";

export type ComparablesMapPin = {
  lat: number;
  lng: number;
  label: string;
  kind: "subject" | "comp";
};

export const COMPARABLES_MAP_HOST_ID = "ejada-comps-map-host";
export const SATELLITE_MAP_HOST_ID = "ejada-satellite-map-host";
export const CLOSEUP_MAP_HOST_ID = "ejada-closeup-map-host";

function parseCoord(value: string | number | null | undefined): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  const t = (value ?? "").trim().replace(",", ".");
  if (!t) return null;
  const n = Number.parseFloat(t);
  return Number.isFinite(n) ? n : null;
}

/** Subject property pin: inspector coords first, then optional city fallback. */
export function resolveSubjectMapCoords(input: {
  subjectLat?: string | number | null;
  subjectLng?: string | number | null;
  city?: string | null;
  fallbackLat?: number | null;
  fallbackLng?: number | null;
}): { lat: number; lng: number } | null {
  const lat = parseCoord(input.subjectLat);
  const lng = parseCoord(input.subjectLng);

  if (lat != null && lng != null && !(lat === 0 && lng === 0)) {
    return { lat, lng };
  }

  const fbLat = input.fallbackLat;
  const fbLng = input.fallbackLng;
  if (
    fbLat != null &&
    fbLng != null &&
    Number.isFinite(fbLat) &&
    Number.isFinite(fbLng) &&
    !(fbLat === 0 && fbLng === 0)
  ) {
    return { lat: fbLat, lng: fbLng };
  }
  return null;
}

export function formatSubjectCoordsLabel(lat: number, lng: number): string {
  return `${lat.toFixed(6)} ، ${lng.toFixed(6)}`;
}

export function collectComparablesMapPins(input: {
  subjectLat?: string | number | null;
  subjectLng?: string | number | null;
  city?: string | null;
  fallbackLat?: number | null;
  fallbackLng?: number | null;
  comps?: Array<{
    latitude?: number | null;
    longitude?: number | null;
    label?: string | null;
  }> | null;
}): ComparablesMapPin[] {
  const pins: ComparablesMapPin[] = [];
  const subject = resolveSubjectMapCoords(input);
  if (subject) {
    pins.push({
      lat: subject.lat,
      lng: subject.lng,
      label: "العقار",
      kind: "subject",
    });
  }
  (input.comps ?? []).forEach((c, i) => {
    const lat = parseCoord(c.latitude);
    const lng = parseCoord(c.longitude);
    if (lat == null || lng == null || (lat === 0 && lng === 0)) return;
    pins.push({
      lat,
      lng,
      label: (c.label ?? "").trim() || String(i + 1),
      kind: "comp",
    });
  });
  return pins;
}

/** Subject-only pin list for §33 location maps (both slots share this). */
export function subjectOnlyMapPins(
  pins: ComparablesMapPin[],
): ComparablesMapPin[] {
  const subject = pins.find((p) => p.kind === "subject");
  if (subject) return [{ ...subject, label: "العقار" }];
  const first = pins[0];
  return first
    ? [{ lat: first.lat, lng: first.lng, label: "العقار", kind: "subject" }]
    : [];
}

export type StaticMapType = "hybrid" | "satellite" | "roadmap" | "terrain";

/** Fixed view for single-subject maps (§33). Omit to let Static Maps fit all markers (§18). */
export type StaticMapView = {
  zoom?: number;
  centerLat?: number;
  centerLng?: number;
};

/**
 * Static Maps request sizes matched to the print slot aspect ratios
 * (A4 content width 178mm ≈ 673px; §18 slot 200px tall, §33 slots 300px).
 * The print `<img>` uses object-fit:cover, so a matched ratio means no cropping.
 * Static Maps caps free-form size at 640px per side; scale=2 doubles the pixels.
 */
export const PRINT_MAP_SIZES = {
  comps: { w: 640, h: 190 },
  satellite: { w: 640, h: 285 },
  closeup: { w: 640, h: 285 },
} as const;

/** §33 views mirror the on-screen Google map (ComparablesGoogleMap / fillLocationMapsSlots). */
export const PRINT_MAP_VIEWS = {
  satellite: { zoom: 15, maptype: "hybrid" as StaticMapType },
  closeup: { zoom: 18, maptype: "satellite" as StaticMapType },
} as const;

/** Google Static Maps — only when Maps Static API is enabled on the key. */
export function buildComparablesGoogleStaticMapUrl(
  pins: ComparablesMapPin[],
  apiKey: string,
  size: { w: number; h: number } = { w: 900, h: 420 },
  maptype: StaticMapType = "hybrid",
  view?: StaticMapView,
): string | null {
  if (pins.length < 1 || !apiKey) return null;
  const params = new URLSearchParams({
    size: `${Math.min(size.w, 640)}x${Math.min(size.h, 640)}`,
    scale: "2",
    maptype,
    language: "ar",
    key: apiKey,
  });
  if (view?.zoom != null && Number.isFinite(view.zoom)) {
    const subject = pins.find((p) => p.kind === "subject") ?? pins[0]!;
    const lat =
      view.centerLat != null && Number.isFinite(view.centerLat)
        ? view.centerLat
        : subject.lat;
    const lng =
      view.centerLng != null && Number.isFinite(view.centerLng)
        ? view.centerLng
        : subject.lng;
    params.set("center", `${lat},${lng}`);
    params.set("zoom", String(Math.round(view.zoom)));
  }
  for (const p of pins) {
    if (p.kind === "subject") {
      params.append("markers", `color:0x12284C|label:S|${p.lat},${p.lng}`);
    } else {
      const digit = p.label.match(/^\d$/)?.[0];
      const label = digit ?? "C";
      params.append("markers", `color:0xC8B591|label:${label}|${p.lat},${p.lng}`);
    }
  }
  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
}

function mapsApiKeyFromEnv(): string {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? "";
}

export type StaticMapOptions = {
  apiKey?: string | null;
  maptype?: StaticMapType;
  size?: { w: number; h: number };
  view?: StaticMapView;
};

/**
 * Image for print / non-interactive slots.
 * Prefers Google Static Maps (same hybrid look as the live preview) when the
 * API key is set; falls back to a schematic SVG if not.
 */
export function resolveComparablesMapImage(
  pins: ComparablesMapPin[],
  options?: StaticMapOptions,
): {
  url: string;
  contentType: string;
  fileName: string;
} | null {
  if (pins.length < 1) return null;
  const apiKey = (options?.apiKey ?? mapsApiKeyFromEnv()).trim();
  const staticUrl = buildComparablesGoogleStaticMapUrl(
    pins,
    apiKey,
    options?.size ?? { w: 900, h: 420 },
    options?.maptype ?? "hybrid",
    options?.view,
  );
  if (staticUrl) {
    return {
      url: staticUrl,
      contentType: "image/png",
      fileName: "comparables-map.png",
    };
  }
  const svg = buildComparablesMapSvgDataUrl(pins);
  if (!svg) return null;
  return {
    url: svg,
    contentType: "image/svg+xml",
    fileName: "comparables-map.svg",
  };
}

/** Where the print map image came from. */
export type MaterializedMapSource =
  /** Static Maps fetched and embedded as a data URL (self-contained print HTML). */
  | "google-static"
  /** Static Maps reachable by <img> but not by fetch (CORS/offline fetch) — direct URL. */
  | "google-static-url"
  /** Google refused the request (Maps Static API not enabled / key restricted) — schematic SVG. */
  | "svg";

/** Why Static Maps could not be embedded: refused by Google / unreachable / not an image. */
export type StaticMapFailureKind = "denied" | "network" | "invalid";

export type MaterializedMapImage = {
  url: string;
  contentType: string;
  fileName: string;
  source: MaterializedMapSource;
  /** Google's refusal text (first line) when source is "svg" because of a denial. */
  denialReason?: string;
  /** Set together with denialReason. */
  failureKind?: StaticMapFailureKind;
};

type StaticMapFetchResult =
  | { ok: true; dataUrl: string; contentType: string }
  | { ok: false; kind: "denied" | "network" | "invalid"; detail: string };

/**
 * Print runs these fetches before the print tab opens; the click's transient user
 * activation lasts ~5 s, so a black-holed Google must fail fast, not hang.
 */
export const STATIC_MAP_FETCH_TIMEOUT_MS = 4000;

function timeoutSignal(ms: number): AbortSignal | undefined {
  if (typeof AbortSignal === "undefined") return undefined;
  const factory = (AbortSignal as unknown as { timeout?: (ms: number) => AbortSignal }).timeout;
  return typeof factory === "function" ? factory.call(AbortSignal, ms) : undefined;
}

async function fetchStaticMapAsDataUrl(url: string): Promise<StaticMapFetchResult> {
  let res: Response;
  try {
    res = await fetch(url, { signal: timeoutSignal(STATIC_MAP_FETCH_TIMEOUT_MS) });
  } catch (err) {
    return {
      ok: false,
      kind: "network",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
  if (!res.ok) {
    let text = "";
    try {
      text = (await res.text()).trim();
    } catch {
      /* body unreadable */
    }
    return {
      ok: false,
      kind: "denied",
      detail: `HTTP ${res.status}${text ? ` — ${text.split("\n")[0]!.slice(0, 240)}` : ""}`,
    };
  }
  const contentType =
    (res.headers.get("content-type") ?? "").split(";")[0]!.trim() || "image/png";
  if (!contentType.startsWith("image/")) {
    return { ok: false, kind: "invalid", detail: `non-image response (${contentType})` };
  }
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await res.arrayBuffer());
  } catch (err) {
    // Mid-download failure takes the same road as a failed fetch: probe, then SVG.
    return {
      ok: false,
      kind: "network",
      detail: `body read failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  if (!bytes.length) return { ok: false, kind: "invalid", detail: "empty body" };
  return {
    ok: true,
    dataUrl: `data:${contentType};base64,${bytesToBase64(bytes)}`,
    contentType,
  };
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** `<img>` does not need CORS — used when fetch() is blocked but the API itself works. */
export function probeImageLoads(url: string, timeoutMs = 1500): Promise<boolean> {
  if (typeof Image === "undefined") return Promise.resolve(false);
  return new Promise((resolve) => {
    let settled = false;
    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };
    const img = new Image();
    img.onload = () => done(true);
    img.onerror = () => done(false);
    setTimeout(() => done(false), timeoutMs);
    img.src = url;
  });
}

function svgFallback(
  pins: ComparablesMapPin[],
  denialReason?: string,
  failureKind?: StaticMapFailureKind,
): MaterializedMapImage | null {
  const svg = buildComparablesMapSvgDataUrl(pins);
  if (!svg) return null;
  return {
    url: svg,
    contentType: "image/svg+xml",
    fileName: "comparables-map.svg",
    source: "svg",
    ...(denialReason ? { denialReason, failureKind } : {}),
  };
}

/**
 * Embeddable print image: fetch Static Maps → data URL so the print HTML is
 * self-contained; keep the direct URL when only fetch() is blocked; fall back
 * to the schematic SVG when Google refuses the key (Maps Static API disabled).
 */
export async function materializeComparablesMapImage(
  pins: ComparablesMapPin[],
  options?: StaticMapOptions & {
    /** Test seam — defaults to an <img> load probe. */
    probeImage?: (url: string) => Promise<boolean>;
  },
): Promise<MaterializedMapImage | null> {
  const resolved = resolveComparablesMapImage(pins, options);
  if (!resolved) return null;
  if (!resolved.url.includes("/maps/api/staticmap")) {
    return { ...resolved, source: "svg" };
  }

  const fetched = await fetchStaticMapAsDataUrl(resolved.url);
  if (fetched.ok) {
    return {
      url: fetched.dataUrl,
      contentType: fetched.contentType,
      fileName: "comparables-map.png",
      source: "google-static",
    };
  }
  if (fetched.kind === "network") {
    const probe = options?.probeImage ?? probeImageLoads;
    if (await probe(resolved.url)) {
      return { ...resolved, source: "google-static-url" };
    }
    return svgFallback(pins, `Static Maps unreachable: ${fetched.detail}`, "network");
  }
  return svgFallback(pins, fetched.detail, fetched.kind);
}

type PrintMapSlot = {
  attachmentId: string;
  url: string;
  contentType: string;
  fileName: string;
  labelAr: string;
  isImage: boolean;
};

export const GENERATED_COMPS_MAP_ID = "generated-comps-map";
export const GENERATED_SATELLITE_MAP_ID = "generated-satellite-map";
export const GENERATED_CLOSEUP_MAP_ID = "generated-closeup-map";

function isGeneratedMapSlot(slot: PrintMapSlot | null | undefined): boolean {
  const id = slot?.attachmentId ?? "";
  return (
    id === GENERATED_COMPS_MAP_ID ||
    id === GENERATED_SATELLITE_MAP_ID ||
    id === GENERATED_CLOSEUP_MAP_ID ||
    Boolean(slot?.url.includes("/maps/api/staticmap"))
  );
}

/** Google Static Maps availability observed while preparing the print copy. */
export type PrintMapsDiagnostics = {
  /** True when at least one Google map image was produced (data URL or direct URL). */
  googleAvailable: boolean;
  /** False when no API key is configured at all (nothing was attempted). */
  attempted: boolean;
  /** True when at least one slot needed a generated map (there were coordinates). */
  wanted: boolean;
  /** Google's refusal text when every attempt fell back to SVG / blank. */
  denialReason: string | null;
  /** Classifies denialReason. */
  failureKind: StaticMapFailureKind | null;
  /** A slot holds a direct maps.googleapis.com URL (fetch blocked, <img> loads) — not self-contained. */
  directUrl: boolean;
  /** What the print copy actually shows after fallbacks. */
  compsSchematic: boolean;
  satelliteMissing: boolean;
  closeupMissing: boolean;
};

/**
 * Appraiser-facing explanation when the print copy could not embed Google maps.
 * Null when Google maps were embedded, or when nothing needed a map.
 */
export function printMapsNotice(d: PrintMapsDiagnostics): string | null {
  if (!d.wanted) return null;
  if (!d.attempted) {
    return "خرائط Google لا تظهر في نسخة الطباعة: لم يُضبط مفتاح الخرائط (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY).";
  }
  if (d.googleAvailable || !d.denialReason) return null;

  const consequences: string[] = [];
  if (d.compsSchematic) consequences.push("تُطبع خريطة تخطيطية بديلة في البند 18");
  if (d.satelliteMissing && d.closeupMissing) consequences.push("يبقى البند 33 فارغًا");
  else if (d.satelliteMissing) consequences.push("تبقى خريطة الأقمار الصناعية في البند 33 فارغة");
  else if (d.closeupMissing) consequences.push("تبقى الصورة المقربة في البند 33 فارغة");
  const consequence = consequences.length ? ` إلى أن يتم ذلك ${consequences.join(" و")}.` : "";

  if (d.failureKind === "network") {
    return (
      "خرائط Google لا تظهر في نسخة الطباعة: تعذّر الوصول إلى خدمة Google Static Maps من هذا الجهاز أو الشبكة. " +
      "تحقق من الاتصال أو من حظر maps.googleapis.com ثم أعد المحاولة." +
      consequence
    );
  }
  if (d.failureKind === "invalid") {
    return "خرائط Google لا تظهر في نسخة الطباعة: ردّت خدمة Google Static Maps بمحتوى غير صالح — أعد المحاولة." + consequence;
  }
  return (
    "خرائط Google لا تظهر في نسخة الطباعة: مفتاح الخرائط غير مصرّح له باستخدام «Maps Static API». " +
    "فعّلها من Google Cloud Console (APIs & Services → Library → Maps Static API → Enable) ثم أضفها إلى قيود المفتاح (API restrictions)." +
    consequence
  );
}

/**
 * Print-time map slots. §18 gets the comps map (Static Maps → SVG fallback).
 * §33 upper keeps an uploaded site map, else the Google hybrid view (zoom 15);
 * §33 lower is the Google satellite close-up (zoom 18). §33 has no SVG fallback:
 * a one-dot grid is not a location map, so the template placeholder stays.
 */
export async function materializePrintMapSlots(input: {
  pins: ComparablesMapPin[];
  comparableMapSlot: PrintMapSlot | null;
  satelliteMapSlot: PrintMapSlot | null;
  closeupMapSlot: PrintMapSlot | null;
  /** Test seam passed through to materializeComparablesMapImage. */
  probeImage?: (url: string) => Promise<boolean>;
}): Promise<{
  comparableMapSlot: PrintMapSlot | null;
  satelliteMapSlot: PrintMapSlot | null;
  closeupMapSlot: PrintMapSlot | null;
  diagnostics: PrintMapsDiagnostics;
}> {
  const pins = input.pins;
  const subjectPins = subjectOnlyMapPins(pins);
  const probeImage = input.probeImage;
  const wantComps =
    pins.length > 0 &&
    (!input.comparableMapSlot || isGeneratedMapSlot(input.comparableMapSlot));
  const wantSatellite =
    subjectPins.length > 0 &&
    (!input.satelliteMapSlot || isGeneratedMapSlot(input.satelliteMapSlot));
  const wantCloseup =
    subjectPins.length > 0 &&
    (!input.closeupMapSlot || isGeneratedMapSlot(input.closeupMapSlot));

  const diagnostics: PrintMapsDiagnostics = {
    googleAvailable: false,
    attempted: Boolean(mapsApiKeyFromEnv()),
    wanted: wantComps || wantSatellite || wantCloseup,
    denialReason: null,
    failureKind: null,
    directUrl: false,
    compsSchematic: false,
    satelliteMissing: false,
    closeupMissing: false,
  };
  const note = (img: MaterializedMapImage | null) => {
    if (!img) return;
    if (img.source !== "svg") diagnostics.googleAvailable = true;
    if (img.source === "google-static-url") diagnostics.directUrl = true;
    if (img.source === "svg" && img.denialReason && !diagnostics.denialReason) {
      diagnostics.denialReason = img.denialReason;
      diagnostics.failureKind = img.failureKind ?? "denied";
    }
  };

  const [comps, satellite, closeup] = await Promise.all([
    wantComps
      ? materializeComparablesMapImage(pins, {
          maptype: "hybrid",
          size: PRINT_MAP_SIZES.comps,
          probeImage,
        })
      : Promise.resolve(null),
    wantSatellite
      ? materializeComparablesMapImage(subjectPins, {
          maptype: PRINT_MAP_VIEWS.satellite.maptype,
          size: PRINT_MAP_SIZES.satellite,
          view: { zoom: PRINT_MAP_VIEWS.satellite.zoom },
          probeImage,
        })
      : Promise.resolve(null),
    wantCloseup
      ? materializeComparablesMapImage(subjectPins, {
          maptype: PRINT_MAP_VIEWS.closeup.maptype,
          size: PRINT_MAP_SIZES.closeup,
          view: { zoom: PRINT_MAP_VIEWS.closeup.zoom },
          probeImage,
        })
      : Promise.resolve(null),
  ]);
  note(comps);
  note(satellite);
  note(closeup);

  let comparableMapSlot = input.comparableMapSlot;
  if (comps) {
    comparableMapSlot = {
      attachmentId: GENERATED_COMPS_MAP_ID,
      url: comps.url,
      contentType: comps.contentType,
      fileName: comps.fileName,
      labelAr: input.comparableMapSlot?.labelAr || "خريطة مواقع المقارنات",
      isImage: true,
    };
  }

  let satelliteMapSlot = input.satelliteMapSlot;
  if (wantSatellite) {
    satelliteMapSlot =
      satellite && satellite.source !== "svg"
        ? {
            attachmentId: GENERATED_SATELLITE_MAP_ID,
            url: satellite.url,
            contentType: satellite.contentType,
            fileName: satellite.fileName.replace("comparables", "satellite"),
            labelAr: input.satelliteMapSlot?.labelAr || "خريطة الأقمار الصناعية",
            isImage: true,
          }
        : null;
  }

  let closeupMapSlot = input.closeupMapSlot;
  if (wantCloseup) {
    closeupMapSlot =
      closeup && closeup.source !== "svg"
        ? {
            attachmentId: GENERATED_CLOSEUP_MAP_ID,
            url: closeup.url,
            contentType: closeup.contentType,
            fileName: closeup.fileName.replace("comparables", "closeup"),
            labelAr: input.closeupMapSlot?.labelAr || "صورة مقربة للموقع",
            isImage: true,
          }
        : null;
  }

  diagnostics.compsSchematic = wantComps && comps?.source === "svg";
  diagnostics.satelliteMissing = wantSatellite && satelliteMapSlot === null;
  diagnostics.closeupMissing = wantCloseup && closeupMapSlot === null;

  return { comparableMapSlot, satelliteMapSlot, closeupMapSlot, diagnostics };
}

/** Project WGS84 → SVG using a padded bounding box (equirectangular). */
export function buildComparablesMapSvgDataUrl(
  pins: ComparablesMapPin[],
  size = { w: 900, h: 420 },
): string | null {
  if (pins.length < 1) return null;

  let minLat = pins[0]!.lat;
  let maxLat = pins[0]!.lat;
  let minLng = pins[0]!.lng;
  let maxLng = pins[0]!.lng;
  for (const p of pins) {
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng);
    maxLng = Math.max(maxLng, p.lng);
  }

  const padLat = Math.max((maxLat - minLat) * 0.25, 0.004);
  const padLng = Math.max((maxLng - minLng) * 0.25, 0.004);
  minLat -= padLat;
  maxLat += padLat;
  minLng -= padLng;
  maxLng += padLng;

  const { w, h } = size;
  const margin = 36;
  const plotW = w - margin * 2;
  const plotH = h - margin * 2;

  const project = (lat: number, lng: number) => {
    const x = margin + ((lng - minLng) / (maxLng - minLng || 1)) * plotW;
    const y = margin + ((maxLat - lat) / (maxLat - minLat || 1)) * plotH;
    return { x, y };
  };

  const esc = escHtml;

  const grid: string[] = [];
  for (let i = 0; i <= 4; i++) {
    const x = margin + (plotW * i) / 4;
    const y = margin + (plotH * i) / 4;
    grid.push(
      `<line x1="${x}" y1="${margin}" x2="${x}" y2="${h - margin}" stroke="#e6e1d6" stroke-width="1"/>`,
      `<line x1="${margin}" y1="${y}" x2="${w - margin}" y2="${y}" stroke="#e6e1d6" stroke-width="1"/>`,
    );
  }

  const markers = pins.map((p, idx) => {
    const { x, y } = project(p.lat, p.lng);
    if (p.kind === "subject") {
      return (
        `<g>` +
        `<circle cx="${x}" cy="${y}" r="11" fill="#102b4e" stroke="#fff" stroke-width="2"/>` +
        `<text x="${x}" y="${y + 4}" text-anchor="middle" fill="#fff" font-size="10" font-family="IBM Plex Sans Arabic,Tajawal,sans-serif" font-weight="700">★</text>` +
        `<text x="${x}" y="${y + 26}" text-anchor="middle" fill="#102b4e" font-size="12" font-family="IBM Plex Sans Arabic,Tajawal,sans-serif" font-weight="600">${esc(p.label)}</text>` +
        `</g>`
      );
    }
    const n = p.label.match(/^\d+$/) ? p.label : String(idx);
    return (
      `<g>` +
      `<circle cx="${x}" cy="${y}" r="12" fill="#a4906f" stroke="#fff" stroke-width="2"/>` +
      `<text x="${x}" y="${y + 4}" text-anchor="middle" fill="#fff" font-size="12" font-family="IBM Plex Sans Arabic,Tajawal,sans-serif" font-weight="700">${esc(n)}</text>` +
      `</g>`
    );
  });

  const legend =
    `<g font-family="IBM Plex Sans Arabic,Tajawal,sans-serif" font-size="11" fill="#3a3f4d">` +
    `<circle cx="28" cy="${h - 18}" r="7" fill="#102b4e"/>` +
    `<text x="42" y="${h - 14}">العقار محل التقييم</text>` +
    `<circle cx="180" cy="${h - 18}" r="7" fill="#a4906f"/>` +
    `<text x="194" y="${h - 14}">مقارن معتمد</text>` +
    `</g>`;

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" direction="rtl">` +
    `<rect width="100%" height="100%" fill="#faf8f3"/>` +
    `<rect x="${margin}" y="${margin}" width="${plotW}" height="${plotH}" fill="#fff" stroke="#ddd8cc" stroke-width="1.5"/>` +
    grid.join("") +
    markers.join("") +
    legend +
    `</svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Self-contained Google Maps bootstrap for standalone report HTML
 * (print tab / blob). Hosts must already exist with data-pins / data-lat.
 */
export function buildGoogleMapsHtmlBootstrap(apiKey: string): string {
  const key = apiKey.trim();
  if (!key) return "";
  return `<script>
(function(){
  var KEY=${JSON.stringify(key)};
  function mount(g){
    var hosts=[].slice.call(document.querySelectorAll("[data-ejada-gmap]"));
    hosts.forEach(function(el){
      var target=el.querySelector(".ejada-gmap-mount")||el;
      var pins=[];
      try{pins=JSON.parse(el.getAttribute("data-pins")||"[]");}catch(e){}
      if(!pins.length) return;
      var lat=Number(el.getAttribute("data-lat"));
      var lng=Number(el.getAttribute("data-lng"));
      var subject=pins.find(function(p){return p.kind==="subject";})||pins[0];
      var center={
        lat:isFinite(lat)?lat:Number(subject.lat),
        lng:isFinite(lng)?lng:Number(subject.lng)
      };
      if(!isFinite(center.lat)||!isFinite(center.lng)) return;
      var zoomAttr=el.getAttribute("data-zoom");
      var zoom=zoomAttr!=null&&zoomAttr!==""?Number(zoomAttr):null;
      var mapType=el.getAttribute("data-map-type")||"hybrid";
      var typeId=mapType==="satellite"?g.maps.MapTypeId.SATELLITE:
        mapType==="roadmap"?g.maps.MapTypeId.ROADMAP:
        mapType==="terrain"?g.maps.MapTypeId.TERRAIN:g.maps.MapTypeId.HYBRID;
      var bounds=new g.maps.LatLngBounds();
      pins.forEach(function(p){bounds.extend({lat:Number(p.lat),lng:Number(p.lng)});});
      var map=new g.maps.Map(target,{
        center:center,
        zoom:(zoom!=null&&isFinite(zoom))?zoom:(pins.length===1?16:14),
        mapTypeId:typeId,
        mapTypeControl:true,
        streetViewControl:false,
        fullscreenControl:true,
        zoomControl:true,
        gestureHandling:"cooperative"
      });
      if(zoom==null&&pins.length>1) map.fitBounds(bounds,48);
      else { map.setCenter(center); if(zoom!=null) map.setZoom(zoom); }
      pins.forEach(function(p){
        var isSubject=p.kind==="subject";
        new g.maps.Marker({
          map:map,
          position:{lat:Number(p.lat),lng:Number(p.lng)},
          title:p.label||"",
          label:isSubject?undefined:{text:String(p.label||"").slice(0,2),color:"#fff",fontWeight:"700",fontSize:"11px"},
          icon:isSubject?{
            path:g.maps.SymbolPath.CIRCLE,scale:10,fillColor:"#12284C",fillOpacity:1,strokeColor:"#fff",strokeWeight:2
          }:{
            path:g.maps.SymbolPath.CIRCLE,scale:9,fillColor:"#C8B591",fillOpacity:1,strokeColor:"#12284C",strokeWeight:1.5
          },
          zIndex:isSubject?1000:100
        });
      });
      setTimeout(function(){
        g.maps.event.trigger(map,"resize");
        map.setCenter(center);
      },50);
    });
  }
  window.__ejadaReportMapsInit=function(){
    if(window.google&&window.google.maps) mount(window.google);
  };
  if(window.google&&window.google.maps){mount(window.google);return;}
  var s=document.createElement("script");
  s.src="https://maps.googleapis.com/maps/api/js?key="+encodeURIComponent(KEY)+"&loading=async&callback=__ejadaReportMapsInit";
  s.async=true;
  s.defer=true;
  document.head.appendChild(s);
})();
</script>`;
}
