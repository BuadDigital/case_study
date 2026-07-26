/** تفقيط مبالغ الريال السعودي لعرض «كتابة» بجانب الحقول الرقمية. */

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

function underThousand(n: number): string {
  if (n < 100) return underHundred(n);
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const head = HUNDREDS[h] ?? "";
  if (!rest) return head;
  return `${head} و${underHundred(rest)}`;
}

type Scale = {
  value: number;
  one: string;
  dual: string;
  few: string;
  many: string;
};

const SCALES: Scale[] = [
  { value: 1_000_000_000, one: "مليار", dual: "ملياران", few: "مليارات", many: "مليار" },
  { value: 1_000_000, one: "مليون", dual: "مليونان", few: "ملايين", many: "مليون" },
  { value: 1_000, one: "ألف", dual: "ألفان", few: "آلاف", many: "ألف" },
];

function scaleLabel(count: number, scale: Scale): string {
  if (count === 1) return scale.one;
  if (count === 2) return scale.dual;
  if (count >= 3 && count <= 10) return `${underThousand(count)} ${scale.few}`;
  return `${underThousand(count)} ${scale.many}`;
}

function integerToArabicWords(n: number): string {
  if (n === 0) return "صفر";
  if (n < 0) return `سالب ${integerToArabicWords(-n)}`;

  const parts: string[] = [];
  let rem = n;

  for (const scale of SCALES) {
    if (rem < scale.value) continue;
    const count = Math.floor(rem / scale.value);
    rem %= scale.value;
    parts.push(scaleLabel(count, scale));
  }

  if (rem > 0) {
    parts.push(underThousand(rem));
  }

  return parts.join(" و");
}

function parseAmountNumber(raw: string): number | null {
  const cleaned = raw.replace(/,/g, "").trim();
  if (!cleaned) return null;
  const n = Number.parseFloat(cleaned);
  if (!Number.isFinite(n)) return null;
  return n;
}

/** يعرض المبلغ كتابةً بالريال (والهللة إن وُجدت كسور). */
export function amountToArabicWords(raw: string | number): string {
  const n = typeof raw === "number" ? raw : parseAmountNumber(raw);
  if (n == null) return "—";
  if (n === 0) return "صفر ريال سعودي";

  const negative = n < 0;
  const abs = Math.abs(n);
  const riyals = Math.floor(abs + 1e-9);
  const hallalas = Math.round((abs - riyals) * 100);

  const parts: string[] = [];
  if (riyals > 0) {
    parts.push(`${integerToArabicWords(riyals)} ريال سعودي`);
  } else if (hallalas === 0) {
    parts.push("صفر ريال سعودي");
  }

  if (hallalas > 0) {
    parts.push(`${integerToArabicWords(hallalas)} هللة`);
  }

  const text = parts.join(" و");
  return negative ? `سالب ${text}` : text;
}

export function formatAmountNumberDisplay(raw: string | number): string {
  const n = typeof raw === "number" ? raw : parseAmountNumber(raw);
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
  }).format(n);
}
