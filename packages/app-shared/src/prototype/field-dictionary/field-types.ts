import type { FieldDictionaryFieldType } from "./types";

export const FIELD_TYPE_LABELS: Record<FieldDictionaryFieldType, string> = {
  text: "نص قصير",
  textarea: "نص طويل",
  richtext: "نص منسّق",
  number: "رقم",
  decimal: "عدد عشري",
  currency: "عملة",
  percent: "نسبة مئوية",
  date: "تاريخ",
  time: "وقت",
  datetime: "تاريخ ووقت",
  list: "قائمة منسدلة",
  multiselect: "اختيار متعدد",
  radio: "أزرار اختيار",
  checkbox: "مربعات تأشير",
  linked: "قائمة مرتبطة",
  bool: "نعم/لا",
  email: "بريد إلكتروني",
  phone: "هاتف",
  url: "رابط",
  file: "مرفق/ملف",
  image: "صورة",
  signature: "توقيع",
  geo: "موقع جغرافي",
  barcode: "باركود/QR",
  rating: "تقييم",
  color: "لون",
  relation: "مرجع لسجل",
  formula: "حقل محسوب",
  autonum: "ترقيم تلقائي",
};

export const FIELD_TYPE_GROUPS: { label: string; types: FieldDictionaryFieldType[] }[] =
  [
    {
      label: "نصوص",
      types: ["text", "textarea", "richtext"],
    },
    {
      label: "أرقام",
      types: ["number", "decimal", "currency", "percent"],
    },
    {
      label: "تاريخ ووقت",
      types: ["date", "time", "datetime"],
    },
    {
      label: "اختيارات",
      types: [
        "list",
        "multiselect",
        "radio",
        "checkbox",
        "linked",
        "bool",
      ],
    },
    {
      label: "هوية واتصال",
      types: ["email", "phone", "url"],
    },
    {
      label: "متخصصة",
      types: [
        "file",
        "image",
        "signature",
        "geo",
        "barcode",
        "rating",
        "color",
      ],
    },
    {
      label: "علائقية ومحسوبة",
      types: ["relation", "formula", "autonum"],
    },
  ];

export const SOURCE_REQUIRED_TYPES: FieldDictionaryFieldType[] = [
  "list",
  "multiselect",
  "radio",
  "checkbox",
  "linked",
  "relation",
  "number",
  "decimal",
  "currency",
  "percent",
];
