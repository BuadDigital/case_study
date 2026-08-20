"use client";

import { Button, InlineLoadingSkeleton, Spinner, cn, useToast } from "@platform/ui-kit";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WorkflowTask } from "@case-study/mfe";
import { inspectionGateForAppraisal } from "../../lib/evaluator/evaluator-inspection-gate";
import {
  cacheEvaluatorPlanImage,
  clearCachedEvaluatorPlanImage,
  getCachedEvaluatorPlanImage,
} from "../../lib/evaluator/evaluator-plan-attachments";
import {
  cacheEvaluatorDepositCertificate,
  clearCachedEvaluatorDepositCertificate,
  getCachedEvaluatorDepositCertificate,
} from "../../lib/evaluator/evaluator-deposit-attachments";
import {
  createEvaluatorDraft,
  evaluatorStatusLabel,
} from "../../lib/evaluator/evaluator-window-data";
import {
  hydrateEvaluatorSubmission,
  isEvaluatorFormLocked,
  updateEvaluatorDraft,
  type EvaluatorPlanImageMetadata,
  type EvaluatorReportMetadata,
} from "../../lib/evaluator/evaluator-submission-storage";
import type { EvaluatorSubmission } from "../../lib/evaluator/evaluator-window-data";
import { scheduleScrollToFormField } from "@platform/app-shared/form-ux";
import {
  evaluatorInvalidControlClass,
  EVALUATOR_INFATH_ERROR_KEYS,
  firstEvaluatorError,
  firstEvaluatorErrorTarget,
  validateEvaluatorSubmission,
  type EvaluatorValidationErrors,
} from "../../lib/evaluator/evaluator-validation";
import { finalizeAppraiserSubmission } from "../../lib/evaluator/finalize-appraiser-submission";
import type { EvaluatorWindowHostRefObject } from "../../lib/evaluator/evaluator-window-host";
import { ValueEstimationSection } from "./ValueEstimationSection";
import {
  InfathSection,
  InfathSelectField,
  InfathTextAreaField,
  InfathTextField,
} from "./InfathFormFields";
import { EvaluatorIssuedReportActions } from "./EvaluatorIssuedReportActions";
import { EvaluatorReportWorkersSection } from "./EvaluatorReportWorkersSection";
import type {
  EvaluatorChecklistAnswers,
  EvaluatorReportWorker,
} from "../../lib/evaluator/evaluator-window-data";
import {
  DEFAULT_APPRAISER_ADDRESS,
  DEFAULT_APPRAISER_PHONE,
  EVALUATOR_DEMAND_LEVEL_OPTIONS,
  EVALUATOR_VALUATION_METHODS,
  EVALUATOR_VALUE_BASIS_OPTIONS,
} from "../../lib/evaluator/evaluator-window-data";
import {
  EvaluatorPropertyTab,
  type EvaluatorPropertySummary,
} from "./EvaluatorPropertyTab";
import { EvaluatorChecklistTab } from "./EvaluatorChecklistTab";
import { EvaluatorComparableSelectionPanel } from "./EvaluatorComparableSelectionPanel";
import { EvaluatorValuationReportTab } from "./EvaluatorValuationReportTab";
import {
  appraiserInspectionDone,
  appraiserNeedsSurvey,
  appraiserSurveyDone,
} from "../../lib/evaluator/evaluator-readiness";
import { computePropertyTotal } from "../../lib/evaluator/value-estimation";
import {
  EngField,
  EngInfo,
  EngSection,
  ValDepChip,
  ValStatusPill,
  ValTabBar,
  VAL_STATUS_COLORS,
  valCardClassName,
  valChipClassName,
  valPpHeadClassName,
  valPrimaryBtnClassName,
} from "./EvaluatorHtmlPrimitives";

export type EvaluatorWindowTab =
  | "property"
  | "report"
  | "comparables"
  | "valuation"
  | "infath"
  | "checklist";

const VAL_TABS: { id: EvaluatorWindowTab; label: string }[] = [
  { id: "property", label: "بيانات العقار" },
  { id: "report", label: "تقييم العقار" },
  { id: "comparables", label: "المقارنات" },
  { id: "valuation", label: "التقييم" },
  { id: "infath", label: "بيانات الرفع لإنفاذ" },
  { id: "checklist", label: "قائمة الفحص" },
];

function extraSelectOption(options: readonly string[], current: string) {
  const trimmed = current.trim();
  if (!trimmed || (options as readonly string[]).includes(trimmed)) return null;
  return <option value={trimmed}>{trimmed}</option>;
}

export function EvaluatorWindow({
  task,
  tasks,
  hostRef,
  propertySummary,
  initialTab = "report",
  deedLabel,
}: {
  task: WorkflowTask;
  tasks: WorkflowTask[];
  hostRef: EvaluatorWindowHostRefObject;
  propertySummary?: EvaluatorPropertySummary;
  initialTab?: EvaluatorWindowTab;
  deedLabel?: string;
  onBack?: () => void;
}) {
  const gate = useMemo(
    () => inspectionGateForAppraisal(task, tasks),
    [task, tasks],
  );
  const { showToast, runWithUploadToast } = useToast();
  const planFileInputRef = useRef<HTMLInputElement>(null);
  const depositFileInputRef = useRef<HTMLInputElement>(null);

  const [draft, setDraft] = useState<EvaluatorSubmission>(() =>
    createEvaluatorDraft({
      taskId: task.id,
      propertyId: task.propertyId ?? "",
      poNumber: task.poNumber,
      assignmentType: task.assignmentType,
    }),
  );
  const [draftLoading, setDraftLoading] = useState(true);
  const [planUploadError, setPlanUploadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<EvaluatorValidationErrors>(
    {},
  );
  const [planUploading, setPlanUploading] = useState(false);
  const [depositUploading, setDepositUploading] = useState(false);
  const [depositUploadError, setDepositUploadError] = useState<string | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [planName, setPlanName] = useState<string | null>(() => {
    const cached = getCachedEvaluatorPlanImage(task.id);
    return cached?.fileName ?? null;
  });
  const [activeTab, setActiveTab] = useState<EvaluatorWindowTab>(initialTab);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const locked = isEvaluatorFormLocked(draft.status);
  const formDisabled = locked || !gate.ready;
  const hasPlan = Boolean(
    planName ||
      draft.planImageFileName ||
      getCachedEvaluatorPlanImage(task.id)?.dataUrl,
  );
  const hasDepositCertificate = Boolean(
    draft.depositCertificateFileName?.trim() ||
      getCachedEvaluatorDepositCertificate(task.id)?.fileName,
  );

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
        if (reconciled.planImageFileName) {
          setPlanName(reconciled.planImageFileName);
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
      const infathError = EVALUATOR_INFATH_ERROR_KEYS.some(
        (key) => errors[key],
      );
      setActiveTab(infathError ? "infath" : "valuation");
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

  async function onPlanSelected(file: File | null) {
    if (!file || formDisabled) return;
    setPlanUploadError(null);
    await runWithUploadToast(async () => {
      setPlanUploading(true);
      try {
        const result = await cacheEvaluatorPlanImage(task.id, file);
        if (!result.ok) {
          setPlanUploadError(result.error);
          throw new Error(result.error);
        }
        setPlanName(file.name);
        persistDraft(
          { planImageFileName: file.name },
          undefined,
          {
            fileName: file.name,
            mimeType: file.type || "application/octet-stream",
            sizeBytes: file.size,
          },
        );
        return true;
      } finally {
        setPlanUploading(false);
      }
    });
  }

  async function clearPlan() {
    if (formDisabled) return;
    try {
      await clearCachedEvaluatorPlanImage(task.id);
      setPlanName(null);
      setDraft((prev) => ({ ...prev, planImageFileName: null }));
      if (planFileInputRef.current) planFileInputRef.current.value = "";
    } catch (err: unknown) {
      showToast(
        err instanceof Error ? err.message : "تعذّر حذف الملف — حاول مرة أخرى",
        "error",
      );
    }
  }

  async function onDepositCertificateSelected(file: File | null) {
    if (!file || formDisabled) return;
    setDepositUploadError(null);
    await runWithUploadToast(async () => {
      setDepositUploading(true);
      try {
        const result = await cacheEvaluatorDepositCertificate(task.id, file);
        if (!result.ok) {
          setDepositUploadError(result.error);
          throw new Error(result.error);
        }
        setDraft((prev) => ({
          ...prev,
          depositCertificateFileName: file.name,
        }));
        persistDraft({ depositCertificateFileName: file.name });
        return true;
      } finally {
        setDepositUploading(false);
      }
    });
  }

  async function clearDepositCertificate() {
    if (formDisabled) return;
    try {
      await clearCachedEvaluatorDepositCertificate(task.id);
      setDraft((prev) => ({ ...prev, depositCertificateFileName: null }));
      if (depositFileInputRef.current) depositFileInputRef.current.value = "";
    } catch (err: unknown) {
      showToast(
        err instanceof Error ? err.message : "تعذّر حذف الملف — حاول مرة أخرى",
        "error",
      );
    }
  }

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
  const gated = !gate.ready;
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

  const depChips = [
    {
      t: "معاينة العقار — المعاين",
      ok: inspected,
      wait: "تُراقب حتى اكتمالها",
    },
    {
      t: "اعتماد بيانات الأطراف — الأخصائي",
      ok: !gated,
      wait: "شرط بدء التقييم",
    },
    ...(needsSurvey
      ? [
          {
            t: "الرفع المساحي — المكتب الهندسي",
            ok: surveyed,
            wait: "وصف إضافي — لا يمنع بدء التقييم",
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col">
      <div className={valPpHeadClassName}>
        <h1 className="m-0 flex flex-wrap items-center gap-2.5 text-[18px] font-extrabold text-heading">
          <span>نافذة المقيم العقاري</span>
          <span className="text-[14px] font-bold text-gold-d" dir="ltr">
            صك {deedLabel ?? summary.deedNumber}
          </span>
        </h1>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <span className={valChipClassName}>{summary.poNumber}</span>
          {draft.reportNo.trim() ? (
            <span className={valChipClassName} dir="ltr" title="رقم التقرير">
              {draft.reportNo.trim()}
            </span>
          ) : null}
          <ValStatusPill
            label={evaluatorStatusLabel(draft.status)}
            color={
              VAL_STATUS_COLORS[draft.status] ?? VAL_STATUS_COLORS.draft
            }
          />
          {gated ? (
            <ValStatusPill
              label="تراقب تقدم الأطراف"
              color={VAL_STATUS_COLORS.gated}
            />
          ) : null}
        </div>
      </div>

      <div className={valCardClassName}>
        <ValTabBar
          tabs={VAL_TABS}
          active={activeTab}
          onChange={(id) => setActiveTab(id as EvaluatorWindowTab)}
        />

        <div className="mb-3.5 flex flex-wrap gap-2">
          {depChips.map((dep) => (
            <ValDepChip
              key={dep.t}
              label={dep.t}
              ok={dep.ok}
              title={dep.wait}
            />
          ))}
        </div>

        {gated ? (
          <EngInfo variant="amber">
            <strong>تراقب تقدم الأطراف:</strong>{" "}
            {!gate.ready ? gate.reason : ""} يمكنك متابعة بيانات العقار
            والمقارنات دون حساب القيمة حتى اعتماد بيانات معاينة العقار.
          </EngInfo>
        ) : needsSurvey && !surveyed && !locked ? (
          <EngInfo variant="amber">
            ℹ يمكنك التقييم الآن (بيانات معاينة العقار معتمدة) — الرفع المساحي وصف
            إضافي: قد يلزم تعديل التقييم بعد صدوره.
          </EngInfo>
        ) : null}

        {draft.status === "reopened" ? (
          <EngInfo variant="amber">
            <strong>⚠ معادة للتصحيح</strong> — أرجعها الأخصائي؛ يمكنك تعديل
            جميع الحقول وإعادة الإرسال.
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
              activeTab !== "property" &&
              activeTab !== "report" &&
              activeTab !== "comparables"
              ? "opacity-75"
              : undefined,
          )}
        >
          {activeTab === "property" ? (
            <EvaluatorPropertyTab property={summary} />
          ) : null}

          {activeTab === "report" ? (
            <EvaluatorValuationReportTab
              propertyId={task.propertyId ?? ""}
              districtHint={
                summary.property?.district?.trim() ||
                summary.cityDistrict.split(/[|/·,،]/)[0]?.trim() ||
                undefined
              }
              draft={draft}
              inspectionTaskId={summary.inspectionTaskId}
            />
          ) : null}

          {activeTab === "comparables" ? (
            <EvaluatorComparableSelectionPanel
              propertyId={task.propertyId ?? ""}
              poNumber={task.poNumber}
              assignmentType={task.assignmentType}
              districtHint={
                summary.property?.district?.trim() ||
                summary.cityDistrict.split(/[|/·,،]/)[0]?.trim() ||
                undefined
              }
            />
          ) : null}

          {activeTab === "checklist" ? (
            <EvaluatorChecklistTab
              checklist={draft.checklist}
              disabled={formDisabled}
              error={fieldErrors.checklist}
              fieldErrors={fieldErrors}
              onChange={(patch) => {
                const checklist = { ...draft.checklist, ...patch };
                setDraft((prev) => ({ ...prev, checklist }));
                scheduleAutosave({ checklist });
                setFieldErrors((prev) => {
                  const next = { ...prev };
                  delete next.checklist;
                  delete next.shared_deed_scope;
                  delete next.shared_deed_percentage;
                  delete next.q_lease_active;
                  delete next.technical_notes_text;
                  return next;
                });
              }}
            />
          ) : null}

          {activeTab === "valuation" ? (
            <div className="flex flex-col gap-3">
              <EngSection>تقرير التقييم</EngSection>
              <p className="m-0 text-[12px] leading-relaxed text-text-2">
                استعراض تقرير التقييم يعرض مسودة المستند المولَّد — وليس معاينة
                العقار. التقرير يُصدَر PDF عند الاعتماد، ويُحجز رقمه عند توزيع
                المعاملة على المقيم. معاينة العقار مصدر بيانات يبني عليه المقيم
                التقرير دون إعادة إدخالها.
              </p>
              {draft.reportNo.trim() ? (
                <p className="m-0 text-[12.5px] text-text">
                  رقم التقرير:{" "}
                  <span className="font-bold" dir="ltr">
                    {draft.reportNo.trim()}
                  </span>
                  {draft.reportIssueDate.trim() ? (
                    <>
                      {" "}
                      · تاريخ الإصدار: {draft.reportIssueDate.trim()}
                    </>
                  ) : (
                    <> · محجوز — يُثبَّت تاريخ الإصدار عند الاعتماد</>
                  )}
                </p>
              ) : (
                <p className="m-0 text-[12px] text-text-3">
                  يُحجز الرقم تلقائياً بصيغة TQ عند توزيع المعاملة على المقيم.
                </p>
              )}
              <EvaluatorIssuedReportActions
                taskId={task.id}
                propertyId={task.propertyId ?? ""}
                reportNo={draft.reportNo}
                depositCode={draft.depositCode}
                area={summary.cityDistrict}
                propertyType={summary.classification}
                appraiserName={task.assigneeName}
                issued={
                  draft.status === "submitted" || draft.status === "completed"
                }
              />

              <ValueEstimationSection
                landValue={draft.landValue}
                buildingValue={draft.buildingValue}
                propertyTotal={draft.evaluatorPrice}
                forcedSaleDiscountPct={draft.forcedSaleDiscountPct}
                disabled={formDisabled}
                landError={fieldErrors.land_value}
                buildingError={fieldErrors.building_value}
                totalError={fieldErrors.evaluator_price}
                discountError={fieldErrors.forced_sale_discount}
                onLandChange={(landValue) => {
                  const evaluatorPrice = String(
                    computePropertyTotal(landValue, draft.buildingValue),
                  );
                  setDraft((prev) => ({
                    ...prev,
                    landValue,
                    evaluatorPrice: String(
                      computePropertyTotal(landValue, prev.buildingValue),
                    ),
                  }));
                  scheduleAutosave({ landValue, evaluatorPrice });
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.land_value;
                    delete next.evaluator_price;
                    return next;
                  });
                }}
                onBuildingChange={(buildingValue) => {
                  const evaluatorPrice = String(
                    computePropertyTotal(draft.landValue, buildingValue),
                  );
                  setDraft((prev) => ({
                    ...prev,
                    buildingValue,
                    evaluatorPrice: String(
                      computePropertyTotal(prev.landValue, buildingValue),
                    ),
                  }));
                  scheduleAutosave({ buildingValue, evaluatorPrice });
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.building_value;
                    delete next.evaluator_price;
                    return next;
                  });
                }}
                onTotalChange={(evaluatorPrice) => {
                  setDraft((prev) => ({ ...prev, evaluatorPrice }));
                  scheduleAutosave({ evaluatorPrice });
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.evaluator_price;
                    return next;
                  });
                }}
                onDiscountChange={(forcedSaleDiscountPct) => {
                  setDraft((prev) => ({ ...prev, forcedSaleDiscountPct }));
                  scheduleAutosave({ forcedSaleDiscountPct });
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.forced_sale_discount;
                    return next;
                  });
                }}
              />

              <EngSection>مراجعة بيانات الأصل</EngSection>
              <div
                id="val-asset-data"
                className={cn(
                  "flex flex-col gap-3 rounded-[10px] border border-border bg-surface-2/60 p-3",
                  fieldErrors.asset_data_confirmed &&
                    evaluatorInvalidControlClass,
                )}
              >
                <p className="text-[12px] leading-relaxed text-text-2">
                  راجع بيانات الأصل من معاينة العقار / الرفع المساحي / دراسة الحالة.
                  أكّد مطابقتها، أو دوّن ملاحظات التباين إن وُجدت اختلافات.
                </p>
                <label
                  className={cn(
                    "flex cursor-pointer items-start gap-2.5 text-[13px] font-medium text-text",
                    formDisabled && "cursor-not-allowed opacity-65",
                  )}
                >
                  <input
                    id="asset-data-confirmed"
                    type="checkbox"
                    className="mt-0.5 size-4 shrink-0 accent-primary"
                    disabled={formDisabled}
                    checked={draft.assetDataConfirmed}
                    onChange={(e) => {
                      const assetDataConfirmed = e.target.checked;
                      setDraft((prev) => ({
                        ...prev,
                        assetDataConfirmed,
                      }));
                      scheduleAutosave({ assetDataConfirmed });
                      setFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next.asset_data_confirmed;
                        return next;
                      });
                    }}
                  />
                  <span>
                    أؤكّد مراجعة بيانات الأصل وأنها مطابقة لما وُثِّق من
                    الأطراف
                    <span className="text-[#a5432e]"> *</span>
                  </span>
                </label>
                <InfathTextAreaField
                  id="asset-data-variance-notes"
                  label="ملاحظات التباين (إن وُجدت)"
                  autoComplete="off"
                  disabled={formDisabled}
                  placeholder="مثال: فرق في مساحة البناء مقارنة بالمعاينة الميدانية…"
                  rows={2}
                  value={draft.assetDataVarianceNotes}
                  onChange={(e) => {
                    const assetDataVarianceNotes = e.target.value;
                    setDraft((prev) => ({
                      ...prev,
                      assetDataVarianceNotes,
                    }));
                    scheduleAutosave({ assetDataVarianceNotes });
                    setFieldErrors((prev) => {
                      const next = { ...prev };
                      if (
                        draft.assetDataConfirmed ||
                        assetDataVarianceNotes.trim()
                      ) {
                        delete next.asset_data_confirmed;
                      }
                      return next;
                    });
                  }}
                />
                {fieldErrors.asset_data_confirmed ? (
                  <span className="text-[11px] text-danger-text">
                    {fieldErrors.asset_data_confirmed}
                  </span>
                ) : null}
              </div>

              <EngSection>ملاحظات</EngSection>
              <InfathTextAreaField
                id="evaluator_notes"
                label="ملاحظات على العقار (اختياري)"
                autoComplete="off"
                disabled={formDisabled}
                placeholder="أي ملاحظات على العقار…"
                rows={3}
                value={draft.evaluatorNotes}
                onChange={(e) => {
                  const evaluatorNotes = e.target.value;
                  setDraft((prev) => ({ ...prev, evaluatorNotes }));
                  scheduleAutosave({ evaluatorNotes });
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
            </div>
          ) : null}

          {activeTab === "infath" ? (
            <div className="flex flex-col gap-6">
              <InfathSection title="بيانات الرفع لإنفاذ (المقيّم)">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <InfathTextField
                    id="inf-appraisal-date"
                    label="تاريخ التقييم"
                    type="date"
                    autoComplete="off"
                    disabled={formDisabled}
                    value={draft.appraisalDate}
                    onChange={(e) => {
                      const appraisalDate = e.target.value;
                      setDraft((prev) => ({ ...prev, appraisalDate }));
                      scheduleAutosave({ appraisalDate });
                    }}
                  />
                  {draft.reportIssueDate.trim() ? (
                    <InfathTextField
                      id="inf-issue-date"
                      label="تاريخ إصدار التقرير"
                      readOnly
                      disabled
                      value={draft.reportIssueDate}
                    />
                  ) : null}
                  <InfathSelectField
                    id="inf-method"
                    label="الأسلوب المستخدم"
                    disabled={formDisabled}
                    value={draft.valuationMethod}
                    onChange={(e) => {
                      const valuationMethod = e.target.value;
                      setDraft((prev) => ({ ...prev, valuationMethod }));
                      scheduleAutosave({ valuationMethod });
                    }}
                  >
                    {extraSelectOption(
                      EVALUATOR_VALUATION_METHODS,
                      draft.valuationMethod,
                    )}
                    {EVALUATOR_VALUATION_METHODS.map((method) => (
                      <option key={method} value={method}>
                        {method}
                      </option>
                    ))}
                  </InfathSelectField>
                  <InfathSelectField
                    id="inf-basis"
                    label="أساس القيمة"
                    disabled={formDisabled}
                    value={draft.valueBasis}
                    onChange={(e) => {
                      const valueBasis = e.target.value;
                      setDraft((prev) => ({ ...prev, valueBasis }));
                      scheduleAutosave({ valueBasis });
                    }}
                  >
                    {extraSelectOption(
                      EVALUATOR_VALUE_BASIS_OPTIONS,
                      draft.valueBasis,
                    )}
                    {EVALUATOR_VALUE_BASIS_OPTIONS.map((basis) => (
                      <option key={basis} value={basis}>
                        {basis}
                      </option>
                    ))}
                  </InfathSelectField>
                </div>
                <p className="mt-3 rounded-lg border border-[color-mix(in_srgb,#d9a441_28%,transparent)] bg-[color-mix(in_srgb,#d9a441_8%,transparent)] px-3 py-2 text-[11.5px] leading-relaxed text-[#7a5b12]">
                  قيم الأرض والمباني ونسبة خصم البيع القسري تُدخل في تبويب
                  «التقييم» — قسم تقدير القيمة.
                </p>
                <div className="mt-3">
                  <InfathSelectField
                    id="inf-demand"
                    label="حجم الطلب على العقار"
                    disabled={formDisabled}
                    value={draft.demandLevel}
                    onChange={(e) => {
                      const demandLevel = e.target.value;
                      setDraft((prev) => ({ ...prev, demandLevel }));
                      scheduleAutosave({ demandLevel });
                    }}
                  >
                    <option value="">اختر</option>
                    {extraSelectOption(
                      EVALUATOR_DEMAND_LEVEL_OPTIONS,
                      draft.demandLevel,
                    )}
                    {EVALUATOR_DEMAND_LEVEL_OPTIONS.map((level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </InfathSelectField>
                </div>
                <div className="mt-3">
                  <InfathTextAreaField
                    id="inf-search"
                    label="نطاق البحث ومصادر معلومات القيم"
                    autoComplete="off"
                    disabled={formDisabled}
                    rows={3}
                    value={draft.searchScopeNotes}
                    onChange={(e) => {
                      const searchScopeNotes = e.target.value;
                      setDraft((prev) => ({ ...prev, searchScopeNotes }));
                      scheduleAutosave({ searchScopeNotes });
                    }}
                  />
                </div>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <EngField
                    label="عنوان المقيم — من إعدادات النظام"
                    value={
                      draft.appraiserAddress.trim() || DEFAULT_APPRAISER_ADDRESS
                    }
                  />
                  <EngField
                    label="رقم تواصل المقيّم — من إعدادات النظام"
                    value={
                      draft.appraiserPhone.trim() || DEFAULT_APPRAISER_PHONE
                    }
                    ltr
                  />
                </div>
              </InfathSection>

              <InfathSection title="نطاق العمل">
                <div
                  id="inf-independence"
                  className={cn(
                    "flex flex-col gap-2 rounded-[10px] border border-border bg-surface-2/60 p-3",
                    fieldErrors.independence_declared &&
                      evaluatorInvalidControlClass,
                  )}
                >
                  <label
                    className={cn(
                      "flex cursor-pointer items-start gap-2.5 text-[13px] font-medium text-text",
                      formDisabled && "cursor-not-allowed opacity-65",
                    )}
                  >
                    <input
                      id="inf-independence-check"
                      type="checkbox"
                      className="mt-0.5 size-4 shrink-0 accent-primary"
                      disabled={formDisabled}
                      checked={draft.independenceDeclared}
                      onChange={(e) => {
                        const independenceDeclared = e.target.checked;
                        setDraft((prev) => ({
                          ...prev,
                          independenceDeclared,
                        }));
                        scheduleAutosave({ independenceDeclared });
                        setFieldErrors((prev) => {
                          const next = { ...prev };
                          delete next.independence_declared;
                          return next;
                        });
                      }}
                    />
                    <span>
                      أقر بالاستقلالية وعدم تضارب المصالح
                      <span className="text-[#a5432e]"> *</span>
                    </span>
                  </label>
                  {fieldErrors.independence_declared ? (
                    <span className="text-[11px] text-danger-text">
                      {fieldErrors.independence_declared}
                    </span>
                  ) : null}
                </div>
              </InfathSection>

              <InfathSection title="العاملون على التقرير">
                <EvaluatorReportWorkersSection
                  workers={draft.reportWorkers}
                  disabled={formDisabled}
                  error={fieldErrors.report_workers}
                  onChange={(reportWorkers) => {
                    setDraft((prev) => ({ ...prev, reportWorkers }));
                    scheduleAutosave({ reportWorkers });
                    setFieldErrors((prev) => {
                      const next = { ...prev };
                      delete next.report_workers;
                      return next;
                    });
                  }}
                />
              </InfathSection>

              <InfathSection title="صورة الأصل من المخطط">
                <div
                  className={cn(
                    "file-zone rounded-[10px] border-2 border-dashed border-border-md bg-surface-2 p-4 text-center",
                    hasPlan && "border-solid border-[#a9dfbf] bg-[#d5f5ef]",
                    formDisabled && "cursor-not-allowed opacity-65",
                  )}
                >
                  <input
                    ref={planFileInputRef}
                    type="file"
                    accept="application/pdf,.pdf,image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
                    disabled={formDisabled || planUploading}
                    className="pointer-events-none absolute size-0 opacity-0"
                    onChange={(e) =>
                      void onPlanSelected(e.target.files?.[0] ?? null)
                    }
                  />
                  {!hasPlan ? (
                    <>
                      <div className="mb-1 text-[12px] font-bold text-text-2">
                        رفع ملف المخطط
                      </div>
                      <div className="mb-2.5 text-[11px] text-text-3">
                        PDF أو صورة · حتى 20 ميجابايت
                      </div>
                      {!formDisabled ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="primary"
                          loading={planUploading}
                          disabled={planUploading}
                          showActionToast={false}
                          onClick={() => planFileInputRef.current?.click()}
                        >
                          اختيار ملف
                        </Button>
                      ) : null}
                    </>
                  ) : (
                    <div className="flex items-center justify-between gap-2 text-[12px]">
                      <span>
                        📎 {planName ?? draft.planImageFileName ?? "تم رفع الملف"}
                      </span>
                      {!formDisabled ? (
                        <button
                          type="button"
                          aria-label="حذف ملف المخطط"
                          className="cursor-pointer border-0 bg-transparent p-1 text-[14px] text-text-3"
                          onClick={() => void clearPlan()}
                        >
                          ✕
                        </button>
                      ) : null}
                    </div>
                  )}
                </div>
                {planUploadError ? (
                  <span className="mt-1 block text-[11px] text-danger-text">
                    {planUploadError}
                  </span>
                ) : null}
              </InfathSection>

              <InfathSection title="شهادة الإيداع في قيمة">
                <p className="mb-3 text-[12px] leading-relaxed text-text-2">
                  اختيارية — لا تمنع اعتماد التقييم. الرمز يظهر في ترويسة التقرير،
                  والشهادة تُرفق ضمن مرفقات التقرير.
                </p>
                <div className="mb-3">
                  <InfathTextField
                    id="inf-deposit-code"
                    label="رمز الإيداع"
                    dir="ltr"
                    autoComplete="off"
                    disabled={formDisabled}
                    value={draft.depositCode}
                    onChange={(e) => {
                      const depositCode = e.target.value;
                      setDraft((prev) => ({ ...prev, depositCode }));
                      scheduleAutosave({ depositCode });
                    }}
                  />
                </div>
                <div
                  className={cn(
                    "file-zone rounded-[10px] border-2 border-dashed border-border-md bg-surface-2 p-4 text-center",
                    hasDepositCertificate &&
                      "border-solid border-[#a9dfbf] bg-[#d5f5ef]",
                    formDisabled && "cursor-not-allowed opacity-65",
                  )}
                >
                  <input
                    ref={depositFileInputRef}
                    type="file"
                    accept="application/pdf,.pdf,image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
                    disabled={formDisabled || depositUploading}
                    className="pointer-events-none absolute size-0 opacity-0"
                    onChange={(e) =>
                      void onDepositCertificateSelected(e.target.files?.[0] ?? null)
                    }
                  />
                  {!hasDepositCertificate ? (
                    <>
                      <div className="mb-1 text-[12px] font-bold text-text-2">
                        رفع شهادة الرفع على قيمة
                      </div>
                      <div className="mb-2.5 text-[11px] text-text-3">
                        PDF أو صورة · حتى 20 ميجابايت · اختياري
                      </div>
                      {!formDisabled ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="primary"
                          loading={depositUploading}
                          disabled={depositUploading}
                          showActionToast={false}
                          onClick={() => depositFileInputRef.current?.click()}
                        >
                          اختيار ملف
                        </Button>
                      ) : null}
                    </>
                  ) : (
                    <div className="flex items-center justify-between gap-2 text-[12px]">
                      <span>
                        📎{" "}
                        {draft.depositCertificateFileName ??
                          getCachedEvaluatorDepositCertificate(task.id)?.fileName}
                      </span>
                      {!formDisabled ? (
                        <button
                          type="button"
                          aria-label="حذف شهادة الإيداع"
                          className="cursor-pointer border-0 bg-transparent p-1 text-[14px] text-text-3"
                          onClick={() => void clearDepositCertificate()}
                        >
                          ✕
                        </button>
                      ) : null}
                    </div>
                  )}
                </div>
                {depositUploadError ? (
                  <span className="mt-1 block text-[11px] text-danger-text">
                    {depositUploadError}
                  </span>
                ) : null}
              </InfathSection>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
