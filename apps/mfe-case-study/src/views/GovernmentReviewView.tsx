"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Badge,
  Button,
  Card,
  CardBody,
  cn,
  Note,
  PageShell,
  PanelSkeleton,
  SkeletonTableRows,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from "@platform/design-system";
import { InternalDelegationLetterPanel } from "../components/government-review/InternalDelegationLetterPanel";
import { PoNumber } from "../components/ui/PoNumber";
import { RegistrationFormCard } from "@platform/app-shared/registration/RegistrationFormCard";
import { getAuthSession } from "@platform/auth-client";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import {
  buildGovernmentReviewPoRows,
  courtGroupsForPo,
  type GovernmentReviewPoRow,
} from "../lib/prototype/government-review-po";
import {
  delegationLetterForCourt,
  hydrateInternalDelegationLetters,
  syncInternalDelegationLetters,
} from "../lib/prototype/internal-delegation-letters";
import { partyTaskPageDef } from "@platform/app-shared/prototype/party-task-pages";
import {
  decodeTaskParam,
  governmentReviewWorkspacePath,
} from "../lib/my-task-routes";
import {
  taskDisplayPropertyLabel,
  tasksForPartyAssignee,
} from "../lib/prototype/tasks-storage";
import { formatPoDisplay } from "../lib/prototype/po-intake-data";
import {
  reviewerCoverageLabel,
  reviewerScopeForRole,
} from "../lib/prototype/reviewer-coverage";
import {
  usePoRecordsQuery,
  useWorkflowTasksQuery,
} from "../query/case-study-queries";

const ROW =
  "cursor-pointer transition-colors hover:bg-[color-mix(in_srgb,var(--info-bg)_40%,var(--surface))]";
const ROW_ACTIVE =
  "bg-[color-mix(in_srgb,var(--warning-bg)_45%,var(--surface))]";

function governmentReviewPoPath(poNumber: string): string {
  return `/government-review?po=${encodeURIComponent(poNumber)}`;
}

function GovernmentReviewPoPanel({
  row,
  onClose,
  onRefresh,
  onOpenTask,
}: {
  row: GovernmentReviewPoRow;
  onClose: () => void;
  onRefresh: () => void;
  onOpenTask: (taskId: string) => void;
}) {
  const { data: poRecords = [] } = usePoRecordsQuery();
  const record = useMemo(
    () => poRecords.find((r) => r.poNumber.trim() === row.poNumber.trim()),
    [poRecords, row.poNumber],
  );
  const [, bump] = useState(0);
  const refreshLetters = useCallback(() => bump((n) => n + 1), []);

  useEffect(() => {
    if (!record) return;
    void hydrateInternalDelegationLetters(record.poNumber).then(() => {
      syncInternalDelegationLetters(record);
      refreshLetters();
    });
  }, [record, refreshLetters]);

  const courtGroups = useMemo(
    () => courtGroupsForPo(record, row.courts),
    [record, row.courts],
  );

  return (
    <Card className="sticky top-3 self-start overflow-hidden rounded-none border-none shadow-none lg:border-s lg:border-border">
      <CardBody className="px-4 py-3">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="m-0 mb-1 text-sm font-semibold text-text">
              {formatPoDisplay(row.poNumber)}
            </h2>
            <p className="m-0 text-[10px] text-text-3">
              {row.assignmentType} · {row.propertyCount} عقار · {row.openCount}{" "}
              مهمة مفتوحة
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onClose}
            aria-label="إغلاق"
          >
            ✕
          </Button>
        </div>
        <RegistrationFormCard title="ملخص أمر العمل">
          <Note tone="info">{row.primaryDataLabel}</Note>
          {row.courts.length > 0 ? (
            <p className="mt-2 text-[10px] text-text-3">
              المحاكم: {row.courts.join(" · ")}
            </p>
          ) : (
            <p className="mt-2 text-[10px] text-text-3">
              لا توجد محاكم مسجّلة بعد في بيانات العقارات.
            </p>
          )}
        </RegistrationFormCard>

        <RegistrationFormCard title="مهام المراجعة (حسب العقار)">
          {row.tasks.length === 0 ? (
            <p className="text-[10px] text-text-3">
              لا توجد مهام مراجعة مرتبطة بهذا الأمر.
            </p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {row.tasks.map((task) => (
                <li key={task.id}>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-auto w-full justify-start py-2 text-start"
                    onClick={() => onOpenTask(task.id)}
                  >
                    {taskDisplayPropertyLabel(task)} — {task.title}
                    {task.status === "open" ? (
                      <Badge tone="warning" className="ms-2">
                        مفتوحة
                      </Badge>
                    ) : (
                      <Badge tone="success" className="ms-2">
                        منجزة
                      </Badge>
                    )}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </RegistrationFormCard>

        {record
          ? courtGroups.map((group) => {
              const letter = delegationLetterForCourt(
                row.poNumber,
                group.court,
                record,
              );
              if (!letter) return null;
              return (
                <InternalDelegationLetterPanel
                  key={group.court}
                  letter={letter}
                  record={record}
                  onRefresh={() => {
                    refreshLetters();
                    onRefresh();
                  }}
                />
              );
            })
          : null}
      </CardBody>
    </Card>
  );
}

export function GovernmentReviewView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedPo = searchParams.get("po");
  const selectedTaskId = searchParams.get("task");
  const { role, viewerEmail } = usePrototype();
  const def = partyTaskPageDef("government-review");
  const reviewerScope = reviewerScopeForRole(role);

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
      ),
    [viewerEmail, role, tasks],
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

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-bg">
      <div
        className={cn(
          "grid min-h-0 flex-1 items-stretch gap-0",
          hasRail && panelOpen && selectedRow
            ? "grid-cols-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(300px,1fr)]"
            : "grid-cols-1",
        )}
      >
        <PageShell>
          <header className="grid items-center gap-1 border-b border-border bg-gradient-to-br from-surface-2 to-surface px-4 py-2.5">
            <div className="flex min-w-0 flex-col gap-0.5">
              <h1 className="m-0 text-base font-bold text-text">
                <span>{def?.pageTitle ?? "المراجعة الحكومية"}</span>
              </h1>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-text-2">
                <span className="font-medium text-text-2">
                  نطاق التغطية: {reviewerCoverageLabel(reviewerScope)}
                </span>
                {!queueReady ? null : (
                  <span className="font-medium text-text-2">
                    {rows.length} {rows.length === 1 ? "أمر عمل" : "أوامر عمل"}
                  </span>
                )}
              </div>
            </div>
          </header>

          {!queueReady ? (
            <div className="w-full overflow-x-auto">
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
            <div className="px-6 py-8 text-center">
              <p className="m-0 text-[13px] text-text-3">
                {def?.emptyLine ?? "لا توجد مهام مراجعة حكومية."}
              </p>
              <p className="mt-2 text-[11px] text-text-3">
                {def?.emptyHint ??
                  "تظهر هنا بعد تأكيد التوزيع عند تفعيل المراجع الحكومي."}
              </p>
            </div>
          ) : (
            <>
              <div className="w-full overflow-x-auto">
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
              <p className="px-6 py-2 pb-3 text-[11px] text-text-3">
                اضغط صف أمر العمل لفتح مهام المراجعة وخطابات التفويض — اختر
                مهمة عقار لفتحها في صفحة مستقلة.
              </p>
            </>
          )}
        </PageShell>

        {hasRail ? (
          <div
            id="government-review-panel"
            className={cn(
              "min-w-0 self-stretch overflow-hidden opacity-0 invisible",
              panelOpen &&
                selectedRow &&
                "visible overflow-visible border-s border-border opacity-100",
            )}
          >
            {panelOpen && selectedRow ? (
              <GovernmentReviewPoPanel
                row={selectedRow}
                onClose={closePanel}
                onRefresh={refreshWork}
                onOpenTask={(taskId) => openTask(selectedRow.poNumber, taskId)}
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
