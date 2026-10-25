/**
 * Spell out SAR amounts («فقط … لا غير») with the Arabic number grammar a reader expects:
 *
 * - 1 / 2 of a scale: «ألف»، «ألفان» — the dual drops its nūn when the counted noun follows
 *   directly (إضافة): 2,000,000 «مليونا ريال», 200,000 «مائتا ألف», 2,000 «ألفا ريال».
 * - 3–10: plural genitive — «ثلاثة آلاف»، «عشرة ملايين».
 * - 11–99: singular accusative — «أحد عشر ألفًا»، «مائة وخمسون ألفًا» … but «ألف» (no tanwīn)
 *   when the counted noun follows directly: «مائة وخمسون ألف ريال».
 * - 100, 200 … 900: singular genitive — «مائة ألف»، «مائتا ألف»، «ثلاثمائة ألف».
 * - A compound count follows its last part: 103,000 «مائة وثلاثة آلاف»; 101 / 102 of a scale
 *   have no counted form, so 101,000 «مائة ألف وألف», 102,000 «مائة ألف وألفان».
 * - The riyal itself follows the same rule (masculine): «ريال»، «ريالان»، «ثلاثة ريالات»،
 *   «خمسة عشر ريالًا سعوديًا»؛ the halala is feminine: «ثلاث هللات»، «إحدى عشرة هللةً».
 *
 * Keep in step with backend ArabicAmountWords.cs (same rules, same test table).
 */
import { parseLocaleNumber } from "@platform/app-shared/format/number";

const ONES = [
  "",
  "واحد",
  "اثنان",
  "ثلاثة",
  "أربعة",
  "خمسة",
  "ستة",
  "سبعة",
  "ثمانية",
  "تسعة",
  "عشرة",
  "أحد عشر",
  "اثنا عشر",
  "ثلاثة عشر",
  "أربعة عشر",
  "خمسة عشر",
  "ستة عشر",
  "سبعة عشر",
  "ثمانية عشر",
  "تسعة عشر",
];

/** Feminine units for a feminine counted noun (هللة). */
const ONES_FEMININE = [
  "",
  "واحدة",
  "اثنتان",
  "ثلاث",
  "أربع",
  "خمس",
  "ست",
  "سبع",
  "ثماني",
  "تسع",
  "عشر",
];

const TENS = [
  "",
  "",
  "عشرون",
  "ثلاثون",
  "أربعون",
  "خمسون",
  "ستون",
  "سبعون",
  "ثمانون",
  "تسعون",
];

const HUNDREDS = [
  "",
  "مائة",
  "مائتان",
  "ثلاثمائة",
  "أربعمائة",
  "خمسمائة",
  "ستمائة",
  "سبعمائة",
  "ثمانمائة",
  "تسعمائة",
];

function underHundred(n: number): string {
  if (n < 20) return ONES[n] ?? "";
  const t = Math.floor(n / 10);
  const o = n % 10;
  if (!o) return TENS[t] ?? "";
  return `${ONES[o]} و${TENS[t]}`;
}

/**
 * 1–999 in words. `construct`: a counted noun follows directly, so a bare «مائتان» becomes
 * «مائتا» (200,000 «مائتا ألف», 200 «مائتا ريال»).
 */
function underThousand(n: number, construct = false): string {
  if (n < 100) return underHundred(n);
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const head = h === 2 && construct && rest === 0 ? "مائتا" : (HUNDREDS[h] ?? "");
  if (!rest) return head;
  return `${head} و${underHundred(rest)}`;
}

type Noun = {
  /** Singular — also the genitive after 100s and the form before a directly following noun. */
  one: string;
  /** Dual, nominative. */
  dual: string;
  /** Dual in construct (a counted noun follows directly). */
  dualConstruct: string;
  /** Plural after 3–10. */
  plural: string;
  /** Singular accusative after 11–99 (with tanwīn). */
  accusative: string;
};

const THOUSAND: Noun = { one: "ألف", dual: "ألفان", dualConstruct: "ألفا", plural: "آلاف", accusative: "ألفًا" };
const MILLION: Noun = { one: "مليون", dual: "مليونان", dualConstruct: "مليونا", plural: "ملايين", accusative: "مليونًا" };
const BILLION: Noun = { one: "مليار", dual: "ملياران", dualConstruct: "مليارا", plural: "مليارات", accusative: "مليارًا" };

/**
 * `count` (1–999) of a scale noun. `last`: nothing follows inside the number, the counted
 * noun (ريال) comes next — duals take the construct form and 11–99 drop the tanwīn.
 */
function countedScale(count: number, noun: Noun, last: boolean): string {
  if (count === 1) return noun.one;
  if (count === 2) return last ? noun.dualConstruct : noun.dual;
  const r = count % 100;
  if (count > 100 && (r === 1 || r === 2)) {
    const tail = r === 1 ? noun.one : last ? noun.dualConstruct : noun.dual;
    return `${underThousand(count - r, true)} ${noun.one} و${tail}`;
  }
  if (r >= 3 && r <= 10) return `${underThousand(count)} ${noun.plural}`;
  if (r >= 11) return `${underThousand(count)} ${last ? noun.one : noun.accusative}`;
  return `${underThousand(count, true)} ${noun.one}`;
}

const SCALES: Array<{ value: number; noun: Noun }> = [
  { value: 1_000_000_000, noun: BILLION },
  { value: 1_000_000, noun: MILLION },
  { value: 1_000, noun: THOUSAND },
];

/** Scale parts of `n` (≥ 1000 part only), `rest` = the part under 1000. */
function scaleParts(n: number): { parts: string[]; rest: number } {
  const parts: string[] = [];
  let rem = n;
  for (const scale of SCALES) {
    if (rem < scale.value) continue;
    const count = Math.floor(rem / scale.value);
    rem %= scale.value;
    // Beyond 999 milliards (never a real valuation) the count is spelled plainly.
    parts.push(
      count >= 1000
        ? `${integerToArabicWords(count)} ${scale.noun.one}`
        : countedScale(count, scale.noun, rem === 0),
    );
  }
  return { parts, rest: rem };
}

/** Plain cardinal (no counted noun) — used for counts and labels. */
function integerToArabicWords(n: number): string {
  if (n === 0) return "صفر";
  if (n < 0) return `سالب ${integerToArabicWords(-n)}`;
  const { parts, rest } = scaleParts(n);
  if (rest > 0) parts.push(underThousand(rest));
  return parts.join(" و");
}

/** Whole riyals with the riyal noun in its grammatical form. */
function riyalsInWords(n: number): string {
  if (n === 1) return "ريال سعودي واحد";
  if (n === 2) return "ريالان سعوديان";
  const { parts, rest } = scaleParts(n);
  const r = rest % 100;
  if (rest === 0) return `${parts.join(" و")} ريال سعودي`;
  if (rest > 100 && (r === 1 || r === 2)) {
    // 101 / 1,002 …: «مائة ريال سعودي وريال واحد» — 1 and 2 have no counted form.
    const head = [...parts, underThousand(rest - r, true)].join(" و");
    return `${head} ريال سعودي و${r === 1 ? "ريال واحد" : "ريالان"}`;
  }
  if (rest === 1 || rest === 2) {
    return `${parts.join(" و")} ريال سعودي و${rest === 1 ? "ريال واحد" : "ريالان"}`;
  }
  const words = [...parts, underThousand(rest, r === 0)].join(" و");
  if (r === 0) return `${words} ريال سعودي`;
  if (r <= 10) return `${words} ريالات سعودية`;
  return `${words} ريالًا سعوديًا`;
}

/** 1–99 halalas — a feminine noun. */
function halalasInWords(h: number): string {
  if (h === 1) return "هللة واحدة";
  if (h === 2) return "هللتان";
  if (h <= 10) return `${ONES_FEMININE[h]} هللات`;
  if (h === 11) return "إحدى عشرة هللةً";
  if (h === 12) return "اثنتا عشرة هللةً";
  if (h < 20) return `${ONES_FEMININE[h % 10]} عشرة هللةً`;
  const t = Math.floor(h / 10);
  const o = h % 10;
  const unit = o === 1 ? "إحدى" : o === 2 ? "اثنتان" : (ONES_FEMININE[o] ?? "");
  return `${o ? `${unit} و` : ""}${TENS[t]} هللةً`;
}

function parseAmountNumber(raw: string): number | null {
  const n = parseLocaleNumber(raw);
  return Number.isFinite(n) ? n : null;
}

/** Renders the amount in words in riyals (and halalas when fractional). */
export function amountToArabicWords(raw: string | number): string {
  const n = typeof raw === "number" ? raw : parseAmountNumber(raw);
  if (n == null || !Number.isFinite(n)) return "—";
  if (n === 0) return "صفر ريال سعودي";

  const negative = n < 0;
  const abs = Math.abs(n);
  let riyals = Math.floor(abs + 1e-9);
  let hallalas = Math.round((abs - riyals) * 100);
  if (hallalas >= 100) {
    riyals += 1;
    hallalas = 0;
  }

  const parts: string[] = [];
  if (riyals > 0) parts.push(riyalsInWords(riyals));
  else if (hallalas === 0) parts.push("صفر ريال سعودي");
  if (hallalas > 0) parts.push(halalasInWords(hallalas));

  const text = parts.join(" و");
  return negative ? `سالب ${text}` : text;
}

// Intl.NumberFormat construction is expensive — cache one formatter per shape
// (the report build formats 100+ money cells per run).
const AMOUNT_FORMAT_INT = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});
const AMOUNT_FORMAT_FRACTION = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

export function formatAmountNumberDisplay(raw: string | number): string {
  const n = typeof raw === "number" ? raw : parseAmountNumber(raw);
  if (n == null) return "—";
  return (Number.isInteger(n) ? AMOUNT_FORMAT_INT : AMOUNT_FORMAT_FRACTION).format(n);
}
