import type { PropertyDetailPartyRoleKey } from "./property-detail-parties";
import type { GovernmentReviewKeysProofFile } from "./government-review-work-data";

export type PartyAnswerRow = {
  question: string;
  answer: string;
};

export type PropertyDetailPartySubmission = {
  roleKey: PropertyDetailPartyRoleKey;
  hasData: boolean;
  emptyReason?: string;
  statusLabel?: string;
  taskStatusLabel?: string;
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
  updatedAtUtc: string;
  submittedAtUtc?: string;
};

export type GovernmentReviewSubmissionSnapshot = {
  status: "draft" | "submitted" | "reopened";
  visitStatus: "completed" | "scheduled" | "blocked" | "";
  visitDate: string;
  courtName: string;
  keysStatus: "received" | "pending" | "not_required" | "";
  keysDescription: string;
  accessBlockReason: string;
  reviewNotes: string;
  returnNote?: string;
  propertyZoneStatus?: string;
  keysProofFiles?: GovernmentReviewKeysProofFile[];
  keysProofFileName?: string;
  submittedAtUtc: string | null;
  updatedAtUtc: string;
};

export type ValuationCoordinationSubmissionSnapshot = {
  status: "draft" | "submitted";
  receiptConfirmed: boolean;
  receiptDate: string;
  inspectorName: string;
  appraiserName: string;
  priority: "normal" | "urgent";
  coordinationNotes: string;
  inspectorInstructions: string;
  appraiserInstructions: string;
  submittedAtUtc: string | null;
  updatedAtUtc: string;
};
