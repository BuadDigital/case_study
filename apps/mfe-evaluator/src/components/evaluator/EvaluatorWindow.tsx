"use client";

import { InlineLoadingSkeleton, Spinner, cn, useToast } from "@platform/ui-kit";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WorkflowTask } from "@case-study/mfe";
import { inspectionGateForAppraisal } from "../../lib/evaluator/evaluator-inspection-gate";
import { createEvaluatorDraft } from "../../lib/evaluator/evaluator-window-data";
import { hydrateEvaluatorSubmission, isEvaluatorFormLocked, updateEvaluatorDraft,
  type EvaluatorPlanImageMetadata,
  type EvaluatorReportMetadata,
} from "../../lib/evaluator/evaluator-submission-storage";
import type { EvaluatorSubmission } from "../../lib/evaluator/evaluator-window-data";
import { scheduleScrollToFormField } from "@platform/app-shared/form-ux";
import {
  firstEvaluatorError,
  firstEvaluatorErrorTarget,
  validateEvaluatorSubmission,
  type EvaluatorValidationErrors,
} from "../../lib/evaluator/evaluator-validation";
import { finalizeAppraiserSubmission } from "../../lib/evaluator/finalize-appraiser-submission";
import type { EvaluatorWindowHostRefObject } from "../../lib/evaluator/evaluator-window-host";
import type {
  EvaluatorChecklistAnswers,
  EvaluatorReportChoices,
  EvaluatorReportWorker,
} from "../../lib/evaluator/evaluator-window-data";
import {
  type EvaluatorPropertySummary,
} from "./EvaluatorPropertyTab";
import { EvaluatorValuationReportOutputTab } from "./EvaluatorValuationReportOutputTab";
import { EvaluatorValuationReportTab } from "./EvaluatorValuationReportTab";
import {
  appraiserInspectionDone,
  appraiserNeedsSurvey,
  appraiserSurveyDone,
} from "../../lib/evaluator/evaluator-readiness";
import { computePropertyTotal } from "../../lib/evaluator/value-estimation";
import {
  EngInfo,
  ValTabBar,
  valCardClassName,
  valPpHeadClassName,
  valPrimaryBtnClassName,
} from "./EvaluatorHtmlPrimitives";

export type EvaluatorWindowTab = "report" | "output";

const VAL_TABS: { id: EvaluatorWindowTab; label: string }[] = [
  { id: "report", label: "تقييم العقار" },
  { id: "output", label: "تقرير التقييم" },
];

export function EvaluatorWindow({
  task,
  tasks,
  hostRef,
  propertySummary,
  initialTab = "report",
  deedLabel,
  embeddedInPropertyChrome = false,
}: {
  task: WorkflowTask;
  tasks: WorkflowTask[];
  hostRef: EvaluatorWindowHostRefObject;
  propertySummary?: EvaluatorPropertySummary;
  initialTab?: EvaluatorWindowTab;
  deedLabel?: string;
  onBack?: () => void;
  embeddedInPropertyChrome?: boolean;
}) {
  const gate = useMemo(
    () => inspectionGateForAppraisal(task, tasks),
    [task, tasks],
  );
  const { showToast } = useToast();

  const [draft, setDraft] = useState<EvaluatorSubmission>(() =>
    createEvaluatorDraft({
      taskId: task.id,
      propertyId: task.propertyId ?? "",
      poNumber: task.poNumber,
      assignmentType: task.assignmentType,
    }),
  );
  const [draftLoading, setDraftLoading] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<EvaluatorValidationErrors>(
    {},
  );
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<EvaluatorWindowTab>(initialTab);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const locked = isEvaluatorFormLocked(draft.status);
  const formDisabled = locked || !gate.ready;

  const persistDraft = useCallback(
    (
      patch: Partial<{
        evaluatorPrice: string;
        evaluatorNotes: string;
        appraisalDate: string;
        valuationMethod: string;
        valueBasis: string;
        demandLevel: string;
        landValue: string;
        buildingValue: string;
        forcedSaleDiscountPct: string;
        searchScopeNotes: string;
        planImageFileName: string | null;
        appraiserAddress: string;
        appraiserPhone: string;
        checklist: EvaluatorChecklistAnswers;
        assetDataConfirmed: boolean;
        assetDataVarianceNotes: string;
        independenceDeclared: boolean;
        reportWorkers: EvaluatorReportWorker[];
        depositCode: string;
        depositCertificateFileName: string | null;
        reportChoices: EvaluatorReportChoices;
      }>,
      reportMetadata?: EvaluatorReportMetadata,
      planImageMetadata?: EvaluatorPlanImageMetadata,
    ) => {
      if (locked) return;
      void updateEvaluatorDraft(task.id, patch, reportMetadata, planImageMetadata)
        .then((updated) => {
          if (updated) setDraft(updated);
        })
        .catch((err: unknown) => {
          showToast(
            err instanceof Error ? err.message : "تعذّر حفظ مسودة التقييم — حاول مرة أخرى",
            "error",
          );
        });
    },
    [locked, task.id, showToast],
  );

  const scheduleAutosave = useCallback(
    (patch: Parameters<typeof persistDraft>[0]) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => persistDraft(patch), 400);
    },
    [persistDraft],
  );

  useEffect(() => {
    let cancelled = false;
    void hydrateEvaluatorSubmission({
      taskId: task.id,
      propertyId: task.propertyId ?? "",
      poNumber: task.poNumber,
      assignmentType: task.assignmentType,
    }).then((loaded) => {
      if (!cancelled) {
        const summed = computePropertyTotal(
          loaded.landValue,
          loaded.buildingValue,
        );
        const currentTotal = Number.parseFloat(
          (loaded.evaluatorPrice || "0").replace(/,/g, ""),
        );
        const reconciled =
          summed > 0 &&
          (!Number.isFinite(currentTotal) || currentTotal === 0)
            ? {
                ...loaded,
                evaluatorPrice: String(summed),
              }
            : loaded;
        setDraft(reconciled);
        if (reconciled !== loaded) {
          void updateEvaluatorDraft(task.id, {
            evaluatorPrice: reconciled.evaluatorPrice,
          }).catch(() => {
            /* best-effort; UI already shows the sum */
          });
        }
        setDraftLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [task.id, task.propertyId, task.poNumber]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const submit = useCallback(async (): Promise<boolean> => {
    if (locked) return false;
    if (!gate.ready) {
      setFormError(gate.reason);
      showToast(gate.reason, "error");
      return false;
    }

    const errors = validateEvaluatorSubmission({
      taskId: task.id,
      evaluatorPrice: draft.evaluatorPrice,
      landValue: draft.landValue,
      buildingValue: draft.buildingValue,
      forcedSaleDiscountPct: draft.forcedSaleDiscountPct,
      assetDataConfirmed: draft.assetDataConfirmed,
      assetDataVarianceNotes: draft.assetDataVarianceNotes,
      independenceDeclared: draft.independenceDeclared,
      reportWorkers: draft.reportWorkers,
    });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      const message =
        firstEvaluatorError(errors) ?? "تحقق من الحقول المطلوبة";
      setFormError(message);
      showToast(message, "error");
      setActiveTab("report");
      scheduleScrollToFormField(firstEvaluatorErrorTarget(errors), 120);
      return false;
    }

    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }

    setSubmitting(true);
    hostRef.current?.onSavingChange?.(true);
    setFormError(null);
    try {
      try {
        const updated = await updateEvaluatorDraft(task.id, {
          landValue: draft.landValue,
          buildingValue: draft.buildingValue,
          forcedSaleDiscountPct: draft.forcedSaleDiscountPct,
          evaluatorPrice: draft.evaluatorPrice,
          assetDataConfirmed: draft.assetDataConfirmed,
          assetDataVarianceNotes: draft.assetDataVarianceNotes,
          independenceDeclared: draft.independenceDeclared,
          reportWorkers: draft.reportWorkers,
          valuationMethod: draft.valuationMethod,
          valueBasis: draft.valueBasis,
          demandLevel: draft.demandLevel,
          depositCode: draft.depositCode,
          depositCertificateFileName: draft.depositCertificateFileName,
        });
        if (updated) setDraft(updated);
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : "تعذّر حفظ مسودة التقييم — حاول مرة أخرى";
        setFormError(message);
        showToast(message, "error");
        return false;
      }

      const result = await finalizeAppraiserSubmission(task.id);
      if (result.ok) {
        setDraft(result.submission);
        showToast(
          "تم اعتماد التقييم وإرساله لأخصائي دراسة الحالة.",
          "success",
        );
        hostRef.current?.onSubmitted?.();
        return true;
      }
      setFormError(result.message);
      showToast(result.message, "error");
      return false;
    } finally {
      setSubmitting(false);
      hostRef.current?.onSavingChange?.(false);
    }
  }, [
    locked,
    gate,
    task.id,
    draft.evaluatorPrice,
    draft.landValue,
    draft.buildingValue,
    draft.forcedSaleDiscountPct,
    draft.assetDataConfirmed,
    draft.assetDataVarianceNotes,
    draft.independenceDeclared,
    draft.reportWorkers,
    draft.valuationMethod,
    draft.valueBasis,
    draft.demandLevel,
    draft.depositCode,
    draft.depositCertificateFileName,
    hostRef,
    showToast,
  ]);

  useEffect(() => {
    if (!hostRef.current) return;
    hostRef.current.submit = submit;
    hostRef.current.focusEvaluatorNotes = () => {
      const field = document.getElementById("evaluator_notes") as
        | HTMLTextAreaElement
        | null;
      if (!field) return;
      field.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => field.focus(), 120);
    };
  }, [hostRef, submit]);

  if (draftLoading) {
    return (
      <div className="flex flex-col gap-3.5">
        <InlineLoadingSkeleton className="my-2" />
      </div>
    );
  }

  const inspected = appraiserInspectionDone(task, tasks);
  const needsSurvey = appraiserNeedsSurvey(task, tasks);
  const surveyed = appraiserSurveyDone(task, tasks);
  const summary: EvaluatorPropertySummary = {
    deedNumber: propertySummary?.deedNumber ?? "—",
    poNumber: propertySummary?.poNumber ?? task.poNumber,
    classification: propertySummary?.classification ?? "—",
    cityDistrict: propertySummary?.cityDistrict ?? "—",
    assignedAt:
      propertySummary?.assignedAt ??
      (task.createdAt
        ? new Date(task.createdAt).toLocaleDateString("en-CA").replace(/-/g, "/")
        : "—"),
    inspectionDone: inspected,
    property: propertySummary?.property ?? null,
    showDecree: propertySummary?.showDecree ?? false,
    surveyTaskId: propertySummary?.surveyTaskId ?? null,
    inspectionTaskId: propertySummary?.inspectionTaskId ?? null,
    appraisalTaskId: propertySummary?.appraisalTaskId ?? task.id,
  };

  return (
    <div className="flex min-w-0 flex-col overflow-x-hidden">
      {embeddedInPropertyChrome ? null : (
        <div className={valPpHeadClassName}>
          <h1 className="m-0 flex flex-wrap items-center gap-2.5 text-[18px] font-extrabold text-heading">
            <span>نافذة المقيم العقاري</span>
            <span className="text-[14px] font-bold text-gold-d" dir="ltr">
              صك {deedLabel ?? summary.deedNumber}
            </span>
          </h1>
        </div>
      )}

      <div
        className={cn(
          valCardClassName,
          embeddedInPropertyChrome &&
            "overflow-x-hidden border-0 bg-transparent p-0 shadow-none",
        )}
      >
        <ValTabBar
          tabs={VAL_TABS}
          active={activeTab}
          onChange={(id) => setActiveTab(id as EvaluatorWindowTab)}
        />

        <div className="pt-5">
        {needsSurvey && !surveyed && !locked && gate.ready ? (
          <EngInfo variant="amber">
            ℹ يمكنك التقييم الآن (بيانات معاينة العقار معتمدة) — الرفع المساحي وصف
            إضافي: قد يلزم تعديل التقييم بعد صدوره.
          </EngInfo>
        ) : null}

        {locked ? (
          <EngInfo variant="amber">
            تم الإرسال لأخصائي دراسة الحالة — لا يمكن التعديل إلا بإعادة فتح من
            الأخصائي.
          </EngInfo>
        ) : null}

        {formError ? <EngInfo variant="red"><strong>!</strong> {formError}</EngInfo> : null}

        <div
          className={cn(
            formDisabled &&
              activeTab !== "report" &&
              activeTab !== "output"
              ? "opacity-75"
              : undefined,
          )}
        >
          {activeTab === "report" ? (
            <>
            <EvaluatorValuationReportTab
              draft={draft}
              disabled={formDisabled}
              property={summary.property}
              inspectionTaskId={summary.inspectionTaskId}
              onChange={(reportChoices, extras) => {
                const patch = {
                  reportChoices,
                  ...(extras?.valueBasis
                    ? { valueBasis: extras.valueBasis }
                    : {}),
                  ...(extras?.valuationMethod
                    ? { valuationMethod: extras.valuationMethod }
                    : {}),
                };
                setDraft((prev) => ({ ...prev, ...patch }));
                scheduleAutosave(patch);
              }}
            />
            {!formDisabled ? (
              <div className="mt-5">
                <button
                  type="button"
                  className={valPrimaryBtnClassName}
                  disabled={submitting}
                  aria-busy={submitting || undefined}
                  onClick={() => void submit()}
                >
                  {submitting ? <Spinner /> : null}
                  <span>
                    {submitting
                      ? "جاري الاعتماد…"
                      : "اعتماد التقييم وإرسال للأخصائي"}
                  </span>
                </button>
              </div>
            ) : null}
            </>
          ) : null}

          {activeTab === "output" ? (
            <EvaluatorValuationReportOutputTab
              draft={draft}
              property={summary.property}
              inspectionTaskId={summary.inspectionTaskId}
            />
          ) : null}
        </div>
        </div>
      </div>
    </div>
  );
}
