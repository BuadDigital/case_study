"use client";

import { Button, cn } from "@platform/design-system";
import {
  InfathSection,
  InfathSelectField,
  InfathTextField,
} from "./InfathFormFields";
import {
  EVALUATOR_WORKER_ROLES,
  createEmptyReportWorker,
  type EvaluatorReportWorker,
  type EvaluatorReportWorkerRole,
} from "../../lib/evaluator/evaluator-window-data";

type ReportWorkersSectionProps = {
  workers: EvaluatorReportWorker[];
  disabled?: boolean;
  error?: string;
  onChange: (workers: EvaluatorReportWorker[]) => void;
};

export function ReportWorkersSection({
  workers,
  disabled = false,
  error,
  onChange,
}: ReportWorkersSectionProps) {
  const update = (id: string, patch: Partial<EvaluatorReportWorker>) => {
    onChange(workers.map((w) => (w.id === id ? { ...w, ...patch } : w)));
  };

  const remove = (id: string) => {
    if (workers.length <= 1) {
      onChange([createEmptyReportWorker("معد")]);
      return;
    }
    onChange(workers.filter((w) => w.id !== id));
  };

  return (
    <InfathSection title="بيانات العاملين على التقرير">
      <p className="m-0 mb-3 text-[11px] leading-relaxed text-[#6b7280]">
        يمكن إضافة أكثر من شخص (معد / مراجع / معتمد) لكل تقرير تقييم.
      </p>

      <div className="flex flex-col gap-4">
        {workers.map((worker, index) => (
          <div
            key={worker.id}
            className="rounded-lg border border-[#e5e7eb] bg-[#fafafa] p-3.5 sm:p-4"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-[12px] font-bold text-[#1f2937]">
                عامل #{index + 1}
              </span>
              {!disabled ? (
                <button
                  type="button"
                  className="text-[12px] font-semibold text-[#b45309] hover:underline disabled:opacity-40"
                  disabled={workers.length <= 1}
                  onClick={() => remove(worker.id)}
                >
                  حذف
                </button>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-x-5 gap-y-3 sm:grid-cols-2 xl:grid-cols-4">
              <InfathSelectField
                id={`worker-role-${worker.id}`}
                label="الدور"
                required
                disabled={disabled}
                value={worker.role}
                onChange={(e) =>
                  update(worker.id, {
                    role: e.target.value as EvaluatorReportWorkerRole | "",
                  })
                }
              >
                <option value="">— اختر —</option>
                {EVALUATOR_WORKER_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </InfathSelectField>

              <InfathTextField
                id={`worker-name-${worker.id}`}
                label="الاسم"
                required
                autoComplete="off"
                disabled={disabled}
                value={worker.name}
                onChange={(e) => update(worker.id, { name: e.target.value })}
              />

              <InfathTextField
                id={`worker-license-${worker.id}`}
                label="رقم الترخيص"
                required
                autoComplete="off"
                disabled={disabled}
                value={worker.licenseNumber}
                onChange={(e) =>
                  update(worker.id, { licenseNumber: e.target.value })
                }
              />

              <InfathTextField
                id={`worker-license-date-${worker.id}`}
                label="تاريخ الترخيص"
                type="date"
                autoComplete="off"
                disabled={disabled}
                value={worker.licenseDate}
                onChange={(e) =>
                  update(worker.id, { licenseDate: e.target.value })
                }
              />
            </div>

            <div className="mt-3">
              <span className="mb-1.5 block text-[11px] font-medium text-[#4b5563]">
                مرفق الترخيص
              </span>
              <div
                className={cn(
                  "flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-[#d1d5db] bg-surface px-3 py-2.5",
                  disabled && "opacity-60",
                )}
              >
                <input
                  type="file"
                  accept="application/pdf,.pdf,image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                  disabled={disabled}
                  className="max-w-full text-[12px] text-[#374151] file:me-2 file:rounded-md file:border-0 file:bg-[#12284C] file:px-2.5 file:py-1 file:text-[11px] file:font-bold file:text-white"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    update(worker.id, {
                      licenseFileName: file?.name ?? null,
                    });
                  }}
                />
                {worker.licenseFileName ? (
                  <span className="text-[12px] font-medium text-[#185fa5]">
                    {worker.licenseFileName}
                  </span>
                ) : (
                  <span className="text-[11px] text-[#9ca3af]">
                    PDF أو صورة (اختياري)
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {error ? (
        <span className="mt-2 block text-[11px] text-danger-text">{error}</span>
      ) : null}

      {!disabled ? (
        <div className="mt-3">
          <Button
            type="button"
            size="sm"
            variant="outline"
            showActionToast={false}
            onClick={() =>
              onChange([...workers, createEmptyReportWorker("مراجع")])
            }
          >
            + إضافة عامل
          </Button>
        </div>
      ) : null}
    </InfathSection>
  );
}
