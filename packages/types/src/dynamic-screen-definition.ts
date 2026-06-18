import type { RoleId } from "./navigation";

/** Field data types for CDO-built dynamic screens. */
export type DynamicScreenFieldType =
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
  | "autonum";

export type DynamicScreenStatus = "مخططة" | "موجودة";

export type DynamicScreenField = {
  id: string;
  ref: string;
  name: string;
  type: DynamicScreenFieldType;
  /** Static options for list-like types. */
  options?: string[];
  placeholder?: string;
};

export type DynamicScreenLayoutCell = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type DynamicScreenFieldBinding = {
  fieldId: string;
  mode: "input" | "view";
  required?: boolean;
  layout: DynamicScreenLayoutCell;
};

export type DynamicScreenDefinition = {
  code: string;
  ownerRole?: RoleId | string;
  status: DynamicScreenStatus;
  fields: DynamicScreenField[];
  bindings: DynamicScreenFieldBinding[];
};

export type DynamicScreenSubmission = {
  id: string;
  screenId: string;
  userId: string;
  answers: Record<string, unknown>;
  isDraft: boolean;
  updatedAtUtc: string;
  submittedAtUtc: string | null;
};

export type SaveDynamicScreenDefinitionRequest = {
  code?: string | null;
  ownerRole?: string;
  fields: DynamicScreenField[];
  bindings: DynamicScreenFieldBinding[];
};

export type SaveDynamicScreenSubmissionRequest = {
  answers: Record<string, unknown>;
  isDraft: boolean;
};
