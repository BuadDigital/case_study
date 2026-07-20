"use client";

import { useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
import { getAuthSession } from "@platform/auth-client";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
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

type GovernmentReviewPoRow = {
  tasks: WorkflowTask[];
  poNumber: string;
  propertyCount: number;
  expectedPropertyCount: number;
  assignmentType: string;
  receivedFromEnfathAt: string;
  dueDateAt: string;
  createdAt: string;
  status: WorkflowTask["status"];
};

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

  const {
    data: tasks,
    isFetched: tasksFetched,
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

    const list: GovernmentReviewPoRow[] = [...grouped.entries()].map(
      ([poNumber, group]) => {
        const status: WorkflowTask["status"] = group.tasks.every(
          (task) => task.status === "completed",
        )
          ? "completed"
          : group.tasks.some((task) => task.status === "open")
            ? "open"
            : "blocked";
        const propertyCount = group.propertyIds.size || group.tasks.length;

        return {
          tasks: group.tasks,
          poNumber,
          propertyCount,
          expectedPropertyCount: Math.max(
            group.expectedPropertyCount,
            propertyCount,
          ),
          assignmentType: group.assignmentType,
          receivedFromEnfathAt: group.receivedFromEnfathAt,
          dueDateAt: group.dueDateAt,
          createdAt: group.createdAt,
          status,
        };
      },
    );

    return list.sort((a, b) => {
      const createdCmp = b.createdAt.localeCompare(a.createdAt);
      if (createdCmp !== 0) return createdCmp;
      return a.poNumber.localeCompare(b.poNumber, "ar", { numeric: true });
    });
  }, [mine, poByNumber, reviewerScope]);

  const openPo = useCallback(
    (row: GovernmentReviewPoRow) => {
      router.push(poPropertiesPath(row.poNumber));
    },
    [router],
  );

  const hasRail = false;

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
                      const poHref = poPropertiesPath(row.poNumber);
                      const dueUrgent =
                        Boolean(row.dueDateAt) && isPastDue(row.dueDateAt);
                      const courtVisit = courtVisitForPo(opsTasks, row.poNumber);
                      return (
                        <Tr
                          key={row.poNumber}
                          hoverable={false}
                          className={ROW}
                          onClick={() => openPo(row)}
                        >
                          <Td className="text-text-2">
                            <Link
                              href={poHref}
                              dir="ltr"
                              className="relative z-[1] text-[13.5px] font-bold text-primary underline decoration-primary underline-offset-2 hover:text-primary-mid"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {row.poNumber}
                            </Link>
                          </Td>
                          <Td className="whitespace-nowrap text-center text-[13px] text-text-2 tabular-nums">
                            <span className="font-extrabold text-heading">
                              {row.propertyCount}
                            </span>
                            <span className="mx-1 text-text-3">من</span>
                            <span className="font-bold text-text-2">
                              {row.expectedPropertyCount}
                            </span>
                          </Td>
                          <Td className="whitespace-nowrap">
                            <span className="inline-flex items-center rounded-md border border-border-md bg-surface-2 px-2.5 py-[3px] text-[12px] font-medium text-text-2">
                              {row.assignmentType}
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
                              <Badge tone="warning">قيد الإجراء</Badge>
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
                اضغط على رقم أمر العمل أو الصف لعرض عقاراته. خطاب التفويض يُنشأ
                عبر المهام التشغيلية — افتح عمود «مهمة زيارة المحكمة» عند وجودها.
              </QueueTableHint>
            </>
          )}
        </OperationalPanel>
  );

  return (
    <ActiveTransactionPageLayout
      pageId="government-review"
      hasRail={hasRail}
      panelOpen={false}
      queuePanel={queuePanel}
      sidePanel={null}
    />
  );
}
