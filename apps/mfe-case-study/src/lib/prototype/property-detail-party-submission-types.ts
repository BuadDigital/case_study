import type { PropertyDetailPartyRoleKey } from "./property-detail-parties";

export type PartyAnswerRow = {
  question: string;
  answer: string;
  answeredByName?: string | null;
  answeredAtUtc?: string | null;
  sourceRole?: string | null;
  taskId?: string | null;
};

export type PropertyDetailPartySubmission = {
  roleKey: PropertyDetailPartyRoleKey;
  hasData: boolean;
  emptyReason?: string;
  statusLabel?: string;
  taskStatusLabel?: string;
  /** ISO timestamp when the party submitted (for party cards / timeline). */
  submittedAtUtc?: string | null;
  /** Specialist acceptance — only accepted packages feed إنفاذ. */
  acceptedAtUtc?: string | null;
  acceptedByName?: string | null;
  /** Raw package workflow status for accept/return actions. */
  packageStatus?: "draft" | "submitted" | "reopened" | string;
  fields: { label: string; value: string; ltr?: boolean }[];
  answers: PartyAnswerRow[];
  remarks: { label: string; value: string }[];
};

export type EvaluatorChecklist = Record<string, boolean | null | string>;

export type EvaluatorSubmissionSnapshot = {
  status: string;
  evaluatorPrice: string;
  evaluatorNotes: string;
  reportFileName: string | null;
  reportNo?: string;
  submittedAtUtc: string | null;
  checklist: EvaluatorChecklist;
  appraisalDate?: string;
  valuationMethod?: string;
  valueBasis?: string;
  demandLevel?: string;
  landValue?: string;
  buildingValue?: string;
  forcedSaleDiscountPct?: string;
  searchScopeNotes?: string;
  planImageFileName?: string | null;
  appraiserAddress?: string;
  appraiserPhone?: string;
  reportIssueDate?: string;
  depositCode?: string;
  depositCertificateFileName?: string | null;
  independenceDeclared?: boolean;
  reportWorkers?: {
    id?: string;
    role?: string;
    name?: string;
    licenseNumber?: string;
    licenseDate?: string;
    licenseFileName?: string | null;
  }[];
  assetDataConfirmed?: boolean;
  assetDataVarianceNotes?: string;
  acceptedAtUtc?: string | null;
  acceptedByName?: string | null;
  returnNote?: string | null;
};

export type EngineeringSurveyChecklistAnswer = "yes" | "no" | null;

export type EngineeringSurveyChecklistRow = {
  answer: EngineeringSurveyChecklistAnswer;
  note: string;
};

export type EngineeringSurveySubmissionSnapshot = {
  status: "draft" | "submitted" | "reopened";
  latitude: string;
  longitude: string;
  surveyReportFileName: string;
  siteLetterFileName: string;
  siteConfirmed: boolean;
  checklist: EngineeringSurveyChecklistRow[];
  returnNote?: string;
  onSiteAreaSqm: string;
  northBoundary: string;
  northBoundaryLengthM: string;
  southBoundary: string;
  southBoundaryLengthM: string;
  eastBoundary: string;
  eastBoundaryLengthM: string;
  westBoundary: string;
  westBoundaryLengthM: string;
  surveyNotes: string;
  /** ملاحظة تبويب «ملاحظة» في مساحة المكتب الهندسي */
  transactionNote: string;
  updatedAtUtc: string;
  submittedAtUtc?: string;
  acceptedAtUtc?: string | null;
  acceptedByName?: string | null;
};
