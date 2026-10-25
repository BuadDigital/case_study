"use client";

/**
 * «لوحة الإدارة › إصلاح البيانات» — find a work order's tasks and run the
 * corrections the server already allows the system administrator: return a
 * transaction to an earlier phase, reopen a completed one, delete a
 * primary-data slot, stop or cancel the order, and re-run the task sync.
 * Every action goes through the existing commands; the server writes the audit row.
 */
import { useDeferredValue, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Button,
  confirmAction,
  EmptyState,
  opsLetterCard,
  opsLetterHead,
  opsLetterSub,
  opsLetterTitle,
  opsSearchInput,
  promptAction,
  QueryErrorState,
  RowMoreMenu,
  TableFrame,
  Table,
  TBody,
  THead,
  Td,
  Th,
  Tr,
  cn,
  useToast,
  type RowMoreMenuItem,
} from "@platform/ui-kit";
import { dmy } from "@platform/app-shared/format/date";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import { queryLoadFailed } from "@platform/app-shared/query/query-load-state";
import { useWorkflowTasksQuery } from "../../query/case-study-queries";
import {
  deletePrimaryDataTransaction,
  reopenCompletedTransaction,
  revertTaskToPhase,
  syncTasksFromPoRecords,
  type WorkflowTask,
} from "../../lib/app-data/tasks";
import {
  taskDisplayPropertyLabel,
  taskKindLabel,
  taskPhaseLabel,
  taskStatusLabel,
} from "../../lib/app-data/tasks-model";
import { cancelPoRecord, stopPoRecord } from "../../lib/app-data/po-intake-commands";

type ActionResult = { ok: true } | { ok: false; error: string };

/** Work orders whose number contains the search, each with its tasks (study slots first). */
function groupTasksByPo(tasks: WorkflowTask[], search: string) {
  const q = search.trim().toLowerCase();
  if (!q) return [];
  const byPo = new Map<string, WorkflowTask[]>();
  for (const task of tasks) {
    const po = task.poNumber.trim();
    if (!po.toLowerCase().includes(q)) continue;
    const list = byPo.get(po) ?? [];
    list.push(task);
    byPo.set(po, list);
  }
  return [...byPo.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, 10)
    .map(([poNumber, list]) => ({
      poNumber,
      tasks: list.sort(
        (a, b) =>
          Number(b.kind === "case-study-property") -
            Number(a.kind === "case-study-property") ||
          a.propertyOrdinal - b.propertyOrdinal,
      ),
    }));
}

export function AdminDataFixesPanel() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const tasksQuery = useWorkflowTasksQuery();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const groups = useMemo(
    () => groupTasksByPo(tasksQuery.data ?? [], deferredSearch),
    [tasksQuery.data, deferredSearch],
  );

  async function run(
    id: string,
    action: () => Promise<ActionResult>,
    success: string,
  ) {
    setBusyId(id);
    try {
      const result = await action();
      if (!result.ok) {
        showToast(result.error, "error");
        return;
      }
      showToast(success, "success");
      await queryClient.invalidateQueries({
        queryKey: appDataKeys.workflowTasks(),
      });
    } finally {
      setBusyId(null);
    }
  }

  async function revert(task: WorkflowTask, target: "enfath" | "bourse") {
    const label =
      target === "enfath" ? "البيانات الأولية" : "استعلام البورصة";
    const ok = await confirmAction({
      title: `إرجاع إلى ${label}`,
      message: `إرجاع «${taskDisplayPropertyLabel(task)}» إلى ${label}؟`,
      confirmLabel: "تأكيد الإرجاع",
    });
    if (!ok) return;
    await run(
      task.id,
      () => revertTaskToPhase(task.id, target),
      `تم إرجاع المعاملة إلى ${label}`,
    );
  }

  async function reopen(task: WorkflowTask) {
    const reason = await promptAction({
      title: "إعادة فتح المعاملة",
      label: "سبب إعادة الفتح",
      required: true,
      confirmLabel: "إعادة الفتح",
    });
    if (reason == null) return;
    await run(
      task.id,
      () => reopenCompletedTransaction(task.id, reason),
      "تمت إعادة فتح المعاملة",
    );
  }

  async function remove(task: WorkflowTask) {
    const reason = await promptAction({
      title: "حذف المعاملة",
      label: "سبب الحذف",
      required: true,
      confirmLabel: "متابعة",
      danger: true,
    });
    if (reason == null) return;
    const ok = await confirmAction({
      title: "حذف المعاملة",
      message:
        "حذف هذه المعاملة؟ يبقى العقار في قائمة أمر العمل مع سبب الحذف، ولا يمكن التراجع.",
      confirmLabel: "حذف",
      danger: true,
    });
    if (!ok) return;
    await run(
      task.id,
      () => deletePrimaryDataTransaction(task.id, reason),
      "تم حذف المعاملة",
    );
  }

  async function poAction(poNumber: string, kind: "stop" | "cancel") {
    const label = kind === "stop" ? "إيقاف" : "إلغاء";
    const ok = await confirmAction({
      title: `${label} أمر العمل`,
      message: `${label} أمر العمل ${poNumber}؟`,
      confirmLabel: label,
      danger: true,
    });
    if (!ok) return;
    await run(
      `po:${poNumber}`,
      () => (kind === "stop" ? stopPoRecord(poNumber) : cancelPoRecord(poNumber)),
      `تم ${label} أمر العمل`,
    );
  }

  async function resync() {
    setSyncing(true);
    try {
      const result = await syncTasksFromPoRecords();
      showToast(
        result.ok ? "تمت إعادة مزامنة المهام" : result.error,
        result.ok ? "success" : "error",
      );
    } finally {
      setSyncing(false);
    }
  }

  function taskMenu(task: WorkflowTask): RowMoreMenuItem[] {
    if (task.kind !== "case-study-property") return [];
    const items: RowMoreMenuItem[] = [];
    const open = task.status === "open";
    if (open && task.phase === "bourse") {
      items.push({
        id: "revert-enfath",
        label: "إرجاع للبيانات الأولية",
        onClick: () => void revert(task, "enfath"),
      });
    }
    if (open && task.phase === "distribution") {
      items.push({
        id: "revert-bourse",
        label: "إرجاع لاستعلام البورصة",
        onClick: () => void revert(task, "bourse"),
      });
    }
    if (task.status === "completed") {
      items.push({
        id: "reopen",
        label: "إعادة فتح المعاملة",
        onClick: () => void reopen(task),
      });
    }
    if (open && (task.phase === "enfath" || task.phase === "bourse")) {
      items.push({
        id: "delete",
        label: "حذف المعاملة",
        danger: true,
        onClick: () => void remove(task),
      });
    }
    return items;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className={cn(opsLetterCard, "rounded-xl")}>
        <div className={opsLetterHead}>
          <div>
            <div className={opsLetterTitle}>البحث عن أمر عمل</div>
            <div className={opsLetterSub}>
              اكتب رقم أمر العمل لعرض معاملاته وتطبيق الإجراء المناسب. كل إجراء
              يُسجَّل في سجل التدقيق.
            </div>
          </div>
          <Button
            variant="default"
            size="sm"
            disabled={syncing}
            onClick={() => void resync()}
          >
            {syncing ? "جاري المزامنة…" : "إعادة مزامنة المهام"}
          </Button>
        </div>
        <div className="p-3.5 sm:p-[18px]">
          <input
            className={cn(opsSearchInput, "w-full rounded-[9px] border border-border-md px-3 py-2.5")}
            placeholder="رقم أمر العمل، مثال: PO-073333"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="رقم أمر العمل"
            dir="ltr"
          />
        </div>
      </div>

      {queryLoadFailed(tasksQuery) ? (
        <div className={opsLetterCard}>
          <QueryErrorState
            panel
            line="تعذّر تحميل المعاملات"
            error={tasksQuery.error}
            onRetry={() => void tasksQuery.refetch()}
            retrying={tasksQuery.isFetching}
          />
        </div>
      ) : !deferredSearch.trim() ? null : tasksQuery.isPending ? (
        <div className={opsLetterCard}>
          <EmptyState panel line="جاري التحميل…" />
        </div>
      ) : groups.length === 0 ? (
        <div className={opsLetterCard}>
          <EmptyState panel line="لا يوجد أمر عمل بهذا الرقم." />
        </div>
      ) : (
        groups.map(({ poNumber, tasks }) => (
          <div key={poNumber} className={cn(opsLetterCard, "rounded-xl")}>
            <div className={opsLetterHead}>
              <bdi dir="ltr" className="text-[14px] font-extrabold text-gold-d">
                {poNumber}
              </bdi>
              <div className="flex gap-2">
                <Button
                  variant="default"
                  size="sm"
                  disabled={busyId === `po:${poNumber}`}
                  onClick={() => void poAction(poNumber, "stop")}
                >
                  إيقاف أمر العمل
                </Button>
                <Button
                  variant="dangerOutline"
                  size="sm"
                  disabled={busyId === `po:${poNumber}`}
                  onClick={() => void poAction(poNumber, "cancel")}
                >
                  إلغاء أمر العمل
                </Button>
              </div>
            </div>
            <TableFrame className="rounded-none border-0">
              <Table>
                <THead>
                  <Tr hoverable={false}>
                    <Th>المهمة</Th>
                    <Th>العقار</Th>
                    <Th>المرحلة</Th>
                    <Th>الحالة</Th>
                    <Th>المسند إليه</Th>
                    <Th>آخر تحديث</Th>
                    <Th>
                      <span className="sr-only">إجراءات</span>
                    </Th>
                  </Tr>
                </THead>
                <TBody>
                  {tasks.map((task) => {
                    const menu = taskMenu(task);
                    return (
                      <Tr key={task.id} hoverable={false}>
                        <Td>{taskKindLabel(task.kind)}</Td>
                        <Td>{taskDisplayPropertyLabel(task)}</Td>
                        <Td>
                          {task.kind === "case-study-property"
                            ? taskPhaseLabel(task.phase)
                            : "—"}
                        </Td>
                        <Td>{taskStatusLabel(task.status)}</Td>
                        <Td>{task.assigneeName || "—"}</Td>
                        <Td>
                          <bdi dir="ltr">{dmy(task.updatedAt)}</bdi>
                        </Td>
                        <Td className="text-end">
                          {menu.length > 0 ? (
                            <RowMoreMenu
                              items={menu}
                              busy={busyId === task.id}
                            />
                          ) : null}
                        </Td>
                      </Tr>
                    );
                  })}
                </TBody>
              </Table>
            </TableFrame>
          </div>
        ))
      )}
    </div>
  );
}
