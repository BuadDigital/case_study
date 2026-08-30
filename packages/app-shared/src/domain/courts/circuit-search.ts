/** بحث وترتيب دوائر المحكمة — مواصفة circuit_select_field_spec. */

export type CircuitSearchItem = {
  id: string;
  circuitNo: string;
  circuitName?: string | null;
};

import { toLatinDigits } from "../../lib/arabic-digits";
export { toLatinDigits };

export function normalizeArabicSearchText(value: string): string {
  let s = toLatinDigits(value).trim().toLowerCase();
  s = s.replace(/[\u064B-\u065F\u0670]/g, "");
  s = s.replace(/[أإآٱ]/g, "ا");
  s = s.replace(/ة/g, "ه");
  s = s.replace(/ى/g, "ي");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

/** تجاهل «ال» التعريف في بداية كل كلمة. */
export function stripArabicAl(value: string): string {
  return normalizeArabicSearchText(value)
    .split(" ")
    .map((w) => w.replace(/^ال/, ""))
    .filter(Boolean)
    .join(" ");
}

function digitsOnly(value: string): string {
  return toLatinDigits(value).replace(/\D/g, "");
}

/** صيغ ترتيبية شائعة للدوائر (١–٤٠). */
const ORDINAL_FORMS: Record<number, string[]> = {
  1: ["الاولى", "الاول", "اولى", "اول", "واحده", "واحد"],
  2: ["الثانيه", "الثاني", "ثانيه", "ثاني"],
  3: ["الثالثه", "الثالث", "ثالثه", "ثالث"],
  4: ["الرابعه", "الرابع", "رابعه", "رابع"],
  5: ["الخامسه", "الخامس", "خامسه", "خامس"],
  6: ["السادسه", "السادس", "سادسه", "سادس"],
  7: ["السابعه", "السابع", "سابعه", "سابع"],
  8: ["الثامنه", "الثامن", "ثامنه", "ثامن"],
  9: ["التاسعه", "التاسع", "تاسعه", "تاسع"],
  10: ["العاشره", "العاشر", "عاشره", "عاشر"],
  11: [
    "الحاديه عشره",
    "الحادي عشر",
    "الحاديه عشر",
    "حاديه عشره",
    "حادي عشر",
  ],
  12: ["الثانيه عشره", "الثاني عشر", "الثانيه عشر", "ثانيه عشره", "ثاني عشر"],
  13: ["الثالثه عشره", "الثالث عشر", "الثالثه عشر", "ثالثه عشره", "ثالث عشر"],
  14: ["الرابعه عشره", "الرابع عشر", "الرابعه عشر", "رابعه عشره", "رابع عشر"],
  15: ["الخامسه عشره", "الخامس عشر", "الخامسه عشر", "خامسه عشره", "خامس عشر"],
  16: ["السادسه عشره", "السادس عشر", "السادسه عشر", "سادسه عشره", "سادس عشر"],
  17: ["السابعه عشره", "السابع عشر", "السابعه عشر", "سابعه عشره", "سابع عشر"],
  18: ["الثامنه عشره", "الثامن عشر", "الثامنه عشر", "ثامنه عشره", "ثامن عشر"],
  19: ["التاسعه عشره", "التاسع عشر", "التاسعه عشر", "تاسعه عشره", "تاسع عشر"],
  20: ["العشرون", "العشرين", "عشرون", "عشرين"],
  21: [
    "الحاديه والعشرون",
    "الحادي والعشرين",
    "الحاديه والعشرين",
    "الواحد والعشرون",
    "الواحده والعشرون",
  ],
  22: ["الثانيه والعشرون", "الثاني والعشرين", "الثانيه والعشرين"],
  23: ["الثالثه والعشرون", "الثالث والعشرين", "الثالثه والعشرين"],
  24: ["الرابعه والعشرون", "الرابع والعشرين", "الرابعه والعشرين"],
  25: ["الخامسه والعشرون", "الخامس والعشرين", "الخامسه والعشرين"],
  26: ["السادسه والعشرون", "السادس والعشرين", "السادسه والعشرين"],
  27: ["السابعه والعشرون", "السابع والعشرين", "السابعه والعشرين"],
  28: ["الثامنه والعشرون", "الثامن والعشرين", "الثامنه والعشرين"],
  29: ["التاسعه والعشرون", "التاسع والعشرين", "التاسعه والعشرين"],
  30: ["الثلاثون", "الثلاثين", "ثلاثون", "ثلاثين"],
  31: [
    "الواحده والثلاثون",
    "الواحد والثلاثون",
    "الواحد والثلاثين",
    "الواحده والثلاثين",
    "الواحد والثلاثون",
  ],
  32: ["الثانيه والثلاثون", "الثاني والثلاثون", "الثاني والثلاثين"],
  33: ["الثالثه والثلاثون", "الثالث والثلاثون", "الثالث والثلاثين"],
  34: ["الرابعه والثلاثون", "الرابع والثلاثون", "الرابع والثلاثين"],
  35: ["الخامسه والثلاثون", "الخامس والثلاثون", "الخامس والثلاثين"],
  36: ["السادسه والثلاثون", "السادس والثلاثون", "السادس والثلاثين"],
  37: ["السابعه والثلاثون", "السابع والثلاثون", "السابع والثلاثين"],
  38: ["الثامنه والثلاثون", "الثامن والثلاثون", "الثامن والثلاثين"],
  39: ["التاسعه والثلاثون", "التاسع والثلاثون", "التاسع والثلاثين"],
  40: ["الاربعون", "الاربعين", "اربعون", "اربعين"],
};

function normalizeOrdinalForm(form: string): string {
  return stripArabicAl(form);
}

const ORDINAL_TO_NUMBER = (() => {
  const map = new Map<string, number>();
  for (const [numStr, forms] of Object.entries(ORDINAL_FORMS)) {
    const n = Number(numStr);
    for (const form of forms) {
      map.set(normalizeOrdinalForm(form), n);
    }
  }
  return map;
})();

function ordinalFormsFor(n: number): string[] {
  return (ORDINAL_FORMS[n] ?? []).map(normalizeOrdinalForm);
}

/** مفاتيح مشتقة من حقول ثابتة — تُحسب مرة لكل عنصر بدل كل ضغطة مفتاح. */
const HAYSTACK_CACHE = new WeakMap<CircuitSearchItem, string>();
const SORT_KEY_CACHE = new WeakMap<CircuitSearchItem, string>();

function circuitHaystack(item: CircuitSearchItem): string {
  const cached = HAYSTACK_CACHE.get(item);
  if (cached !== undefined) return cached;
  const label = `${item.circuitName ?? ""} ${item.circuitNo}`.trim();
  const hay = stripArabicAl(label);
  HAYSTACK_CACHE.set(item, hay);
  return hay;
}

function circuitSortKey(item: CircuitSearchItem): string {
  const cached = SORT_KEY_CACHE.get(item);
  if (cached !== undefined) return cached;
  const digits = digitsOnly(item.circuitNo);
  const key = digits
    ? digits.padStart(4, "0")
    : stripArabicAl(item.circuitNo || item.circuitName || "");
  SORT_KEY_CACHE.set(item, key);
  return key;
}

export function circuitDisplayLabel(item: CircuitSearchItem): string {
  const name = item.circuitName?.trim();
  if (name) return name;
  return item.circuitNo.trim();
}

function hasStandaloneOrdinal(hay: string, n: number): boolean {
  const forms = ordinalFormsFor(n);
  if (forms.length === 0) return false;
  const toks = hay.split(/\s+/).filter(Boolean);

  if (n < 11) {
    for (let i = 0; i < toks.length; i++) {
      if (!forms.includes(toks[i]!)) continue;
      const next = toks[i + 1] ?? "";
      if (next.startsWith("عشر")) continue;
      return true;
    }
    return false;
  }

  return forms.some((f) => hay.includes(f));
}

/**
 * رتبة البحث: أصغر = أفضل.
 * 0 تطابق رقمي/ترتيبي تام، 1 بادئة رقمية، 2 تطابق نصي، null لا يظهر.
 */
/** تطبيع الاستعلام مرة واحدة خارج الحلقة — كان يعاد (٥+ تمريرات regex) لكل عنصر. */
function rankWithNormalizedQuery(
  qDigits: string,
  qText: string,
  item: CircuitSearchItem,
): number | null {
  const noDigits = digitsOnly(item.circuitNo);

  if (qDigits) {
    if (noDigits && noDigits === qDigits) return 0;
    const n = Number(qDigits);
    if (
      Number.isFinite(n) &&
      n > 0 &&
      hasStandaloneOrdinal(circuitHaystack(item), n)
    ) {
      return 0;
    }
    if (noDigits && noDigits.startsWith(qDigits)) return 1;
    return null;
  }

  if (!qText) return null;

  const hay = circuitHaystack(item);

  if (hay.includes(qText)) return 2;

  for (const [form, n] of ORDINAL_TO_NUMBER) {
    if (form.includes(qText) || qText.includes(form)) {
      if (hasStandaloneOrdinal(hay, n) || ordinalFormsFor(n).some((f) => hay.includes(f))) {
        return 2;
      }
    }
  }

  return null;
}

/** فلترة وترتيب الدوائر حسب الاستعلام. بدون q: ترتيب تصاعدي حسب الرقم. */
export function filterAndRankCircuits<T extends CircuitSearchItem>(
  circuits: readonly T[],
  query: string,
): T[] {
  const q = query.trim();
  if (!q) {
    // decorate-sort-undecorate — كان المقارن يعيد اشتقاق المفتاح (regex) لطرفي كل مقارنة.
    return circuits
      .map((item) => ({ item, key: circuitSortKey(item) }))
      .sort((a, b) => a.key.localeCompare(b.key, "en", { numeric: true }))
      .map((r) => r.item);
  }

  const qDigits = digitsOnly(q);
  const qText = stripArabicAl(q);
  const ranked: { item: T; rank: number; key: string }[] = [];
  for (const item of circuits) {
    const rank = rankWithNormalizedQuery(qDigits, qText, item);
    if (rank === null) continue;
    ranked.push({ item, rank, key: circuitSortKey(item) });
  }
  ranked.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    return a.key.localeCompare(b.key, "en", { numeric: true });
  });
  return ranked.map((r) => r.item);
}
