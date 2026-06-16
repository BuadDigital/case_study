import type { RoleId } from "@platform/types";

export type FieldDictionaryFieldType =
  | "text"
  | "textarea"
  | "richtext"
  | "number"
  | "decimal"
  | "currency"
  | "percent"
  | "date"
  | "time"
  | "datetime"
  | "list"
  | "multiselect"
  | "radio"
  | "checkbox"
  | "linked"
  | "bool"
  | "email"
  | "phone"
  | "url"
  | "file"
  | "image"
  | "signature"
  | "geo"
  | "barcode"
  | "rating"
  | "color"
  | "relation"
  | "formula"
  | "autonum";

export type FieldAssignmentMode = "input" | "view";

export type FieldDictionaryAssignment = {
  role: RoleId;
  screens: string[];
  mode: FieldAssignmentMode;
  required?: boolean;
  final?: boolean;
};

export type FieldDictionaryField = {
  id: string;
  ref: string;
  key: string;
  name: string;
  type: FieldDictionaryFieldType;
  tags: string[];
  source?: string;
  parent?: string;
  child?: string;
  persisted: boolean;
  assignments: FieldDictionaryAssignment[];
};

export type FieldDictionaryScreenStatus = "موجودة" | "مخططة";

export type FieldDictionaryScreen = {
  id: string;
  name: string;
  roles: RoleId[];
  status: FieldDictionaryScreenStatus;
};

export type FieldReliabilityMode = "واحد" | "متعدد";
export type FieldAssignmentReliability = "أولي" | "معتمد";

/** مصدر تعريف الحقل في القاموس */
export type FieldDictionaryLayer = "frontend" | "backend";

export type FieldDictionaryState = {
  fields: FieldDictionaryField[];
  tags: string[];
};
