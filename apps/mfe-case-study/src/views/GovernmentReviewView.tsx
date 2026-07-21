"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getPropertyKeyGate } from "@platform/api-client";
import {
  Badge,
  EmptyState,
  OperationalPanel,
  PanelSkeleton,
  QueueTableHint,
  SkeletonTableRows,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  cn,
  queueTableRowClassName,
  queueTableWrapClassName,
} from "@platform/design-system";
import { ActiveTransactionPageLayout } from "../components/active-transactions/ActiveTransactionPageLayout";
import { GovernmentReviewPoPanel } from "../components/government-review/GovernmentReviewPoPanel";
import { getAuthSession } from "@platform/auth-client";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import { prototypeModulesApiConfig } from "@platform/app-shared/prototype/prototype-modules-api-config";
import { useStaffUsersQuery } from "@settings/mfe/query/settings-queries";
import { partyTaskPageDef } from "@platform/app-shared/prototype/party-task-pages";
import {
  decodeTaskParam,
  governmentReviewWorkspacePath,
} from "../lib/my-task-routes";
import { poPropertiesPath } from "../lib/po-routes";
import {
  tasksForPartyAssignee,
  type WorkflowTask,
} from "../lib/prototype/tasks-storage";
import {
  reviewerScopeForRole,
  poInReviewerScope,
  poCitiesForReviewerScope,
} from "../lib/prototype/reviewer-coverage";
import {
  formatDateAr,
  isPastDue,
  type PoIntakeRecord,
} from "../lib/prototype/po-intake-data";
import { poPrimaryDataReadiness } from "../lib/prototype/po-primary-data-readiness";
import type { GovernmentReviewPoRow } from "../lib/prototype/government-review-po";
import { ltrValueClass } from "../components/po-intake/PropertyDetailFields";
import {
  usePoRecordsQuery,
  useWorkflowTasksQuery,
} from "../query/case-study-queries";
import { useOperationsTasksQuery } from "../query/operations-tasks-queries";
import { partyAccountForRole } from "../lib/prototype/distribution-parties";
import {
  isActiveOperationsTask,
  type OperationsTask,
} from "../lib/prototype/operations-tasks-storage";
import { operationsTaskStatusLabel } from "../lib/prototype/operations-task-display";

const ROW = queueTableRowClassName;
const TABLE_COLS = 7;

type QueuePoRow = {
  panelRow: GovernmentReviewPoRow;
  expectedPropertyCount: number;
  receivedFromEnfathAt: string;
  dueDateAt: string;
  status: WorkflowTask["status"];
};

function uniqueCourtsForTasks(
  record: PoIntakeRecord | undefined,
  tasks: WorkflowTask[],
): string[] {
  const courts = new Set<string>();
  for (const task of tasks) {
    const property = record?.properties.find((p) => p.id === task.propertyId);
    const court = property?.court.trim();
    if (court) courts.add(court);
  }
  if (record) {
    for (const property of record.properties) {
      const court = property.court.trim();
      if (court) courts.add(court);
    }
  }
  return [...courts].sort((a, b) => a.localeCompare(b, "ar"));
}

function courtVisitForPo(
  opsTasks: OperationsTask[],
  poNumber: string,
  options?: { activeOnly?: boolean },
): OperationsTask | undefined {
  const po = poNumber.trim();
  return opsTasks.find((t) => {
    if (t.type !== "court_visit" || t.poNumber?.trim() !== po) return false;
    if (options?.activeOnly) return isActiveOperationsTask(t);
    return t.status !== "cancelled";
  });
}

export function GovernmentReviewView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedTaskId = searchParams.get("task");
  const { role, viewerEmail } = usePrototype();
  const { data: staffResult } = useStaffUsersQuery();
  const staffUsers = useMemo(() => staffResult?.users ?? [], [staffResult?.users]);
  const def = partyTaskPageDef("government-review");
  const reviewerScope = reviewerScopeForRole(role, staffUsers);
  const reviewerAccount = useMemo(
    () => partyAccountForRole(role, staffUsers),
    [role, staffUsers],
  );

  const [selectedPoNumber, setSelectedPoNumber] = useState<string | null>(null);

  const {
    data: tasks,
    isFetched: tasksFetched,
    refetch: refetchTasks,
  } = useWorkflowTasksQuery();
  const {
    data: poRecords = [],
    isFetched: poRecordsFetched,
  } = usePoRecordsQuery();

  const assigneeFilter = reviewerAccount?.assigneeId?.trim();
  const { data: opsTasks = [] } = useOperationsTasksQuery({
    assigneeId: assigneeFilter,
  });

  const queueReady = tasksFetched && poRecordsFetched;

  useEffect(() => {
    if (!selectedTaskId) return;
    router.replace(governmentReviewWorkspacePath(decodeTaskParam(selectedTaskId)));
  }, [selectedTaskId, router]);

  const poByNumber = useMemo(() => {
    const map = new Map<string, PoIntakeRecord>();
    for (const record of poRecords) map.set(record.poNumber.trim(), record);
    return map;
  }, [poRecords]);

  const mine = useMemo(
    () =>
      tasksForPartyAssignee(
        role,
        tasks ?? [],
        "government-reviewer",
        viewerEmail ?? getAuthSession()?.user.email,
        staffUsers,
      ),
    [viewerEmail, role, tasks, staffUsers],
  );

  const rows = useMemo(() => {
    const govTasks = mine.filter((task) => task.kind === "government-review");
    const grouped = new Map<
      string,
      {
        tasks: WorkflowTask[];
        assignmentType: string;
        propertyIds: Set<string>;
        createdAt: string;
        receivedFromEnfathAt: string;
        dueDateAt: string;
        expectedPropertyCount: number;
      }
    >();

    for (const task of govTasks) {
      const poNumber = task.poNumber.trim();
      const record = poByNumber.get(poNumber);
      const property = task.propertyId
        ? record?.properties.find((p) => p.id === task.propertyId)
        : undefined;
      const court = property?.court.trim() ?? "";
      const courts = court ? [court] : [];
      const cities = poCitiesForReviewerScope(record, [task]);
      if (!poInReviewerScope(courts, reviewerScope, cities)) continue;

      const activeCount =
        record?.properties.filter((p) => !p.isRemoved).length ?? 0;
      const expected =
        record?.expectedPropertyCount && record.expectedPropertyCount > 0
          ? record.expectedPropertyCount
          : activeCount;

      const current = grouped.get(poNumber);
      if (current) {
        current.tasks.push(task);
        if (task.propertyId) current.propertyIds.add(task.propertyId);
        if (task.createdAt > current.createdAt) current.createdAt = task.createdAt;
        continue;
      }

      grouped.set(poNumber, {
        tasks: [task],
        assignmentType: record?.assignmentType ?? task.assignmentType ?? "—",
        propertyIds: new Set(task.propertyId ? [task.propertyId] : []),
        createdAt: task.createdAt,
        receivedFromEnfathAt: record?.receivedFromEnfathAt?.trim() ?? "",
        dueDateAt: record?.dueDateAt?.trim() ?? "",
        expectedPropertyCount: expected,
      });
    }

    const list: QueuePoRow[] = [...grouped.entries()].map(([poNumber, group]) => {
      const record = poByNumber.get(poNumber);
      const status: WorkflowTask["status"] = group.tasks.every(
        (task) => task.status === "completed",
      )
        ? "completed"
        : group.tasks.some((task) => task.status === "open")
          ? "open"
          : "blocked";
      const propertyCount = group.propertyIds.size || group.tasks.length;
      const readiness = record
        ? poPrimaryDataReadiness(record)
        : {
            ready: false,
            label: "لا توجد بيانات أمر العمل",
          };

      return {
        panelRow: {
          poNumber,
          tasks: group.tasks,
          openCount: group.tasks.filter((t) => t.status === "open").length,
          propertyCount,
          courts: uniqueCourtsForTasks(record, group.tasks),
          assignmentType: group.assignmentType,
          primaryDataReady: readiness.ready,
          primaryDataLabel: readiness.label,
          createdAt: group.createdAt,
        },
        expectedPropertyCount: Math.max(group.expectedPropertyCount, propertyCount),
        receivedFromEnfathAt: group.receivedFromEnfathAt,
        dueDateAt: group.dueDateAt,
        status,
      };
    });

    return list.sort((a, b) => {
      const createdCmp = b.panelRow.createdAt.localeCompare(a.panelRow.createdAt);
      if (createdCmp !== 0) return createdCmp;
      return a.panelRow.poNumber.localeCompare(b.panelRow.poNumber, "ar", {
        numeric: true,
      });
    });
  }, [mine, poByNumber, reviewerScope]);

  const openGateTargets = useMemo(() => {
    const seen = new Set<string>();
    const targets: { propertyId: string; poNumber: string }[] = [];
    for (const row of rows) {
      if (row.status !== "open") continue;
      for (const task of row.panelRow.tasks) {
        if (task.status !== "open" || !task.propertyId?.trim()) continue;
        const key = `${task.propertyId}:${task.poNumber}`;
        if (seen.has(key)) continue;
        seen.add(key);
        targets.push({
          propertyId: task.propertyId.trim(),
          poNumber: task.poNumber.trim(),
        });
      }
    }
    return targets;
  }, [rows]);

  const { data: awaitingEnvelopeByPo = new Set<string>() } = useQuery({
    queryKey: [
      "government-review-envelope-missing",
      openGateTargets.map((t) => `${t.propertyId}:${t.poNumber}`).join("|"),
    ],
    enabled: openGateTargets.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const config = prototypeModulesApiConfig();
      const missing = new Set<string>();
      if (!config) return missing;
      await Promise.all(
        openGateTargets.map(async (target) => {
          const result = await getPropertyKeyGate(config, {
            propertyId: target.propertyId,
            poNumber: target.poNumber,
          });
          if (result.ok && result.data.envelopeMissingWarning) {
            missing.add(target.poNumber);
          }
        }),
      );
      return missing;
    },
  });

  const selectedRow = useMemo(
    () =>
      selectedPoNumber
        ? (rows.find((r) => r.panelRow.poNumber === selectedPoNumber) ?? null)
        : null,
    [rows, selectedPoNumber],
  );

  const togglePo = useCallback((poNumber: string) => {
    setSelectedPoNumber((prev) => (prev === poNumber ? null : poNumber));
  }, []);

  const openReviewTask = useCallback(
    (taskId: string) => {
      router.push(governmentReviewWorkspacePath(taskId));
    },
    [router],
  );

  /** صف واحد بمهمة مفتوحة → نموذج التعبئة مباشرة؛ أكثر من مهمة → لوحة الاختيار. */
  const selectQueueRow = useCallback(
    (row: QueuePoRow) => {
      const po = row.panelRow.poNumber;
      if (selectedPoNumber === po) {
        setSelectedPoNumber(null);
        return;
      }
      const openTasks = row.panelRow.tasks.filter((t) => t.status === "open");
      if (openTasks.length === 1) {
        openReviewTask(openTasks[0]!.id);
        return;
      }
      setSelectedPoNumber(po);
    },
    [openReviewTask, selectedPoNumber],
  );

  const panelOpen = Boolean(selectedRow);
  const hasRail = true;

  if (selectedTaskId) {
    return <PanelSkeleton className="p-4" />;
  }

  const tableHead = (
    <Tr hoverable={false}>
      <Th>أمر العمل</Th>
      <Th className="text-center">عدد الصكوك</Th>
      <Th>نوع الإسناد</Th>
      <Th>تاريخ الاستلام</Th>
      <Th>تاريخ الاستحقاق</Th>
      <Th>حالة المهمة</Th>
      <Th>مهمة زيارة المحكمة</Th>
    </Tr>
  );

  const queuePanel = (
    <OperationalPanel className={cn("min-h-0 flex-1")}>
      {!queueReady ? (
        <div className={queueTableWrapClassName}>
          <Table pending>
            <THead>{tableHead}</THead>
            <TBody>
              <SkeletonTableRows rows={5} cols={TABLE_COLS} />
            </TBody>
          </Table>
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          line={def?.emptyLine ?? "لا توجد مهام مراجعة حكومية."}
          hint={
            def?.emptyHint ??
            "تظهر هنا بعد تأكيد التوزيع عند تفعيل المراجع الحكومي."
          }
        />
      ) : (
        <>
          <div className={queueTableWrapClassName}>
            <Table>
              <THead>{tableHead}</THead>
              <TBody>
                {rows.map((row) => {
                  const po = row.panelRow.poNumber;
                  const poHref = poPropertiesPath(po);
                  const dueUrgent =
                    Boolean(row.dueDateAt) && isPastDue(row.dueDateAt);
                  const courtVisit = courtVisitForPo(opsTasks, po);
                  const selected = selectedPoNumber === po;
                  return (
                    <Tr
                      key={po}
                      hoverable={false}
                      className={cn(ROW, selected && "bg-primary-light/40")}
                      onClick={() => selectQueueRow(row)}
                    >
                      <Td className="text-text-2">
                        <Link
                          href={poHref}
                          dir="ltr"
                          className="relative z-[1] text-[13.5px] font-bold text-primary underline decoration-primary underline-offset-2 hover:text-primary-mid"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {po}
                        </Link>
                      </Td>
                      <Td className="whitespace-nowrap text-center text-[13px] text-text-2 tabular-nums">
                        <span className="font-extrabold text-heading">
                          {row.panelRow.propertyCount}
                        </span>
                        <span className="mx-1 text-text-3">من</span>
                        <span className="font-bold text-text-2">
                          {row.expectedPropertyCount}
                        </span>
                      </Td>
                      <Td className="whitespace-nowrap">
                        <span className="inline-flex items-center rounded-md border border-border-md bg-surface-2 px-2.5 py-[3px] text-[12px] font-medium text-text-2">
                          {row.panelRow.assignmentType}
                        </span>
                      </Td>
                      <Td className="whitespace-nowrap text-[13px] text-text-2">
                        {row.receivedFromEnfathAt ? (
                          <bdi dir="ltr" className={ltrValueClass}>
                            {formatDateAr(row.receivedFromEnfathAt)}
                          </bdi>
                        ) : (
                          "—"
                        )}
                      </Td>
                      <Td
                        className={cn(
                          "whitespace-nowrap text-[13px] font-semibold",
                          dueUrgent ? "text-red" : "text-heading",
                        )}
                      >
                        {row.dueDateAt ? (
                          <bdi dir="ltr" className={ltrValueClass}>
                            {formatDateAr(row.dueDateAt)}
                          </bdi>
                        ) : (
                          "—"
                        )}
                      </Td>
                      <Td>
                        {row.status === "open" ? (
                          awaitingEnvelopeByPo.has(row.panelRow.poNumber) ? (
                            <Badge tone="warning">بانتظار الظرف</Badge>
                          ) : (
                            <Badge tone="warning">قيد الإجراء</Badge>
                          )
                        ) : row.status === "blocked" ? (
                          <Badge tone="default">موقوفة</Badge>
                        ) : (
                          <Badge tone="success">مكتملة</Badge>
                        )}
                      </Td>
                      <Td onClick={(e) => e.stopPropagation()}>
                        {courtVisit ? (
                          <Link
                            href={`/operations-tasks?task=${encodeURIComponent(courtVisit.id)}`}
                            className="relative z-[1] inline-flex flex-col gap-0.5 text-start no-underline"
                          >
                            <span className="text-[12px] font-semibold text-primary underline decoration-primary underline-offset-2">
                              {courtVisit.displayId}
                            </span>
                            <span className="text-[10px] text-text-3">
                              {operationsTaskStatusLabel(courtVisit.status)}
                              {isActiveOperationsTask(courtVisit)
                                ? " · افتح الخطاب من المهام"
                                : ""}
                            </span>
                          </Link>
                        ) : (
                          <span className="text-[12px] text-text-3">—</span>
                        )}
                      </Td>
                    </Tr>
                  );
                })}
              </TBody>
            </Table>
          </div>
          <QueueTableHint>
            {def?.tableHint ??
              "اضغط الصف لفتح نموذج المراجعة (أو لوحة اختيار العقار إن وُجد أكثر من مهمة). خطاب التفويض من عمود «مهمة زيارة المحكمة»."}
          </QueueTableHint>
        </>
      )}
    </OperationalPanel>
  );

  const sidePanel = (
    <OperationalPanel
      className={cn(
        "min-h-0 min-w-0 self-stretch opacity-0 invisible",
        panelOpen && "visible opacity-100",
      )}
    >
      {panelOpen && selectedRow ? (
        <GovernmentReviewPoPanel
          row={selectedRow.panelRow}
          onClose={() => setSelectedPoNumber(null)}
          onRefresh={() => {
            void refetchTasks();
          }}
          onOpenTask={openReviewTask}
        />
      ) : null}
    </OperationalPanel>
  );

  return (
    <ActiveTransactionPageLayout
      pageId="government-review"
      hasRail={hasRail}
      panelOpen={panelOpen}
      queuePanel={queuePanel}
      sidePanel={sidePanel}
    />
  );
}
