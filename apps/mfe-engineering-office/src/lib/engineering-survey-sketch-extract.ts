/**
 * Extract deed / nature **edge lengths** from a survey sketch PDF (client-side).
 *
 * Only fills boundary length fields (شمال/جنوب/شرق/غرب).
 * Never fills: وصف الحدود, المساحة الإجمالية.
 * Internal table text may anchor lengths, then is stripped before output.
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
};

/** Form patch — length keys only (other keys kept on type for form shape). */
export type SurveySketchApplyPatch = {
  deedMatchesNature?: "yes" | "no" | null;
  northBoundaryLengthM?: string;
  southBoundaryLengthM?: string;
  eastBoundaryLengthM?: string;
  westBoundaryLengthM?: string;
  natureNorthBoundaryLengthM?: string;
  natureSouthBoundaryLengthM?: string;
  natureEastBoundaryLengthM?: string;
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

/** Drop وصف الحدود + المساحة — public extract is edge lengths only. */
function stripToLengthsOnly(block: SketchBoundaryBlock): SketchBoundaryBlock {
  return {
    areaSqm: "",
    north: { description: "", lengthM: block.north.lengthM },
    south: { description: "", lengthM: block.south.lengthM },
    east: { description: "", lengthM: block.east.lengthM },
    west: { description: "", lengthM: block.west.lengthM },
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
  const n = normalizeSketchText(raw)
    .replace(/,/g, "")
    .replace(/\s/g, "")
    .trim();
  if (!n || !/^\d+(\.\d+)?$/.test(n)) return "";
  return n;
}

function cleanDescription(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .replace(/^[\s:：\-–—|•·]+/, "")
    .replace(/[\s:：\-–—|•·]+$/, "")
    .trim();
}

/** Normalize plot/street tokens used only as length-binding anchors. */
function formatDescription(raw: string): string {
  let s = cleanDescription(raw);
  if (!s) return "";
  s = normalizeSketchText(s)
    .replace(/قطعه\s*رقم/gi, "قطعة رقم")
    .replace(/قطعه/gi, "قطعة")
    .replace(/شارع\s*عرض/gi, "شارع عرض");
  const plot = s.match(
    /قطعه?\s*رقم\s*(\d+)(?:\s*([\-–ـ]\s*[^\d\s]+))?/i,
  );
  if (plot) {
    const suf = (plot[2] ?? "").replace(/\s+/g, "");
    return suf ? `قطعة رقم ${plot[1]}${suf}` : `قطعة رقم ${plot[1]}`;
  }
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
  for (const d of DIR_ORDER) {
    if (b[d].lengthM) n += 1;
  }
  return n;
}

function isBlockEmpty(b: SketchBoundaryBlock): boolean {
  return blockFilledCount(b) === 0;
}

function onlyLengthsFilled(b: SketchBoundaryBlock): boolean {
  return DIR_ORDER.every((d) => Boolean(b[d].lengthM));
}

function lengthCount(b: SketchBoundaryBlock): number {
  return DIR_ORDER.filter((d) => Boolean(b[d].lengthM)).length;
}

function descriptionCount(b: SketchBoundaryBlock): number {
  return DIR_ORDER.filter((d) => Boolean(b[d].description)).length;
}

/** Plot/street anchors used only to pair table rows with edge lengths. */
const DESC_TOKEN =
  "(?:قطعه?\\s*رقم\\s*[\\d٠-٩]{1,6}(?![\\d٠-٩])(?:\\s*[\\-–ـ]\\s*[^\\d\\s،,.;:]+)?|شارع\\s*عرض\\s*[\\d.٠-٩]+\\s*م?)";
/**
 * Edge meters: decimals preferred; whole meters 2–3 digits only after id completed.
 */
const EDGE_LEN_TOKEN =
  "([\\d٠-٩]+[.,][\\d٠-٩]{1,3}|[\\d٠-٩]{2,3}(?![\\d٠-٩.,]))";

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
      const a = cleanLength((am[1] ?? "").replace(",", "."));
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

function sidesEqual(
  a: SketchBoundaryBlock,
  b: SketchBoundaryBlock,
): boolean {
  return DIR_ORDER.every((d) => a[d].lengthM === b[d].lengthM);
}

function finalizeExtractResult(
  deed: SketchBoundaryBlock,
  nature: SketchBoundaryBlock | null,
  text: string,
  usedSpatialLengths: boolean,
): SurveySketchExtractResult {
  // Edge lengths only — never expose وصف or مساحة إجمالية to callers / form.
  const deedNums = stripToLengthsOnly(deed);
  const natureNums = nature ? stripToLengthsOnly(nature) : null;

  // Keep nature when it has different/paired lengths (مطابقة = لا on sides).
  let natureOut =
    natureNums && !isBlockEmpty(natureNums) ? natureNums : null;

  let deedMatchesNature: "yes" | "no" | null = null;
  if (natureOut) {
    const sameSides = sidesEqual(deedNums, natureOut);
    deedMatchesNature = sameSides ? "yes" : "no";
  } else if (usedSpatialLengths && onlyLengthsFilled(deedNums)) {
    deedMatchesNature = "yes";
  }

  const filledCount =
    blockFilledCount(deedNums) +
    (natureOut ? blockFilledCount(natureOut) : 0);

  let warning: string | undefined;
  if (filledCount === 0) {
    warning =
      text.trim().length > 0
        ? "وُجدت أرقام في التقرير لكن لم تُستخرج أطوال الحدود بوضوح. راجع الملف وعبّئ يدوياً."
        : "تعذّر قراءة أطوال من التقرير. عبّئ الحقول يدوياً.";
  } else if (usedSpatialLengths) {
    warning =
      "تم تعبئة أطوال الحدود من أرقام الرسم. المساحة الإجمالية والأوصاف يدوياً.";
  } else {
    warning =
      "تم تعبئة أطوال الحدود من التقرير. المساحة الإجمالية والأوصاف يدوياً.";
  }

  return {
    rawText: text,
    hasData: filledCount > 0,
    warning,
    deedMatchesNature,
    deed: deedNums,
    nature: natureOut,
    filledCount,
    usedSpatialLengths,
  };
}

/**
 * Build a patch for form fields — **edge lengths only**.
 * On re-upload (`overwrite=true`), replace existing meters so wrong lengths don't stick.
 */
export function sketchExtractToEmptyFieldsPatch(
  result: SurveySketchExtractResult,
  current: {
    northBoundaryLengthM?: string;
    southBoundaryLengthM?: string;
    eastBoundaryLengthM?: string;
    westBoundaryLengthM?: string;
    natureNorthBoundaryLengthM?: string;
    natureSouthBoundaryLengthM?: string;
    natureEastBoundaryLengthM?: string;
    natureWestBoundaryLengthM?: string;
    deedMatchesNature?: "yes" | "no" | null;
  },
  overwrite = false,
): { patch: SurveySketchApplyPatch; appliedCount: number } {
  const patch: SurveySketchApplyPatch = {};
  let appliedCount = 0;

  const takeLength = (
    curr: string | undefined,
    next: string | undefined,
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
    if (value === undefined || value === null || value === "") return;
    (patch as Record<string, unknown>)[key] = value;
    appliedCount += 1;
  };

  set(
    "northBoundaryLengthM",
    takeLength(current.northBoundaryLengthM, d.north.lengthM),
  );
  set(
    "southBoundaryLengthM",
    takeLength(current.southBoundaryLengthM, d.south.lengthM),
  );
  set(
    "eastBoundaryLengthM",
    takeLength(current.eastBoundaryLengthM, d.east.lengthM),
  );
  set(
    "westBoundaryLengthM",
    takeLength(current.westBoundaryLengthM, d.west.lengthM),
  );

  if (result.nature) {
    const n = result.nature;
    set(
      "natureNorthBoundaryLengthM",
      takeLength(current.natureNorthBoundaryLengthM, n.north.lengthM),
    );
    set(
      "natureSouthBoundaryLengthM",
      takeLength(current.natureSouthBoundaryLengthM, n.south.lengthM),
    );
    set(
      "natureEastBoundaryLengthM",
      takeLength(current.natureEastBoundaryLengthM, n.east.lengthM),
    );
    set(
      "natureWestBoundaryLengthM",
      takeLength(current.natureWestBoundaryLengthM, n.west.lengthM),
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
 * Nature edge lengths from croquis extract (no area / description).
 */
export function sketchNatureFieldsFromExtract(
  result: SurveySketchExtractResult,
): SurveySketchApplyPatch {
  const n = result.nature;
  const d = result.deed;
  const len = (
    fromNature: SketchBoundarySide | undefined,
    fromDeed: SketchBoundarySide,
  ): string =>
    fromNature?.lengthM?.trim() || fromDeed.lengthM?.trim() || "";

  const northL = len(n?.north, d.north);
  const southL = len(n?.south, d.south);
  const eastL = len(n?.east, d.east);
  const westL = len(n?.west, d.west);

  return {
    natureNorthBoundaryLengthM: northL || undefined,
    natureSouthBoundaryLengthM: southL || undefined,
    natureEastBoundaryLengthM: eastL || undefined,
    natureWestBoundaryLengthM: westL || undefined,
  };
}

/** Mirror form edge lengths into nature length fields. */
export function sketchNatureFieldsFromDeedForm(fields: {
  northBoundaryLengthM?: string;
  southBoundaryLengthM?: string;
  eastBoundaryLengthM?: string;
  westBoundaryLengthM?: string;
}): SurveySketchApplyPatch {
  return {
    natureNorthBoundaryLengthM:
      cleanLength(fields.northBoundaryLengthM ?? "") || undefined,
    natureSouthBoundaryLengthM:
      cleanLength(fields.southBoundaryLengthM ?? "") || undefined,
    natureEastBoundaryLengthM:
      cleanLength(fields.eastBoundaryLengthM ?? "") || undefined,
    natureWestBoundaryLengthM:
      cleanLength(fields.westBoundaryLengthM ?? "") || undefined,
  };
}

/**
 * Apply nature length patch into form current values — only empty slots unless overwrite.
 */
export function applyNatureSketchPatch(
  naturePatch: SurveySketchApplyPatch,
  current: {
    natureNorthBoundaryLengthM?: string;
    natureSouthBoundaryLengthM?: string;
    natureEastBoundaryLengthM?: string;
    natureWestBoundaryLengthM?: string;
  },
  overwrite = false,
): { patch: SurveySketchApplyPatch; appliedCount: number } {
  const keys: Array<keyof SurveySketchApplyPatch> = [
    "natureNorthBoundaryLengthM",
    "natureSouthBoundaryLengthM",
    "natureEastBoundaryLengthM",
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

  return {
    deed,
    nature: null,
  };
}

export function parseLengthsFromPositions(items: SketchPdfTextItem[]): {
  deed: SketchBoundaryBlock;
  nature: SketchBoundaryBlock | null;
  raw: string;
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
 * Extract + parse a survey sketch PDF File — edge lengths only.
 */
export async function extractSurveySketchFromPdf(
  file: File,
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
    const tableSource = joinedText;

    // Re-bind lengths: body under الطول/م → full text → column zip
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

    // Edge lengths from PDF text transforms when layer has only edge numbers.
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
      }
    }

    // Nature without its own lengths: seed side lengths from deed.
    if (
      (!result.nature || lengthCount(result.nature) < 1) &&
      lengthCount(result.deed) >= 3
    ) {
      const natureSeed: SketchBoundaryBlock = {
        areaSqm: "",
        north: { description: "", lengthM: result.deed.north.lengthM },
        south: { description: "", lengthM: result.deed.south.lengthM },
        east: { description: "", lengthM: result.deed.east.lengthM },
        west: { description: "", lengthM: result.deed.west.lengthM },
      };
      result = finalizeExtractResult(
        result.deed,
        natureSeed,
        result.rawText || joinedText,
        Boolean(result.usedSpatialLengths),
      );
    }

    return result;
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

export const SKETCH_DIR_WORDS = DIR_WORD;
