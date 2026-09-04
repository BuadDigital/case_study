/**
 * Pure rules behind the valuation lists screen — the tab catalogue, each
 * list's column metadata, cell padding and the “add item” draft to DTO
 * mapping. No React, no I/O.
 */
import {
  VALUER_MEMBERSHIP_CATEGORIES,
  type ValuationListItemDto,
} from "@platform/api-client";

export type ValuationListTab = {
  id: string;
  label: string;
  kind: "table" | "ivs" | "photos" | "cert" | "parts";
};

export type AddItemDraft = {
  name: string;
  cells: string[];
  isRequired: boolean;
  propertyTypeKeys: string[];
};

export const TABS: { id: string; label: string; kind: "table" | "ivs" | "photos" | "cert" | "parts" }[] = [
  { id: "purposes", label: "أغراض التقييم", kind: "table" },
  { id: "valueBases", label: "أساس القيمة", kind: "table" },
  { id: "premises", label: "فرضية القيمة", kind: "table" },
  { id: "methods", label: "أساليب وطرق التقييم", kind: "table" },
  { id: "comparables", label: "العقارات المقارنة", kind: "table" },
  { id: "facades", label: "أنواع الواجهات", kind: "table" },
  { id: "boundaryTypes", label: "أنواع الحد", kind: "table" },
  { id: "glossary", label: "المصطلحات المهنية", kind: "table" },
  { id: "ivsStandards", label: "معايير التقييم الدولية", kind: "table" },
  { id: "attachments", label: "مرفقات التقرير", kind: "table" },
  { id: "certValuer", label: "بيانات المقيم المعتمد", kind: "cert" },
  { id: "participants", label: "المشاركون في إعداد التقرير", kind: "parts" },
  { id: "photos", label: "صفحات الصور", kind: "photos" },
  { id: "ivs", label: "تاريخ سريان المعايير", kind: "ivs" },
];

export const TABLE_META: Record<
  string,
  { addLabel: string; addTitle: string; cols: string[]; note: string }
> = {
  purposes: {
    addLabel: "إضافة غرض",
    addTitle: "إضافة غرض تقييم",
    cols: ["الغرض", "أساس القيمة المعتاد", "الاستخدام"],
    note: "الغرض المختار في المعاملة يُطبع في نطاق العمل، ويقترح أساس القيمة المعتاد له (قابل للتغيير من المقيم).",
  },
  valueBases: {
    addLabel: "إضافة أساس قيمة",
    addTitle: "إضافة أساس قيمة",
    cols: ["الأساس", "التعريف — يُطبع في التقرير عند اختيار الأساس", "الاستخدام"],
    note: "عند اختيار أساس القيمة المناسب للعقار في المعاملة يتبدل التعريف المطبوع في نطاق العمل تلقائيًا إلى تعريف الأساس المختار.",
  },
  premises: {
    addLabel: "إضافة فرضية",
    addTitle: "إضافة فرضية قيمة",
    cols: ["الفرضية", "تُستخدم مع", "الاستخدام"],
    note: "فرضية القيمة (الاستخدام المفترض) تُطبع في نطاق العمل بجانب أساس القيمة المختار.",
  },
  methods: {
    addLabel: "إضافة طريقة",
    addTitle: "إضافة أسلوب/طريقة تقييم",
    cols: ["الطريقة", "الأسلوب", "الاستخدام"],
    note: "لكل أسلوب تقييم طرقه — يختار المقيم في المعاملة الأسلوب ثم الطريقة، ويُطبع الاختيار في القسم «أسلوب وطريقة التقييم المستخدمة».",
  },
  comparables: {
    addLabel: "إضافة عنوان",
    addTitle: "إضافة عنوان مقارن",
    cols: ["العنوان", "مصدر التعبئة", "الاستخدام"],
    note: "العناوين المطلوبة لكل عقار مقارن — تظهر أعمدةً في جدول «العقارات المقارنة» بالتقرير، ويعبئها المقيم لكل مقارن.",
  },
  facades: {
    addLabel: "إضافة نوع واجهة",
    addTitle: "إضافة نوع واجهة",
    cols: ["نوع الواجهة", "الاستخدام"],
    note: "أنواع الواجهات — تُعرض قائمةَ اختيار في حقل «نوع الواجهة» لدى المعاين في شاشة المعاينة الميدانية، ويُنقل المختار إلى وصف العقار في التقرير.",
  },
  boundaryTypes: {
    addLabel: "إضافة نوع حد",
    addTitle: "إضافة نوع حد",
    cols: ["النوع", "الاستخدام"],
    note: "قائمة «النوع» في جدول الحدود والأطوال (استعلام البورصة). نوع «شارع» (المفتاح street) فقط يُحسب في عدد الشوارع بالتقرير والتسويات.",
  },
  glossary: {
    addLabel: "إضافة مصطلح",
    addTitle: "إضافة مصطلح مهني",
    cols: ["المصطلح", "التعريف — يُطبع في القسم 38 من التقرير", "الاستخدام"],
    note: "المفعَّل يُطبع في قسم «مصطلحات مهنية» بالتقرير.",
  },
  ivsStandards: {
    addLabel: "إضافة معيار",
    addTitle: "إضافة معيار تقييم دولي",
    cols: ["المعيار", "الوصف — يُطبع في القسم «معايير التقييم الدولية العامة»", "الاستخدام"],
    note: "المفعَّل يُطبع في التقرير.",
  },
  attachments: {
    addLabel: "إضافة مرفق",
    addTitle: "إضافة مرفق تقرير",
    cols: ["المرفق", "الإلزامية", "نوع العقار", "الاستخدام"],
    note: "الربط بنوع العقار منطق ثابت — الإعداد يحدد المرفق لا القاعدة.",
  },
};

export const PROPERTY_TYPE_SPLIT_RE = /[,،]/;

export function listDataColumnLabels(listId: string): string[] {
  return TABLE_META[listId]?.cols ?? [];
}

export function listCellCount(listId: string): number {
  return Math.max(0, listDataColumnLabels(listId).length - 2);
}

export function rowCellsForList(listId: string, row: ValuationListItemDto): string[] {
  const count = listCellCount(listId);
  const cells = [...row.cells];
  while (cells.length < count) cells.push("");
  return cells.slice(0, count);
}

export function valuationListMiddleCount(tab: string): number {
  if (tab === "attachments") return 2;
  return listCellCount(tab);
}

export function valuationListThClass(label: string, idx: number): string {
  if (idx === 0) return "align-middle";
  if (label === "الاستخدام") return "text-center align-middle";
  return "align-middle";
}

export function valuationListInlineInputClassName(): string {
  return "w-full min-w-0 border-0 border-b border-transparent bg-transparent p-0.5 font-[inherit] text-[13px] text-text outline-none focus:border-gold";
}

export function emptyAddDraft(listId: string): AddItemDraft {
  return {
    name: "",
    cells: Array.from({ length: listCellCount(listId) }, () => ""),
    isRequired: false,
    propertyTypeKeys: [],
  };
}

export function buildNewItem(
  listId: string,
  draft: AddItemDraft,
  sortOrder: number,
): ValuationListItemDto {
  const name = draft.name.trim();
  const cells =
    listId === "attachments"
      ? [
          draft.isRequired ? "إلزامي" : "اختياري",
          draft.propertyTypeKeys.length
            ? draft.propertyTypeKeys.join("، ")
            : "الكل",
        ]
      : draft.cells.map((c) => c.trim() || "—");
  return {
    id: `${listId}-${Date.now()}`,
    key: `item-${Date.now().toString(36)}`,
    name,
    cells,
    isEnabled: true,
    defaultName: name,
    usage: 0,
    sortOrder,
    isSystemDefault: false,
    isRequired: draft.isRequired,
    propertyTypeKeys: draft.propertyTypeKeys,
  };
}

export function membershipLabel(value: string | null | undefined): string {
  return VALUER_MEMBERSHIP_CATEGORIES.find((x) => x.value === value)?.label ?? value ?? "—";
}
