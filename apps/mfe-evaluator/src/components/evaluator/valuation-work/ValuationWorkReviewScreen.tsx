"use client";

import { Suspense, lazy } from "react";
import { InlineLoadingSkeleton, Spinner } from "@platform/ui-kit";
import type { PoPropertyIntake } from "@platform/app-shared/app-data/po-intake-data";
import type {
  EvaluatorReportChoices,
  EvaluatorReportWorker,
  EvaluatorSubmission,
} from "../../../lib/evaluator/evaluator-window-data";
import { createEvaluatorDraft } from "../../../lib/evaluator/evaluator-window-data";
import type { ValuationApproachSettingsDto } from "@platform/api-client";
import { PrimaryBtn } from "./atoms";

const EvaluatorFinalReviewTab = lazy(() =>
  import("../EvaluatorFinalReviewTab").then((m) => ({
    default: m.EvaluatorFinalReviewTab,
  })),
);

export function ValuationWorkReviewScreen({
  draft,
  propertyId,
  poNumber,
  assignmentType,
  disabled = false,
  intakeProperty = null,
  valuationRequestId,
  approachSettings,
  fieldErrors,
  onDraftPatch,
  onReportChoicesPatch,
  onSettingsSaved,
  showSubmit = false,
  submitting = false,
  onSubmit,
}: {
  draft?: EvaluatorSubmission;
  propertyId: string;
  poNumber?: string;
  assignmentType?: string;
  disabled?: boolean;
  intakeProperty?: PoPropertyIntake | null;
  valuationRequestId: string | null;
  approachSettings: ValuationApproachSettingsDto | null;
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
  onSettingsSaved?: (saved: ValuationApproachSettingsDto) => void;
  showSubmit?: boolean;
  submitting?: boolean;
  onSubmit?: () => void;
}) {
  const reviewDraft =
    draft ??
    createEvaluatorDraft({
      taskId: "",
      propertyId,
      poNumber: poNumber ?? "",
      assignmentType,
    });
  return (
    <>
      <Suspense fallback={<InlineLoadingSkeleton />}>
        <EvaluatorFinalReviewTab
          draft={reviewDraft}
          disabled={disabled}
          property={intakeProperty}
          valuationRequestId={valuationRequestId}
          approachSettings={approachSettings}
          fieldErrors={fieldErrors}
          onDraftPatch={onDraftPatch}
          onReportChoicesPatch={onReportChoicesPatch}
          onSettingsSaved={onSettingsSaved}
        />
      </Suspense>
      {showSubmit ? (
        <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
          <PrimaryBtn
            disabled={disabled || submitting}
            onClick={() => onSubmit?.()}
          >
            {submitting ? <Spinner /> : null}
            <span>
              {submitting
                ? "جاري الاعتماد…"
                : "اعتماد التقييم وإرسال للأخصائي"}
            </span>
          </PrimaryBtn>
        </div>
      ) : null}
    </>
  );
}
