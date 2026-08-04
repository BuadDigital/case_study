/**
 * Extract deed / nature boundary fields from a survey sketch PDF (client-side).
 *
 * Strategies (best → fallback):
 * 1) Text layer with labeled tables (بموجب الصك / الطبيعة + وصف الحد)
 * 2) Spatial edge-length numbers only (no descriptions)
 * 3) Empty fields filled from property intake (بورصة) hints
 */

export type SketchBoundarySide = {
  description: string;
  lengthM: string;
};

export type SketchBoundaryBlock = {
  areaSqm: string;
  north: SketchBoundarySide;
  south: SketchBoundarySide;
  east: SketchBoundarySide;
  west: SketchBoundarySide;
};

export type SurveySketchExtractResult = {
  rawText: string;
  hasData: boolean;
  warning?: string;
  deedMatchesNature: "yes" | "no" | null;
  deed: SketchBoundaryBlock;
  nature: SketchBoundaryBlock | null;
  filledCount: number;
  usedSpatialLengths?: boolean;
  /**
   * Area estimated from 4 edge lengths + croquis edge orientation
   * (when table «المساحة» is image-only). Used for طبيعة.
   */
  estimatedNatureAreaSqm?: string;
  /** Angle (rad) between N/S-pair edge dir and E/W-pair dir (spatial). */
  edgeAngleBetweenRad?: number;
};

export type SurveySketchApplyPatch = {
  deedMatchesNature?: "yes" | "no" | null;
  onSiteAreaSqm?: string;
  northBoundary?: string;
  northBoundaryLengthM?: string;
  southBoundary?: string;
  southBoundaryLengthM?: string;
  eastBoundary?: string;
  eastBoundaryLengthM?: string;
  westBoundary?: string;
  westBoundaryLengthM?: string;
  natureOnSiteAreaSqm?: string;
  natureNorthBoundary?: string;
  natureNorthBoundaryLengthM?: string;
  natureSouthBoundary?: string;
  natureSouthBoundaryLengthM?: string;
  natureEastBoundary?: string;
  natureEastBoundaryLengthM?: string;
  natureWestBoundary?: string;
  natureWestBoundaryLengthM?: string;
};

export type SketchPdfTextItem = {
  str: string;
  x: number;
  y: number;
  a?: number;
  b?: number;
  width?: number;
};

export type SketchPropertyBoundaryHints = {
  areaSqm?: string;
  northBoundary?: string;
  northBoundaryLengthM?: string;
  southBoundary?: string;
  southBoundaryLengthM?: string;
  eastBoundary?: string;
  eastBoundaryLengthM?: string;
  westBoundary?: string;
  westBoundaryLengthM?: string;
};

type DirKey = "north" | "south" | "east" | "west";

const EMPTY_SIDE: SketchBoundarySide = { description: "", lengthM: "" };
const DIR_ORDER: DirKey[] = ["north", "south", "east", "west"];

const DIR_PATTERNS: Record<DirKey, RegExp> = {
  north: /(?:الحد\s*)?(?:الشمالي|الشمال|شمالا|شمال|جهة\s*الشمال)/i,
  south: /(?:الحد\s*)?(?:الجنوبي|الجنوب|جنوبا|جنوب|جهة\s*الجنوب)/i,
  east: /(?:الحد\s*)?(?:الشرقي|الشرق|شرقا|شرق|جهة\s*الشرق)/i,
  west: /(?:الحد\s*)?(?:الغربي|الغرب|غربا|غرب|جهة\s*الغرب)/i,
};

const DIR_TOKEN_BY_DIR: Record<DirKey, string> = {
  north: "(?:الحد\\s*)?(?:الشمالي|الشمال|شمالا|شمال|جهة\\s*الشمال)",
  south: "(?:الحد\\s*)?(?:الجنوبي|الجنوب|جنوبا|جنوب|جهة\\s*الجنوب)",
  east: "(?:الحد\\s*)?(?:الشرقي|الشرق|شرقا|شرق|جهة\\s*الشرق)",
  west: "(?:الحد\\s*)?(?:الغربي|الغرب|غربا|غرب|جهة\\s*الغرب)",
};

const DIR_WORD: Record<DirKey, string> = {
  north: "شمال",
  south: "جنوب",
  east: "شرق",
  west: "غرب",
};

function emptyBlock(): SketchBoundaryBlock {
  return {
    areaSqm: "",
    north: { ...EMPTY_SIDE },
    south: { ...EMPTY_SIDE },
    east: { ...EMPTY_SIDE },
    west: { ...EMPTY_SIDE },
  };
}

let workerReady = false;

async function loadPdfJs() {
  const pdfjs = await import("pdfjs-dist");
  if (!workerReady && typeof window !== "undefined") {
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    workerReady = true;
  }
  return pdfjs;
}

/** Normalize Arabic for matching (display uses cleaned but readable form). */
export function normalizeSketchText(input: string): string {
  return input
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ـ/g, "")
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[０-９]/g, (d) =>
      String.fromCharCode(d.charCodeAt(0) - 0xff10 + 0x30),
    )
    .replace(/[،]/g, ",")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\r\n/g, "\n")
    .trim();
}

function cleanLength(raw: string): string {
  const n = raw.replace(/,/g, "").replace(/\s/g, "").trim();
  if (!n || !/^\d+(\.\d+)?$/.test(n)) return "";
  return n;
}

function cleanArea(raw: string): string {
  return cleanLength(raw);
}

function cleanDescription(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .replace(/^[\s:：\-–—|•·]+/, "")
    .replace(/[\s:：\-–—|•·]+$/, "")
    .trim();
}

/** Prettify OCR-ish description for form display. */
function formatDescription(raw: string): string {
  let s = cleanDescription(raw);
  if (!s) return "";
  // Normalize common croquis phrases
  s = s
    .replace(/قطعه\s*رقم/gi, "قطعة رقم")
    .replace(/قطعه\s*رقم/gi, "قطعة رقم")
    .replace(/قطعه/gi, "قطعة")
    .replace(/شارع\s*عرض/gi, "شارع عرض");
  // "قطعة رقم 225" keep arabic digits if wanted - keep latin after normalize
  const plot = s.match(/قطعه?\s*رقم\s*(\d+)/i);
  if (plot) return `قطعة رقم ${plot[1]}`;
  const street = s.match(/شارع\s*عرض\s*([\d.]+)\s*م?/i);
  if (street) return `شارع عرض ${street[1]} م`;
  return s;
}

function detectDir(line: string): DirKey | null {
  const n = normalizeSketchText(line);
  for (const key of DIR_ORDER) {
    if (DIR_PATTERNS[key].test(n)) return key;
  }
  return null;
}

/** Arabic «المساحة» after normalizeSketchText ends with ه not ة; \w never matches Arabic.
 * Tag after unit uses [ \\t] only (not \\n) so the next مساحة line is not consumed.
 */
const AREA_LABEL_RE =
  /المساحه?\s*[:：]?\s*([\d.,]+)\s*(?:م2|م²|م\s*2|متر)?(?:[ \t]+(\S+))?/gi;

function extractArea(rawText: string): string {
  const n = normalizeSketchText(rawText);
  // Prefer صك/طبيعة labelled areas; skip "حسابيا" as primary when others exist.
  const all = [...n.matchAll(new RegExp(AREA_LABEL_RE.source, "gi"))];
  let first: string | null = null;
  for (const m of all) {
    const a = cleanArea(m[1] ?? "");
    if (!a || Number(a) < 10) continue;
    const tail = normalizeSketchText(m[2] ?? "");
    if (tail.includes("حساب")) continue;
    return a;
  }
  for (const m of all) {
    const a = cleanArea(m[1] ?? "");
    if (a && Number(a) >= 10) {
      first = a;
      break;
    }
  }
  if (first) return first;
  const loose = n.match(/([\d.,]{3,})\s*(?:م2|م²|متر\s*مربع)/i);
  if (loose?.[1]) return cleanArea(loose[1]) || "";
  return "";
}

/**
 * Split raw croquis text into deed / nature slices (headers like بموجب الصك).
 */
export function splitDeedNatureSections(rawText: string): {
  deedText: string;
  natureText: string | null;
} {
  const text = rawText.trim();
  if (!text) return { deedText: "", natureText: null };

  const normalized = normalizeSketchText(text);
  const natureHeader =
    /(?:بموجب\s*الطبيع[هة]|حسب\s*الطبيع[هة]|بيانات\s*الطبيع[هة]|الحدود\s*(?:والاطوال\s*)?(?:حسب\s*)?الطبيع[هة])/i;
  const deedHeader =
    /(?:بموجب\s*الصك|حسب\s*الصك|بيانات\s*الصك|الحدود\s*(?:والاطوال\s*)?(?:حسب\s*)?الصك)/i;

  const natureInOrig = text.search(natureHeader);
  const deedInOrig = text.search(deedHeader);
  const natureInNorm = natureInOrig < 0 ? normalized.search(natureHeader) : -1;
  const deedInNorm = deedInOrig < 0 ? normalized.search(deedHeader) : -1;

  const nIdx = natureInOrig >= 0 ? natureInOrig : natureInNorm;
  const dIdx = deedInOrig >= 0 ? deedInOrig : deedInNorm;
  const source = natureInOrig >= 0 || deedInOrig >= 0 ? text : normalized;

  if (nIdx >= 0 && dIdx >= 0) {
    if (dIdx < nIdx) {
      return {
        deedText: source.slice(dIdx, nIdx),
        natureText: source.slice(nIdx),
      };
    }
    return {
      deedText: source.slice(dIdx),
      natureText: source.slice(nIdx, dIdx),
    };
  }
  if (nIdx >= 0) {
    return {
      deedText: source.slice(0, nIdx) || source,
      natureText: source.slice(nIdx),
    };
  }
  if (dIdx >= 0) {
    return { deedText: source.slice(dIdx), natureText: null };
  }
  return { deedText: text, natureText: null };
}

function blockFilledCount(b: SketchBoundaryBlock): number {
  let n = 0;
  if (b.areaSqm) n += 1;
  for (const d of DIR_ORDER) {
    if (b[d].description) n += 1;
    if (b[d].lengthM) n += 1;
  }
  return n;
}

function blocksEqual(a: SketchBoundaryBlock, b: SketchBoundaryBlock): boolean {
  if (a.areaSqm !== b.areaSqm) return false;
  for (const d of DIR_ORDER) {
    if (a[d].description !== b[d].description) return false;
    if (a[d].lengthM !== b[d].lengthM) return false;
  }
  return true;
}

function isBlockEmpty(b: SketchBoundaryBlock): boolean {
  return blockFilledCount(b) === 0;
}

function onlyLengthsFilled(b: SketchBoundaryBlock): boolean {
  if (b.areaSqm) return false;
  return DIR_ORDER.every((d) => b[d].lengthM && !b[d].description);
}

function hasAnyDescription(b: SketchBoundaryBlock): boolean {
  return DIR_ORDER.some((d) => Boolean(b[d].description));
}

function lengthCount(b: SketchBoundaryBlock): number {
  return DIR_ORDER.filter((d) => Boolean(b[d].lengthM)).length;
}

function descriptionCount(b: SketchBoundaryBlock): number {
  return DIR_ORDER.filter((d) => Boolean(b[d].description)).length;
}

/**
 * Table is "good" when sides have paired وصف + طول from the croquis table
 * (not guesswork from edge positions on the drawing).
 */
function isTableQuality(r: SurveySketchExtractResult): boolean {
  // Only true when وصف+طول paired together — "has desc + any lengths" is NOT quality
  // (wrong spatial lengths + correct descs from intake used to skip OCR).
  const paired = DIR_ORDER.filter(
    (d) => r.deed[d].description && r.deed[d].lengthM,
  ).length;
  const nPaired = r.nature
    ? DIR_ORDER.filter(
        (d) => r.nature![d].description && r.nature![d].lengthM,
      ).length
    : 0;
  return paired >= 3 || nPaired >= 3;
}

const DESC_TOKEN =
  "(?:قطعه?\\s*رقم\\s*\\d+|شارع\\s*عرض\\s*[\\d.]+\\s*م?)";
/** Edge meters in croquis tables are always decimals (24.25) — never bare parcel ids. */
const EDGE_LEN_TOKEN = "([\\d]+[.,]\\d{1,3})";

/**
 * Croquis table column header "الطول/م" (and OCR variants).
 * Presence anchors the real boundary table — not drawing edge labels.
 */
export const LENGTH_COLUMN_HEADER_RE =
  /(?:ال)?طول\s*[\/|\\.\-–—]?\s*م(?:تر)?|(?:ال)?طول\s*بالمتر|الطول\s*\/\s*م/i;

/**
 * Body of the table that sits under (or on the same line as) header الطول/م.
 * Everything before this header is treated as croquis noise (edge labels).
 */
export function extractBodiesAfterLengthColumnHeader(
  sectionText: string,
): string[] {
  const text = sectionText.trim();
  if (!text) return [];

  const bodies: string[] = [];
  // Search original + normalized (OCR may drop slashes)
  const sources = [text, normalizeSketchText(text)];
  const seen = new Set<string>();

  for (const source of sources) {
    const re = new RegExp(LENGTH_COLUMN_HEADER_RE.source, "gi");
    let m: RegExpExecArray | null;
    while ((m = re.exec(source)) !== null) {
      const start = m.index + m[0].length;
      let body = source.slice(start);
      // Stop before next title / area / second table header noise
      body = body.split(
        /(?:بموجب\s*(?:الصك|الطبيع)|المساحه?\s*[:：]?|الحدود\s*والاطوال)/i,
      )[0] ?? body;
      // Cap runaway captures
      body = body.slice(0, 1200).trim();
      if (body.length < 8) continue;
      const key = normalizeSketchText(body).slice(0, 80);
      if (seen.has(key)) continue;
      seen.add(key);
      bodies.push(body);
    }
  }

  return bodies;
}

/**
 * Parse boundary rows strictly from text under column header الطول/م.
 * This is the preferred source for edge lengths.
 */
export function parseFromLengthColumnTable(
  sectionText: string,
): SketchBoundaryBlock | null {
  const bodies = extractBodiesAfterLengthColumnHeader(sectionText);
  if (bodies.length === 0) return null;

  let best: SketchBoundaryBlock | null = null;
  let bestScore = -1;

  for (const body of bodies) {
    const block = emptyBlock();
    const flat = normalizeSketchText(body).replace(/\n+/g, " ");

    for (const dir of DIR_ORDER) {
      const dirTok = DIR_TOKEN_BY_DIR[dir];
      // Full row under الطول/م column family: جهة + وصف + طول
      const matches = [
        ...flat.matchAll(
          new RegExp(
            `${dirTok}\\s*(?:الحد)?\\s*[:：\\-–—|•·]*\\s*(${DESC_TOKEN})\\s*[:：\\-–—|/]*\\s*${EDGE_LEN_TOKEN}`,
            "gi",
          ),
        ),
      ];
      if (matches.length > 0) {
        const last = matches[matches.length - 1]!;
        block[dir].description = formatDescription(last[1] ?? "");
        const len = cleanLength((last[2] ?? "").replace(",", "."));
        const plotN = (last[1] ?? "").match(/رقم\s*(\d+)/i)?.[1];
        if (isPlausibleEdgeLength(len, plotN)) block[dir].lengthM = len;
        continue;
      }

      // Direction + description only under header (length trailing elsewhere on row list)
      const dOnly = [
        ...flat.matchAll(
          new RegExp(
            `${dirTok}\\s*(?:الحد)?\\s*[:：\\-–—|•·]*\\s*(${DESC_TOKEN})`,
            "gi",
          ),
        ),
      ];
      if (dOnly.length > 0) {
        block[dir].description = formatDescription(
          dOnly[dOnly.length - 1]![1] ?? "",
        );
      }
    }

    // Bind lengths after orصاف from body only (never pre-header drawing)
    for (const dir of DIR_ORDER) {
      if (!block[dir].description) continue;
      if (block[dir].lengthM) continue;
      const len = lengthAfterDescriptionInText(body, block[dir].description);
      if (len) block[dir].lengthM = len;
    }

    // Column dump under header: four descs then four decimals in N,S,E,W order
    if (lengthCount(block) < 3) {
      const descs = [...flat.matchAll(new RegExp(DESC_TOKEN, "gi"))].map((x) =>
        formatDescription(x[0]),
      );
      const uniqueDescs: string[] = [];
      for (const d of descs) {
        if (!uniqueDescs.includes(d)) uniqueDescs.push(d);
        if (uniqueDescs.length >= 4) break;
      }
      const lens = [
        ...flat.matchAll(/([\d]+[.,]\d{1,3})/g),
      ]
        .map((x) => cleanLength((x[1] ?? "").replace(",", ".")))
        .filter((len) => isPlausibleEdgeLength(len) && Number(len) < 200);

      // Only zip when we are clearly inside الطول/م body (few decimals ≈ 4 edges)
      if (uniqueDescs.length >= 4 && lens.length >= 4 && lens.length <= 8) {
        for (let i = 0; i < 4; i++) {
          const dir = DIR_ORDER[i]!;
          if (!block[dir].description) {
            block[dir].description = uniqueDescs[i]!;
          }
          // Prefer length after this description when available
          const adj = lengthAfterDescriptionInText(body, block[dir].description);
          if (adj) {
            block[dir].lengthM = adj;
          } else if (!block[dir].lengthM) {
            // Zip only the *trailing* 4 decimals (column الطول/م), not leading noise
            const tail = lens.slice(-4);
            block[dir].lengthM = tail[i]!;
          }
        }
      }
    }

    const score =
      DIR_ORDER.filter((d) => block[d].description && block[d].lengthM)
        .length *
        10 +
      descriptionCount(block) * 2 +
      lengthCount(block);
    if (score > bestScore) {
      bestScore = score;
      best = block;
    }
  }

  if (!best || bestScore < 6) return null;
  return best;
}

function isPlausibleEdgeLength(len: string, exclude?: string): boolean {
  if (!len) return false;
  const n = Number(len);
  if (!(n >= 2 && n <= 500)) return false;
  if (exclude && len === exclude) return false;
  if (exclude && Number(len) === Number(exclude)) return false;
  // Parcel-like whole numbers without decimal are rejected unless tiny street-side
  if (!len.includes(".") && n >= 100) return false;
  return true;
}

/**
 * Text belonging to one direction — pick the best window among ALL
 * occurrences of the direction token (tables often appear AFTER drawing
 * labels; first "شمال" on page is frequently next to edge length 24.95).
 */
export function sliceTextForDirection(
  sourceText: string,
  dir: DirKey,
): string {
  const flat = normalizeSketchText(sourceText).replace(/\n+/g, " ");
  if (!flat) return "";

  const selfRe = new RegExp(DIR_TOKEN_BY_DIR[dir], "gi");
  const hits: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = selfRe.exec(flat)) !== null) {
    hits.push(m.index);
    // Avoid zero-length loops
    if (m[0].length === 0) selfRe.lastIndex += 1;
  }
  if (hits.length === 0) return "";

  const windowAfter = (start: number, tokenLen: number): string => {
    const after = flat.slice(start + tokenLen);
    let endRel = after.length;
    for (const other of DIR_ORDER) {
      if (other === dir) continue;
      const oRe = new RegExp(DIR_TOKEN_BY_DIR[other], "i");
      const om = oRe.exec(after);
      if (om && om.index < endRel) endRel = om.index;
    }
    return flat.slice(start, start + tokenLen + endRel);
  };

  let best = "";
  let bestScore = -1;
  let bestStart = -1;

  for (const start of hits) {
    const tokM = flat.slice(start).match(new RegExp(DIR_TOKEN_BY_DIR[dir], "i"));
    const tokenLen = tokM?.[0].length ?? 0;
    const win = windowAfter(start, tokenLen);
    let score = 0;
    // Table row: وصف (قطعة/شارع) is a strong signal
    if (new RegExp(DESC_TOKEN, "i").test(win)) score += 5;
    // Decimal immediately after description
    if (
      /قطعه?\s*رقم\s*\d+\s*[:：\-–—|/]*\s*[\d]+[.,]\d{1,3}/i.test(win) ||
      /شارع\s*عرض\s*[\d.]+\s*م?\s*[:：\-–—|/]*\s*[\d]+[.,]\d{1,3}/i.test(win)
    ) {
      score += 8;
    }
    // Explicit "طول" before a decimal
    if (/طول(?:\s*الحد)?\s*[:：]?\s*[\d]+[.,]\d{1,3}/i.test(win)) score += 3;
    // Lone decimals without table words — likely drawing edge (penalize only-decimal windows)
    if (score === 0 && /[\d]+[.,]\d{1,3}/.test(win)) score -= 2;
    // Prefer later windows when scores equal (table usually after croquis drawing)
    if (
      score > bestScore ||
      (score === bestScore && start > bestStart)
    ) {
      bestScore = score;
      bestStart = start;
      best = win;
    }
  }

  // If every window scored poorly (drawing only), return last dir mention still
  return best || windowAfter(hits[hits.length - 1]!, 4);
}

/**
 * Number of meters immediately following a plot/street description in text.
 * Requires a decimal so 225 is never taken as the edge length.
 *
 * Uses the LAST plausible pairing when the same plot appears twice
 * (طبيعة + صك) or OCR duplicates a row.
 */
function lengthAfterDescriptionInText(
  sourceText: string,
  description: string,
): string {
  const flat = normalizeSketchText(sourceText).replace(/\n+/g, " ");
  const desc = normalizeSketchText(description);
  if (!flat || !desc) return "";

  const plot = desc.match(/قطعه?\s*رقم\s*(\d+)/i);
  if (plot?.[1]) {
    const id = plot[1];
    const patterns = [
      new RegExp(
        `قطعه?\\s*رقم\\s*${id}\\s*[:：\\-–—|/]*\\s*${EDGE_LEN_TOKEN}`,
        "gi",
      ),
      // Looser OCR gap between plot id and meters (stop at next plot/dir)
      new RegExp(
        `قطعه?\\s*رقم\\s*${id}(?:(?!قطعه?\\s*رقم|${DIR_TOKEN_BY_DIR.north}|${DIR_TOKEN_BY_DIR.south}|${DIR_TOKEN_BY_DIR.east}|${DIR_TOKEN_BY_DIR.west})[\\s\\S]){0,36}?${EDGE_LEN_TOKEN}`,
        "gi",
      ),
      new RegExp(
        `رقم\\s*${id}\\s*[:：\\-–—|/]*\\s*${EDGE_LEN_TOKEN}`,
        "gi",
      ),
      new RegExp(
        `${EDGE_LEN_TOKEN}\\s*[:：\\-–—|/]*\\s*قطعه?\\s*رقم\\s*${id}\\b`,
        "gi",
      ),
    ];
    for (const re of patterns) {
      const all = [...flat.matchAll(re)];
      for (let i = all.length - 1; i >= 0; i--) {
        const hit = all[i]!;
        const raw = hit[1] ?? "";
        const len = cleanLength(String(raw).replace(",", "."));
        if (!isPlausibleEdgeLength(len, id)) continue;
        // Reject if this decimal starts a multi-length column dump (24.25 24.50 25.00 …)
        // — leave those for zipLengthColumnDecimals.
        const afterMatch = flat.slice((hit.index ?? 0) + hit[0].length);
        const cluster = afterMatch.match(
          /^(?:\s*[\d]+[.,]\d{1,3}){2,}/,
        );
        if (cluster) continue;
        return len;
      }
    }
  }

  const street = desc.match(/شارع\s*عرض\s*([\d.]+)/i);
  if (street?.[1]) {
    const w = street[1].replace(".", "\\.");
    const patterns = [
      new RegExp(
        `شارع\\s*عرض\\s*${w}\\s*م?\\s*[:：\\-–—|/]*\\s*${EDGE_LEN_TOKEN}`,
        "gi",
      ),
      new RegExp(
        `شارع\\s*عرض\\s*${w}\\s*م?(?:(?!شارع\\s*عرض|${DIR_TOKEN_BY_DIR.north}|${DIR_TOKEN_BY_DIR.south}|${DIR_TOKEN_BY_DIR.east}|${DIR_TOKEN_BY_DIR.west}|قطعه?)[\\s\\S]){0,24}?${EDGE_LEN_TOKEN}`,
        "gi",
      ),
      new RegExp(
        `${EDGE_LEN_TOKEN}\\s*[:：\\-–—|/]*\\s*شارع\\s*عرض\\s*${w}\\s*م?\\b`,
        "gi",
      ),
    ];
    for (const re of patterns) {
      const all = [...flat.matchAll(re)];
      for (let i = all.length - 1; i >= 0; i--) {
        const raw = all[i]![1] ?? "";
        const len = cleanLength(String(raw).replace(",", "."));
        if (isPlausibleEdgeLength(len, street[1])) return len;
      }
    }
  }

  return "";
}

/** Prefer the stronger side (paired desc+len beats incomplete). */
function mergePreferPairedSides(
  primary: SketchBoundaryBlock,
  secondary: SketchBoundaryBlock,
): SketchBoundaryBlock {
  const out = {
    areaSqm: primary.areaSqm || secondary.areaSqm,
    north: { ...primary.north },
    south: { ...primary.south },
    east: { ...primary.east },
    west: { ...primary.west },
  };
  for (const dir of DIR_ORDER) {
    const p = primary[dir];
    const s = secondary[dir];
    const pPaired = Boolean(p.description && p.lengthM);
    const sPaired = Boolean(s.description && s.lengthM);
    if (sPaired && !pPaired) {
      out[dir] = { ...s };
      continue;
    }
    if (!out[dir].description && s.description) {
      out[dir].description = s.description;
    }
    if (!out[dir].lengthM && s.lengthM) {
      out[dir].lengthM = s.lengthM;
    }
  }
  if (!out.areaSqm) out.areaSqm = secondary.areaSqm;
  return out;
}

/**
 * When OCR splits table into desc lines + length column, zip four edge
 * decimals (under الطول/م when possible) onto N→S→E→W.
 */
export function zipLengthColumnDecimals(
  block: SketchBoundaryBlock,
  sectionText: string,
): SketchBoundaryBlock {
  if (lengthCount(block) >= 4) return block;
  if (descriptionCount(block) < 3) return block;

  const bodies = extractBodiesAfterLengthColumnHeader(sectionText);
  const scopes = bodies.length > 0 ? bodies : [sectionText];

  const next = {
    areaSqm: block.areaSqm,
    north: { ...block.north },
    south: { ...block.south },
    east: { ...block.east },
    west: { ...block.west },
  };

  for (const scope of scopes) {
    const flat = normalizeSketchText(scope).replace(/\n+/g, " ");
    const areas = new Set<string>();
    for (const am of flat.matchAll(/المساحه?\s*[:：]?\s*([\d.,]+)/gi)) {
      const a = cleanArea(am[1] ?? "");
      if (a) areas.add(a);
    }
    let lens = [...flat.matchAll(/([\d]+[.,]\d{1,3})/g)]
      .map((m) => cleanLength((m[1] ?? "").replace(",", ".")))
      .filter(
        (len): len is string =>
          Boolean(len) &&
          isPlausibleEdgeLength(len) &&
          !areas.has(len) &&
          Number(len) >= 5 &&
          Number(len) <= 200,
      );

    const seen = new Set<string>();
    lens = lens.filter((l) => {
      if (seen.has(l)) return false;
      seen.add(l);
      return true;
    });

    let four: string[] | null = null;
    if (lens.length >= 4 && lens.length <= 5) four = lens.slice(0, 4);
    else if (lens.length >= 8) four = lens.slice(-4);
    if (!four) continue;

    let filled = 0;
    for (let i = 0; i < 4; i++) {
      const dir = DIR_ORDER[i]!;
      if (next[dir].description && !next[dir].lengthM) {
        next[dir].lengthM = four[i]!;
        filled += 1;
      }
    }
    if (filled >= 3) return next;
  }

  return next;
}

/**
 * Collect every table-like row "جهة + وصف + طول عشري" in the text.
 * Prefers later matches per direction (table body over drawing labels).
 */
export function extractDirectionalTableRows(
  sectionText: string,
): SketchBoundaryBlock {
  const block = emptyBlock();
  const flat = normalizeSketchText(sectionText).replace(/\n+/g, " ");
  if (!flat) return block;

  // Build alternation of dirs that still captures which dir matched
  for (const dir of DIR_ORDER) {
    const dirTok = DIR_TOKEN_BY_DIR[dir];
    // A) dir + وصف + طول  (authoritative)
    const reA = new RegExp(
      `${dirTok}\\s*(?:الحد)?\\s*[:：\\-–—|•·]*\\s*(${DESC_TOKEN})\\s*[:：\\-–—|/]*\\s*${EDGE_LEN_TOKEN}`,
      "gi",
    );
    const matchesA = [...flat.matchAll(reA)];
    if (matchesA.length > 0) {
      const last = matchesA[matchesA.length - 1]!;
      block[dir].description = formatDescription(last[1] ?? "");
      const len = cleanLength((last[2] ?? "").replace(",", "."));
      const plotN = (last[1] ?? "").match(/رقم\s*(\d+)/i)?.[1];
      if (isPlausibleEdgeLength(len, plotN)) block[dir].lengthM = len;
      continue;
    }

    // B) dir + وصف only — length filled later via adjacency
    const reDesc = new RegExp(
      `${dirTok}\\s*(?:الحد)?\\s*[:：\\-–—|•·]*\\s*(${DESC_TOKEN})`,
      "gi",
    );
    const matchesD = [...flat.matchAll(reDesc)];
    if (matchesD.length > 0) {
      const last = matchesD[matchesD.length - 1]!;
      block[dir].description = formatDescription(last[1] ?? "");
    }
  }

  // Rows without leading dir: "قطعة رقم 225 24.25" — bind by description
  // only when a side already has that description without length
  for (const dir of DIR_ORDER) {
    if (!block[dir].description || block[dir].lengthM) continue;
    const len = lengthAfterDescriptionInText(flat, block[dir].description);
    if (len) block[dir].lengthM = len;
  }

  return block;
}

/**
 * After descriptions exist, bind edge length from the same table row only.
 * Never uses "first decimal after شمال on the page" (that is drawing labels).
 *
 * `overwrite=true` replaces only when a stronger match is *found* —
 * never blanks an existing length (that emptied the form after a weak re-bind).
 */
export function fillMissingLengthsFromTableContext(
  block: SketchBoundaryBlock,
  sourceText: string,
  overwrite = false,
): SketchBoundaryBlock {
  const next = {
    areaSqm: block.areaSqm,
    north: { ...block.north },
    south: { ...block.south },
    east: { ...block.east },
    west: { ...block.west },
  };

  for (const dir of DIR_ORDER) {
    if (next[dir].lengthM && !overwrite) continue;
    const desc = next[dir].description;
    if (!desc) continue;

    // Prefer match inside best direction window, then full section
    const windowText = sliceTextForDirection(sourceText, dir);
    let found =
      lengthAfterDescriptionInText(windowText, desc) ||
      lengthAfterDescriptionInText(sourceText, desc);

    // Explicit "طول …" only inside a high-quality direction window (has وصف)
    if (!found && windowText && new RegExp(DESC_TOKEN, "i").test(windowText)) {
      const nWin = normalizeSketchText(windowText);
      const m = nWin.match(
        new RegExp(
          `طول(?:\\s*الحد)?\\s*[:：]?\\s*${EDGE_LEN_TOKEN}\\s*(?:م|متر)?`,
          "i",
        ),
      );
      if (m?.[1]) {
        const len = cleanLength(m[1].replace(",", "."));
        if (isPlausibleEdgeLength(len)) found = len;
      }
    }

    if (found) next[dir].lengthM = found;
  }

  return next;
}

/**
 * Strict croquis rows via global last-match + best direction windows.
 * Never takes "شمال + أول رقم على الرسم" (e.g. 24.95 west edge → north).
 */
function parseStrictDirectionalRows(sectionText: string): SketchBoundaryBlock {
  // Global table rows first (dir+وصف+طول) — most reliable for croquis tables
  let block = extractDirectionalTableRows(sectionText);

  // Fill gaps from best windows only (never pattern: dir + lone decimal first)
  for (const dir of DIR_ORDER) {
    if (block[dir].description && block[dir].lengthM) continue;
    const win = sliceTextForDirection(sectionText, dir);
    if (!win) continue;
    const flat = normalizeSketchText(win).replace(/\n+/g, " ");
    const dirTok = DIR_TOKEN_BY_DIR[dir];

    // dir + وصف + طول only (no dir+length+desc — that picks drawing edge first)
    let m = flat.match(
      new RegExp(
        `${dirTok}\\s*(?:الحد)?\\s*[:：\\-–—|•·]*\\s*(${DESC_TOKEN})\\s*[:：\\-–—|/]*\\s*${EDGE_LEN_TOKEN}`,
        "i",
      ),
    );
    if (m) {
      if (!block[dir].description) {
        block[dir].description = formatDescription(m[1] ?? "");
      }
      if (!block[dir].lengthM) {
        const len = cleanLength((m[2] ?? "").replace(",", "."));
        const plotN = (m[1] ?? "").match(/رقم\s*(\d+)/i)?.[1];
        if (isPlausibleEdgeLength(len, plotN)) block[dir].lengthM = len;
      }
      continue;
    }

    m = flat.match(
      new RegExp(
        `${dirTok}\\s*(?:الحد)?\\s*[:：\\-–—|•·]*\\s*(${DESC_TOKEN})`,
        "i",
      ),
    );
    if (m && !block[dir].description) {
      block[dir].description = formatDescription(m[1] ?? "");
    }

    // dir + … طول N.NN only when window already has table وصف
    if (
      block[dir].description ||
      new RegExp(DESC_TOKEN, "i").test(flat)
    ) {
      m = flat.match(
        new RegExp(
          `طول(?:\\s*الحد)?\\s*[:：]?\\s*${EDGE_LEN_TOKEN}\\s*(?:م|متر)?`,
          "i",
        ),
      );
      if (m?.[1] && !block[dir].lengthM) {
        const len = cleanLength(m[1].replace(",", "."));
        if (isPlausibleEdgeLength(len)) block[dir].lengthM = len;
      }
    }
  }

  return block;
}

/**
 * OCR sometimes dumps columns separately:
 *   شمال جنوب شرق غرب
 *   قطعة رقم 225 …  قطعة رقم 226
 *   24.25 24.50 25.00 24.95
 *
 * ONLY bind length when it sits next to a وصف. Never zip page-order
 * decimals (drawing labels come first: 24.95 → wrongly assigned to شمال).
 */
function parseColumnarTableBody(sectionText: string): SketchBoundaryBlock | null {
  const n = normalizeSketchText(sectionText);
  if (!n) return null;

  const dirHits: Array<{ dir: DirKey; index: number }> = [];
  for (const dir of DIR_ORDER) {
    // Prefer last dir token that is followed shortly by a table description
    const re = new RegExp(
      `${DIR_TOKEN_BY_DIR[dir]}(?=[\\s\\S]{0,80}?${DESC_TOKEN})`,
      "gi",
    );
    const all = [...n.matchAll(re)];
    if (all.length > 0) {
      const last = all[all.length - 1]!;
      if (last.index != null) dirHits.push({ dir, index: last.index });
      continue;
    }
    const m = n.match(new RegExp(DIR_TOKEN_BY_DIR[dir], "i"));
    if (m && m.index != null) dirHits.push({ dir, index: m.index });
  }
  if (dirHits.length < 4) return null;
  dirHits.sort((a, b) => a.index - b.index);
  const dirsInOrder = dirHits.map((h) => h.dir);
  if (new Set(dirsInOrder).size < 4) return null;

  // Unique descriptions in document order (first 4 distinct)
  const descsRaw = [...n.matchAll(new RegExp(DESC_TOKEN, "gi"))].map((m) =>
    formatDescription(m[0]),
  );
  const descs: string[] = [];
  for (const d of descsRaw) {
    if (!descs.includes(d)) descs.push(d);
    if (descs.length >= 4) break;
  }
  if (descs.length < 4) return null;

  const block = emptyBlock();
  let adjacencyHits = 0;

  // Pair each dir (appearance order near table) with desc + length-after-desc only
  // Standard croquis row order is N,S,E,W — if dirs sorted match that order, zip descs
  for (let i = 0; i < 4; i++) {
    const dir = dirsInOrder[i]!;
    const desc = descs[i]!;
    block[dir].description = desc;
    const afterDesc = lengthAfterDescriptionInText(n, desc);
    if (afterDesc) {
      block[dir].lengthM = afterDesc;
      adjacencyHits += 1;
    }
  }

  // If zip order may be wrong (dir order ≠ NSEW) but we have descriptions with lengths,
  // re-assign by extracting full rows only — lengths already on descs.
  // Also try: for each dir, take desc from best window
  if (adjacencyHits < 3) {
    const fromRows = extractDirectionalTableRows(sectionText);
    for (const dir of DIR_ORDER) {
      if (fromRows[dir].description) {
        block[dir].description = fromRows[dir].description;
      }
      if (fromRows[dir].lengthM) {
        block[dir].lengthM = fromRows[dir].lengthM;
        adjacencyHits = Math.max(adjacencyHits, 1);
      }
    }
  }

  // Refuse to return guessed lengths without adjacency — wrong zip is worse than empty
  if (adjacencyHits === 0) {
    // Still return descriptions only
    const lenCount = lengthCount(block);
    if (lenCount > 0) {
      for (const dir of DIR_ORDER) block[dir].lengthM = "";
    }
  }

  return descriptionCount(block) >= 3 ? block : null;
}

function mergeBlocksPreferStrict(
  primary: SketchBoundaryBlock,
  secondary: SketchBoundaryBlock | null,
): SketchBoundaryBlock {
  if (!secondary) return primary;
  const out = {
    areaSqm: primary.areaSqm || secondary.areaSqm,
    north: { ...primary.north },
    south: { ...primary.south },
    east: { ...primary.east },
    west: { ...primary.west },
  };
  for (const dir of DIR_ORDER) {
    if (!out[dir].description && secondary[dir].description) {
      out[dir].description = secondary[dir].description;
    }
    // Only take secondary length when primary missing OR primary has no paired desc
    if (!out[dir].lengthM && secondary[dir].lengthM) {
      out[dir].lengthM = secondary[dir].lengthM;
    }
  }
  if (!out.areaSqm) out.areaSqm = secondary.areaSqm;
  return out;
}

/**
 * Parse croquis table body: جهة + وصف (قطعة رقم / شارع…) + طول.
 * Preferred source: rows under column header «الطول/م».
 */
export function parseBoundaryBlock(sectionText: string): SketchBoundaryBlock {
  const areaSqm = extractArea(sectionText);

  // 1) Explicit «الطول/م» column body — ignore drawing numbers before the header
  const fromLengthCol = parseFromLengthColumnTable(sectionText);
  let block = fromLengthCol ?? emptyBlock();

  // 2) Fallbacks: strict rows / columnar (whole section)
  if (descriptionCount(block) < 3 || lengthCount(block) < 3) {
    const strict = parseStrictDirectionalRows(sectionText);
    block = mergeBlocksPreferStrict(block, strict);
  }
  if (descriptionCount(block) < 3 || lengthCount(block) < 3) {
    const col = parseColumnarTableBody(sectionText);
    if (col) block = mergeBlocksPreferStrict(block, col);
  }

  // 3) Lengths: adjacency first, then column zip.
  const lengthBodies = extractBodiesAfterLengthColumnHeader(sectionText);
  if (lengthBodies.length > 0) {
    block = fillMissingLengthsFromTableContext(
      block,
      lengthBodies.join("\n"),
      true,
    );
  }
  if (lengthCount(block) < 3) {
    block = fillMissingLengthsFromTableContext(block, sectionText, true);
  }
  block = zipLengthColumnDecimals(block, sectionText);

  // Explicit trailing 4-length column after rows (OCR common layout):
  // override any mistaken "first of the dump" assignment when all 4 descs present.
  if (descriptionCount(block) >= 4) {
    const flat = normalizeSketchText(sectionText).replace(/\n+/g, " ");
    const tail = [
      ...flat.matchAll(
        /([\d]+[.,]\d{1,3})\s+([\d]+[.,]\d{1,3})\s+([\d]+[.,]\d{1,3})\s+([\d]+[.,]\d{1,3})(?!\s*[\d]+[.,]\d)/g,
      ),
    ].pop();
    if (tail) {
      const four = [tail[1], tail[2], tail[3], tail[4]].map((x) =>
        cleanLength(String(x).replace(",", ".")),
      );
      if (
        four.every((x) => x && isPlausibleEdgeLength(x!)) &&
        new Set(four).size >= 3
      ) {
        for (let i = 0; i < 4; i++) {
          const dir = DIR_ORDER[i]!;
          if (!block[dir].description) continue;
          // Prefer trailing column when current length is missing OR equals the
          // first dump value while this side is not north (classic mis-pair).
          if (
            !block[dir].lengthM ||
            (i > 0 && block[dir].lengthM === four[0])
          ) {
            block[dir].lengthM = four[i]!;
          }
        }
      }
    }
  }

  block.areaSqm = areaSqm || block.areaSqm;

  // Line-based prose: "الحد الشمالي: … طول 25.00 م"
  const lines = sectionText
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    const dir = detectDir(line);
    if (!dir) continue;
    if (block[dir].description && block[dir].lengthM) continue;

    const nLine = normalizeSketchText(line);
    const dirTok = DIR_TOKEN_BY_DIR[dir];

    let m = nLine.match(
      new RegExp(
        `${dirTok}\\s*(?:الحد)?\\s*[:：\\-–—|]*\\s*(${DESC_TOKEN})\\s*${EDGE_LEN_TOKEN}\\s*$`,
        "i",
      ),
    );
    if (m) {
      if (!block[dir].description) {
        block[dir].description = formatDescription(m[1] ?? "");
      }
      if (!block[dir].lengthM) {
        const plotN = (m[1] ?? "").match(/(\d+)/)?.[1];
        const len = cleanLength((m[2] ?? "").replace(",", "."));
        if (isPlausibleEdgeLength(len, plotN)) block[dir].lengthM = len;
      }
      continue;
    }

    m = nLine.match(
      new RegExp(
        `${dirTok}[\\s:：\\-–—|]+(.+?)\\s*طول(?:\\s*الحد)?\\s*${EDGE_LEN_TOKEN}\\s*(?:م|متر)?\\s*$`,
        "i",
      ),
    );
    if (m) {
      const desc = formatDescription(m[1] ?? "");
      const len = cleanLength((m[2] ?? "").replace(",", "."));
      if (desc && !block[dir].description) block[dir].description = desc;
      if (isPlausibleEdgeLength(len) && !block[dir].lengthM) {
        block[dir].lengthM = len;
      }
    }
  }

  return block;
}

/**
 * Prefer tables titled بموجب الصك / بموجب الطبيعة (user croquis layout).
 */
export function parseSurveySketchText(
  rawText: string,
): SurveySketchExtractResult {
  const text = rawText.trim();
  if (!text) {
    return finalizeExtractResult(emptyBlock(), null, "", false);
  }

  const { deedText, natureText } = splitDeedNatureSections(text);
  const hasDeedHeader =
    /(?:بموجب\s*الصك|حسب\s*الصك|بيانات\s*الصك|الحدود\s*(?:والاطوال\s*)?(?:حسب\s*)?الصك)/i.test(
      text,
    );

  let deed = parseBoundaryBlock(deedText || text);
  let nature: SketchBoundaryBlock | null = natureText
    ? parseBoundaryBlock(natureText)
    : null;

  if (nature && isBlockEmpty(nature)) nature = null;

  // Never copy nature→deed when both tables exist (keeps 609 vs 606.49).
  if (isBlockEmpty(deed)) {
    const whole = parseBoundaryBlock(text);
    if (!isBlockEmpty(whole)) deed = whole;
  }

  // Nature-only document (no صك header): seed deed from nature sides.
  if (isBlockEmpty(deed) && nature && !isBlockEmpty(nature) && !hasDeedHeader) {
    deed = {
      areaSqm: nature.areaSqm,
      north: { ...nature.north },
      south: { ...nature.south },
      east: { ...nature.east },
      west: { ...nature.west },
    };
  }

  // Section-scoped length re-bind — prefer «الطول/م» body first, then full section for gaps.
  const deedBodies = extractBodiesAfterLengthColumnHeader(deedText || text);
  if (deedBodies.length > 0) {
    deed = fillMissingLengthsFromTableContext(
      deed,
      deedBodies.join("\n"),
      true,
    );
  }
  if (lengthCount(deed) < 3) {
    deed = fillMissingLengthsFromTableContext(deed, deedText || text, true);
  }
  if (nature && natureText) {
    const natureBodies = extractBodiesAfterLengthColumnHeader(natureText);
    if (natureBodies.length > 0) {
      nature = fillMissingLengthsFromTableContext(
        nature,
        natureBodies.join("\n"),
        true,
      );
    }
    if (lengthCount(nature) < 3) {
      nature = fillMissingLengthsFromTableContext(nature, natureText, true);
    }
  }

  return finalizeExtractResult(deed, nature, text, false);
}

function areasEqualLoose(a: string, b: string): boolean {
  if (!a.trim() || !b.trim()) return true; // missing area doesn't force mismatch alone
  const na = Number(a.replace(/,/g, ""));
  const nb = Number(b.replace(/,/g, ""));
  if (!Number.isFinite(na) || !Number.isFinite(nb)) return a.trim() === b.trim();
  return Math.abs(na - nb) < 0.02;
}

function sidesEqual(
  a: SketchBoundaryBlock,
  b: SketchBoundaryBlock,
): boolean {
  return DIR_ORDER.every(
    (d) =>
      a[d].description === b[d].description && a[d].lengthM === b[d].lengthM,
  );
}

function finalizeExtractResult(
  deed: SketchBoundaryBlock,
  nature: SketchBoundaryBlock | null,
  text: string,
  usedSpatialLengths: boolean,
): SurveySketchExtractResult {
  // Always retain nature when parsed — form needs it when مطابقة = لا
  // (area often 609 صك vs 606.49 طبيعة even if sides match).
  let natureOut = nature && !isBlockEmpty(nature) ? nature : null;

  let deedMatchesNature: "yes" | "no" | null = null;
  if (natureOut) {
    const sameSides = sidesEqual(deed, natureOut);
    const sameArea = areasEqualLoose(deed.areaSqm, natureOut.areaSqm);
    // UI shows nature fields only when "no" — differ on sides OR area.
    deedMatchesNature = sameSides && sameArea ? "yes" : "no";
  } else if (usedSpatialLengths && onlyLengthsFilled(deed)) {
    deedMatchesNature = "yes";
  }

  const filledCount =
    blockFilledCount(deed) + (natureOut ? blockFilledCount(natureOut) : 0);

  let warning: string | undefined;
  if (filledCount === 0) {
    warning =
      text.trim().length > 0
        ? "وُجد نص في التقرير لكن لم تُستخرج حدود/أطوال بوضوح. راجع الملف وعبّئ يدوياً."
        : "تعذّر قراءة نص من التقرير. عبّئ الحقول يدوياً.";
  } else if (hasAnyDescription(deed)) {
    warning =
      "تم استخراج أوصاف الحدود والأطوال من التقرير. راجع القيم قبل الإرسال.";
  } else if (usedSpatialLengths) {
    warning =
      "تم تقدير الأطوال من مواقع الأرقام فقط — أوصاف (قطعة رقم…) غير متاحة في طبقة النص. راجع الجهات.";
  } else {
    warning = "تم استخراج بيانات جزئية. راجع قبل الإرسال.";
  }

  return {
    rawText: text,
    hasData: filledCount > 0,
    warning,
    deedMatchesNature,
    deed,
    nature: natureOut,
    filledCount,
    usedSpatialLengths,
  };
}

/**
 * Fill empty description/area from property intake (بورصة) — never overwrites croquis.
 * Orientation-aware croquis edge lengths are kept when intake only supplies orصاف.
 */
export function mergePropertyBoundaryHints(
  result: SurveySketchExtractResult,
  hints?: SketchPropertyBoundaryHints | null,
): SurveySketchExtractResult {
  if (!hints) return result;
  const deed = {
    areaSqm: result.deed.areaSqm,
    north: { ...result.deed.north },
    south: { ...result.deed.south },
    east: { ...result.deed.east },
    west: { ...result.deed.west },
  };

  if (!deed.areaSqm.trim() && hints.areaSqm?.trim()) {
    deed.areaSqm = hints.areaSqm.trim().replace(/[^\d.,]/g, "");
  }
  const descMap: Array<[DirKey, string | undefined]> = [
    ["north", hints.northBoundary],
    ["south", hints.southBoundary],
    ["east", hints.eastBoundary],
    ["west", hints.westBoundary],
  ];
  for (const [dir, v] of descMap) {
    if (!deed[dir].description && v?.trim()) {
      deed[dir].description = v.trim();
    }
  }

  // Keep croquis edge lengths (orientation-aware spatial) even when بورصة
  // fills descriptions — clearing them left "وصف صح + طول فاضي".
  // Still prefer table/OCR lengths already on the block (never overwrite).

  // Last resort: fill still-empty lengths from property intake (only empty slots).
  const lenMap: Array<[DirKey, string | undefined]> = [
    ["north", hints.northBoundaryLengthM],
    ["south", hints.southBoundaryLengthM],
    ["east", hints.eastBoundaryLengthM],
    ["west", hints.westBoundaryLengthM],
  ];
  for (const [dir, v] of lenMap) {
    if (!deed[dir].lengthM && v?.trim()) {
      deed[dir].lengthM = cleanLength(v) || "";
    }
  }

  const filledCount =
    blockFilledCount(deed) +
    (result.nature ? blockFilledCount(result.nature) : 0);

  return {
    ...result,
    deed,
    usedSpatialLengths: result.usedSpatialLengths,
    hasData: filledCount > 0,
    filledCount,
  };
}

/**
 * Build a patch for form fields. On re-upload (`overwrite=true`), replace existing
 * boundary values so wrong spatial lengths don't stick.
 */
export function sketchExtractToEmptyFieldsPatch(
  result: SurveySketchExtractResult,
  current: {
    onSiteAreaSqm?: string;
    northBoundary?: string;
    northBoundaryLengthM?: string;
    southBoundary?: string;
    southBoundaryLengthM?: string;
    eastBoundary?: string;
    eastBoundaryLengthM?: string;
    westBoundary?: string;
    westBoundaryLengthM?: string;
    natureOnSiteAreaSqm?: string;
    natureNorthBoundary?: string;
    natureNorthBoundaryLengthM?: string;
    natureSouthBoundary?: string;
    natureSouthBoundaryLengthM?: string;
    natureEastBoundary?: string;
    natureEastBoundaryLengthM?: string;
    natureWestBoundary?: string;
    natureWestBoundaryLengthM?: string;
    deedMatchesNature?: "yes" | "no" | null;
  },
  overwrite = false,
): { patch: SurveySketchApplyPatch; appliedCount: number } {
  const patch: SurveySketchApplyPatch = {};
  let appliedCount = 0;

  const take = (
    curr: string | undefined,
    next: string | undefined,
  ): string | undefined => {
    if (!next?.trim()) return undefined;
    if (!overwrite && (curr ?? "").trim()) return undefined;
    return next.trim();
  };

  /** On re-upload, replace when extract has a value. Do not blank the field if extract length is empty. */
  const takeLength = (
    curr: string | undefined,
    next: string | undefined,
    _hasPairedDesc: boolean,
  ): string | undefined => {
    const n = next?.trim() ?? "";
    if (n) {
      if (!overwrite && (curr ?? "").trim()) return undefined;
      return n;
    }
    return undefined;
  };

  const d = result.deed;
  const set = <K extends keyof SurveySketchApplyPatch>(
    key: K,
    value: SurveySketchApplyPatch[K],
  ) => {
    if (value === undefined || value === null) return;
    // Allow empty string to clear stale lengths on overwrite
    if (value === "" && !String(key).includes("Length")) return;
    (patch as Record<string, unknown>)[key] = value;
    appliedCount += 1;
  };

  set("onSiteAreaSqm", take(current.onSiteAreaSqm, d.areaSqm));
  set("northBoundary", take(current.northBoundary, d.north.description));
  set(
    "northBoundaryLengthM",
    takeLength(
      current.northBoundaryLengthM,
      d.north.lengthM,
      Boolean(d.north.description),
    ),
  );
  set("southBoundary", take(current.southBoundary, d.south.description));
  set(
    "southBoundaryLengthM",
    takeLength(
      current.southBoundaryLengthM,
      d.south.lengthM,
      Boolean(d.south.description),
    ),
  );
  set("eastBoundary", take(current.eastBoundary, d.east.description));
  set(
    "eastBoundaryLengthM",
    takeLength(
      current.eastBoundaryLengthM,
      d.east.lengthM,
      Boolean(d.east.description),
    ),
  );
  set("westBoundary", take(current.westBoundary, d.west.description));
  set(
    "westBoundaryLengthM",
    takeLength(
      current.westBoundaryLengthM,
      d.west.lengthM,
      Boolean(d.west.description),
    ),
  );

  if (result.nature) {
    const n = result.nature;
    set("natureOnSiteAreaSqm", take(current.natureOnSiteAreaSqm, n.areaSqm));
    set(
      "natureNorthBoundary",
      take(current.natureNorthBoundary, n.north.description),
    );
    set(
      "natureNorthBoundaryLengthM",
      takeLength(
        current.natureNorthBoundaryLengthM,
        n.north.lengthM,
        Boolean(n.north.description),
      ),
    );
    set(
      "natureSouthBoundary",
      take(current.natureSouthBoundary, n.south.description),
    );
    set(
      "natureSouthBoundaryLengthM",
      takeLength(
        current.natureSouthBoundaryLengthM,
        n.south.lengthM,
        Boolean(n.south.description),
      ),
    );
    set(
      "natureEastBoundary",
      take(current.natureEastBoundary, n.east.description),
    );
    set(
      "natureEastBoundaryLengthM",
      takeLength(
        current.natureEastBoundaryLengthM,
        n.east.lengthM,
        Boolean(n.east.description),
      ),
    );
    set(
      "natureWestBoundary",
      take(current.natureWestBoundary, n.west.description),
    );
    set(
      "natureWestBoundaryLengthM",
      takeLength(
        current.natureWestBoundaryLengthM,
        n.west.lengthM,
        Boolean(n.west.description),
      ),
    );
  }

  if (
    result.deedMatchesNature &&
    (overwrite ||
      current.deedMatchesNature == null ||
      current.deedMatchesNature === undefined)
  ) {
    patch.deedMatchesNature = result.deedMatchesNature;
    appliedCount += 1;
  }

  return { patch, appliedCount };
}

/**
 * Nature (حسب الطبيعة) fields from croquis extract.
 * Prefers the nature table when present; otherwise seeds orصاف/أطوال
 * from the deed block (common when red/blue edges share lengths).
 * Never copies deed area onto nature — areas often differ (609 vs 606.49).
 */
export function sketchNatureFieldsFromExtract(
  result: SurveySketchExtractResult,
  deedFormFallback?: {
    onSiteAreaSqm?: string;
    northBoundary?: string;
    northBoundaryLengthM?: string;
    southBoundary?: string;
    southBoundaryLengthM?: string;
    eastBoundary?: string;
    eastBoundaryLengthM?: string;
    westBoundary?: string;
    westBoundaryLengthM?: string;
  } | null,
): SurveySketchApplyPatch {
  const n = result.nature;
  const d = result.deed;
  const side = (
    fromNature: SketchBoundarySide | undefined,
    fromDeed: SketchBoundarySide,
    formDesc?: string,
    formLen?: string,
  ): SketchBoundarySide => ({
    description:
      fromNature?.description?.trim() ||
      fromDeed.description?.trim() ||
      formDesc?.trim() ||
      "",
    lengthM:
      fromNature?.lengthM?.trim() ||
      fromDeed.lengthM?.trim() ||
      cleanLength(formLen ?? "") ||
      "",
  });

  const north = side(
    n?.north,
    d.north,
    deedFormFallback?.northBoundary,
    deedFormFallback?.northBoundaryLengthM,
  );
  const south = side(
    n?.south,
    d.south,
    deedFormFallback?.southBoundary,
    deedFormFallback?.southBoundaryLengthM,
  );
  const east = side(
    n?.east,
    d.east,
    deedFormFallback?.eastBoundary,
    deedFormFallback?.eastBoundaryLengthM,
  );
  const west = side(
    n?.west,
    d.west,
    deedFormFallback?.westBoundary,
    deedFormFallback?.westBoundaryLengthM,
  );

  // Prefer nature table / حسابي / OCR / geometric estimate vs صك (609 → 606.xx)
  const areaSqm =
    resolveNatureAreaSqm(result, deedFormFallback?.onSiteAreaSqm, {
      northBoundaryLengthM:
        deedFormFallback?.northBoundaryLengthM || north.lengthM,
      southBoundaryLengthM:
        deedFormFallback?.southBoundaryLengthM || south.lengthM,
      eastBoundaryLengthM:
        deedFormFallback?.eastBoundaryLengthM || east.lengthM,
      westBoundaryLengthM:
        deedFormFallback?.westBoundaryLengthM || west.lengthM,
    }) || "";

  return {
    natureOnSiteAreaSqm: areaSqm || undefined,
    natureNorthBoundary: north.description || undefined,
    natureNorthBoundaryLengthM: north.lengthM || undefined,
    natureSouthBoundary: south.description || undefined,
    natureSouthBoundaryLengthM: south.lengthM || undefined,
    natureEastBoundary: east.description || undefined,
    natureEastBoundaryLengthM: east.lengthM || undefined,
    natureWestBoundary: west.description || undefined,
    natureWestBoundaryLengthM: west.lengthM || undefined,
  };
}

/** Mirror croquis «حسب الصك» form values into nature fields (no extract in hand). */
export function sketchNatureFieldsFromDeedForm(fields: {
  northBoundary?: string;
  northBoundaryLengthM?: string;
  southBoundary?: string;
  southBoundaryLengthM?: string;
  eastBoundary?: string;
  eastBoundaryLengthM?: string;
  westBoundary?: string;
  westBoundaryLengthM?: string;
}): SurveySketchApplyPatch {
  const take = (v?: string) => (v?.trim() ? v.trim() : undefined);
  return {
    natureNorthBoundary: take(fields.northBoundary),
    natureNorthBoundaryLengthM:
      cleanLength(fields.northBoundaryLengthM ?? "") || undefined,
    natureSouthBoundary: take(fields.southBoundary),
    natureSouthBoundaryLengthM:
      cleanLength(fields.southBoundaryLengthM ?? "") || undefined,
    natureEastBoundary: take(fields.eastBoundary),
    natureEastBoundaryLengthM:
      cleanLength(fields.eastBoundaryLengthM ?? "") || undefined,
    natureWestBoundary: take(fields.westBoundary),
    natureWestBoundaryLengthM:
      cleanLength(fields.westBoundaryLengthM ?? "") || undefined,
  };
}

/**
 * Pick a second croquis area (طبيعة / حسابيا) different from deed.
 * e.g. المساحه 609 + المساحه 606.49 حسابيا → 606.49
 * Also scans bare decimals when labels are image-OCR soup.
 */
export function extractSecondaryNatureArea(
  sourceText: string,
  deedArea: string,
  edgeLengths: string[] = [],
): string {
  const n = normalizeSketchText(sourceText);
  if (!n) return "";
  const areas: Array<{ value: string; tag: string }> = [];
  for (const m of n.matchAll(new RegExp(AREA_LABEL_RE.source, "gi"))) {
    const a = cleanArea(m[1] ?? "");
    if (!a || Number(a) < 10) continue;
    areas.push({ value: a, tag: normalizeSketchText(m[2] ?? "") });
  }
  const deedN = cleanArea(deedArea);
  const edges = new Set(
    edgeLengths.map((x) => cleanLength(x) || x).filter(Boolean),
  );

  // Prefer explicitly حسابي / nature-tagged
  for (const a of areas) {
    if (
      (a.tag.includes("حساب") || a.tag.includes("طبيع")) &&
      a.value !== deedN
    ) {
      return a.value;
    }
  }
  // Labeled areas different from deed
  for (const a of areas) {
    if (deedN && a.value === deedN) continue;
    if (Math.abs(Number(a.value) - Number(deedN || "0")) >= 0.01) {
      return a.value;
    }
  }

  // OCR / bare numbers: 606.49 vs 609 (skip known edge meters)
  const loose = collectPlausibleAreaCandidates(n, edges, deedN);
  return pickNatureAreaFromCandidates(loose, deedN);
}

/** Area-like numbers found loosely (OCR digits or unlabeled). */
export function collectPlausibleAreaCandidates(
  sourceText: string,
  edgeLengths: Set<string> | string[] = [],
  deedArea = "",
): string[] {
  const edges =
    edgeLengths instanceof Set
      ? edgeLengths
      : new Set(edgeLengths.map((x) => cleanLength(x) || x).filter(Boolean));
  void deedArea;
  const n = normalizeSketchText(sourceText);
  // Parcel plot ids (قطعة رقم 225) must not become «مساحة»
  const plotIds = new Set(
    [...n.matchAll(/(?:قطعه?|رقم)\s*(\d{2,5})\b/gi)].map((m) => m[1]!),
  );
  const out: string[] = [];
  const push = (raw: string) => {
    const a = cleanArea(String(raw).replace(",", "."));
    if (!a) return;
    const v = Number(a);
    // Edge metres usually < ~120; plot areas typically ≥ 80 م²
    if (!(v >= 80 && v <= 200_000)) return;
    if (edges.has(a)) return;
    // Integer plot ids without decimal
    if (
      !a.includes(".") &&
      (plotIds.has(a) || plotIds.has(String(Math.trunc(v))))
    ) {
      return;
    }
    // Bare 3-digit ints under 500 are almost always رقم قطعة, not area
    if (!a.includes(".") && Number.isInteger(v) && v < 500) return;
    if (!out.includes(a)) out.push(a);
  };
  for (const m of n.matchAll(new RegExp(AREA_LABEL_RE.source, "gi"))) {
    push(m[1] ?? "");
  }
  for (const m of n.matchAll(/(?<![\d])(\d{2,5}[.,]\d{1,3})(?![\d])/g)) {
    push(m[1] ?? "");
  }
  for (const m of n.matchAll(/(?<![\d])(\d{3,6})(?![\d.,])/g)) {
    push(m[1] ?? "");
  }
  return out;
}

/**
 * From [609, 606.49] pair: smaller (or non-deed) → nature area.
 */
export function pickNatureAreaFromCandidates(
  candidates: string[],
  deedArea: string,
): string {
  if (candidates.length === 0) return "";
  const deedN = cleanArea(deedArea);
  let nums = candidates
    .map((c) => ({ raw: c, v: Number(c) }))
    .filter((x) => Number.isFinite(x.v));
  if (nums.length === 0) return "";

  // Prefer decimals (606.49, 609.00) over bare integers
  const decimals = nums.filter((x) => x.raw.includes("."));
  if (decimals.length > 0) nums = decimals;

  // Explicit different from deed
  const diff = nums.filter(
    (x) => !deedN || Math.abs(x.v - Number(deedN)) >= 0.02,
  );
  if (diff.length === 1) return diff[0]!.raw;

  if (diff.length >= 2) {
    // Croquis pattern: صك larger (609), طبيعة/حسابي smaller (606.49)
    // Prefer the value closest under the deed when deed known
    if (deedN) {
      const under = diff
        .filter((x) => x.v < Number(deedN))
        .sort((a, b) => b.v - a.v);
      if (under.length > 0) return under[0]!.raw;
    }
    diff.sort((a, b) => a.v - b.v);
    return diff[0]!.raw;
  }

  // Only deed-like values found
  if (deedN) return "";
  nums.sort((a, b) => a.v - b.v);
  return nums[0]!.raw;
}

/**
 * Resolve nature المساحة from extract + form deed area + OCR/raw soup.
 * Falls back to geometric estimate from the four side lengths (+ edge angle).
 */
export function resolveNatureAreaSqm(
  result: SurveySketchExtractResult,
  deedFormArea?: string,
  formLengths?: {
    northBoundaryLengthM?: string;
    southBoundaryLengthM?: string;
    eastBoundaryLengthM?: string;
    westBoundaryLengthM?: string;
  },
): string {
  const deedArea =
    cleanArea(result.deed.areaSqm) || cleanArea(deedFormArea ?? "") || "";
  if (result.nature?.areaSqm?.trim()) {
    const na = cleanArea(result.nature.areaSqm);
    if (na && (!deedArea || Math.abs(Number(na) - Number(deedArea)) >= 0.01)) {
      return na;
    }
    if (na && !deedArea) return na;
  }

  if (result.estimatedNatureAreaSqm?.trim()) {
    const est = cleanArea(result.estimatedNatureAreaSqm);
    if (est && (!deedArea || Math.abs(Number(est) - Number(deedArea)) >= 0.01)) {
      return est;
    }
  }

  const edges = DIR_ORDER.map((d) => result.deed[d].lengthM).filter(Boolean);
  const sources = [result.rawText || "", result.nature?.areaSqm || ""]
    .filter(Boolean)
    .join("\n");

  const fromLabels = extractSecondaryNatureArea(sources, deedArea, edges);
  if (fromLabels) return fromLabels;

  const candidates = collectPlausibleAreaCandidates(sources, edges, deedArea);
  const fromLoose = pickNatureAreaFromCandidates(candidates, deedArea);
  if (fromLoose) return fromLoose;

  // Geometric estimate from croquis edge lengths (image-only table PDFs)
  const nLen =
    result.deed.north.lengthM || formLengths?.northBoundaryLengthM || "";
  const sLen =
    result.deed.south.lengthM || formLengths?.southBoundaryLengthM || "";
  const eLen =
    result.deed.east.lengthM || formLengths?.eastBoundaryLengthM || "";
  const wLen =
    result.deed.west.lengthM || formLengths?.westBoundaryLengthM || "";
  const est = estimateAreaSqmFromBoundaryLengths(
    nLen,
    sLen,
    eLen,
    wLen,
    result.edgeAngleBetweenRad,
  );
  if (est && (!deedArea || Math.abs(Number(est) - Number(deedArea)) >= 0.05)) {
    return est;
  }
  return est || "";
}

/**
 * Approx plot area (م²) from four sides as a parallelogram:
 * ½·(شمال×شرق + جنوب×غرب)·sin(زاوية بين اتجاهي الأضلاع).
 * When edge angle unknown, uses mean of product pairs (≈ rectangle).
 */
export function estimateAreaSqmFromBoundaryLengths(
  northM: string,
  southM: string,
  eastM: string,
  westM: string,
  angleBetweenEdgesRad?: number | null,
): string {
  const N = Number(cleanLength(northM) || "");
  const S = Number(cleanLength(southM) || "");
  const E = Number(cleanLength(eastM) || "");
  const W = Number(cleanLength(westM) || "");
  if (![N, S, E, W].every((x) => Number.isFinite(x) && x >= 1 && x <= 800)) {
    return "";
  }
  let sinA = 1;
  if (
    angleBetweenEdgesRad != null &&
    Number.isFinite(angleBetweenEdgesRad)
  ) {
    let a = Math.abs(angleBetweenEdgesRad);
    while (a > Math.PI) a -= Math.PI;
    const s1 = Math.abs(Math.sin(a));
    const s2 = Math.abs(Math.sin(Math.PI - a));
    sinA = Math.max(s1, s2);
    if (sinA < 0.15) sinA = 1;
  }
  const area = 0.5 * (N * E + S * W) * sinA;
  if (!(area >= 20 && area <= 500_000)) return "";
  return (Math.round(area * 100) / 100).toFixed(2);
}

/**
 * Apply nature patch into form current values — only empty slots unless overwrite.
 */
export function applyNatureSketchPatch(
  naturePatch: SurveySketchApplyPatch,
  current: {
    natureOnSiteAreaSqm?: string;
    natureNorthBoundary?: string;
    natureNorthBoundaryLengthM?: string;
    natureSouthBoundary?: string;
    natureSouthBoundaryLengthM?: string;
    natureEastBoundary?: string;
    natureEastBoundaryLengthM?: string;
    natureWestBoundary?: string;
    natureWestBoundaryLengthM?: string;
  },
  overwrite = false,
): { patch: SurveySketchApplyPatch; appliedCount: number } {
  const keys: Array<keyof SurveySketchApplyPatch> = [
    "natureOnSiteAreaSqm",
    "natureNorthBoundary",
    "natureNorthBoundaryLengthM",
    "natureSouthBoundary",
    "natureSouthBoundaryLengthM",
    "natureEastBoundary",
    "natureEastBoundaryLengthM",
    "natureWestBoundary",
    "natureWestBoundaryLengthM",
  ];
  const patch: SurveySketchApplyPatch = {};
  let appliedCount = 0;
  for (const key of keys) {
    const next = naturePatch[key];
    if (typeof next !== "string" || !next.trim()) continue;
    const curr = (current as Record<string, string | undefined>)[key] ?? "";
    if (!overwrite && curr.trim()) continue;
    (patch as Record<string, string>)[key] = next.trim();
    appliedCount += 1;
  }
  return { patch, appliedCount };
}

/* ---------- spatial lengths from croquis edge labels ---------- */

type LengthLabel = {
  lengthM: string;
  value: number;
  x: number;
  y: number;
  a: number;
  b: number;
};

type SideCluster = {
  x: number;
  y: number;
  values: string[];
  a: number;
  b: number;
};

function labelMidpoint(it: SketchPdfTextItem): { x: number; y: number } {
  const a = it.a ?? 0;
  const b = it.b ?? 0;
  const w = it.width ?? 0;
  const h = Math.hypot(a, b);
  if (h > 0.001 && w > 0) {
    return {
      x: it.x + (a / h) * (w / 2),
      y: it.y + (b / h) * (w / 2),
    };
  }
  return { x: it.x, y: it.y };
}

export function collectPositionedLengthLabels(
  items: SketchPdfTextItem[],
): LengthLabel[] {
  const out: LengthLabel[] = [];
  for (const it of items) {
    const str = (it.str ?? "").trim().replace(/,/g, "");
    if (!/^\d{1,3}(\.\d{1,4})?$/.test(str)) continue;
    const value = Number(str);
    if (!(value >= 2 && value <= 900)) continue;
    const mid = labelMidpoint(it);
    out.push({
      lengthM: cleanLength(str) || str,
      value,
      x: mid.x,
      y: mid.y,
      // PDF text matrix x-axis of the glyph run (direction along the edge)
      a: typeof it.a === "number" ? it.a : 1,
      b: typeof it.b === "number" ? it.b : 0,
    });
  }
  return out;
}

function clusterLengthLabels(
  labels: LengthLabel[],
  distTol = 42,
): SideCluster[] {
  if (labels.length === 0) return [];
  const used = new Set<number>();
  const clusters: SideCluster[] = [];

  for (let i = 0; i < labels.length; i++) {
    if (used.has(i)) continue;
    const members = [labels[i]!];
    used.add(i);
    let changed = true;
    while (changed) {
      changed = false;
      for (let j = 0; j < labels.length; j++) {
        if (used.has(j)) continue;
        const cand = labels[j]!;
        if (
          members.some(
            (m) => Math.hypot(m.x - cand.x, m.y - cand.y) <= distTol,
          )
        ) {
          members.push(cand);
          used.add(j);
          changed = true;
        }
      }
    }
    clusters.push({
      x: members.reduce((s, m) => s + m.x, 0) / members.length,
      y: members.reduce((s, m) => s + m.y, 0) / members.length,
      a: members.reduce((s, m) => s + m.a, 0) / members.length,
      b: members.reduce((s, m) => s + m.b, 0) / members.length,
      values: [
        ...new Set(
          members.map((m) => m.lengthM).sort((a, b) => Number(a) - Number(b)),
        ),
      ],
    });
  }
  return clusters;
}

/** Undirected angle gap (parallel edges share orientation, not direction). */
function parallelAngleGap(a1: number, a2: number): number {
  let d = Math.abs(a1 - a2) % (Math.PI * 2);
  if (d > Math.PI) d = Math.PI * 2 - d;
  if (d > Math.PI / 2) d = Math.PI - d;
  return d;
}

function clusterTextAngle(c: SideCluster): number {
  return Math.atan2(c.b, c.a === 0 && c.b === 0 ? 1 : c.a);
}

function pickFourClusters(clusters: SideCluster[]): SideCluster[] | null {
  if (clusters.length < 4) return null;
  if (clusters.length === 4) return [...clusters];
  const cx = clusters.reduce((s, c) => s + c.x, 0) / clusters.length;
  const cy = clusters.reduce((s, c) => s + c.y, 0) / clusters.length;
  return [...clusters]
    .sort(
      (a, b) =>
        Math.hypot(b.x - cx, b.y - cy) - Math.hypot(a.x - cx, a.y - cy),
    )
    .slice(0, 4);
}

/**
 * Pair 4 edge labels into opposite sides by matching text-run orientation
 * (parallel sides share the same glyph angle). Then map:
 *  - N/S pair: higher page-Y → شمال, lower → جنوب
 *  - E/W pair: higher page-X → شرق, lower → غرب
 *
 * Which pair is N/S vs E/W: the pair with larger average PDF transform `a`
 * (N/S edge labels on typical croquis PDF exports). Fallback pure Y/X.
 */
export function assignClustersToCardinal(clusters: SideCluster[]): {
  deed: SketchBoundaryBlock;
  nature: SketchBoundaryBlock | null;
  edgeAngleBetweenRad?: number;
  estimatedNatureAreaSqm?: string;
} | null {
  const picks = pickFourClusters(clusters);
  if (!picks || picks.length !== 4) return null;

  const angles = picks.map(clusterTextAngle);
  const partitions: Array<[[number, number], [number, number]]> = [
    [
      [0, 1],
      [2, 3],
    ],
    [
      [0, 2],
      [1, 3],
    ],
    [
      [0, 3],
      [1, 2],
    ],
  ];

  let bestPart: [[number, number], [number, number]] | null = null;
  let bestCost = Infinity;
  for (const part of partitions) {
    const cost =
      parallelAngleGap(angles[part[0][0]]!, angles[part[0][1]]!) +
      parallelAngleGap(angles[part[1][0]]!, angles[part[1][1]]!);
    if (cost < bestCost) {
      bestCost = cost;
      bestPart = part;
    }
  }

  const avgA = (i: number, j: number) => (picks[i]!.a + picks[j]!.a) / 2;

  let north: SideCluster;
  let south: SideCluster;
  let east: SideCluster;
  let west: SideCluster;
  let edgeAngleBetweenRad: number | undefined;

  // Parallel pairs only trusted when within ~28° aggregate (two gaps sum).
  if (bestPart && bestCost <= (28 * Math.PI) / 180) {
    const p0 = bestPart[0];
    const p1 = bestPart[1];
    const pair0: [SideCluster, SideCluster] = [picks[p0[0]]!, picks[p0[1]]!];
    const pair1: [SideCluster, SideCluster] = [picks[p1[0]]!, picks[p1[1]]!];

    // Larger mean `a` → N/S pair (verified on real croquis edge text matrices).
    const a0 = avgA(p0[0], p0[1]);
    const a1 = avgA(p1[0], p1[1]);
    const nsPair = a0 >= a1 ? pair0 : pair1;
    const ewPair = a0 >= a1 ? pair1 : pair0;

    north = nsPair[0].y >= nsPair[1].y ? nsPair[0] : nsPair[1];
    south = nsPair[0].y >= nsPair[1].y ? nsPair[1] : nsPair[0];
    east = ewPair[0].x >= ewPair[1].x ? ewPair[0] : ewPair[1];
    west = ewPair[0].x >= ewPair[1].x ? ewPair[1] : ewPair[0];

    // Angle between the two edge-orientation classes (N/S dir vs E/W dir)
    const angNs = Math.atan2(
      (nsPair[0].b + nsPair[1].b) / 2,
      (nsPair[0].a + nsPair[1].a) / 2 || 1e-9,
    );
    const angEw = Math.atan2(
      (ewPair[0].b + ewPair[1].b) / 2,
      (ewPair[0].a + ewPair[1].a) / 2 || 1e-9,
    );
    edgeAngleBetweenRad = Math.abs(angNs - angEw);
  } else {
    // No reliable edge orientation — fall back to page axes.
    const byYDesc = [...picks].sort((a, b) => b.y - a.y);
    const byYAsc = [...picks].sort((a, b) => a.y - b.y);
    north = byYDesc[0]!;
    south = byYAsc[0]!;
    const remaining = picks.filter((c) => c !== north && c !== south);
    if (remaining.length !== 2) return null;
    remaining.sort((a, b) => b.x - a.x);
    east = remaining[0]!;
    west = remaining[1]!;
  }

  // Distinct physical clusters only
  if (new Set([north, south, east, west]).size !== 4) return null;

  const deed = emptyBlock();
  const sides: Array<[DirKey, SideCluster]> = [
    ["north", north],
    ["south", south],
    ["east", east],
    ["west", west],
  ];
  for (const [dir, cluster] of sides) {
    deed[dir].lengthM = cluster.values[0] ?? "";
  }

  const estimatedNatureAreaSqm = estimateAreaSqmFromBoundaryLengths(
    deed.north.lengthM,
    deed.south.lengthM,
    deed.east.lengthM,
    deed.west.lengthM,
    edgeAngleBetweenRad,
  );

  return {
    deed,
    nature: null,
    edgeAngleBetweenRad,
    estimatedNatureAreaSqm: estimatedNatureAreaSqm || undefined,
  };
}

export function parseLengthsFromPositions(items: SketchPdfTextItem[]): {
  deed: SketchBoundaryBlock;
  nature: SketchBoundaryBlock | null;
  raw: string;
  edgeAngleBetweenRad?: number;
  estimatedNatureAreaSqm?: string;
} | null {
  const labels = collectPositionedLengthLabels(items);
  if (labels.length < 4) return null;
  let clusters = clusterLengthLabels(labels, 42);
  if (clusters.length < 4) {
    // One cluster per unique length (deed+nature duplicates of the same edge)
    const byVal = new Map<string, LengthLabel[]>();
    for (const l of labels) {
      const list = byVal.get(l.lengthM) ?? [];
      list.push(l);
      byVal.set(l.lengthM, list);
    }
    clusters = [...byVal.entries()].map(([, group]) => ({
      x: group.reduce((s, g) => s + g.x, 0) / group.length,
      y: group.reduce((s, g) => s + g.y, 0) / group.length,
      a: group.reduce((s, g) => s + g.a, 0) / group.length,
      b: group.reduce((s, g) => s + g.b, 0) / group.length,
      values: [group[0]!.lengthM],
    }));
  }
  const assigned = assignClustersToCardinal(clusters);
  if (!assigned) return null;
  return {
    deed: assigned.deed,
    nature: assigned.nature,
    raw: labels.map((l) => l.lengthM).join(" "),
    edgeAngleBetweenRad: assigned.edgeAngleBetweenRad,
    estimatedNatureAreaSqm: assigned.estimatedNatureAreaSqm,
  };
}

function textFromPdfItems(items: SketchPdfTextItem[]): string {
  type RowItem = { str: string; x: number; y: number };
  const rows: RowItem[] = [];
  for (const it of items) {
    const str = (it.str ?? "").trim();
    if (!str) continue;
    rows.push({ str, x: it.x, y: it.y });
  }
  if (rows.length === 0) return "";
  const yTol = 4;
  rows.sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: RowItem[][] = [];
  for (const item of rows) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last[0]!.y - item.y) <= yTol) last.push(item);
    else lines.push([item]);
  }
  return lines
    .map((line) => {
      line.sort((a, b) => a.x - b.x);
      return line.map((i) => i.str).join(" ");
    })
    .join("\n");
}

function itemsFromPdfContent(
  items: Array<{ str?: string; transform?: number[]; width?: number }>,
): SketchPdfTextItem[] {
  const out: SketchPdfTextItem[] = [];
  for (const it of items) {
    const str = (it.str ?? "").trim();
    if (!str) continue;
    const t = it.transform;
    out.push({
      str,
      x: t?.[4] ?? 0,
      y: t?.[5] ?? 0,
      a: t?.[0],
      b: t?.[1],
      width: typeof it.width === "number" ? it.width : undefined,
    });
  }
  return out;
}

/**
 * Render PDF pages and OCR Arabic+English tables (وصف الحد + مساحات).
 * Also runs a digit-focused pass on the lower half (جداول المساحة).
 */
export async function ocrSurveySketchPdf(file: File): Promise<string> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return "";
  }
  try {
    const pdfjs = await loadPdfJs();
    const data = new Uint8Array(await file.arrayBuffer());
    const pdf = await pdfjs.getDocument({ data }).promise;
    const pageCount = Math.min(pdf.numPages, 2);
    const parts: string[] = [];

    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("ara+eng");

    try {
      for (let i = 1; i <= pageCount; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2.4 });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          page.cleanup();
          continue;
        }
        await page.render({
          canvas,
          canvasContext: ctx,
          viewport,
        }).promise;

        const {
          data: { text },
        } = await worker.recognize(canvas);
        if (text?.trim()) parts.push(text.trim());

        // Digit/area pass on lower portion (بموجب الطبيعة/الصك area rows)
        try {
          const y0 = Math.floor(canvas.height * 0.52);
          const h = canvas.height - y0;
          if (h > 40) {
            const crop = document.createElement("canvas");
            crop.width = canvas.width;
            crop.height = h;
            const cctx = crop.getContext("2d");
            if (cctx) {
              cctx.fillStyle = "#fff";
              cctx.fillRect(0, 0, crop.width, crop.height);
              cctx.drawImage(
                canvas,
                0,
                y0,
                canvas.width,
                h,
                0,
                0,
                crop.width,
                h,
              );
              // Boost contrast for purple/red table ink
              const img = cctx.getImageData(0, 0, crop.width, crop.height);
              const d = img.data;
              for (let p = 0; p < d.length; p += 4) {
                const g =
                  0.3 * d[p]! + 0.59 * d[p + 1]! + 0.11 * d[p + 2]!;
                const v = g < 160 ? 0 : 255;
                d[p] = d[p + 1] = d[p + 2] = v;
              }
              cctx.putImageData(img, 0, 0);
              await worker.setParameters({
                tessedit_char_whitelist: "0123456789., ",
              });
              const {
                data: { text: digits },
              } = await worker.recognize(crop);
              await worker.setParameters({ tessedit_char_whitelist: "" });
              if (digits?.trim()) {
                parts.push(`AREA_DIGITS\n${digits.trim()}`);
              }
            }
          }
        } catch {
          // Digits pass is best-effort
        }

        page.cleanup();
      }
    } finally {
      await worker.terminate();
    }

    await pdf.cleanup();
    return parts.join("\n\n");
  } catch {
    return "";
  }
}

/**
 * Extract + parse a survey sketch PDF File.
 *
 * Priority:
 * 1) Labeled text / OCR under «الطول/م» (وصف + طول per side).
 * 2) Orientation-aware edge lengths from PDF text matrices (even if orصاف
 *    already came from OCR/بورصة) to fill missing طول fields only.
 * 3) Property-intake: empty descriptions (+ area); lengths only for still-empty slots.
 */
export async function extractSurveySketchFromPdf(
  file: File,
  propertyHints?: SketchPropertyBoundaryHints | null,
): Promise<SurveySketchExtractResult> {
  if (typeof window === "undefined") {
    return {
      rawText: "",
      hasData: false,
      warning: "الاستخراج متاح في المتصفح فقط.",
      deedMatchesNature: null,
      deed: emptyBlock(),
      nature: null,
      filledCount: 0,
    };
  }

  try {
    const pdfjs = await loadPdfJs();
    const data = new Uint8Array(await file.arrayBuffer());
    const pdf = await pdfjs.getDocument({ data }).promise;
    const pageCount = Math.min(pdf.numPages, 4);
    const allPos: SketchPdfTextItem[] = [];
    const textParts: string[] = [];

    for (let i = 1; i <= pageCount; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const rawItems = content.items as Array<{
        str?: string;
        transform?: number[];
        width?: number;
      }>;
      const pageItems = itemsFromPdfContent(rawItems);
      allPos.push(...pageItems);
      const pageText = textFromPdfItems(pageItems);
      if (pageText.trim()) textParts.push(pageText);
      page.cleanup();
    }
    await pdf.cleanup();

    const joinedText = textParts.join("\n\n");
    let result = parseSurveySketchText(joinedText);
    // Combined text for length binding (PDF text + OCR). Always prefer OCR body
    // for croquis tables even when graphics-only.
    let tableSource = joinedText;

    // Always OCR when lengths not fully paired — table is often image-only.
    // Also OCR when we have zero paired rows (descriptions alone don't count).
    const needsOcr =
      !isTableQuality(result) ||
      DIR_ORDER.filter(
        (d) => result.deed[d].description && result.deed[d].lengthM,
      ).length < 3;

    if (needsOcr) {
      const ocrText = await ocrSurveySketchPdf(file);
      if (ocrText.trim()) {
        tableSource = [joinedText, ocrText].filter(Boolean).join("\n\n");
        const fromOcr = parseSurveySketchText(ocrText);
        // Merge best sides — never discard OCR lengths because desc count alone
        // looked "enough" on a weaker base result.
        result = {
          ...fromOcr,
          deed: mergePreferPairedSides(result.deed, fromOcr.deed),
          nature:
            fromOcr.nature || result.nature
              ? mergePreferPairedSides(
                  result.nature ?? emptyBlock(),
                  fromOcr.nature ?? emptyBlock(),
                )
              : null,
          rawText: tableSource,
          warning:
            fromOcr.warning ??
            result.warning ??
            "تم استخراج أوصاف الحدود والأطوال من جداول الكروكي. راجع القيم قبل الإرسال.",
        };
        if (result.nature && isBlockEmpty(result.nature)) {
          result = { ...result, nature: null };
        }
        // Re-finalize counts / match flag after merge
        result = finalizeExtractResult(
          result.deed,
          result.nature,
          tableSource,
          false,
        );
      }
    }

    // Re-bind lengths: body under الطول/م → full combined text → column zip
    {
      const source = tableSource || result.rawText || joinedText;
      const { deedText, natureText } = splitDeedNatureSections(source);
      let deed = result.deed;
      let nature = result.nature;

      const rebind = (
        block: SketchBoundaryBlock,
        section: string,
      ): SketchBoundaryBlock => {
        let b = block;
        const bodies = extractBodiesAfterLengthColumnHeader(section);
        if (bodies.length > 0) {
          b = fillMissingLengthsFromTableContext(b, bodies.join("\n"), true);
        }
        if (lengthCount(b) < 3) {
          b = fillMissingLengthsFromTableContext(b, section, true);
        }
        if (lengthCount(b) < 3) {
          // Whole OCR+PDF dump: plot id → nearby decimal
          b = fillMissingLengthsFromTableContext(b, source, true);
        }
        if (lengthCount(b) < 3) {
          b = zipLengthColumnDecimals(b, section);
        }
        if (lengthCount(b) < 3) {
          b = zipLengthColumnDecimals(b, source);
        }
        return b;
      };

      deed = rebind(deed, deedText || source);
      if (nature) {
        nature = rebind(nature, natureText || source);
      }
      result = finalizeExtractResult(
        deed,
        nature,
        result.rawText || joinedText,
        false,
      );
    }

    // Edge lengths from text matrices (+ geometric nature-area estimate).
    // Always run when edge number labels exist — even if text already filled lengths
    // (so we still get edgeAngleBetweenRad for طبيعة area estimate).
    {
      const spatial = parseLengthsFromPositions(allPos);
      if (spatial) {
        let filledSpatial = 0;
        for (const d of DIR_ORDER) {
          if (!result.deed[d].lengthM && spatial.deed[d].lengthM) {
            result.deed[d].lengthM = spatial.deed[d].lengthM;
            filledSpatial += 1;
          }
        }
        if (filledSpatial > 0) {
          result = finalizeExtractResult(
            result.deed,
            result.nature,
            result.rawText || joinedText || spatial.raw,
            true,
          );
        }
        const angle =
          spatial.edgeAngleBetweenRad ?? result.edgeAngleBetweenRad;
        const estArea =
          spatial.estimatedNatureAreaSqm ||
          estimateAreaSqmFromBoundaryLengths(
            result.deed.north.lengthM,
            result.deed.south.lengthM,
            result.deed.east.lengthM,
            result.deed.west.lengthM,
            angle,
          ) ||
          result.estimatedNatureAreaSqm;
        result = {
          ...result,
          edgeAngleBetweenRad: angle,
          estimatedNatureAreaSqm: estArea || undefined,
        };
      } else if (lengthCount(result.deed) >= 4 && !result.estimatedNatureAreaSqm) {
        const est = estimateAreaSqmFromBoundaryLengths(
          result.deed.north.lengthM,
          result.deed.south.lengthM,
          result.deed.east.lengthM,
          result.deed.west.lengthM,
          result.edgeAngleBetweenRad,
        );
        if (est) result = { ...result, estimatedNatureAreaSqm: est };
      }
    }

    // Always compute geometric nature-area estimate when we have 4 lengths
    if (!result.estimatedNatureAreaSqm && lengthCount(result.deed) >= 4) {
      const est = estimateAreaSqmFromBoundaryLengths(
        result.deed.north.lengthM,
        result.deed.south.lengthM,
        result.deed.east.lengthM,
        result.deed.west.lengthM,
        result.edgeAngleBetweenRad,
      );
      if (est) result = { ...result, estimatedNatureAreaSqm: est };
    }

    // When nature table was not parsed but croquis has a distinct second area
    // (e.g. 606.49 حسابي / طبيعة vs 609 صك) — seed nature for form «لا».
    {
      const edges = DIR_ORDER.map((d) => result.deed[d].lengthM).filter(Boolean);
      const secArea =
        resolveNatureAreaSqm(result, propertyHints?.areaSqm) ||
        extractSecondaryNatureArea(
          result.rawText || tableSource || joinedText,
          result.deed.areaSqm || propertyHints?.areaSqm || "",
          edges,
        ) ||
        result.estimatedNatureAreaSqm ||
        "";

      if (
        (!result.nature || isBlockEmpty(result.nature) || !result.nature.areaSqm) &&
        (hasAnyDescription(result.deed) || lengthCount(result.deed) > 0)
      ) {
        if (secArea || lengthCount(result.deed) >= 3) {
          const natureSeed: SketchBoundaryBlock = {
            areaSqm: secArea || result.nature?.areaSqm || "",
            north: { ...(result.nature?.north ?? result.deed.north) },
            south: { ...(result.nature?.south ?? result.deed.south) },
            east: { ...(result.nature?.east ?? result.deed.east) },
            west: { ...(result.nature?.west ?? result.deed.west) },
          };
          if (result.nature && !isBlockEmpty(result.nature) && secArea) {
            natureSeed.north = { ...result.nature.north };
            natureSeed.south = { ...result.nature.south };
            natureSeed.east = { ...result.nature.east };
            natureSeed.west = { ...result.nature.west };
            natureSeed.areaSqm = secArea;
          }
          const meta = {
            edgeAngleBetweenRad: result.edgeAngleBetweenRad,
            estimatedNatureAreaSqm:
              result.estimatedNatureAreaSqm || secArea || undefined,
          };
          result = finalizeExtractResult(
            result.deed,
            natureSeed,
            result.rawText || joinedText,
            Boolean(result.usedSpatialLengths),
          );
          result = { ...result, ...meta };
        }
      } else if (
        result.nature &&
        !result.nature.areaSqm.trim() &&
        secArea
      ) {
        const meta = {
          edgeAngleBetweenRad: result.edgeAngleBetweenRad,
          estimatedNatureAreaSqm: result.estimatedNatureAreaSqm,
        };
        result = finalizeExtractResult(
          result.deed,
          { ...result.nature, areaSqm: secArea },
          result.rawText || joinedText,
          Boolean(result.usedSpatialLengths),
        );
        result = { ...result, ...meta };
      }

      // Ensure deed area when only صك area known from hints/OCR candidates
      if (!result.deed.areaSqm.trim()) {
        const cands = collectPlausibleAreaCandidates(
          result.rawText || tableSource || joinedText,
          edges,
          "",
        );
        if (cands.length >= 1) {
          const sorted = [...cands].sort((a, b) => Number(b) - Number(a));
          const meta = {
            edgeAngleBetweenRad: result.edgeAngleBetweenRad,
            estimatedNatureAreaSqm: result.estimatedNatureAreaSqm,
          };
          result = finalizeExtractResult(
            { ...result.deed, areaSqm: sorted[0]! },
            result.nature,
            result.rawText || joinedText,
            Boolean(result.usedSpatialLengths),
          );
          result = { ...result, ...meta };
        }
      }
    }

    // Property intake last: fill empty descriptions/area; never replace table lengths.
    return mergePropertyBoundaryHints(result, propertyHints);
  } catch (err) {
    return {
      rawText: "",
      hasData: false,
      warning:
        err instanceof Error
          ? `تعذّر تحليل التقرير: ${err.message}`
          : "تعذّر تحليل التقرير المساحي.",
      deedMatchesNature: null,
      deed: emptyBlock(),
      nature: null,
      filledCount: 0,
    };
  }
}

// re-export word map for tests
export const SKETCH_DIR_WORDS = DIR_WORD;
