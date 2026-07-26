"use client";

import { Button, InlineLoadingSkeleton, cn, useToast } from "@platform/design-system";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WorkflowTask } from "@case-study/mfe";
import { inspectionGateForAppraisal } from "../../lib/evaluator/evaluator-inspection-gate";
import {
  cacheEvaluatorReport,
  getCachedEvaluatorReport,
  openEvaluatorReportPreview,
} from "../../lib/evaluator/evaluator-report-attachments";
import {
  cacheEvaluatorPlanImage,
  getCachedEvaluatorPlanImage,
  openEvaluatorPlanImagePreview,
} from "../../lib/evaluator/evaluator-plan-attachments";
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
import {
  firstEvaluatorError,
  validateEvaluatorSubmission,
  type EvaluatorValidationErrors,
} from "../../lib/evaluator/evaluator-validation";
import { finalizeAppraiserSubmission } from "../../lib/evaluator/finalize-appraiser-submission";
import type { EvaluatorWindowHostRefObject } from "../../lib/evaluator/evaluator-window-host";
import { ValueEstimationSection } from "./ValueEstimationSection";
import { computePropertyTotal } from "../../lib/evaluator/value-estimation";
import {
  InfathSection,
  InfathSelectField,
  InfathTextAreaField,
  InfathTextField,
} from "./InfathFormFields";
import { ReportWorkersSection } from "./ReportWorkersSection";
import {
  INFATH_DEMAND_LEVELS,
  INFATH_VALUATION_METHODS,
  INFATH_VALUE_BASES,
} from "../../lib/evaluator/infath-select-options";
import type { EvaluatorReportWorker } from "../../lib/evaluator/evaluator-window-data";

export function EvaluatorWindow({
  task,
  tasks,
  hostRef,
}: {
  task: WorkflowTask;
  tasks: WorkflowTask[];
  hostRef: EvaluatorWindowHostRefObject;
}) {
  const gate = useMemo(
    () => inspectionGateForAppraisal(task, tasks),
    [task, tasks],
  );
  const { showToast, runWithUploadToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const planFileInputRef = useRef<HTMLInputElement>(null);

  const [draft, setDraft] = useState<EvaluatorSubmission>(() =>
    createEvaluatorDraft({
      taskId: task.id,
      propertyId: task.propertyId ?? "",
      poNumber: task.poNumber,
    }),
  );
  const [draftLoading, setDraftLoading] = useState(true);
  const [reportName, setReportName] = useState<string | null>(() => {
    const cached = getCachedEvaluatorReport(task.id);
    return cached?.fileName ?? null;
  });
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [planUploadError, setPlanUploadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<EvaluatorValidationErrors>(
    {},
  );
  const [uploading, setUploading] = useState(false);
  const [planUploading, setPlanUploading] = useState(false);
  const [planName, setPlanName] = useState<string | null>(() => {
    const cached = getCachedEvaluatorPlanImage(task.id);
    return cached?.fileName ?? null;
  });
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const locked = isEvaluatorFormLocked(draft.status);
  const formDisabled = locked || !gate.ready;
  const hasReport = Boolean(
    reportName || getCachedEvaluatorReport(task.id)?.dataUrl,
  );
  const hasPlan = Boolean(
    planName ||
      draft.planImageFileName ||
      getCachedEvaluatorPlanImage(task.id)?.dataUrl,
  );

  const persistDraft = useCallback(
    (
      patch: Partial<{
        evaluatorPrice: string;
        evaluatorNotes: string;
        reportFileName: string | null;
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
        reportIssueDate: string;
        independenceDeclared: boolean;
        reportWorkers: EvaluatorReportWorker[];
        assetDataConfirmed: boolean;
        assetDataVarianceNotes: string;
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
    }).then((loaded) => {
      if (!cancelled) {
        setDraft(loaded);
        if (loaded.reportFileName) {
          setReportName(loaded.reportFileName);
        }
        if (loaded.planImageFileName) {
          setPlanName(loaded.planImageFileName);
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

    const total = computePropertyTotal(draft.landValue, draft.buildingValue);
    const evaluatorPrice = String(total);

    const errors = validateEvaluatorSubmission({
      taskId: task.id,
      evaluatorPrice,
      landValue: draft.landValue,
      buildingValue: draft.buildingValue,
      forcedSaleDiscountPct: draft.forcedSaleDiscountPct,
      independenceDeclared: draft.independenceDeclared,
      reportWorkers: draft.reportWorkers,
      assetDataConfirmed: draft.assetDataConfirmed,
      assetDataVarianceNotes: draft.assetDataVarianceNotes,
    });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      const message =
        firstEvaluatorError(errors) ?? "تحقق من الحقول المطلوبة";
      setFormError(message);
      showToast(message, "error");
      return false;
    }

    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }

    try {
      const updated = await updateEvaluatorDraft(task.id, {
        landValue: draft.landValue,
        buildingValue: draft.buildingValue,
        forcedSaleDiscountPct: draft.forcedSaleDiscountPct,
        evaluatorPrice,
        independenceDeclared: draft.independenceDeclared,
        reportWorkers: draft.reportWorkers,
        assetDataConfirmed: draft.assetDataConfirmed,
        assetDataVarianceNotes: draft.assetDataVarianceNotes,
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

    hostRef.current?.onSavingChange?.(true);
    setFormError(null);
    const result = await finalizeAppraiserSubmission(task.id);
    hostRef.current?.onSavingChange?.(false);
    if (result.ok) {
      setDraft(result.submission);
      setSubmitSuccess(true);
      hostRef.current?.onSubmitted?.();
      return true;
    }
    setFormError(result.message);
    showToast(result.message, "error");
    return false;
  }, [
    locked,
    gate,
    task.id,
    draft.landValue,
    draft.buildingValue,
    draft.forcedSaleDiscountPct,
    draft.independenceDeclared,
    draft.reportWorkers,
    draft.assetDataConfirmed,
    draft.assetDataVarianceNotes,
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

  async function onReportSelected(file: File | null) {
    if (!file || formDisabled) return;
    setUploadError(null);
    await runWithUploadToast(async () => {
      setUploading(true);
      try {
        const result = await cacheEvaluatorReport(task.id, file);
        if (!result.ok) {
          setUploadError(result.error);
          throw new Error(result.error);
        }
        setReportName(file.name);
        persistDraft(
          { reportFileName: file.name },
          {
            fileName: file.name,
            mimeType: file.type || "application/pdf",
            sizeBytes: file.size,
          },
        );
        setFieldErrors((prev) => {
          const next = { ...prev };
          delete next.evaluator_report_file;
          return next;
        });
        return true;
      } finally {
        setUploading(false);
      }
    });
  }

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

  if (draftLoading) {
    return (
      <div className="flex flex-col gap-3.5">
        <InlineLoadingSkeleton className="my-2" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3.5">
      {!gate.ready ? (
        <div className="rounded-[10px] border border-[#FCD34D] bg-[#FEF3C7] px-3.5 py-2.5 text-xs leading-relaxed text-[#92400E]">
          {gate.reason}
        </div>
      ) : null}

      {submitSuccess ? (
        <div className="mb-3 rounded-[var(--radius-DEFAULT)] border border-success border-e-[3px] border-e-success bg-success-bg px-3.5 py-2.5 text-xs leading-relaxed text-success-text">
          تم الإرسال لأخصائي دراسة الحالة — يمكنك إغلاق الشاشة أو العودة للقائمة.
        </div>
      ) : null}

      {draft.status !== "draft" && !submitSuccess ? (
        <div className="rounded-[10px] border border-[#BFDBFE] bg-[#EFF6FF] px-3.5 py-2.5 text-xs leading-relaxed text-[#1E40AF]">
          الحالة: {evaluatorStatusLabel(draft.status)}
          {draft.status === "reopened"
            ? " — يمكنك تعديل جميع الحقول وإعادة الإرسال."
            : null}
        </div>
      ) : null}

      <section className="flex flex-col gap-4">
          <p className="m-0 text-xs text-text-3">
            تقرير المقياس وتقدير قيمة العقار — يُعرض للأخصائي للاسترشاد فقط
          </p>
          <div
            className={cn(
              "flex flex-col gap-1.5",
              fieldErrors.evaluator_report_file && "[&_.file-zone]:border-danger",
            )}
          >
            <span className="text-xs font-semibold text-text-2">
              تقرير التقييم (PDF من برنامج المقياس)
            </span>
            <div
              className={cn(
                "file-zone flex flex-wrap items-center gap-3 rounded-xl border-[1.5px] border-dashed border-border-md bg-surface-2 p-3.5 transition-colors",
                hasReport && "border-solid border-[#86EFAC] bg-[#F0FDF4]",
                formDisabled && "cursor-not-allowed opacity-65",
                !formDisabled && !hasReport && "hover:border-primary hover:bg-[#F8FAFF]",
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                disabled={formDisabled || uploading}
                className="pointer-events-none absolute size-0 opacity-0"
                onChange={(e) => void onReportSelected(e.target.files?.[0] ?? null)}
              />
              <div
                className={cn(
                  "flex size-11 shrink-0 items-center justify-center rounded-[10px] border border-border bg-surface text-[11px] font-extrabold text-primary",
                  hasReport && "border-success bg-success text-white",
                )}
                aria-hidden
              >
                {hasReport ? "✓" : "PDF"}
              </div>
              <div className="flex min-w-[140px] flex-1 flex-col gap-0.5 text-[11px] leading-snug text-text-3">
                {hasReport ? (
                  <strong className="break-all text-[13px] text-text">
                    {reportName ?? "تم رفع الملف"}
                  </strong>
                ) : (
                  <>
                    <strong className="text-[13px] text-text">اختر ملف PDF</strong>
                    <span>صادر من برنامج المقياس · حتى 20 MB</span>
                  </>
                )}
              </div>
              <div className="ms-auto flex flex-wrap gap-2">
                {!formDisabled ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="primary"
                    loading={uploading}
                    disabled={uploading}
                    showActionToast={false}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {hasReport ? "تغيير الملف" : "رفع الملف"}
                  </Button>
                ) : null}
                {hasReport ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      void openEvaluatorReportPreview(task.id).then((ok) => {
                        if (!ok) {
                          showToast("تعذّر فتح معاينة الملف — حاول مرة أخرى", "error");
                        }
                      });
                    }}
                  >
                    معاينة
                  </Button>
                ) : null}
              </div>
            </div>
            {uploadError ? (
              <span className="text-[11px] text-danger-text">{uploadError}</span>
            ) : null}
            {fieldErrors.evaluator_report_file ? (
              <span className="text-[11px] text-danger-text">
                {fieldErrors.evaluator_report_file}
              </span>
            ) : null}
          </div>

          <div className="grid grid-cols-1 items-start gap-4">
            <ValueEstimationSection
              landValue={draft.landValue}
              buildingValue={draft.buildingValue}
              forcedSaleDiscountPct={draft.forcedSaleDiscountPct}
              disabled={formDisabled}
              landError={fieldErrors.land_value}
              buildingError={fieldErrors.building_value}
              discountError={fieldErrors.forced_sale_discount}
              onLandChange={(landValue) => {
                const evaluatorPrice = String(
                  computePropertyTotal(landValue, draft.buildingValue),
                );
                setDraft((prev) => ({ ...prev, landValue, evaluatorPrice }));
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
                  evaluatorPrice,
                }));
                scheduleAutosave({ buildingValue, evaluatorPrice });
                setFieldErrors((prev) => {
                  const next = { ...prev };
                  delete next.building_value;
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
            {fieldErrors.evaluator_price ? (
              <span className="text-[11px] text-danger-text">
                {fieldErrors.evaluator_price}
              </span>
            ) : null}

            <InfathTextAreaField
              id="evaluator_notes"
              label="ملاحظات على العقار"
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
          </div>

          <div className="flex flex-col gap-6 border-t border-border pt-5">
            <InfathSection title="بيانات التقرير">
              <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
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
                <InfathTextField
                  id="inf-issue-date"
                  label="تاريخ إصدار التقرير"
                  type="date"
                  autoComplete="off"
                  disabled={formDisabled}
                  value={draft.reportIssueDate}
                  onChange={(e) => {
                    const reportIssueDate = e.target.value;
                    setDraft((prev) => ({ ...prev, reportIssueDate }));
                    scheduleAutosave({ reportIssueDate });
                  }}
                />
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
                  {INFATH_VALUATION_METHODS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                  {draft.valuationMethod &&
                  !(INFATH_VALUATION_METHODS as readonly string[]).includes(
                    draft.valuationMethod,
                  ) ? (
                    <option value={draft.valuationMethod}>
                      {draft.valuationMethod}
                    </option>
                  ) : null}
                </InfathSelectField>
                <InfathTextField
                  id="inf-address"
                  label="عنوان المقيم"
                  autoComplete="off"
                  disabled={formDisabled}
                  value={draft.appraiserAddress}
                  onChange={(e) => {
                    const appraiserAddress = e.target.value;
                    setDraft((prev) => ({ ...prev, appraiserAddress }));
                    scheduleAutosave({ appraiserAddress });
                  }}
                />
                <InfathTextField
                  id="inf-phone"
                  label="رقم تواصل المقيّم"
                  inputMode="tel"
                  autoComplete="off"
                  disabled={formDisabled}
                  value={draft.appraiserPhone}
                  onChange={(e) => {
                    const appraiserPhone = e.target.value;
                    setDraft((prev) => ({ ...prev, appraiserPhone }));
                    scheduleAutosave({ appraiserPhone });
                  }}
                />
              </div>
            </InfathSection>

            <InfathSection title="نطاق العمل">
              <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
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
                  {INFATH_VALUE_BASES.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                  {draft.valueBasis &&
                  !(INFATH_VALUE_BASES as readonly string[]).includes(
                    draft.valueBasis,
                  ) ? (
                    <option value={draft.valueBasis}>{draft.valueBasis}</option>
                  ) : null}
                </InfathSelectField>
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
                  <option value="">— اختر —</option>
                  {INFATH_DEMAND_LEVELS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                  {draft.demandLevel &&
                  !(INFATH_DEMAND_LEVELS as readonly string[]).includes(
                    draft.demandLevel,
                  ) ? (
                    <option value={draft.demandLevel}>
                      {draft.demandLevel}
                    </option>
                  ) : null}
                </InfathSelectField>
              </div>

              <div
                className={cn(
                  "mt-4 rounded-lg border border-[#d1d5db] bg-surface px-3.5 py-3",
                  fieldErrors.independence_declared && "border-[#f87171]",
                  formDisabled && "opacity-65",
                )}
              >
                <label className="flex cursor-pointer items-start gap-2.5">
                  <input
                    id="inf-independence"
                    type="checkbox"
                    className="mt-0.5 size-4 shrink-0 accent-[#12284C]"
                    disabled={formDisabled}
                    checked={draft.independenceDeclared}
                    onChange={(e) => {
                      const independenceDeclared = e.target.checked;
                      setDraft((prev) => ({ ...prev, independenceDeclared }));
                      scheduleAutosave({ independenceDeclared });
                      setFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next.independence_declared;
                        return next;
                      });
                    }}
                  />
                  <span className="text-[13px] leading-relaxed text-[#1f2937]">
                    إقرار الاستقلالية وعدم تضارب المصالح
                    <span className="text-[#e11d48]">*</span>
                    <span className="mt-0.5 block text-[11px] text-[#6b7280]">
                      أقرّ بأن التقييم أُعد باستقلالية تامة ودون أي تضارب مصالح.
                    </span>
                  </span>
                </label>
                {fieldErrors.independence_declared ? (
                  <span className="mt-2 block text-[11px] text-danger-text">
                    {fieldErrors.independence_declared}
                  </span>
                ) : null}
              </div>
            </InfathSection>

            <ReportWorkersSection
              workers={draft.reportWorkers}
              disabled={formDisabled}
              error={fieldErrors.report_workers}
              onChange={(reportWorkers) => {
                setDraft((prev) => ({ ...prev, reportWorkers }));
                scheduleAutosave({ reportWorkers });
                setFieldErrors((prev) => {
                  const next = { ...prev };
                  delete next.report_workers;
                  for (const key of Object.keys(next)) {
                    if (key.startsWith("report_worker_")) delete next[key];
                  }
                  return next;
                });
              }}
            />

            <InfathSection title="نطاق البحث">
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
            </InfathSection>

            <InfathSection title="صور الأصل">
              <div className="mt-1 flex flex-col gap-1.5">
                <span className="text-[11px] font-medium text-[#4b5563]">
                  صورة الأصل من المخطط
                </span>
                <div
                  className={cn(
                    "file-zone flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-[#d1d5db] bg-surface p-3.5 transition-colors",
                    hasPlan && "border-solid border-[#86EFAC] bg-[#F0FDF4]",
                    formDisabled && "cursor-not-allowed opacity-65",
                    !formDisabled &&
                      !hasPlan &&
                      "hover:border-[#94a3b8] hover:bg-[#f8fafc]",
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
                  <div
                    className={cn(
                      "flex size-11 shrink-0 items-center justify-center rounded-lg border border-[#d1d5db] bg-surface text-[10px] font-extrabold text-[#185fa5]",
                      hasPlan && "border-success bg-success text-white",
                    )}
                    aria-hidden
                  >
                    {hasPlan ? "✓" : "PDF"}
                  </div>
                  <div className="flex min-w-[140px] flex-1 flex-col gap-0.5 text-[11px] leading-snug text-[#6b7280]">
                    {hasPlan ? (
                      <strong className="break-all text-[13px] text-[#111827]">
                        {planName ?? draft.planImageFileName ?? "تم رفع الملف"}
                      </strong>
                    ) : (
                      <>
                        <strong className="text-[13px] text-[#111827]">
                          اختر ملف المخطط
                        </strong>
                        <span>PDF أو صورة · حتى 20 MB</span>
                      </>
                    )}
                  </div>
                  <div className="ms-auto flex flex-wrap gap-2">
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
                        {hasPlan ? "تغيير الملف" : "رفع الملف"}
                      </Button>
                    ) : null}
                    {hasPlan ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          void openEvaluatorPlanImagePreview(task.id).then(
                            (ok) => {
                              if (!ok) {
                                showToast(
                                  "تعذّر فتح معاينة الملف — حاول مرة أخرى",
                                  "error",
                                );
                              }
                            },
                          );
                        }}
                      >
                        معاينة
                      </Button>
                    ) : null}
                  </div>
                </div>
                {planUploadError ? (
                  <span className="text-[11px] text-danger-text">
                    {planUploadError}
                  </span>
                ) : null}
              </div>
            </InfathSection>

            <InfathSection title="بيانات الأصل">
              <p className="m-0 mb-3 text-[11px] leading-relaxed text-text-3">
                تُعرض بيانات الأصل والحدود والأصول المرتبطة واستلام المفتاح من
                مصادرها (المعاين / المكتب الهندسي / الأخصائي / المراجع) في
                تفاصيل العقار — تأكيدك هنا يثبت مراجعتها قبل اعتماد التقييم.
              </p>
              <div
                className={cn(
                  "rounded-lg border border-[#d1d5db] bg-surface px-3.5 py-3",
                  fieldErrors.asset_data_confirmed && "border-[#f87171]",
                  formDisabled && "opacity-65",
                )}
              >
                <label className="flex cursor-pointer items-start gap-2.5">
                  <input
                    id="inf-asset-data-confirmed"
                    type="checkbox"
                    className="mt-0.5 size-4 shrink-0 accent-[#12284C]"
                    disabled={formDisabled}
                    checked={draft.assetDataConfirmed}
                    onChange={(e) => {
                      const assetDataConfirmed = e.target.checked;
                      setDraft((prev) => ({ ...prev, assetDataConfirmed }));
                      scheduleAutosave({ assetDataConfirmed });
                      setFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next.asset_data_confirmed;
                        return next;
                      });
                    }}
                  />
                  <span className="text-[13px] leading-relaxed text-[#1f2937]">
                    تأكيد مراجعة بيانات الأصل
                    <span className="mt-0.5 block text-[11px] text-[#6b7280]">
                      أقرّ بأنني راجعت بيانات الأصل وحدوده وأصوله المرتبطة
                      واستلام المفتاح كما هي معروضة في تفاصيل العقار.
                    </span>
                  </span>
                </label>
              </div>

              <div className="mt-3">
                <InfathTextAreaField
                  id="inf-asset-data-variance-notes"
                  label="ملاحظات التباين"
                  autoComplete="off"
                  disabled={formDisabled}
                  placeholder="دوّن أي تباين بين بيانات الأصل المعروضة وواقع المعاينة (مطلوبة إن لم يتم التأكيد)…"
                  rows={2}
                  value={draft.assetDataVarianceNotes}
                  onChange={(e) => {
                    const assetDataVarianceNotes = e.target.value;
                    setDraft((prev) => ({ ...prev, assetDataVarianceNotes }));
                    scheduleAutosave({ assetDataVarianceNotes });
                    setFieldErrors((prev) => {
                      const next = { ...prev };
                      delete next.asset_data_confirmed;
                      return next;
                    });
                  }}
                />
                {fieldErrors.asset_data_confirmed ? (
                  <span className="mt-1.5 block text-[11px] text-danger-text">
                    {fieldErrors.asset_data_confirmed}
                  </span>
                ) : null}
              </div>
            </InfathSection>
          </div>
      </section>

      {formError ? (
        <div className="rounded-[10px] border border-[#FCD34D] bg-[#FEF3C7] px-3.5 py-2.5 text-xs leading-relaxed text-[#92400E]">
          {formError}
        </div>
      ) : null}
    </div>
  );
}

