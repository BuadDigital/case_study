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
  CaseStudyFormAnswer,
  CaseStudyFormDraft,
  CaseStudyFormStatus,
} from "../app-data/case-study-form-model";

export type {
  PropertyDetailDocumentEntry,
  PropertyDetailDocumentSection,
} from "../app-data/property-detail-document-types";
