"use client";

import { Button, Input, Label, cn, formControlClassName } from "@platform/design-system";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WorkflowTask } from "@case-study/mfe";
import { inspectionGateForAppraisal } from "../../lib/evaluator/evaluator-inspection-gate";
import {
  cacheEvaluatorReport,
  getCachedEvaluatorReport,
  openEvaluatorReportPreview,
} from "../../lib/evaluator/evaluator-report-attachments";
import {
  createEvaluatorDraft,
  evaluatorStatusLabel,
  formatEvaluatorPriceDisplay,
} from "../../lib/evaluator/evaluator-window-data";
import {
  hydrateEvaluatorSubmission,
  isEvaluatorFormLocked,
  updateEvaluatorDraft,
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
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<EvaluatorValidationErrors>(
    {},
  );
  const [uploading, setUploading] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const locked = isEvaluatorFormLocked(draft.status);
  const formDisabled = locked || !gate.ready;
  const hasReport = Boolean(
    reportName || getCachedEvaluatorReport(task.id)?.dataUrl,
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
      }>,
      reportMetadata?: EvaluatorReportMetadata,
    ) => {
      if (locked) return;
      void updateEvaluatorDraft(task.id, patch, reportMetadata).then((updated) => {
        if (updated) setDraft(updated);
      });
    },
    [locked, task.id],
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
      return false;
    }

    const errors = validateEvaluatorSubmission({
      taskId: task.id,
      evaluatorPrice: draft.evaluatorPrice,
    });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setFormError(firstEvaluatorError(errors));
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
    return false;
  }, [locked, gate, task.id, draft.evaluatorPrice, hostRef]);

  useEffect(() => {
    if (!hostRef.current) return;
    hostRef.current.submit = submit;
  }, [hostRef, submit]);

  async function onReportSelected(file: File | null) {
    if (!file || formDisabled) return;
    setUploading(true);
    setUploadError(null);
    const result = await cacheEvaluatorReport(task.id, file);
    setUploading(false);
    if (!result.ok) {
      setUploadError(result.error);
      return;
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
  }

  if (draftLoading) {
    return (
      <div className="flex flex-col gap-3.5">
        <p className="my-2 text-xs text-text-3">جاري تحميل مسودة التقييم…</p>
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
            تقرير المقياس وسعر العقار — يُعرض للأخصائي للاسترشاد فقط
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
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploading
                      ? "جاري الرفع…"
                      : hasReport
                        ? "تغيير الملف"
                        : "رفع الملف"}
                  </Button>
                ) : null}
                {getCachedEvaluatorReport(task.id)?.dataUrl ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => openEvaluatorReportPreview(task.id)}
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

          <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="evaluator_price" className="text-xs font-semibold text-text-2">
                سعر التقييم
              </Label>
              <div className="flex items-stretch overflow-hidden rounded-[10px] border border-border bg-surface">
                <Input
                  id="evaluator_price"
                  className="min-w-0 flex-1 rounded-none border-0 text-sm font-semibold shadow-none focus:ring-0"
                  inputMode="decimal"
                  disabled={formDisabled}
                  hasError={Boolean(fieldErrors.evaluator_price)}
                  value={draft.evaluatorPrice}
                  placeholder="1,250,000"
                  onChange={(e) => {
                    const evaluatorPrice = e.target.value;
                    setDraft((prev) => ({ ...prev, evaluatorPrice }));
                    scheduleAutosave({ evaluatorPrice });
                    setFieldErrors((prev) => {
                      const next = { ...prev };
                      delete next.evaluator_price;
                      return next;
                    });
                  }}
                />
                <span className="flex items-center whitespace-nowrap border-s border-border bg-surface-3 px-3.5 text-xs font-bold text-text-2">
                  ر.س
                </span>
              </div>
              {draft.evaluatorPrice.trim() ? (
                <span className="text-[11px] text-text-3 [direction:ltr] [unicode-bidi:isolate]">
                  {formatEvaluatorPriceDisplay(draft.evaluatorPrice)}
                </span>
              ) : null}
              {fieldErrors.evaluator_price ? (
                <span className="text-[11px] text-danger-text">
                  {fieldErrors.evaluator_price}
                </span>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="evaluator_notes" className="text-xs font-semibold text-text-2">
                ملاحظات (اختياري)
              </Label>
              <textarea
                id="evaluator_notes"
                className={cn(
                  formControlClassName,
                  "min-h-[88px] resize-y rounded-[10px] py-2 leading-relaxed",
                )}
                rows={3}
                disabled={formDisabled}
                placeholder="أي ملاحظات على العقار…"
                value={draft.evaluatorNotes}
                onChange={(e) => {
                  const evaluatorNotes = e.target.value;
                  setDraft((prev) => ({ ...prev, evaluatorNotes }));
                  scheduleAutosave({ evaluatorNotes });
                }}
              />
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <h4 className="mb-3 text-xs font-semibold text-primary">
              بيانات الرفع لإنفاذ (المقيّم)
            </h4>
            <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="inf-appraisal-date" className="text-xs font-semibold text-text-2">
                  تاريخ التقييم
                </Label>
                <Input
                  id="inf-appraisal-date"
                  type="date"
                  className="text-xs"
                  disabled={formDisabled}
                  value={draft.appraisalDate}
                  onChange={(e) => {
                    const appraisalDate = e.target.value;
                    setDraft((prev) => ({ ...prev, appraisalDate }));
                    scheduleAutosave({ appraisalDate });
                  }}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="inf-issue-date" className="text-xs font-semibold text-text-2">
                  تاريخ إصدار التقرير
                </Label>
                <Input
                  id="inf-issue-date"
                  type="date"
                  className="text-xs"
                  disabled={formDisabled}
                  value={draft.reportIssueDate}
                  onChange={(e) => {
                    const reportIssueDate = e.target.value;
                    setDraft((prev) => ({ ...prev, reportIssueDate }));
                    scheduleAutosave({ reportIssueDate });
                  }}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="inf-method" className="text-xs font-semibold text-text-2">
                  الأسلوب المستخدم
                </Label>
                <Input
                  id="inf-method"
                  className="text-xs"
                  disabled={formDisabled}
                  value={draft.valuationMethod}
                  onChange={(e) => {
                    const valuationMethod = e.target.value;
                    setDraft((prev) => ({ ...prev, valuationMethod }));
                    scheduleAutosave({ valuationMethod });
                  }}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="inf-basis" className="text-xs font-semibold text-text-2">
                  أساس القيمة
                </Label>
                <Input
                  id="inf-basis"
                  className="text-xs"
                  disabled={formDisabled}
                  value={draft.valueBasis}
                  onChange={(e) => {
                    const valueBasis = e.target.value;
                    setDraft((prev) => ({ ...prev, valueBasis }));
                    scheduleAutosave({ valueBasis });
                  }}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="inf-land" className="text-xs font-semibold text-text-2">
                  قيمة الأرض (ر.س)
                </Label>
                <Input
                  id="inf-land"
                  className="text-xs"
                  disabled={formDisabled}
                  value={draft.landValue}
                  onChange={(e) => {
                    const landValue = e.target.value;
                    setDraft((prev) => ({ ...prev, landValue }));
                    scheduleAutosave({ landValue });
                  }}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="inf-building" className="text-xs font-semibold text-text-2">
                  قيمة المباني (ر.س)
                </Label>
                <Input
                  id="inf-building"
                  className="text-xs"
                  disabled={formDisabled}
                  value={draft.buildingValue}
                  onChange={(e) => {
                    const buildingValue = e.target.value;
                    setDraft((prev) => ({ ...prev, buildingValue }));
                    scheduleAutosave({ buildingValue });
                  }}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="inf-discount" className="text-xs font-semibold text-text-2">
                  نسبة خصم البيع القسري (%)
                </Label>
                <Input
                  id="inf-discount"
                  className="text-xs"
                  disabled={formDisabled}
                  value={draft.forcedSaleDiscountPct}
                  onChange={(e) => {
                    const forcedSaleDiscountPct = e.target.value;
                    setDraft((prev) => ({ ...prev, forcedSaleDiscountPct }));
                    scheduleAutosave({ forcedSaleDiscountPct });
                  }}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="inf-demand" className="text-xs font-semibold text-text-2">
                حجم الطلب على العقار
              </Label>
              <Input
                id="inf-demand"
                className="text-xs"
                disabled={formDisabled}
                value={draft.demandLevel}
                onChange={(e) => {
                  const demandLevel = e.target.value;
                  setDraft((prev) => ({ ...prev, demandLevel }));
                  scheduleAutosave({ demandLevel });
                }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="inf-search" className="text-xs font-semibold text-text-2">
                نطاق البحث ومصادر معلومات القيم
              </Label>
              <textarea
                id="inf-search"
                className={cn(
                formControlClassName,
                "min-h-[88px] resize-y rounded-[10px] py-2 leading-relaxed",
              )}
                rows={3}
                disabled={formDisabled}
                value={draft.searchScopeNotes}
                onChange={(e) => {
                  const searchScopeNotes = e.target.value;
                  setDraft((prev) => ({ ...prev, searchScopeNotes }));
                  scheduleAutosave({ searchScopeNotes });
                }}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="inf-address" className="text-xs font-semibold text-text-2">
                  عنوان المقيم
                </Label>
                <Input
                  id="inf-address"
                  className="text-xs"
                  disabled={formDisabled}
                  value={draft.appraiserAddress}
                  onChange={(e) => {
                    const appraiserAddress = e.target.value;
                    setDraft((prev) => ({ ...prev, appraiserAddress }));
                    scheduleAutosave({ appraiserAddress });
                  }}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="inf-phone" className="text-xs font-semibold text-text-2">
                  رقم تواصل المقيّم
                </Label>
                <Input
                  id="inf-phone"
                  className="text-xs"
                  disabled={formDisabled}
                  value={draft.appraiserPhone}
                  onChange={(e) => {
                    const appraiserPhone = e.target.value;
                    setDraft((prev) => ({ ...prev, appraiserPhone }));
                    scheduleAutosave({ appraiserPhone });
                  }}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="inf-plan" className="text-xs font-semibold text-text-2">
                صورة الأصل من المخطط (اسم الملف)
              </Label>
              <Input
                id="inf-plan"
                className="text-xs"
                disabled={formDisabled}
                value={draft.planImageFileName ?? ""}
                onChange={(e) => {
                  const planImageFileName = e.target.value || null;
                  setDraft((prev) => ({ ...prev, planImageFileName }));
                  scheduleAutosave({ planImageFileName });
                }}
              />
            </div>
            </div>
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

