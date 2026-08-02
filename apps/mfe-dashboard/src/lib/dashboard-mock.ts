/** Literal mock content from Case Study.html `TREND_DATA` / `DWELL` (charts still prototype). */

export const TREND_DATA = {
  labels: [
    "ينا",
    "فبر",
    "مار",
    "أبر",
    "ماي",
    "يون",
    "يول",
    "أغس",
    "سبت",
    "أكت",
    "نوف",
    "ديس",
  ],
  "2024": [11, 13, 12, 16, 15, 19, 17, 22, 20, 24, 21, 26],
  "2025": [14, 17, 20, 22, 19, 26, 24, 29, 27, 31, 30, 34],
  "2026": [18, 24, 21, 30, 27, 35, 32, 41, 38, 44, 40, 47],
} as const;

export const TREND_COLORS: Record<string, string> = {
  "2024": "#9aa3b2",
  "2025": "var(--ink)",
  "2026": "var(--gold-d)",
};

export const TREND_QUARTER_LABELS = ["ربع 1", "ربع 2", "ربع 3", "ربع 4"];

/** [label, avgDays, slaLimitDays] */
export const DWELL_SLA: [string, number, number][] = [
  ["البيانات الأولية", 0.6, 1],
  ["البورصة", 1.4, 1],
  ["التوزيع", 0.7, 1],
  ["دراسة الحالة", 2.6, 2],
  ["المراجعة الحكومية", 1.9, 1.5],
  ["التقييم والرفع", 1.3, 1.5],
];
