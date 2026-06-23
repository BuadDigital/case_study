"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  queueTableRowActiveClassName,
  queueTableRowClassName,
  queueTableWrapClassName,
} from "@platform/design-system";
import { GovernmentReviewPoPanel } from "../components/government-review/GovernmentReviewPoPanel";
import { ActiveTransactionPageLayout } from "../components/active-transactions/ActiveTransactionPageLayout";
import { PoNumber } from "../components/ui/PoNumber";
import { getAuthSession } from "@platform/auth-client";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import { useStaffUsersQuery } from "@settings/mfe/query/settings-queries";
import { buildGovernmentReviewPoRows } from "../lib/prototype/government-review-po";
import { partyTaskPageDef } from "@platform/app-shared/prototype/party-task-pages";
import {
  decodeTaskParam,
  governmentReviewWorkspacePath,
} from "../lib/my-task-routes";
import { tasksForPartyAssignee } from "../lib/prototype/tasks-storage";
import {
  reviewerScopeForRole,
} from "../lib/prototype/reviewer-coverage";
import {
  usePoRecordsQuery,
  useWorkflowTasksQuery,
} from "../query/case-study-queries";

const ROW = queueTableRowClassName;
const ROW_ACTIVE = queueTableRowActiveClassName;

function governmentReviewPoPath(poNumber: string): string {
  return `/government-review?po=${encodeURIComponent(poNumber)}`;
}

export function GovernmentReviewView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedPo = searchParams.get("po");
  const selectedTaskId = searchParams.get("task");
  const { role, viewerEmail } = usePrototype();
  const { data: staffResult } = useStaffUsersQuery();
  const staffUsers = staffResult?.users ?? [];
  const def = partyTaskPageDef("government-review");
  const reviewerScope = reviewerScopeForRole(role, staffUsers);

  const {
    data: tasks,
    refetch: refetchTasks,
    isFetched: tasksFetched,
  } = useWorkflowTasksQuery();
  const {
    data: poRecords = [],
    isFetched: poRecordsFetched,
  } = usePoRecordsQuery();

  const queueReady = tasksFetched && poRecordsFetched;
  const [panelOpen, setPanelOpen] = useState(() => Boolean(selectedPo));

  useEffect(() => {
    if (!selectedTaskId) return;
    router.replace(governmentReviewWorkspacePath(decodeTaskParam(selectedTaskId)));
  }, [selectedTaskId, router]);

  useEffect(() => {
    setPanelOpen(Boolean(selectedPo));
  }, [selectedPo]);

  const poByNumber = useMemo(() => {
    const map = new Map<string, (typeof poRecords)[number]>();
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

  const rows = useMemo(
    () => buildGovernmentReviewPoRows(mine, poByNumber, reviewerScope),
    [mine, poByNumber, reviewerScope],
  );

  const selectedRow = useMemo(
    () =>
      selectedPo
        ? rows.find((row) => row.poNumber.trim() === selectedPo.trim()) ?? null
        : null,
    [rows, selectedPo],
  );

  const closePanel = useCallback(() => {
    router.replace("/government-review", { scroll: false });
  }, [router]);

  const openPo = useCallback(
    (poNumber: string) => {
      setPanelOpen(true);
      router.replace(governmentReviewPoPath(poNumber), { scroll: false });
    },
    [router],
  );

  const openTask = useCallback(
    (_poNumber: string, taskId: string) => {
      router.push(governmentReviewWorkspacePath(taskId));
    },
    [router],
  );

  const handleRowClick = useCallback(
    (poNumber: string) => {
      if (selectedPo?.trim() === poNumber.trim()) {
        closePanel();
        return;
      }
      openPo(poNumber);
    },
    [selectedPo, closePanel, openPo],
  );

  useEffect(() => {
    if (!selectedPo || !queueReady) return;
    if (rows.some((row) => row.poNumber.trim() === selectedPo.trim())) return;
    closePanel();
  }, [selectedPo, queueReady, rows, closePanel]);

  const refreshWork = useCallback(() => {
    void refetchTasks();
  }, [refetchTasks]);

  const hasRail = !queueReady ? false : rows.length > 0;

  if (selectedTaskId) {
    return <PanelSkeleton className="p-4" />;
  }

  const queuePanel = (
        <OperationalPanel
          className={cn(
            "min-h-0 flex-1",
            hasRail && panelOpen && selectedRow ? undefined : "flex-none",
          )}
        >
          {!queueReady ? (
            <div className={queueTableWrapClassName}>
              <Table pending>
                <THead>
                  <Tr hoverable={false}>
                    <Th>أمر العمل</Th>
                    <Th>نوع الإسناد</Th>
                    <Th>المحاكم</Th>
                    <Th>العقارات</Th>
                    <Th>مهام مفتوحة</Th>
                    <Th>البيانات الأولية</Th>
                  </Tr>
                </THead>
                <TBody>
                  <SkeletonTableRows rows={5} cols={6} />
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
                      <Th>نوع الإسناد</Th>
                      <Th>المحاكم</Th>
                      <Th>العقارات</Th>
                      <Th>مهام مفتوحة</Th>
                      <Th>البيانات الأولية</Th>
                    </Tr>
                  </THead>
                  <TBody>
                    {rows.map((row) => {
                      const active = selectedPo?.trim() === row.poNumber.trim();
                      return (
                        <Tr
                          key={row.poNumber}
                          hoverable={false}
                          className={cn(ROW, active && ROW_ACTIVE)}
                          onClick={() => handleRowClick(row.poNumber)}
                        >
                          <Td>
                            <PoNumber value={row.poNumber} />
                          </Td>
                          <Td className="text-text-2">{row.assignmentType}</Td>
                          <Td className="text-text-2">
                            {row.courts.length > 0
                              ? row.courts.join(" · ")
                              : "—"}
                          </Td>
                          <Td className="text-text-2">{row.propertyCount}</Td>
                          <Td>
                            {row.openCount > 0 ? (
                              <Badge tone="warning">{row.openCount}</Badge>
                            ) : (
                              <Badge tone="success">0</Badge>
                            )}
                          </Td>
                          <Td>
                            {row.primaryDataReady ? (
                              <Badge tone="success">مكتمل</Badge>
                            ) : (
                              <Badge tone="warning">ناقص</Badge>
                            )}
                          </Td>
                        </Tr>
                      );
                    })}
                  </TBody>
                </Table>
              </div>
              <QueueTableHint>
                اضغط صف أمر العمل لفتح مهام المراجعة وخطابات التفويض — اختر
                مهمة عقار لفتحها في صفحة مستقلة.
              </QueueTableHint>
            </>
          )}
        </OperationalPanel>
  );

  const sidePanel =
    hasRail && panelOpen && selectedRow ? (
      <OperationalPanel
        id="government-review-panel"
        className="flex min-h-0 min-w-0 flex-col self-stretch"
      >
        <GovernmentReviewPoPanel
          row={selectedRow}
          onClose={closePanel}
          onRefresh={refreshWork}
          onOpenTask={(taskId) => openTask(selectedRow.poNumber, taskId)}
        />
      </OperationalPanel>
    ) : null;

  return (
    <ActiveTransactionPageLayout
      pageId="government-review"
      hasRail={hasRail}
      panelOpen={panelOpen && Boolean(selectedRow)}
      queuePanel={queuePanel}
      sidePanel={sidePanel}
    />
  );
}
