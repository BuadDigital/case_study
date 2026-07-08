"use client";

import { useEffect, useMemo } from "react";
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
import {
  taskDisplayPropertyLabel,
  tasksForPartyAssignee,
  type WorkflowTask,
} from "../lib/prototype/tasks-storage";
import {
  reviewerScopeForRole,
  poInReviewerScope,
  poCitiesForReviewerScope,
} from "../lib/prototype/reviewer-coverage";
import {
  formatPropertyDeedDisplay,
  type PoIntakeRecord,
} from "../lib/prototype/po-intake-data";
import {
  usePoRecordsQuery,
  useWorkflowTasksQuery,
} from "../query/case-study-queries";

const ROW = queueTableRowClassName;

type GovernmentReviewDeedRow = {
  task: WorkflowTask;
  poNumber: string;
  deedLabel: string;
  assignmentType: string;
  courtLine: string;
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
    const list: GovernmentReviewDeedRow[] = [];
    for (const task of govTasks) {
      const poNumber = task.poNumber.trim();
      const record = poByNumber.get(poNumber);
      const property = task.propertyId
        ? record?.properties.find((p) => p.id === task.propertyId)
        : undefined;
      const court = property?.court.trim() ?? "";
      const circuit = property?.circuit.trim() ?? "";
      const courts = court ? [court] : [];
      const cities = poCitiesForReviewerScope(record, [task]);
      if (!poInReviewerScope(courts, reviewerScope, cities)) continue;
      const deedLabel =
        (property ? formatPropertyDeedDisplay(property) : "") ||
        taskDisplayPropertyLabel(task);
      list.push({
        task,
        poNumber,
        deedLabel,
        assignmentType: record?.assignmentType ?? task.assignmentType ?? "—",
        courtLine: [court, circuit].filter(Boolean).join(" · ") || "—",
      });
    }
    return list.sort((a, b) =>
      a.deedLabel.localeCompare(b.deedLabel, "ar", { numeric: true }),
    );
  }, [mine, poByNumber, reviewerScope]);

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
                      <Th>الصك</Th>
                    <Th>المحاكم</Th>
                      <Th>نوع الإسناد</Th>
                      <Th>أمر العمل</Th>
                      <Th>حالة المهمة</Th>
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
                      <Th>الصك</Th>
                      <Th>المحاكم</Th>
                      <Th>نوع الإسناد</Th>
                      <Th>أمر العمل</Th>
                      <Th>حالة المهمة</Th>
                    </Tr>
                  </THead>
                  <TBody>
                    {rows.map((row) => {
                      return (
                        <Tr
                          key={row.task.id}
                          hoverable={false}
                          className={ROW}
                          onClick={() =>
                            router.push(governmentReviewWorkspacePath(row.task.id))
                          }
                        >
                          <Td className="text-text-2">
                            <span className="font-medium text-text">
                              {row.deedLabel}
                            </span>
                          </Td>
                          <Td className="text-text-2">{row.courtLine}</Td>
                          <Td className="text-text-2">{row.assignmentType}</Td>
                          <Td className="text-text-2">{row.poNumber}</Td>
                          <Td>
                            {row.task.status === "open" ? (
                              <Badge tone="warning">مفتوحة</Badge>
                            ) : row.task.status === "blocked" ? (
                              <Badge tone="default">موقوفة</Badge>
                            ) : (
                              <Badge tone="success">مكتملة</Badge>
                            )}
                          </Td>
                        </Tr>
                      );
                    })}
                  </TBody>
                </Table>
              </div>
              <QueueTableHint>
                اضغط على الصك لفتح نموذج المراجعة الحكومية ونموذج الدراسة لنفس
                العقار مباشرة.
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
