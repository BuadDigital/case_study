/** Client-side static map for §18 — subject + adopted comparables. */

export type ComparablesMapPin = {
  lat: number;
  lng: number;
  label: string;
  kind: "subject" | "comp";
};

function parseCoord(value: string | number | null | undefined): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  const t = (value ?? "").trim().replace(",", ".");
  if (!t) return null;
  const n = Number.parseFloat(t);
  return Number.isFinite(n) ? n : null;
}

export function collectComparablesMapPins(input: {
  subjectLat?: string | number | null;
  subjectLng?: string | number | null;
  comps?: Array<{
    latitude?: number | null;
    longitude?: number | null;
    label?: string | null;
  }> | null;
}): ComparablesMapPin[] {
  const pins: ComparablesMapPin[] = [];
  const sLat = parseCoord(input.subjectLat);
  const sLng = parseCoord(input.subjectLng);
  if (sLat != null && sLng != null && !(sLat === 0 && sLng === 0)) {
    pins.push({ lat: sLat, lng: sLng, label: "العقار", kind: "subject" });
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

  // Pad so a single pin or tight cluster still has readable extent (~400m–ish).
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

  const esc = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

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
