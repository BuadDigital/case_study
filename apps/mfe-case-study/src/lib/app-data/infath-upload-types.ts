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
  /**
   * `ready` = a file can be downloaded now; `conditional` = only needed in some cases and missing;
   * `missing` = needed and missing; `not-needed` = this transaction has no such file at all (the badge
   * then shows `statusNote`, e.g. «لا يوجد رفع مساحي»).
   */
  status: "ready" | "conditional" | "missing" | "not-needed";
  conditional?: boolean;
  /** The badge text when `status` is `not-needed`. */
  statusNote?: string;
  /**
   * The file behind the row. The case-study report has no stored file: its entry carries only a name,
   * and the PDF is printed when the row is downloaded.
   */
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
  "مساحات المباني (القبو/اللاحق/المباني): مكتب هندسي أم مقيّم؟",
  "قسم العاملين على التقرير: تعبئة تلقائية من الحسابات؟",
];
