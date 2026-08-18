import type { PropertyDetailDocumentEntry } from "./property-detail-documents";

export type InfathRoleKey =
  | "MA"
  | "EN"
  | "EV"
  | "GR"
  | "BR"
  | "SP"
  | "SY"
  | "UN";

export type InfathFieldType = "text" | "area" | "sel" | "auto" | "file" | "ref";

export type InfathFieldState = "" | "cf" | "ms" | "un";

export type InfathUploadField = {
  id: string;
  label: string;
  value: string;
  role: InfathRoleKey;
  type: InfathFieldType;
  state?: InfathFieldState;
};

export type InfathUploadSection = {
  id: string;
  num: string;
  title: string;
  badge?: string;
  fields: InfathUploadField[];
  areas: InfathUploadField[];
  conditional?: boolean;
};

export type InfathUploadAttachment = {
  id: string;
  name: string;
  infathTarget: string;
  status: "ready" | "conditional" | "missing";
  conditional?: boolean;
  document: PropertyDetailDocumentEntry | null;
};

export type InfathUploadStats = {
  conflicts: number;
  missing: number;
  unresolved: number;
  attachments: number;
};

export type InfathUploadModel = {
  sections: InfathUploadSection[];
  attachments: InfathUploadAttachment[];
  stats: InfathUploadStats;
  copyableTotal: number;
  unresolvedPoints: string[];
};

export const INFAZ_UPLOAD_UNRESOLVED_POINTS = [
  "مصدر «تاريخ المعاينة/التقييم» في بيانات التقرير",
  "هل «المعاين» هو الأصيل لقسم وصف الأصل؟",
  "مساحات المباني (القبو/اللاحق/المباني): مكتب هندسي أم مقيم؟",
  "قسم العاملين على التقرير: تعبئة تلقائية من الحسابات؟",
];
