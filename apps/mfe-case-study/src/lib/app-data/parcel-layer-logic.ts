/**
 * The land layers of the properties map (Omar 2026-11-16): MOMRAH's 48,131 plans and 7.37M parcels,
 * served as vector tiles and drawn over the Google map — their own source, apart from the
 * properties' pins. Pure: no React, no I/O.
 */
import { areaText } from "./appraiser-summary-model";

/** The plans' outlines show from this zoom, their numbers from `PLAN_LABEL_MIN_ZOOM`. */
export const PLAN_MIN_ZOOM = 11;
export const PLAN_LABEL_MIN_ZOOM = 15;
/** The parcels start to show at this zoom — the tiles hold nothing farther out. */
export const PARCEL_MIN_ZOOM = 13;
/** The tiles' deepest level; closer zooms enlarge it. */
export const PARCEL_MAX_TILE_ZOOM = 15;
/** Parcel numbers are written on the map from this zoom — farther out they crowd each other. */
export const PARCEL_LABEL_MIN_ZOOM = 18;

/** One parcel's attributes as the tiles carry them. */
export type ParcelProps = {
  plan?: string | null;
  parcel?: string | null;
  district?: string | null;
  city?: string | null;
  area?: number | string | null;
  use?: number | string | null;
};

/**
 * The tile server's address (`NEXT_PUBLIC_PARCEL_TILES_URL`, e.g. `http://localhost:8091`), or
 * null when none is set — then the layer's button is not shown.
 */
export function parcelTilesBase(raw: string | undefined = process.env.NEXT_PUBLIC_PARCEL_TILES_URL): string | null {
  const base = (raw ?? "").trim().replace(/\/+$/, "");
  return base || null;
}

/** The plans', parcels' and parcel numbers' tile templates under the server's address. */
export function parcelTileUrls(base: string): { plans: string; parcels: string; labels: string } {
  return {
    plans: `${base}/plans/{z}/{x}/{y}.mvt`,
    parcels: `${base}/parcels/{z}/{x}/{y}.mvt`,
    labels: `${base}/labels/{z}/{x}/{y}.mvt`,
  };
}

/** The three land layers, each switched on by itself from the map's top bar. */
export type LandLayerKey = "plans" | "parcels" | "numbers";
export type LandLayers = Record<LandLayerKey, boolean>;

export const LAND_LAYERS_OFF: LandLayers = { plans: false, parcels: false, numbers: false };

/** The land layers' chips, in the bar's order, with the zoom each starts to show at. */
export const LAND_LAYER_CHIPS: readonly { key: LandLayerKey; label: string; color: string; minZoom: number }[] = [
  { key: "plans", label: "المخططات", color: "#d4880f", minZoom: PLAN_MIN_ZOOM },
  { key: "parcels", label: "حدود القطع", color: "#12284C", minZoom: PARCEL_MIN_ZOOM },
  { key: "numbers", label: "أرقام القطع", color: "#73767f", minZoom: PARCEL_LABEL_MIN_ZOOM },
];

/**
 * The note asking to zoom in, naming the switched-on land layers that cannot show yet at this
 * zoom; null when every layer that is on is drawn (or none is on).
 */
export function landLayerHint(layers: LandLayers, zoom: number): string | null {
  const waiting = LAND_LAYER_CHIPS.filter((c) => layers[c.key] && zoom < c.minZoom);
  return waiting.length ? `قرّب الخريطة لتظهر ${waiting.map((c) => c.label).join(" و")}` : null;
}

/** MOMRAH's ways of saying a plan has no number. */
const NO_PLAN_NUMBER = new Set(["9999", "بدون"]);

/** A plan number as the map writes it — MOMRAH's «no number» (9999, «بدون») writes nothing. */
export function planNumberText(plan: string | null | undefined): string {
  const raw = String(plan ?? "").trim();
  return !raw || NO_PLAN_NUMBER.has(raw) ? "" : arabicForMap(raw.replace(/\s*\/\s*/g, " / "));
}

/** The plans' outline and number colours: amber, bright on imagery, deeper on a street map. */
export function planStyle(satellite: boolean): { line: Rgba; text: Rgba } {
  return satellite
    ? { line: [255, 190, 40, 235], text: [255, 214, 120, 255] }
    : { line: [196, 120, 15, 230], text: [150, 85, 0, 255] };
}

/** MOMRAH's main land-use codes. */
const LAND_USE: Record<string, string> = {
  "100000": "سكني",
  "200000": "تجاري",
  "300000": "خدمات",
  "400000": "مرافق",
  "500000": "زراعي",
  "800000": "صناعي",
};

/** A land-use code in words; an unknown code stays as it is. */
export function parcelUseLabel(code: number | string | null | undefined): string {
  const key = String(code ?? "").trim();
  return LAND_USE[key] ?? key;
}

/** Identifies a parcel across tiles — the same parcel is cut into several at tile edges. */
export function parcelKey(p: ParcelProps): string {
  return `${p.city ?? ""}|${p.plan ?? ""}|${p.parcel ?? ""}`;
}

/** MOMRAH's placeholder for a parcel with no number — nothing is written on the map for it. */
const NO_PARCEL_NUMBER = "لا يوجد رقم";

/**
 * A parcel number as the map writes it: «1588/2» → «1588 / 2», easier to read; Arabic letters
 * joined and ordered for the map (`arabicForMap`).
 * Edge cases: MOMRAH's «لا يوجد رقم» writes nothing (the parcel's window still says it).
 */
export function parcelNumberText(p: ParcelProps): string {
  const raw = String(p.parcel ?? "").trim();
  if (!raw || raw === NO_PARCEL_NUMBER) return "";
  return arabicForMap(raw.replace(/\s*\/\s*/g, " / "));
}

/**
 * Each Arabic letter's presentation forms — isolated, final, initial, medial. A letter with two
 * forms joins only the letter before it.
 */
const ARABIC_FORMS: Record<string, readonly number[]> = {
  "ء": [0xfe80],
  "آ": [0xfe81, 0xfe82],
  "أ": [0xfe83, 0xfe84],
  "ؤ": [0xfe85, 0xfe86],
  "إ": [0xfe87, 0xfe88],
  "ئ": [0xfe89, 0xfe8a, 0xfe8b, 0xfe8c],
  "ا": [0xfe8d, 0xfe8e],
  "ب": [0xfe8f, 0xfe90, 0xfe91, 0xfe92],
  "ة": [0xfe93, 0xfe94],
  "ت": [0xfe95, 0xfe96, 0xfe97, 0xfe98],
  "ث": [0xfe99, 0xfe9a, 0xfe9b, 0xfe9c],
  "ج": [0xfe9d, 0xfe9e, 0xfe9f, 0xfea0],
  "ح": [0xfea1, 0xfea2, 0xfea3, 0xfea4],
  "خ": [0xfea5, 0xfea6, 0xfea7, 0xfea8],
  "د": [0xfea9, 0xfeaa],
  "ذ": [0xfeab, 0xfeac],
  "ر": [0xfead, 0xfeae],
  "ز": [0xfeaf, 0xfeb0],
  "س": [0xfeb1, 0xfeb2, 0xfeb3, 0xfeb4],
  "ش": [0xfeb5, 0xfeb6, 0xfeb7, 0xfeb8],
  "ص": [0xfeb9, 0xfeba, 0xfebb, 0xfebc],
  "ض": [0xfebd, 0xfebe, 0xfebf, 0xfec0],
  "ط": [0xfec1, 0xfec2, 0xfec3, 0xfec4],
  "ظ": [0xfec5, 0xfec6, 0xfec7, 0xfec8],
  "ع": [0xfec9, 0xfeca, 0xfecb, 0xfecc],
  "غ": [0xfecd, 0xfece, 0xfecf, 0xfed0],
  "ف": [0xfed1, 0xfed2, 0xfed3, 0xfed4],
  "ق": [0xfed5, 0xfed6, 0xfed7, 0xfed8],
  "ك": [0xfed9, 0xfeda, 0xfedb, 0xfedc],
  "ل": [0xfedd, 0xfede, 0xfedf, 0xfee0],
  "م": [0xfee1, 0xfee2, 0xfee3, 0xfee4],
  "ن": [0xfee5, 0xfee6, 0xfee7, 0xfee8],
  "ه": [0xfee9, 0xfeea, 0xfeeb, 0xfeec],
  "و": [0xfeed, 0xfeee],
  "ى": [0xfeef, 0xfef0],
  "ي": [0xfef1, 0xfef2, 0xfef3, 0xfef4],
};
/** Persian keheh and yeh, as some rows write ك and ي. */
const ARABIC_ALIASES: Record<string, string> = { "ک": "ك", "ی": "ي" };
/** Lam followed by an alef is one glyph — isolated, final. */
const LAM_ALEF: Record<string, readonly number[]> = {
  "آ": [0xfef5, 0xfef6],
  "أ": [0xfef7, 0xfef8],
  "إ": [0xfef9, 0xfefa],
  "ا": [0xfefb, 0xfefc],
};

const joinsNext = (ch: string | undefined) => (ch ? (ARABIC_FORMS[ch]?.length ?? 0) === 4 : false);

/** One run of Arabic letters (and spaces) in its joined forms, still in reading order. */
function shapeArabic(run: string): string {
  const chars = [...run].map((c) => ARABIC_ALIASES[c] ?? c);
  let out = "";
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]!;
    const forms = ARABIC_FORMS[ch];
    if (!forms) {
      out += ch;
      continue;
    }
    const joinedBefore = joinsNext(chars[i - 1]);
    const lamAlef = ch === "ل" ? LAM_ALEF[chars[i + 1] ?? ""] : undefined;
    if (lamAlef) {
      out += String.fromCodePoint(lamAlef[joinedBefore ? 1 : 0]!);
      i++;
      continue;
    }
    const joinedAfter = forms.length === 4 && Boolean(ARABIC_FORMS[chars[i + 1] ?? ""]);
    const form = joinedBefore ? (joinedAfter ? 3 : 1) : joinedAfter ? 2 : 0;
    out += String.fromCodePoint(forms[form] ?? forms[0]!);
  }
  return out;
}

/** A run of Arabic letters, spaces between Arabic words included. */
const ARABIC_RUN = /[\u0621-\u064A\u06A9\u06CC]+(?:\s+[\u0621-\u064A\u06A9\u06CC]+)*/g;

/**
 * Text for deck.gl's map labels, which draw characters one by one, left to right, with no Arabic
 * joining (seen 2026-11-16: «لا يوجد رقم» came out as «مقر دجوي ال»). Each Arabic run is put in its
 * joined forms and reversed, so it reads right; digits and the rest stay left to right — the order
 * the system shows plan and parcel numbers in (`ltr`), «م / 1» as on the deed page.
 * Edge cases: text without Arabic letters is returned as it is; harakat are dropped.
 */
export function arabicForMap(text: string): string {
  const bare = text.replace(/[\u064B-\u0652]/g, "");
  return bare.replace(ARABIC_RUN, (run) => [...shapeArabic(run)].reverse().join(""));
}

/**
 * What a clicked parcel shows. `9999` is MOMRAH's «no plan», shown as «—»; `ltr` marks a number
 * written left to right.
 * Edge cases: an empty value reads «—»; the area is in m².
 */
export function parcelFacts(p: ParcelProps): { label: string; value: string; ltr?: boolean }[] {
  const text = (v: unknown) => String(v ?? "").trim() || "—";
  const plan = String(p.plan ?? "").trim();
  return [
    // Plan and parcel numbers read left to right, as on the deed page (seen 2026-11-16: «1133 / س .ت»
    // had its characters reordered in the right-to-left window).
    { label: "رقم المخطط", value: plan && plan !== "9999" ? plan : "—", ltr: true },
    { label: "رقم القطعة", value: text(p.parcel), ltr: true },
    { label: "الحي", value: text(p.district) },
    { label: "المدينة", value: text(p.city) },
    { label: "المساحة", value: areaText(p.area == null ? "" : String(p.area)) || "—" },
    { label: "الاستخدام", value: parcelUseLabel(p.use) || "—" },
  ];
}

type Rgba = [number, number, number, number];

/**
 * The clicked parcel's fill: navy on imagery — gold is lost on the desert's beige (seen
 * 2026-11-16) — and the system's gold on a street map.
 */
export function parcelHighlightColor(satellite: boolean): Rgba {
  return satellite ? [18, 40, 76, 170] : [200, 181, 145, 170];
}

/**
 * The parcels' outline at a zoom, on imagery (white) or a street map (navy): far out the parcels
 * are dense, so the lines start hairline-thin and faint and firm up as the map zooms in.
 */
export function parcelLineStyle(zoom: number, satellite: boolean): { color: Rgba; width: number } {
  const alpha = zoom < 15 ? 90 : zoom < 17 ? 160 : satellite ? 235 : 255;
  const rgb: [number, number, number] = satellite ? [255, 255, 255] : [18, 40, 76];
  const width = zoom < 15 ? 0.4 : zoom < 17 ? 0.7 : zoom < 19 ? 1 : 1.4;
  return { color: [...rgb, alpha], width };
}
