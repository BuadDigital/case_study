import type { PoPropertyIntake } from "@platform/app-shared/app-data/po-intake-data";
import type {
  EvaluatorReportChoices,
  EvaluatorReportWorker,
  EvaluatorSubmission,
} from "../../../lib/evaluator/evaluator-window-data";
import type { EvaluatorRetrospectiveDraft } from "../../../lib/evaluator/evaluator-validation";
import type { FinalOpinionChangeHandler } from "./lib/valuation-data-state";
import type {
  ValuationWorkNavAvailability,
  ValuationWorkPropertyHint,
  ValuationWorkScreenId,
} from "./lib/shell-state";

export type ValuationWorkShellProps = {
  propertyId: string;
  poNumber?: string;
  assignmentType?: string;
  districtHint?: string;
  /** Field-inspection task — seeds cost actual age from the inspector package. */
  inspectionTaskId?: string | null;
  onFinalOpinionChange?: FinalOpinionChangeHandler;
  property?: ValuationWorkPropertyHint;
  /** Full intake row when available (final-review screen). */
  intakeProperty?: PoPropertyIntake | null;
  draft?: EvaluatorSubmission;
  disabled?: boolean;
  fieldErrors?: Record<string, string>;
  onDraftPatch?: (patch: {
    evaluatorPrice?: string;
    forcedSaleDiscountPct?: string;
    assetDataConfirmed?: boolean;
    assetDataVarianceNotes?: string;
    independenceDeclared?: boolean;
    reportWorkers?: EvaluatorReportWorker[];
  }) => void;
  onReportChoicesPatch?: (patch: Partial<EvaluatorReportChoices>) => void;
  onSubmit?: () => void;
  submitting?: boolean;
  showSubmit?: boolean;
  /** Controlled screen when embedded in EvaluatorWindow top tabs. */
  screen?: ValuationWorkScreenId;
  onScreenChange?: (screen: ValuationWorkScreenId) => void;
  /** Hide inner header/nav — top ValTabBar owns navigation. */
  embeddedInTopTabs?: boolean;
  /** Notify parent which approach tabs should appear (Rule Q-2). */
  onNavAvailabilityChange?: (nav: ValuationWorkNavAvailability) => void;
  onRetrospectiveDraftChange?: (draft: EvaluatorRetrospectiveDraft) => void;
};
