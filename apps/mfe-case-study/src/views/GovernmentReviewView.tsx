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
  TdAction,
  Th,
  ThAction,
  THead,
  Tr,
  cn,
  queueTableRowClassName,
  queueTableWrapClassName,
} from "@platform/design-system";
import { RowMoreMenu } from "../components/ui/RowMoreMenu";
import type { RowMoreMenuItem } from "../components/ui/RowMoreMenu";
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
  type PoIntakeRecord,
} from "../lib/prototype/po-intake-data";
import {
  usePoRecordsQuery,
  useWorkflowTasksQuery,
} from "../query/case-study-queries";

const ROW = queueTableRowClassName;

type GovernmentReviewPoRow = {
  tasks: WorkflowTask[];
  poNumber: string;
  propertyCount: number;
  assignmentType: string;
  createdAt: string;
  status: WorkflowTask["status"];
};

export function GovernmentReviewView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedTaskId = searchParams.get("task");
  const { role, viewerEmail } = usePrototype();
  const { data: staffResult } = useStaffUsersQuery();
  const staffUsers = useMemo(() => staffResult?.users ?? [], [staffResult?.users]);
  const def = partyTaskPageDef("government-review");
  const reviewerScope = reviewerScopeForRole(role, staffUsers);

  const {
    data: tasks,
    isFetched: tasksFetched,
  } = useWorkflowTasksQuery();
  const {
    data: poRecords = [],
    isFetched: poRecordsFetched,
  } = usePoRecordsQuery();

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

        return {
          tasks: group.tasks,
          poNumber,
          propertyCount: group.propertyIds.size || group.tasks.length,
          assignmentType: group.assignmentType,
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

  const rowMoreItems = useCallback(
    (row: GovernmentReviewPoRow): RowMoreMenuItem[] => {
      const task =
        row.tasks.find((item) => item.status === "open") ??
        row.tasks.find((item) => item.status === "blocked") ??
        row.tasks[0];
      if (!task) return [];
      return [
        {
          id: "start-transaction",
          label: "بدء المعاملة",
          onClick: () => router.push(governmentReviewWorkspacePath(task.id)),
        },
      ];
    },
    [router],
  );

  const hasRail = false;

  if (selectedTaskId) {
    return <PanelSkeleton className="p-4" />;
  }

  const queuePanel = (
        <OperationalPanel className={cn("min-h-0 flex-1")}>
          {!queueReady ? (
            <div className={queueTableWrapClassName}>
              <Table pending>
                <THead>
                  <Tr hoverable={false}>
                    <Th>أمر العمل</Th>
                    <Th>عدد الصكوك</Th>
                    <Th>نوع الإسناد</Th>
                    <Th>حالة المهمة</Th>
                    <ThAction aria-label="المزيد" />
                  </Tr>
                </THead>
                <TBody>
                  <SkeletonTableRows rows={5} cols={5} />
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
                  <THead>
                    <Tr hoverable={false}>
                      <Th>أمر العمل</Th>
                      <Th>عدد الصكوك</Th>
                      <Th>نوع الإسناد</Th>
                      <Th>حالة المهمة</Th>
                      <ThAction aria-label="المزيد" />
                    </Tr>
                  </THead>
                  <TBody>
                    {rows.map((row) => {
                      const poHref = poPropertiesPath(row.poNumber);
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
                              className="relative z-[1] font-medium text-primary underline decoration-primary underline-offset-2 hover:text-primary-mid"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {row.poNumber}
                            </Link>
                          </Td>
                          <Td className="text-text-2">
                            {row.propertyCount}
                          </Td>
                          <Td className="text-text-2">{row.assignmentType}</Td>
                          <Td>
                            {row.status === "open" ? (
                              <Badge tone="warning">قيد الإجراء</Badge>
                            ) : row.status === "blocked" ? (
                              <Badge tone="default">موقوفة</Badge>
                            ) : (
                              <Badge tone="success">مكتملة</Badge>
                            )}
                          </Td>
                          <TdAction>
                            <RowMoreMenu items={rowMoreItems(row)} />
                          </TdAction>
                        </Tr>
                      );
                    })}
                  </TBody>
                </Table>
              </div>
              <QueueTableHint>
                اضغط على رقم أمر العمل أو الصف لعرض عقاراته. لبدء المراجعة
                استخدم «بدء المعاملة» من قائمة ⋮.
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
