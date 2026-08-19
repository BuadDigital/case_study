"use client";

import { Button } from "@platform/ui-kit";
import {
  InfathSelectField,
  InfathTextField,
} from "./InfathFormFields";
import {
  EVALUATOR_WORKER_ROLES,
  createEmptyReportWorker,
  type EvaluatorReportWorker,
  type EvaluatorReportWorkerRole,
} from "../../lib/evaluator/evaluator-window-data";

export function EvaluatorReportWorkersSection({
  workers,
  disabled,
  error,
  onChange,
}: {
  workers: EvaluatorReportWorker[];
  disabled?: boolean;
  error?: string;
  onChange: (workers: EvaluatorReportWorker[]) => void;
}) {
  function patchWorker(
    id: string,
    patch: Partial<EvaluatorReportWorker>,
  ) {
    onChange(
      workers.map((worker) =>
        worker.id === id ? { ...worker, ...patch } : worker,
      ),
    );
  }

  return (
    <div id="inf-workers" className="flex flex-col gap-3">
      {workers.map((worker, index) => (
        <div
          key={worker.id}
          className="rounded-[10px] border border-border bg-surface-2/50 p-3"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[12px] font-bold text-text-2">
              عامل {index + 1}
            </span>
            {!disabled && workers.length > 1 ? (
              <button
                type="button"
                className="cursor-pointer border-0 bg-transparent p-0 text-[11px] font-bold text-danger-text"
                onClick={() =>
                  onChange(workers.filter((item) => item.id !== worker.id))
                }
              >
                حذف
              </button>
            ) : null}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <InfathSelectField
              id={`inf-worker-role-${worker.id}`}
              label="الدور"
              required
              disabled={disabled}
              value={worker.role}
              onChange={(e) =>
                patchWorker(worker.id, {
                  role: e.target.value as EvaluatorReportWorkerRole | "",
                })
              }
            >
              <option value="">اختر الدور</option>
              {EVALUATOR_WORKER_ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </InfathSelectField>
            <InfathTextField
              id={`inf-worker-name-${worker.id}`}
              label="الاسم"
              required
              autoComplete="off"
              disabled={disabled}
              value={worker.name}
              onChange={(e) =>
                patchWorker(worker.id, { name: e.target.value })
              }
            />
            <InfathTextField
              id={`inf-worker-license-${worker.id}`}
              label="رقم الترخيص"
              autoComplete="off"
              disabled={disabled}
              value={worker.licenseNumber}
              onChange={(e) =>
                patchWorker(worker.id, { licenseNumber: e.target.value })
              }
            />
            <InfathTextField
              id={`inf-worker-license-date-${worker.id}`}
              label="تاريخ الترخيص"
              type="date"
              autoComplete="off"
              disabled={disabled}
              value={worker.licenseDate}
              onChange={(e) =>
                patchWorker(worker.id, { licenseDate: e.target.value })
              }
            />
          </div>
          <div className="mt-3">
            <label
              className="mb-1 block text-[11px] font-medium text-text-2"
              htmlFor={`inf-worker-license-file-${worker.id}`}
            >
              مرفق الترخيص
            </label>
            <input
              id={`inf-worker-license-file-${worker.id}`}
              type="file"
              accept="application/pdf,.pdf,image/jpeg,image/png,.jpg,.jpeg,.png"
              disabled={disabled}
              className="block w-full text-[12px] text-text-2 file:me-3 file:rounded-md file:border-0 file:bg-surface file:px-3 file:py-1.5 file:text-[11px] file:font-bold file:text-text"
              onChange={(e) => {
                const file = e.target.files?.[0];
                patchWorker(worker.id, {
                  licenseFileName: file?.name ?? null,
                });
              }}
            />
            {worker.licenseFileName ? (
              <p className="mt-1 text-[11px] text-text-3">
                📎 {worker.licenseFileName}
              </p>
            ) : null}
          </div>
        </div>
      ))}
      {error ? (
        <span className="text-[11px] text-danger-text">{error}</span>
      ) : null}
      {!disabled ? (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          showActionToast={false}
          onClick={() =>
            onChange([...workers, createEmptyReportWorker("مراجع")])
          }
        >
          إضافة عامل على التقرير
        </Button>
      ) : null}
    </div>
  );
}
