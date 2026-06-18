import type { DynamicScreenFieldType } from "@platform/types";

export const DYNAMIC_SCREEN_FIELD_TYPE_LABELS: Record<
  DynamicScreenFieldType,
  string
> = {
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
  autonum: "ترقيم تلقائي",
};

export const DYNAMIC_SCREEN_FIELD_TYPE_GROUPS: {
  label: string;
  types: DynamicScreenFieldType[];
}[] = [
  { label: "نصوص", types: ["text", "textarea", "richtext"] },
  {
    label: "أرقام",
    types: ["number", "decimal", "currency", "percent"],
  },
  { label: "تاريخ ووقت", types: ["date", "time", "datetime"] },
  {
    label: "اختيارات",
    types: ["list", "multiselect", "radio", "checkbox", "bool"],
  },
  { label: "اتصال", types: ["email", "phone", "url"] },
  {
    label: "متخصصة",
    types: ["file", "image", "signature", "geo", "barcode", "rating", "color", "autonum"],
  },
];

export const LIST_LIKE_FIELD_TYPES: DynamicScreenFieldType[] = [
  "list",
  "multiselect",
  "radio",
  "checkbox",
];
