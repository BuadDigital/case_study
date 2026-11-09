"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import type { OperationsTaskDto } from "@platform/api-client";
import { Badge, Button, Note } from "@platform/ui-kit";
import { filterOperationsTasksForProperty } from "../../lib/app-data/operations-task-property-scope";
import { operationsTaskStatusLabel } from "../../lib/app-data/operations-task-display";
import { operationsTaskPath } from "../../lib/my-task-routes";
import { useOperationsTasksQuery } from "../../query/operations-tasks-queries";

/**
 * Whether an operations task still holds the transaction (Omar 2026-11-08): not cancelled and its
 * outputs not accepted by its creator — the server applies the same rule before «إرسال المعاملة للدراسة».
 */
export function linkedTaskHolds(task: Pick<OperationsTaskDto, "status" | "outputsAcceptedAt">): boolean {
  return task.status !== "cancelled" && !task.outputsAcceptedAt;
}

/**
 * «المهام المرتبطة» on the coordinator's page: the operations tasks on this deed (a government review,
 * a court visit, a re-shoot…) — a task not accepted yet holds the send to the study.
 *
 * How it works: the shared operations-task list scoped to the deed as the property pages scope it
 * (`filterOperationsTasksForProperty`); each row shows its state and whether it holds the send, and
 * opens the task (its creator accepts the outputs there). «إنشاء مهمة مرتبطة» opens the create form
 * on this work order.
 * Edge cases: a list that cannot load shows a note — the server still checks before sending.
 */
export function LinkedTasksSection({
  poNumber,
  deedNumber,
  canCreate,
}: {
  poNumber: string;
  deedNumber: string;
  canCreate: boolean;
}) {
  const router = useRouter();
  const query = useOperationsTasksQuery({ live: true });
  const tasks = useMemo(
    () => filterOperationsTasksForProperty(query.data ?? [], { poNumber, deedNumber }),
    [query.data, poNumber, deedNumber],
  );

  return (
    <div className="flex flex-col gap-3 pt-3" data-testid="coordination-linked-tasks">
      <p className="m-0 text-[12.5px] text-text-2">
        المهام التشغيلية على هذا الصك أو أمر العمل. لا تُرسل المعاملة للدراسة حتى يقبل منشئ كل مهمة مخرجاتها أو تُلغى.
      </p>
      {query.isError ? <Note tone="warn">تعذّر تحميل المهام — يتحقق منها النظام عند الإرسال.</Note> : null}
      {tasks.length === 0 && query.isFetched ? (
        <p className="m-0 text-[12px] text-text-3">لا توجد مهام مرتبطة.</p>
      ) : null}
      {tasks.map((task) => {
        const holds = linkedTaskHolds(task);
        return (
          <div
            key={task.id}
            className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-[13px]"
          >
            <span className="font-mono text-[12px] text-text-3">{task.displayId}</span>
            <span className="font-bold text-heading">{task.title}</span>
            <Badge tone="default">{operationsTaskStatusLabel(task.status)}</Badge>
            {holds ? (
              <Badge tone="warning">تمنع الإرسال</Badge>
            ) : task.outputsAcceptedAt ? (
              <Badge tone="success">قُبلت مخرجاتها</Badge>
            ) : null}
            <span className="flex-1" />
            <Button type="button" size="sm" variant="outline" onClick={() => router.push(operationsTaskPath(task.id))}>
              فتح المهمة
            </Button>
          </div>
        );
      })}
      {canCreate ? (
        <div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              router.push(`/operations-tasks?create=1&type=general&po=${encodeURIComponent(poNumber.trim())}`)
            }
          >
            إنشاء مهمة مرتبطة
          </Button>
        </div>
      ) : null}
    </div>
  );
}
