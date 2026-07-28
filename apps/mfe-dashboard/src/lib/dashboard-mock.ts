/** Literal mock content from Case Study.html `renderDashboard` / `TREND_DATA` / `DWELL`. */

export type DashActivityIcon = "bell" | "file" | "eye" | "pin" | "tri" | "mail" | "check";

export type DashActivityItem = {
  ic: DashActivityIcon;
  c: string;
  t: string;
  /** Minutes ago relative to “now”. */
  o: number;
  open: string;
};

export const DASH_ACTIVITY_ITEMS: DashActivityItem[] = [
  {
    ic: "bell",
    c: "#d9a441",
    t: "تذكير: مهمة «زيارة محكمة التنفيذ بجدة» تقترب من الاستحقاق",
    o: 5,
    open: "task:T-2041",
  },
  {
    ic: "file",
    c: "var(--gold-d)",
    t: "أمر عمل جديد بانتظار الإسناد — PO-057114 (قطاع خاص · 4 عقارات)",
    o: 14,
    open: "po:PO-057114",
  },
  {
    ic: "eye",
    c: "#3f8f5f",
    t: "المعاين أعاد معاينة العقار (صك 88120044991) — جاهزة لدراسة الحالة",
    o: 27,
    open: "po:PO-2026-7",
  },
  {
    ic: "pin",
    c: "var(--ink)",
    t: "المكتب الهندسي رفع التقرير المساحي — PO-2026-0011",
    o: 41,
    open: "po:PO-2026-0011",
  },
  {
    ic: "tri",
    c: "#d9694f",
    t: "تعذّر جديد على عقار النسيم (صك 45500213366)",
    o: 49,
    open: "",
  },
  {
    ic: "mail",
    c: "var(--ink)",
    t: "تم تسجيل ظرف مفاتيح جديد ENV-2026-014",
    o: 72,
    open: "",
  },
  {
    ic: "check",
    c: "#3f8f5f",
    t: "أُغلقت مهمة «استفسار البورصة» بنجاح",
    o: 96,
    open: "",
  },
];

export const DASH_SEEN_KEY = "dashSeenTs";

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
