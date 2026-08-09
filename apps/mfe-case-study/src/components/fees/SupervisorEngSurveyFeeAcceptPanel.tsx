"use client";

/**
 * Supervisor / ops fees: accept engineering-survey outputs so fee accrual starts.
 * Styled like Case Study.html fee card grids.
 */

import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  SkeletonTableRows,
  Table,
  TBody,
  formControlClassName,
  cn,
  useToast,
} from "@platform/design-system";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import {
  acceptEngineeringSurveySubmission,
  reopenEngineeringSurveySubmission,
  prefetchEngineeringSurveySubmissions,
  loadEngineeringSurveySubmission,
  isEngineeringSurveyOutputsAccepted,
} from "@engineering-office/mfe/lib/engineering-survey-submission-storage";
import { useWorkflowTasksQuery } from "../../query/case-study-queries";
import type { WorkflowTask } from "../../lib/prototype/tasks-storage";
import { PoNumber } from "../ui/PoNumber";

function deedFromTitle(title: string | undefined): string {
  const t = (title ?? "").trim();
  if (!t) return "—";
  const m = t.match(/—\s*(.+)$/);
  return m?.[1]?.trim() || t;
}

function formatWhen(raw: string | null | undefined): string {
  if (!raw?.trim()) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("ar-SA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export type EngSurveyPendingAcceptRow = {
  taskId: string;
  poNumber: string;
  deedLabel: string;
  assigneeName: string;
  submittedAtUtc?: string;
};

const PENDING_ACCEPT_KEY = [
  ...prototypeKeys.all,
  "eng-survey-fee-accept-pending",
] as const;

export const SUPERVISOR_ENG_SURVEY_PENDING_ACCEPT_KEY = PENDING_ACCEPT_KEY;

const COLS =
  "minmax(100px,.85fr) minmax(120px,1fr) minmax(130px,1.1fr) minmax(110px,.9fr) minmax(220px,1.35fr)";

export async function loadSupervisorEngSurveyPendingAcceptRows(
  tasks: WorkflowTask[],
): Promise<EngSurveyPendingAcceptRow[]> {
  const surveyTasks = tasks.filter(
    (t) => t.kind === "engineering-survey" && t.status === "completed",
  );
  if (surveyTasks.length === 0) return [];

  await prefetchEngineeringSurveySubmissions(surveyTasks.map((t) => t.id));

  const rows: EngSurveyPendingAcceptRow[] = [];
  for (const task of surveyTasks) {
    const sub = loadEngineeringSurveySubmission(task.id);
    if (!sub || sub.status !== "submitted") continue;
    if (isEngineeringSurveyOutputsAccepted(sub)) continue;
    rows.push({
      taskId: task.id,
      poNumber: task.poNumber?.trim() || "—",
      deedLabel: deedFromTitle(task.title),
      assigneeName: (task.assigneeName ?? task.assigneeId ?? "—").trim() || "—",
      submittedAtUtc: sub.submittedAtUtc,
    });
  }
  return rows;
}

export function SupervisorEngSurveyFeeAcceptPanel() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { data: tasks, isPending: tasksPending } = useWorkflowTasksQuery();

  const {
    data: pending = [],
    isPending: pendingLoading,
    isFetched,
  } = useQuery({
    queryKey: PENDING_ACCEPT_KEY,
    queryFn: () => loadSupervisorEngSurveyPendingAcceptRows(tasks ?? []),
    enabled: Boolean(tasks && tasks.length > 0),
    staleTime: 15_000,
  });

  const [busyId, setBusyId] = useState<string | null>(null);
  const [returnForId, setReturnForId] = useState<string | null>(null);
  const [returnNote, setReturnNote] = useState("");
  const [rowError, setRowError] = useState<string | null>(null);

  const refreshAfterMutation = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: PENDING_ACCEPT_KEY }),
      queryClient.invalidateQueries({
        queryKey: [...prototypeKeys.all, "inspector-fees"],
      }),
      queryClient.invalidateQueries({ queryKey: prototypeKeys.workflowTasks() }),
    ]);
  }, [queryClient]);

  async function handleAccept(taskId: string) {
    setBusyId(taskId);
    setRowError(null);
    try {
      const result = await acceptEngineeringSurveySubmission(taskId);
      if (!result.ok) {
        setRowError(result.error);
        showToast(result.error, "error");
        return;
      }
      showToast("تم قبول المخرجات واستحقاق الأتعاب من جدول التسعير.", "success");
      await refreshAfterMutation();
    } finally {
      setBusyId(null);
    }
  }

  async function handleReturn(taskId: string) {
    const note = returnNote.trim();
    if (!note) {
      setRowError("يجب إدخال سبب الإرجاع للتصحيح.");
      return;
    }
    setBusyId(taskId);
    setRowError(null);
    try {
      const result = await reopenEngineeringSurveySubmission(taskId, note);
      if (!result.ok) {
        setRowError(result.error);
        showToast(result.error, "error");
        return;
      }
      showToast("أُعيدت المخرجات للتصحيح — لا استحقاق أتعاب.", "success");
      setReturnForId(null);
      setReturnNote("");
      await refreshAfterMutation();
    } finally {
      setBusyId(null);
    }
  }

  const loading =
    tasksPending || (Boolean(tasks?.length) && pendingLoading && !isFetched);

  if (loading) {
    return (
      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-card">
        <Table pending>
          <TBody>
            <SkeletonTableRows rows={3} cols={5} />
          </TBody>
        </Table>
      </div>
    );
  }

  if (pending.length === 0) {
    return (
      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-card">
        <div className="px-4 py-10 text-center text-[13px] text-text-3">
          لا رفوعات مساحية بانتظار القبول.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {rowError ? (
        <p className="m-0 text-xs text-danger" role="alert">
          {rowError}
        </p>
      ) : null}
      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-card">
        <div className="overflow-x-auto">
          <div className="min-w-[760px]">
            <div
              className="grid border-b-2 border-gold bg-surface-2"
              style={{ gridTemplateColumns: COLS }}
            >
              {[
                "أمر العمل",
                "الصك / العقار",
                "المكتب",
                "تاريخ الإرسال",
                "إجراء",
              ].map((h) => (
                <div
                  key={h}
                  className="flex min-w-0 items-center justify-center overflow-hidden px-4 py-3.5 text-center text-[12px] font-bold text-heading"
                >
                  {h}
                </div>
              ))}
            </div>
            {pending.map((row) => {
              const busy = busyId === row.taskId;
              const returning = returnForId === row.taskId;
              return (
                <div
                  key={row.taskId}
                  className="grid min-h-[38px] items-center border-b border-border transition-colors hover:bg-[var(--row-hover,#faf6ee)]"
                  style={{ gridTemplateColumns: COLS }}
                >
                  <div className="px-4 py-3">
                    <PoNumber value={row.poNumber} link />
                  </div>
                  <div
                    dir="ltr"
                    className="px-4 py-3 text-end text-[13px] font-bold text-gold-d"
                  >
                    {row.deedLabel}
                  </div>
                  <div className="px-4 py-3 text-[12.5px] text-text-2">
                    {row.assigneeName}
                  </div>
                  <div className="px-4 py-3 text-[12px] tabular-nums text-text-2">
                    {formatWhen(row.submittedAtUtc)}
                  </div>
                  <div className="px-4 py-3">
                    {returning ? (
                      <div className="flex min-w-[200px] flex-col gap-2">
                        <textarea
                          className={cn(
                            formControlClassName,
                            "min-h-[56px] text-[11.5px]",
                          )}
                          placeholder="سبب الإرجاع للتصحيح…"
                          value={returnNote}
                          disabled={busy}
                          onChange={(e) => setReturnNote(e.target.value)}
                        />
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            disabled={busy}
                            className="cursor-pointer rounded-lg border-none bg-ink px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50"
                            onClick={() => void handleReturn(row.taskId)}
                          >
                            تأكيد الإرجاع
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            className="cursor-pointer rounded-lg border border-border-md bg-surface px-3 py-1.5 text-[11px] font-bold text-text-2 disabled:opacity-50"
                            onClick={() => {
                              setReturnForId(null);
                              setReturnNote("");
                              setRowError(null);
                            }}
                          >
                            إلغاء
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          disabled={busy}
                          className="cursor-pointer whitespace-nowrap rounded-lg border-none bg-ink px-[11px] py-1.5 text-[11px] font-bold text-white shadow-[0_6px_16px_-8px_rgba(18,40,76,.55)] disabled:opacity-50"
                          onClick={() => void handleAccept(row.taskId)}
                        >
                          قبول المخرجات
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          className="cursor-pointer whitespace-nowrap rounded-lg border border-border-md bg-surface px-[11px] py-1.5 text-[11px] font-bold text-text-2 disabled:opacity-50"
                          onClick={() => {
                            setReturnForId(row.taskId);
                            setReturnNote("");
                            setRowError(null);
                          }}
                        >
                          إرجاع للتصحيح
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
