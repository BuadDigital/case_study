// toLocaleString ينشئ Intl.NumberFormat في كل نداء — الشاشات تنادي fmt لعشرات
// الخلايا مع كل رسم، فنبقي منسّقاً واحداً لكل عدد كسور.
const NUM_FORMATS = new Map<number, Intl.NumberFormat>();

export function fmt(n: number | null | undefined, digits = 0): string {
  if (n == null || !Number.isFinite(n)) return "—";
  // أرقام لاتينية موحّدة مع بقية النظام (بطاقة العقار، جدول التسويات، التقارير).
  let formatter = NUM_FORMATS.get(digits);
  if (!formatter) {
    formatter = new Intl.NumberFormat("en-US", {
      maximumFractionDigits: digits,
      minimumFractionDigits: digits > 0 ? Math.min(digits, 2) : 0,
    });
    NUM_FORMATS.set(digits, formatter);
  }
  return formatter.format(n);
}

// شاشات المالية تعرض المبالغ بحد أقصى للكسور دون أصفار إلزامية
// (1,234.5 وليس 1,234.50) — منسّق منفصل يحافظ على العرض نفسه.
const MAX_ONLY_FORMATS = new Map<number, Intl.NumberFormat>();

/** يكافئ toLocaleString("en-US", { maximumFractionDigits: digits }) مع "—" للفارغ. */
export function fmtMax(n: number | null | undefined, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return "—";
  let formatter = MAX_ONLY_FORMATS.get(digits);
  if (!formatter) {
    formatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: digits });
    MAX_ONLY_FORMATS.set(digits, formatter);
  }
  return formatter.format(n);
}

/** مبلغ بالريال — fmt مع لاحقة "ر.س"، و"—" دون لاحقة عند الغياب. */
export function fmtSar(n: number | null | undefined, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${fmt(n, digits)} ر.س`;
}
