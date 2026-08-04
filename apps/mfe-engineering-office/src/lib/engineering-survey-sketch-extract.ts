/**
 * Extract deed / nature **وصف الحد + أطوال الحدود** from a survey sketch PDF.
 *
 * Fills boundary description + length fields (شمال/جنوب/شرق/غرب) from PDF text only.
 * Never fills: المساحة الإجمالية (صك/طبيعة). Never property/بورصة mix-in.
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

/** Form patch — وصف الحد + أطوال (never total area). */
export type SurveySketchApplyPatch = {
  deedMatchesNature?: "yes" | "no" | null;
  northBoundary?: string;
  northBoundaryLengthM?: string;
  southBoundary?: string;
  southBoundaryLengthM?: string;
  eastBoundary?: string;
  eastBoundaryLengthM?: string;
  westBoundary?: string;
  westBoundaryLengthM?: string;
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

/** Drop المساحة only — keep وصف الحد + أطوال from croquis PDF. */
function stripTotalArea(block: SketchBoundaryBlock): SketchBoundaryBlock {
  return {
    areaSqm: "",
    north: { ...block.north },
    south: { ...block.south },
    east: { ...block.east },
    west: { ...block.west },
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

/** Normalize plot/street tokens for form display (PDF croquis only). */
function formatDescription(raw: string): string {
  let s = cleanDescription(raw);
  if (!s) return "";
  s = normalizeSketchText(s)
    .replace(/قطعه\s*دقم/gi, "قطعة رقم")
    .replace(/قطعه\s*رقه/gi, "قطعة رقم")
    .replace(/قطعه\s*رقم/gi, "قطعة رقم")
    .replace(/قطعه/gi, "قطعة")
    .replace(/شارع\s*عرض/gi, "شارع عرض")
    .replace(/ممر\s*مشاء/gi, "ممر مشاة")
    .replace(/ممر\s*مشاه/gi, "ممر مشاة")
    .replace(/\bسرق\b/gi, "شرق")
    // OCR: "رقم 94 س" / "رقم.دس" style fragments after "قطعة"
    .replace(/رقم\s*[.\-–ـ]?\s*(\d{1,6})\s*[.\-–ـ]?\s*س/gi, "رقم $1-س");
  // قطعة رقم 94-س / 94 ـس / ٩٤-س (digits already westernized by normalize)
  // Require dash (or end) for suffix so "225 قطعة" next-row junk is not a suffix
  const plot = s.match(
    /قطعه?\s*رقم\s*(\d{1,6})(?:\s*[\\-–ـ.]+\s*([ا-يA-Za-zسص]{1,3}))?/i,
  );
  if (plot) {
    const suf = (plot[2] ?? "").replace(/\s+/g, "").replace(/^[\-–ـ.]+/, "");
    const letter = suf.slice(0, 1);
    return letter ? `قطعة رقم ${plot[1]}-${letter}` : `قطعة رقم ${plot[1]}`;
  }
  // Loose OCR: "رقم 94-س" without قطعة word
  const plotLoose = s.match(/(?:رقم|نقم)\s*(\d{1,6})\s*[-–ـ.]+\s*(س)/i);
  if (plotLoose) return `قطعة رقم ${plotLoose[1]}-${plotLoose[2]}`;
  const pathWalk = s.match(
    /ممر\s*(?:مشاه?ة?|مشاء)?\s*عرض\s*([\d.]+)\s*م?/i,
  );
  if (pathWalk) return `ممر مشاة عرض ${pathWalk[1]} م`;
  const street = s.match(/شارع\s*عرض\s*([\d.]+)\s*م?/i);
  if (street) return `شارع عرض ${street[1]} م`;
  // OCR: "زع عرض 20 م" / "شاع عرض 20"
  const streetLoose = s.match(/(?:شارع|شاع|زع)\s*عرض\s*([\d.]+)\s*م?/i);
  if (streetLoose) return `شارع عرض ${streetLoose[1]} م`;
  return s;
}

/** Only trustworthy croquis description shapes — never free-form OCR garbage. */
export function isPlausibleBoundaryDescription(desc: string): boolean {
  const n = normalizeSketchText(desc);
  if (!n || n.length < 4) return false;
  if (/قطعه?\s*رقم\s*\d{1,6}/i.test(n)) return true;
  if (/شارع\s*عرض\s*[\d.]+/i.test(n)) return true;
  if (/ممر\s*(?:مشاه?ة?|مشاء)?\s*عرض\s*[\d.]+/i.test(n)) return true;
  return false;
}

/** Fix common croquis OCR misreads before parsing. */
function repairOcrArabicSoup(text: string): string {
  return text
    .replace(/سرق/g, "شرق")
    .replace(/جن[\u0648و]ب|جن\s*وب/gi, "جنوب")
    .replace(/شم[\u0627ا]ل/gi, "شمال")
    .replace(/غر[\u0628ب]/gi, "غرب")
    .replace(/قطعه?\s*دقم/gi, "قطعة رقم")
    .replace(/قطعه?\s*رقه/gi, "قطعة رقم")
    .replace(/قطعه?\s*رقم/gi, "قطعة رقم")
    .replace(/(?:زع|شاع|شايع)\s*عرض/gi, "شارع عرض")
    .replace(/ممر\s*مشاء/gi, "ممر مشاة")
    .replace(/ممر\s*مشاه(?!ة)/gi, "ممر مشاة")
    .replace(/الطسسسول|الطو[لn]/gi, "الطول")
    .replace(/وصف\s*الح|وصف\s*الم|وصفالح/gi, "وصف الحد")
    .replace(/العد/g, "الحد")
    .replace(/وجب\s*الطبيم[هة]/gi, "بموجب الطبيعة")
    .replace(/وجب\s*الصك|بموجب\s*الصك/gi, "بموجب الصك")
    .replace(/بموجب\s*الطبيع/gi, "بموجب الطبيعة")
    .replace(/الموتع/g, "الموقع");
}

/**
 * Harvest شمال/جنوب/شرق/غرب + وصف الحد from OCR text (noisy Arabic).
 * Only returns plot/street shapes via formatDescription.
 */
export function mineBoundaryDescriptionsFromOcr(
  rawText: string,
): SketchBoundaryBlock {
  const block = emptyBlock();
  if (!rawText.trim()) return block;

  const soup = repairOcrArabicSoup(rawText);
  // Prefer structured parse when OCR is clean enough
  const structured = parseBoundaryBlock(soup);
  for (const d of DIR_ORDER) {
    if (isPlausibleBoundaryDescription(structured[d].description)) {
      block[d].description = structured[d].description;
    }
    if (structured[d].lengthM) block[d].lengthM = structured[d].lengthM;
  }

  const flat = normalizeSketchText(soup).replace(/\n+/g, " ");

  // Direction window mining (OCR often drops separators)
  for (const dir of DIR_ORDER) {
    if (isPlausibleBoundaryDescription(block[dir].description)) continue;
    const dirTok = DIR_TOKEN_BY_DIR[dir];

    // Direct row: جهة + وصف anywhere in OCR soup (strongest)
    const direct = [
      ...flat.matchAll(
        new RegExp(
          `${dirTok}\\s*(?:الحد)?\\s*[:：\\-–—|•·]*\\s*(${DESC_TOKEN}|رقم\\s*[\\d٠-٩]{1,6}\\s*[-–ـ.]?\\s*س|(?:شارع|شاع|زع)\\s*عرض\\s*[\\d.٠-٩]+\\s*م?)`,
          "gi",
        ),
      ),
    ];
    if (direct.length > 0) {
      const last = direct[direct.length - 1]!;
      const f = formatDescription(last[1] ?? last[0] ?? "");
      if (isPlausibleBoundaryDescription(f)) {
        block[dir].description = f;
        continue;
      }
    }

    const win = sliceTextForDirection(soup, dir);
    if (!win) continue;
    // A) full DESC_TOKEN in window
    const tok = win.match(new RegExp(DESC_TOKEN, "i"));
    if (tok) {
      const f = formatDescription(tok[0]);
      if (isPlausibleBoundaryDescription(f)) {
        block[dir].description = f;
        continue;
      }
    }
    // B) loose plot / street in window after direction token
    const loosePlot = win.match(
      /قطعه?\s*(?:رقم|دقم|رقه)?\s*[\d٠-٩]{1,6}\s*[\\-–ـ.]?\s*[سص]?|رقم\s*[\d٠-٩]{1,6}\s*[\\-–ـ.]?\s*س/i,
    );
    if (loosePlot) {
      const f = formatDescription(loosePlot[0]);
      if (isPlausibleBoundaryDescription(f)) {
        block[dir].description = f;
        continue;
      }
    }
    const looseStreet = win.match(
      /(?:شارع|شاع|زع)\s*عرض\s*[\d.٠-٩]+\s*م?/i,
    );
    if (looseStreet) {
      const f = formatDescription(looseStreet[0]);
      if (isPlausibleBoundaryDescription(f)) block[dir].description = f;
    }
  }

  // Table-shaped dump: four unique plot/street tokens later in page (N→S→E→W)
  if (descriptionCount(block) < 3) {
    const ordered: string[] = [];
    const re = new RegExp(
      `${DESC_TOKEN}|(?:رقم\\s*[\\d٠-٩]{1,6}\\s*[\\-–ـ.]+\\s*س)|(?:(?:شارع|شاع|زع|شايع)\\s*عرض\\s*[\\d.٠-٩]+\\s*م?)|(?:ممر\\s*(?:مشاه?ة?|مشاء)?\\s*عرض\\s*[\\d.٠-٩]+\\s*م?)`,
      "gi",
    );
    for (const m of flat.matchAll(re)) {
      const f = formatDescription(m[0]);
      if (!isPlausibleBoundaryDescription(f)) continue;
      if (!ordered.includes(f)) ordered.push(f);
      if (ordered.length >= 4) break;
    }
    if (ordered.length >= 3) {
      for (let i = 0; i < ordered.length && i < 4; i++) {
        const dir = DIR_ORDER[i]!;
        if (!block[dir].description) block[dir].description = ordered[i]!;
      }
    }
  }

  return block;
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
    if (b[d].description) n += 1;
    if (b[d].lengthM) n += 1;
  }
  return n;
}

function isBlockEmpty(b: SketchBoundaryBlock): boolean {
  return blockFilledCount(b) === 0;
}

function onlyLengthsFilled(b: SketchBoundaryBlock): boolean {
  return (
    DIR_ORDER.every((d) => Boolean(b[d].lengthM)) &&
    DIR_ORDER.every((d) => !b[d].description)
  );
}

function lengthCount(b: SketchBoundaryBlock): number {
  return DIR_ORDER.filter((d) => Boolean(b[d].lengthM)).length;
}

function descriptionCount(b: SketchBoundaryBlock): number {
  return DIR_ORDER.filter((d) => Boolean(b[d].description)).length;
}

/** Plot/street/path anchors — optional plot suffix must start with dash (ـس) so next row is not eaten. */
const DESC_TOKEN =
  "(?:قطعه?\\s*(?:رقم|دقم|رقه)\\s*[\\d٠-٩]{1,6}(?![\\d٠-٩])(?:\\s*[\\-–ـ.]+\\s*[ا-يA-Za-zسص]{1,3})?|شارع\\s*عرض\\s*[\\d.٠-٩]+\\s*م?|ممر\\s*(?:مشاه?ة?|مشاء)?\\s*عرض\\s*[\\d.٠-٩]+\\s*م?)";
/**
 * Edge meters: decimals preferred; whole meters 2–3 digits (20, 25).
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
  const text = repairOcrArabicSoup(rawText.trim());
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
  return DIR_ORDER.every(
    (d) =>
      a[d].lengthM === b[d].lengthM &&
      a[d].description === b[d].description,
  );
}

function finalizeExtractResult(
  deed: SketchBoundaryBlock,
  nature: SketchBoundaryBlock | null,
  text: string,
  usedSpatialLengths: boolean,
): SurveySketchExtractResult {
  // Keep وصف + أطوال; never expose total area.
  const deedOut = stripTotalArea(deed);
  const natureNums = nature ? stripTotalArea(nature) : null;

  let natureOut =
    natureNums && !isBlockEmpty(natureNums) ? natureNums : null;

  let deedMatchesNature: "yes" | "no" | null = null;
  if (natureOut) {
    deedMatchesNature = sidesEqual(deedOut, natureOut) ? "yes" : "no";
  } else if (usedSpatialLengths && onlyLengthsFilled(deedOut)) {
    deedMatchesNature = "yes";
  }

  const filledCount =
    blockFilledCount(deedOut) +
    (natureOut ? blockFilledCount(natureOut) : 0);

  let warning: string | undefined;
  if (filledCount === 0) {
    warning =
      text.trim().length > 0
        ? "وُجد نص في التقرير لكن لم تُستخرج أوصاف/أطوال الحدود بوضوح. راجع وعبّئ يدوياً."
        : "تعذّر قراءة حدود من التقرير. عبّئ الحقول يدوياً.";
  } else if (usedSpatialLengths && descriptionCount(deedOut) < 1) {
    warning =
      "تم تعبئة أطوال الحدود من أرقام الرسم. أوصاف الحد (إن وُجدت في النص) والمساحة الإجمالية يدوياً.";
  } else {
    warning =
      "تم تعبئة أوصاف/أطوال الحدود من التقرير. المساحة الإجمالية يدوياً — راجع قبل الإرسال.";
  }

  return {
    rawText: text,
    hasData: filledCount > 0,
    warning,
    deedMatchesNature,
    deed: deedOut,
    nature: natureOut,
    filledCount,
    usedSpatialLengths,
  };
}

/**
 * Build a patch: وصف الحد + أطوال from croquis PDF only (no total area).
 */
export function sketchExtractToEmptyFieldsPatch(
  result: SurveySketchExtractResult,
  current: {
    northBoundary?: string;
    northBoundaryLengthM?: string;
    southBoundary?: string;
    southBoundaryLengthM?: string;
    eastBoundary?: string;
    eastBoundaryLengthM?: string;
    westBoundary?: string;
    westBoundaryLengthM?: string;
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

  set("northBoundary", take(current.northBoundary, d.north.description));
  set(
    "northBoundaryLengthM",
    take(current.northBoundaryLengthM, d.north.lengthM),
  );
  set("southBoundary", take(current.southBoundary, d.south.description));
  set(
    "southBoundaryLengthM",
    take(current.southBoundaryLengthM, d.south.lengthM),
  );
  set("eastBoundary", take(current.eastBoundary, d.east.description));
  set(
    "eastBoundaryLengthM",
    take(current.eastBoundaryLengthM, d.east.lengthM),
  );
  set("westBoundary", take(current.westBoundary, d.west.description));
  set(
    "westBoundaryLengthM",
    take(current.westBoundaryLengthM, d.west.lengthM),
  );

  if (result.nature) {
    const n = result.nature;
    set(
      "natureNorthBoundary",
      take(current.natureNorthBoundary, n.north.description),
    );
    set(
      "natureNorthBoundaryLengthM",
      take(current.natureNorthBoundaryLengthM, n.north.lengthM),
    );
    set(
      "natureSouthBoundary",
      take(current.natureSouthBoundary, n.south.description),
    );
    set(
      "natureSouthBoundaryLengthM",
      take(current.natureSouthBoundaryLengthM, n.south.lengthM),
    );
    set(
      "natureEastBoundary",
      take(current.natureEastBoundary, n.east.description),
    );
    set(
      "natureEastBoundaryLengthM",
      take(current.natureEastBoundaryLengthM, n.east.lengthM),
    );
    set(
      "natureWestBoundary",
      take(current.natureWestBoundary, n.west.description),
    );
    set(
      "natureWestBoundaryLengthM",
      take(current.natureWestBoundaryLengthM, n.west.lengthM),
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
 * Nature boundary fields from croquis extract (وصف + أطوال; no area).
 */
export function sketchNatureFieldsFromExtract(
  result: SurveySketchExtractResult,
): SurveySketchApplyPatch {
  const n = result.nature;
  const d = result.deed;
  const side = (
    fromNature: SketchBoundarySide | undefined,
    fromDeed: SketchBoundarySide,
  ): SketchBoundarySide => ({
    description:
      fromNature?.description?.trim() || fromDeed.description?.trim() || "",
    lengthM: fromNature?.lengthM?.trim() || fromDeed.lengthM?.trim() || "",
  });

  const north = side(n?.north, d.north);
  const south = side(n?.south, d.south);
  const east = side(n?.east, d.east);
  const west = side(n?.west, d.west);

  return {
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

/** Mirror form deed boundary text+lengths into nature fields. */
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
 * Apply nature patch into form — empty slots unless overwrite.
 */
export function applyNatureSketchPatch(
  naturePatch: SurveySketchApplyPatch,
  current: {
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
  return filterLengthLabelOutliers(out);
}

/**
 * Drop chamfer / annotation leftovers (e.g. 4.20 next to 20–25 m edges).
 * Official croquis often ship a tiny fifth label that steals South when clustered by Y.
 */
export function filterLengthLabelOutliers(
  labels: LengthLabel[],
): LengthLabel[] {
  if (labels.length < 5) return labels;
  const values = labels.map((l) => l.value).sort((a, b) => a - b);
  const median = values[Math.floor(values.length / 2)]!;
  // Keep labels that are not tiny leftovers relative to the main edges.
  const floor = Math.max(5, median * 0.35);
  const filtered = labels.filter((l) => l.value >= floor);
  return filtered.length >= 4 ? filtered : labels;
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
  // Position-based clustering: edge pairs (صك + طبيعة) sit near each other.
  // Retry a looser radius when labels are slightly farther apart.
  let clusters = clusterLengthLabels(labels, 42);
  if (clusters.length < 4) {
    clusters = clusterLengthLabels(labels, 72);
  }
  if (clusters.length < 4) {
    // One cluster per unique length (deed+nature duplicates of the same edge)
    const byVal = new Map<string, LengthLabel[]>();
    for (const l of labels) {
      const list = byVal.get(l.lengthM) ?? [];
      list.push(l);
      byVal.set(l.lengthM, list);
    }
    // Prefer groups that look like real sides (typically 2 labels per edge).
    const groups = [...byVal.entries()]
      .map(([, group]) => group)
      .filter((g) => g.length >= 1)
      .sort((a, b) => b.length - a.length);
    if (groups.length >= 4) {
      clusters = groups.slice(0, 4).map((group) => ({
        x: group.reduce((s, g) => s + g.x, 0) / group.length,
        y: group.reduce((s, g) => s + g.y, 0) / group.length,
        a: group.reduce((s, g) => s + g.a, 0) / group.length,
        b: group.reduce((s, g) => s + g.b, 0) / group.length,
        values: [group[0]!.lengthM],
      }));
    } else {
      clusters = groups.map((group) => ({
        x: group.reduce((s, g) => s + g.x, 0) / group.length,
        y: group.reduce((s, g) => s + g.y, 0) / group.length,
        a: group.reduce((s, g) => s + g.a, 0) / group.length,
        b: group.reduce((s, g) => s + g.b, 0) / group.length,
        values: [group[0]!.lengthM],
      }));
    }
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

/** Canvas helpers for croquis table crops (vector Arabic ink). */
function cropCanvas(
  source: HTMLCanvasElement,
  fx: number,
  fy: number,
  fw: number,
  fh: number,
): HTMLCanvasElement {
  const x = Math.max(0, Math.floor(fx * source.width));
  const y = Math.max(0, Math.floor(fy * source.height));
  const w = Math.max(8, Math.floor(fw * source.width));
  const h = Math.max(8, Math.floor(fh * source.height));
  const c = document.createElement("canvas");
  c.width = Math.min(w, source.width - x);
  c.height = Math.min(h, source.height - y);
  const ctx = c.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(source, x, y, c.width, c.height, 0, 0, c.width, c.height);
  }
  return c;
}

function rotateCanvasQuarter(
  source: HTMLCanvasElement,
  quarterTurns: 1 | 2 | 3,
): HTMLCanvasElement {
  const rad = (quarterTurns * Math.PI) / 2;
  const swap = quarterTurns % 2 === 1;
  const out = document.createElement("canvas");
  out.width = swap ? source.height : source.width;
  out.height = swap ? source.width : source.height;
  const ctx = out.getContext("2d");
  if (!ctx) return out;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate(rad);
  ctx.drawImage(source, -source.width / 2, -source.height / 2);
  return out;
}

/**
 * Keep pure red (صك) or pure blue (طبيعة) CAD ink; drop grids/checklists.
 * Osoul Print-to-PDF draws وصف الحد as R=1,0,0 / B=0,0,1 vectors.
 */
function isolatePureCadInk(
  source: HTMLCanvasElement,
  mode: "blue" | "red",
): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = source.width;
  out.height = source.height;
  const ctx = out.getContext("2d");
  const sctx = source.getContext("2d");
  if (!ctx || !sctx) return source;
  const img = sctx.getImageData(0, 0, source.width, source.height);
  const d = img.data;
  let ink = 0;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i]!;
    const g = d[i + 1]!;
    const b = d[i + 2]!;
    const isBlue =
      (b > 180 && r < 60 && g < 60) ||
      (b > 140 && b >= r + 45 && b >= g + 40);
    const isRed =
      (r > 180 && g < 60 && b < 60) ||
      (r > 140 && r >= g + 45 && r >= b + 40);
    const keep = mode === "blue" ? isBlue : isRed;
    if (keep) {
      d[i] = d[i + 1] = d[i + 2] = 0;
      ink += 1;
    } else {
      d[i] = d[i + 1] = d[i + 2] = 255;
    }
    d[i + 3] = 255;
  }
  // Too little pure ink → also keep saturated near-blue/red (anti-alias)
  if (ink < 400) {
    const again = sctx.getImageData(0, 0, source.width, source.height);
    const a = again.data;
    for (let i = 0; i < a.length; i += 4) {
      const r = a[i]!;
      const g = a[i + 1]!;
      const b = a[i + 2]!;
      const isBlue = b > 100 && b >= r + 18 && b >= g + 10;
      const isRed = r > 100 && r >= g + 20 && r >= b + 20;
      const keep = mode === "blue" ? isBlue : isRed;
      if (keep) {
        a[i] = a[i + 1] = a[i + 2] = 0;
      } else {
        a[i] = a[i + 1] = a[i + 2] = 255;
      }
      a[i + 3] = 255;
    }
    ctx.putImageData(again, 0, 0);
  } else {
    ctx.putImageData(img, 0, 0);
  }
  return out;
}

function shrinkCanvasForOcr(
  source: HTMLCanvasElement,
  maxEdge = 1400,
): HTMLCanvasElement {
  const edge = Math.max(source.width, source.height);
  if (edge <= maxEdge) return source;
  const scale = maxEdge / edge;
  const out = document.createElement("canvas");
  out.width = Math.max(8, Math.round(source.width * scale));
  out.height = Math.max(8, Math.round(source.height * scale));
  const ctx = out.getContext("2d");
  if (!ctx) return source;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, out.width, out.height);
  return out;
}

function canvasToJpegBlob(
  source: HTMLCanvasElement,
  quality = 0.9,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    source.toBlob((b) => resolve(b), "image/jpeg", quality);
  });
}

/**
 * Cloud OCR (OCR.space engine 2) — reliable on pure red/blue croquis ink.
 * Tesseract local repeatedly fails on Osoul calligraphy; this path is what
 * fills وصف الحد on official Print-to-PDF croquis when online.
 *
 * Free demo key (`helloworld`) is rate-limited (~few / min). Prefer a real
 * NEXT_PUBLIC_OCR_SPACE_API_KEY for daily use.
 */
export async function ocrImageBlobArabic(blob: Blob): Promise<string> {
  if (typeof fetch === "undefined") return "";
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "";
  }
  try {
    // Next.js only inlines exact `process.env.NEXT_PUBLIC_*` access (not process.env?).
    const key =
      (typeof process !== "undefined"
        ? process.env.NEXT_PUBLIC_OCR_SPACE_API_KEY
        : undefined
      )?.trim() || "helloworld";
    const form = new FormData();
    form.append("file", blob, "sketch.jpg");
    form.append("language", "auto");
    form.append("OCREngine", "2");
    form.append("scale", "true");
    form.append("detectOrientation", "true");
    form.append("isOverlayRequired", "false");
    const res = await fetch("https://api.ocr.space/parse/image", {
      method: "POST",
      headers: { apikey: key },
      body: form,
    });
    // 429 = free-tier throttle — empty so lengths still apply
    if (!res.ok) return "";
    const data = (await res.json()) as {
      IsErroredOnProcessing?: boolean;
      ErrorMessage?: string | string[];
      ParsedResults?: Array<{ ParsedText?: string }>;
    };
    if (data.IsErroredOnProcessing) return "";
    const text = (data.ParsedResults ?? [])
      .map((p) => p.ParsedText ?? "")
      .join("\n")
      .trim();
    return text ? repairOcrArabicSoup(text) : "";
  } catch {
    return "";
  }
}

function countNearBlackPixels(source: HTMLCanvasElement): number {
  const sctx = source.getContext("2d");
  if (!sctx) return 0;
  const img = sctx.getImageData(0, 0, source.width, source.height);
  const d = img.data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i]! < 40 && d[i + 1]! < 40 && d[i + 2]! < 40) n += 1;
  }
  return n;
}

async function recognizeCanvasCloud(
  source: HTMLCanvasElement,
): Promise<string> {
  if (countNearBlackPixels(source) < 80) return "";
  const small = shrinkCanvasForOcr(source, 1200);
  const blob = await canvasToJpegBlob(small, 0.88);
  if (!blob || blob.size < 200) return "";
  if (blob.size > 900_000) {
    const tinier = shrinkCanvasForOcr(source, 900);
    const b2 = await canvasToJpegBlob(tinier, 0.72);
    if (!b2) return "";
    return ocrImageBlobArabic(b2);
  }
  return ocrImageBlobArabic(blob);
}

/**
 * Prepare one pure-ink table strip for cloud OCR.
 * Osoul form: vertical dual tables of «وصف الحد» on the left (red=صك, blue=طبيعة).
 * Works across the common 841×1190 Print-to-PDF croquis family — not one PDF only.
 */
function prepareInkTableStrip(
  pageCanvas: HTMLCanvasElement,
  mode: "red" | "blue",
): HTMLCanvasElement {
  // Wider left column covers slight layout drift between offices
  const strip = cropCanvas(pageCanvas, 0.0, 0.26, 0.32, 0.58);
  const oriented = rotateCanvasQuarter(strip, 3);
  return isolatePureCadInk(oriented, mode);
}

/**
 * Targeted OCR for Arabic «وصف الحد» on official croquis (vector calligraphy).
 * Pure red/blue ink isolation + cloud OCR (local Tesseract cannot read this font).
 *
 * Budget: at most **2** cloud OCR requests per PDF (deed, then nature if needed)
 * so free API keys survive multi-file uploads.
 */
export async function ocrSurveySketchPdf(file: File): Promise<string> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return "";
  }
  try {
    const pdfjs = await loadPdfJs();
    const data = new Uint8Array(await file.arrayBuffer());
    const pdf = await pdfjs.getDocument({ data }).promise;
    const parts: string[] = [];

    try {
      const page = await pdf.getPage(1);
      // Slightly lower DPI — still enough for pure-ink OCR, less memory
      const viewport = page.getViewport({ scale: 2.6 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        page.cleanup();
        await pdf.cleanup();
        return "";
      }
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({
        canvas,
        canvasContext: ctx,
        viewport,
      }).promise;

      // 1) Deed (red) first — primary form fields «حسب الصك»
      const deedInked = prepareInkTableStrip(canvas, "red");
      const deedText = await recognizeCanvasCloud(deedInked);
      if (deedText.trim()) {
        parts.push(`بموجب الصك\n${deedText.trim()}`);
      }

      // 2) Nature (blue) only when deed desc is weak (extra rate-limit cost)
      const deedMined = mineBoundaryDescriptionsFromOcr(deedText || "");
      if (descriptionCount(deedMined) < 3) {
        const natureInked = prepareInkTableStrip(canvas, "blue");
        const natureText = await recognizeCanvasCloud(natureInked);
        if (natureText.trim()) {
          parts.push(`بموجب الطبيعة\n${natureText.trim()}`);
        }
      } else {
        // Same croquis usually mirrors nature = deed; seed header for parsers
        parts.push(`بموجب الطبيعة\n${deedText.trim()}`);
      }

      page.cleanup();
    } finally {
      await pdf.cleanup();
    }

    return parts.join("\n\n");
  } catch {
    return "";
  }
}

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    let done = false;
    const t = window.setTimeout(() => {
      if (!done) {
        done = true;
        resolve(fallback);
      }
    }, ms);
    p.then(
      (v) => {
        if (!done) {
          done = true;
          window.clearTimeout(t);
          resolve(v);
        }
      },
      () => {
        if (!done) {
          done = true;
          window.clearTimeout(t);
          resolve(fallback);
        }
      },
    );
  });
}

/**
 * Extract + parse a survey sketch PDF: أطوال from text/spatial + وصف الحد Arabic
 * from text layer when present, else targeted OCR of croquis tables/plot.
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
    let tableSource = joinedText;

    // Re-bind lengths when some PDF text exists
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

    // Spatial edge lengths (when layer is numbers-only) — keep prior descriptions.
    {
      const spatial = parseLengthsFromPositions(allPos);
      if (spatial) {
        let filledSpatial = 0;
        const deed = {
          areaSqm: result.deed.areaSqm,
          north: { ...result.deed.north },
          south: { ...result.deed.south },
          east: { ...result.deed.east },
          west: { ...result.deed.west },
        };
        for (const d of DIR_ORDER) {
          const onlyNumbersLayer =
            descriptionCount(result.deed) === 0 && allPos.length >= 4;
          if (
            spatial.deed[d].lengthM &&
            (!deed[d].lengthM || onlyNumbersLayer)
          ) {
            if (deed[d].lengthM !== spatial.deed[d].lengthM) {
              filledSpatial += 1;
            }
            deed[d] = { ...deed[d], lengthM: spatial.deed[d].lengthM };
          }
        }
        if (filledSpatial > 0 || lengthCount(deed) >= 3) {
          result = finalizeExtractResult(
            deed,
            result.nature,
            result.rawText || joinedText || spatial.raw,
            true,
          );
        }
      }
    }

    // Arabic وصف الحد: text layer first; if missing → pure ink + cloud OCR
    if (descriptionCount(result.deed) < 3) {
      try {
        const ocrText = await withTimeout(
          ocrSurveySketchPdf(file),
          70_000,
          "",
        );
        if (ocrText.trim()) {
          tableSource = [joinedText, ocrText].filter(Boolean).join("\n\n");
          const { deedText: ocrDeed, natureText: ocrNature } =
            splitDeedNatureSections(ocrText);
          const minedAll = mineBoundaryDescriptionsFromOcr(ocrText);
          const minedDeed = mineBoundaryDescriptionsFromOcr(
            ocrDeed || ocrText,
          );
          const minedNature = ocrNature
            ? mineBoundaryDescriptionsFromOcr(ocrNature)
            : emptyBlock();
          const fromText = parseSurveySketchText(ocrText);

          const deed = {
            areaSqm: result.deed.areaSqm,
            north: { ...result.deed.north },
            south: { ...result.deed.south },
            east: { ...result.deed.east },
            west: { ...result.deed.west },
          };
          const natureBase = result.nature
            ? {
                areaSqm: result.nature.areaSqm,
                north: { ...result.nature.north },
                south: { ...result.nature.south },
                east: { ...result.nature.east },
                west: { ...result.nature.west },
              }
            : emptyBlock();

          for (const d of DIR_ORDER) {
            const descCandidates = [
              fromText.deed[d].description,
              minedDeed[d].description,
              minedAll[d].description,
              fromText.nature?.[d].description,
            ];
            if (!deed[d].description) {
              for (const c of descCandidates) {
                if (c && isPlausibleBoundaryDescription(c)) {
                  deed[d] = { ...deed[d], description: c };
                  break;
                }
              }
            }
            if (!deed[d].lengthM) {
              const len =
                fromText.deed[d].lengthM ||
                minedDeed[d].lengthM ||
                minedAll[d].lengthM ||
                "";
              if (len) deed[d] = { ...deed[d], lengthM: len };
            }
            if (!natureBase[d].description) {
              const nd =
                fromText.nature?.[d].description ||
                minedNature[d].description ||
                minedAll[d].description ||
                deed[d].description;
              if (nd && isPlausibleBoundaryDescription(nd)) {
                natureBase[d] = { ...natureBase[d], description: nd };
              }
            }
            if (!natureBase[d].lengthM) {
              natureBase[d] = {
                ...natureBase[d],
                lengthM:
                  fromText.nature?.[d].lengthM ||
                  minedNature[d].lengthM ||
                  deed[d].lengthM ||
                  "",
              };
            }
          }

          const natureOut = isBlockEmpty(natureBase)
            ? result.nature
            : natureBase;
          result = finalizeExtractResult(
            deed,
            natureOut,
            tableSource,
            Boolean(result.usedSpatialLengths),
          );
        }
      } catch {
        /* OCR optional — keep lengths */
      }
    }

    // Nature without its own sides: seed وصف + أطوال from deed.
    if (
      (!result.nature || lengthCount(result.nature) < 1) &&
      (lengthCount(result.deed) >= 3 || descriptionCount(result.deed) >= 1)
    ) {
      const natureSeed: SketchBoundaryBlock = {
        areaSqm: "",
        north: {
          description: result.deed.north.description,
          lengthM: result.deed.north.lengthM,
        },
        south: {
          description: result.deed.south.description,
          lengthM: result.deed.south.lengthM,
        },
        east: {
          description: result.deed.east.description,
          lengthM: result.deed.east.lengthM,
        },
        west: {
          description: result.deed.west.description,
          lengthM: result.deed.west.lengthM,
        },
      };
      result = finalizeExtractResult(
        result.deed,
        natureSeed,
        result.rawText || tableSource || joinedText,
        Boolean(result.usedSpatialLengths),
      );
    }

    // Status messages
    if (
      lengthCount(result.deed) >= 3 &&
      descriptionCount(result.deed) >= 3
    ) {
      result = {
        ...result,
        warning:
          "تُعبّأت الأطوال وأوصاف الحد من التقرير. راجعها قبل الإرسال — المساحة الإجمالية يدوياً.",
      };
    } else if (
      lengthCount(result.deed) >= 3 &&
      descriptionCount(result.deed) >= 1
    ) {
      result = {
        ...result,
        warning:
          "تُعبّأت الأطوال وجزء من أوصاف الحد. أكمل الناقص من جدول الكروكي — المساحة الإجمالية يدوياً.",
      };
    } else if (
      lengthCount(result.deed) >= 3 &&
      descriptionCount(result.deed) < 1
    ) {
      result = {
        ...result,
        warning:
          "تُعبّأت الأطوال من أرقام الرسم. تعذّر قراءة أوصاف الحد العربية تلقائياً — انسخها يدوياً من جدول الكروكي (شمال/جنوب/شرق/غرب).",
      };
    } else if (lengthCount(result.deed) === 0 && allPos.length === 0) {
      result = {
        ...result,
        warning:
          "لا توجد أرقام أطوال قابلة للقراءة في طبقة النص لهذا التقرير — عبّئ الأطوال والأوصاف يدوياً من الكروكي.",
      };
    } else if (
      lengthCount(result.deed) >= 1 &&
      descriptionCount(result.deed) >= 1 &&
      descriptionCount(result.deed) < 4
    ) {
      result = {
        ...result,
        warning:
          "تعبئة جزئية لأوصاف/أطوال من التقرير. أكمل الناقص من جدول الكروكي — المساحة الإجمالية يدوياً.",
      };
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
