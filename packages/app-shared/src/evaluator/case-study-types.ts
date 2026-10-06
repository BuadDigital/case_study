/**
 * Case-study domain types that `@evaluator/mfe` needs without importing
 * `@case-study/mfe`. Re-exported from the moved app-shared modules.
 */

export type {
  InspectorWorkspaceDraft,
  InspectorPhotoAttachment,
} from "../app-data/inspector-workspace-data";

export type {
  PoIntakeRecord,
  PoPropertyIntake,
  PoContact,
  PropertyUiStatus,
} from "../app-data/po-intake-property-model";

export type {
  CaseStudyReportAnswer,
  CaseStudyReportDraft,
  CaseStudyReportStatus,
} from "../app-data/case-study-report-model";

export type {
  PropertyDetailDocumentEntry,
  PropertyDetailDocumentSection,
} from "../app-data/property-detail-document-types";
