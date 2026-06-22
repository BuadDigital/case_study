"use client";

import type { MutableRefObject, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Badge,
  cn,
  EmptyState,
  OperationalPanel,
  PageShellHeader,
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
  queueTableRowActiveClassName,
  queueTableRowClassName,
  queueTableWrapClassName,
  type BadgeTone,
} from "@platform/design-system";
import { PoNumber } from "@case-study/mfe/components/ui/PoNumber";
import { RemainingTimeCell } from "@case-study/mfe/components/ui/RemainingTimeCell";
import { RowMoreMenu } from "@case-study/mfe/components/ui/RowMoreMenu";
import type { RowMoreMenuItem } from "@case-study/mfe/components/ui/RowMoreMenu";
import { PartyAssigneeCell } from "../components/ui/PartyAssigneeCell";
import { buildActiveQueueRowMoreItems } from "../lib/prototype/active-queue-row-menu";
import { buildCaseStudyPartyAssignees } from "../lib/prototype/case-study-tracks";
import { getAuthSession } from "@platform/auth-client";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import type { PageId, RoleId } from "@platform/types";
import { poPropertyDetailPath } from "../lib/po-routes";
import {
  buildDistributionTableRow,
  buildPrimaryDataTableRow,
  compareQueueTasksOldestFirst,
  findPropertyForTask,
} from "../lib/prototype/my-task-row";
import type { PoIntakeRecord } from "../lib/prototype/po-intake-data";
import { isTaskOnSuspendedProperty } from "../lib/prototype/suspended-transactions-storage";
import { type WorkflowTask } from "../lib/prototype/tasks-storage";
import { resolveQueueTasksForViewer } from "../lib/prototype/viewer-task-access";
import {
  usePoRecordsQuery,
  useWorkflowTasksQuery,
} from "@case-study/mfe/query/case-study-queries";
import { useQueryClient } from "@tanstack/react-query";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";

export type ActiveTransactionQueueTableLayout =
  | "primary-data"
  | "distribution"
  | "case-study";

export type ActiveTransactionQueueConfig = {
  pageTitle: string;
  /** Hide in-page hero title when the top bar already shows the same label. */
  hidePageTitle?: boolean;
  emptyLine: string;
  emptyHint: string;
  panelId: string;
  /** Column set for the queue table (default: primary-data). */
  tableLayout?: ActiveTransactionQueueTableLayout;
  /** Hint under the queue table; defaults to distribution wording. */
  tableHint?: string;
  /** Filter by prototype assignee id from توزيع المعاملات. */
  partyAssignee?: boolean;
  /** Page id for queue context (e.g. party pages). */
  pageId?: PageId;
  /** Role whose queue is shown (party pages); CDO uses this to see all assignees. */
  assigneeRole?: RoleId;
  getBasePath: () => string;
  getTaskPath: (taskId: string) => string;
  /** Navigate to a dedicated page instead of opening the side panel. */
  fullPageTaskPath?: (taskId: string) => string;
  filterListed: (
    mine: WorkflowTask[],
    poByNumber: Map<string, PoIntakeRecord>,
  ) => WorkflowTask[];
  /** Override row ⋮ menu (e.g. appraiser recall). */
  buildRowMoreItems?: (ctx: ActiveQueueRowMoreContext) => RowMoreMenuItem[];
  /** When false, row click does not open the work panel. */
  canOpenTask?: (task: WorkflowTask) => boolean;
  /** Replaces remaining-time cell when set (e.g. submission status). */
  getTaskStatusBadge?: (
    task: WorkflowTask,
  ) => { label: string; className: string } | null;
  statusColumnLabel?: string;
  /** Re-bump queue when these window events fire. */
  refreshOnWindowEvents?: string[];
  /** Stats / filters above the queue table (e.g. engineering office dashboard). */
  renderQueueHeader?: (listed: WorkflowTask[]) => ReactNode;
};

export type ActiveQueueRowMoreContext = {
  task: WorkflowTask;
  propertyId?: string;
  openTask: () => void;
  router: { push: (href: string) => void };
  refreshQueue: () => void;
};

export type ActiveQueueApi = {
  listed: WorkflowTask[];
  poByNumber: Map<string, PoIntakeRecord>;
  openTask: (taskId: string) => void;
  closePanel: () => void;
  setAdvancing: (value: boolean) => void;
  syncQueue: () => Promise<void>;
};

type PanelRenderProps = {
  task: WorkflowTask;
  onRefresh: () => void;
  onClose: () => void;
};

const ROW = queueTableRowClassName;
const ROW_ACTIVE = queueTableRowActiveClassName;

function legacyBadgeTone(className: string): BadgeTone {
  if (className.includes("done")) return "success";
  if (className.includes("fail")) return "danger";
  if (className.includes("prog")) return "warning";
  if (className.includes("new")) return "info";
  return "default";
}

export function ActiveTransactionQueueView({
  config,
  renderPanel,
  queueApiRef,
}: {
  config: ActiveTransactionQueueConfig;
  renderPanel?: (props: PanelRenderProps) => ReactNode;
  queueApiRef?: MutableRefObject<ActiveQueueApi | null>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const selectedId = searchParams.get("task");
  const { role, viewerEmail } = usePrototype();
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
  const queuePending = !queueReady;
  const [now, setNow] = useState(() => new Date());
  const [panelOpen, setPanelOpen] = useState(() => Boolean(selectedId));
  const advancingRef = useRef(false);
  const [, bump] = useState(0);

  const refreshWork = useCallback(() => {
    bump((n) => n + 1);
    void refetchTasks();
  }, [refetchTasks]);

  const syncQueue = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: prototypeKeys.poRecords() });
    await queryClient.invalidateQueries({
      queryKey: prototypeKeys.workflowTasks(),
    });
    bump((n) => n + 1);
    await refetchTasks();
  }, [queryClient, refetchTasks]);

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    const events = config.refreshOnWindowEvents;
    if (!events?.length) return;
    const handler = () => refreshWork();
    for (const ev of events) window.addEventListener(ev, handler);
    return () => {
      for (const ev of events) window.removeEventListener(ev, handler);
    };
  }, [config.refreshOnWindowEvents, refreshWork]);

  useEffect(() => {
    if (selectedId) setPanelOpen(true);
    else setPanelOpen(false);
  }, [selectedId]);

  const poByNumber = useMemo(() => {
    const map = new Map<string, PoIntakeRecord>();
    for (const r of poRecords) map.set(r.poNumber.trim(), r);
    return map;
  }, [poRecords]);

  const mine = useMemo(() => {
    return resolveQueueTasksForViewer({
      role,
      tasks: tasks ?? [],
      pageId: config.pageId,
      partyAssignee: config.partyAssignee,
      assigneeRole: config.assigneeRole,
      viewerEmail: viewerEmail ?? getAuthSession()?.user.email,
    });
  }, [
    config.assigneeRole,
    config.pageId,
    config.partyAssignee,
    viewerEmail,
    role,
    tasks,
  ]);

  const listed = useMemo(
    () =>
      config
        .filterListed(mine, poByNumber)
        .filter(
          (t) =>
            (t.status === "open" || t.status === "blocked") &&
            !isTaskOnSuspendedProperty(t),
        )
        .sort((a, b) => compareQueueTasksOldestFirst(a, b, poByNumber)),
    [config, mine, poByNumber],
  );

  const selectedTask = useMemo((): WorkflowTask | null => {
    if (!selectedId) return null;
    return listed.find((t) => t.id === selectedId) ?? null;
  }, [selectedId, listed]);

  const closePanel = useCallback(() => {
    router.replace(config.getBasePath(), { scroll: false });
  }, [router, config]);

  const useFullPage = Boolean(config.fullPageTaskPath);

  const openTask = useCallback(
    (taskId: string) => {
      if (config.fullPageTaskPath) {
        router.push(config.fullPageTaskPath(taskId));
        return;
      }
      setPanelOpen(true);
      router.replace(config.getTaskPath(taskId), { scroll: false });
    },
    [router, config],
  );

  const handleRowClick = useCallback(
    (taskId: string) => {
      const task = listed.find((t) => t.id === taskId);
      if (task && config.canOpenTask && !config.canOpenTask(task)) return;

      if (useFullPage) {
        openTask(taskId);
        return;
      }
      if (selectedId === taskId) {
        closePanel();
        return;
      }
      openTask(taskId);
    },
    [useFullPage, selectedId, closePanel, openTask, listed, config],
  );

  const resolveRowMoreItems = useCallback(
    (task: WorkflowTask, propertyId: string | undefined) => {
      const ctx: ActiveQueueRowMoreContext = {
        task,
        propertyId,
        openTask: () => handleRowClick(task.id),
        router,
        refreshQueue: refreshWork,
      };
      if (config.buildRowMoreItems) {
        return config.buildRowMoreItems(ctx);
      }
      return buildActiveQueueRowMoreItems(ctx);
    },
    [config, handleRowClick, router, refreshWork],
  );

  const renderStatusOrRemaining = useCallback(
    (
      task: WorkflowTask,
      remainingTime: Parameters<typeof RemainingTimeCell>[0]["state"],
    ) => {
      const badge = config.getTaskStatusBadge?.(task);
      if (badge) {
        return (
          <Badge tone={legacyBadgeTone(badge.className)}>{badge.label}</Badge>
        );
      }
      return <RemainingTimeCell state={remainingTime} />;
    },
    [config],
  );

  useEffect(() => {
    if (!queueApiRef) return;
    queueApiRef.current = {
      listed,
      poByNumber,
      openTask,
      closePanel,
      setAdvancing: (value) => {
        advancingRef.current = value;
      },
      syncQueue,
    };
  }, [queueApiRef, listed, poByNumber, openTask, closePanel, syncQueue]);

  useEffect(() => {
    if (advancingRef.current) return;
    if (!selectedId || queuePending) return;
    if (selectedTask) return;
    const stillExists = (tasks ?? []).some((t) => t.id === selectedId);
    if (!stillExists || listed.every((t) => t.id !== selectedId)) {
      closePanel();
    }
  }, [selectedId, selectedTask, queuePending, listed, closePanel, tasks]);

  const isDistributionTable =
    config.tableLayout === "distribution" ||
    config.tableLayout === "case-study";
  const showPartyColumns = config.tableLayout === "case-study";
  const distributionSkeletonCols = 8 + (showPartyColumns ? 4 : 0);
  const primarySkeletonCols = 6;

  const handleDistributionRowClick = useCallback(
    (task: WorkflowTask, propertyId: string | undefined) => {
      if (showPartyColumns && propertyId) {
        router.push(
          poPropertyDetailPath(task.poNumber, propertyId, "basic"),
        );
        return;
      }
      handleRowClick(task.id);
    },
    [showPartyColumns, router, handleRowClick],
  );

  const hasRail = !useFullPage && queueReady && listed.length > 0 && renderPanel;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-bg">
      <div
        className={cn(
          "grid min-h-0 flex-1 gap-3 bg-bg",
          hasRail && panelOpen
            ? "grid-cols-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(300px,1fr)] lg:items-stretch"
            : "grid-cols-1 items-start content-start",
        )}
      >
        <OperationalPanel
          className={cn(hasRail && panelOpen ? "min-h-0 flex-1" : "flex-none")}
        >
          {!config.hidePageTitle && config.pageTitle ? (
            <PageShellHeader title={config.pageTitle} />
          ) : null}

          {config.renderQueueHeader && queueReady && listed.length > 0
            ? config.renderQueueHeader(listed)
            : null}

          {queueReady && listed.length === 0 ? (
            <EmptyState line={config.emptyLine} hint={config.emptyHint} />
          ) : (
            <>
              <div
                className={cn(
                  queueTableWrapClassName,
                  isDistributionTable && "overflow-x-auto",
                )}
              >
                {isDistributionTable ? (
                  <Table
                    className={cn(
                      "w-full",
                      showPartyColumns ? "min-w-0" : "min-w-[720px]",
                    )}
                    pending={queuePending}
                  >
                    <THead>
                      <Tr hoverable={false}>
                        <Th>رقم الصك</Th>
                        <Th>أمر العمل</Th>
                        <Th>المدينة</Th>
                        <Th>الحي</Th>
                        <Th>نوع العقار</Th>
                        <Th>التصنيف</Th>
                        <Th>المساحة</Th>
                        {showPartyColumns ? (
                          <>
                            <Th>المعاين</Th>
                            <Th>المراجع الحكومي</Th>
                            <Th>المقيم</Th>
                            <Th>المكتب الهندسي</Th>
                          </>
                        ) : null}
                        <ThAction aria-label="المزيد" />
                      </Tr>
                    </THead>
                    <TBody>
                      {queuePending && listed.length === 0 ? (
                        <SkeletonTableRows
                          rows={6}
                          cols={distributionSkeletonCols}
                        />
                      ) : (
                        listed.map((task) => {
                        const record = poByNumber.get(task.poNumber.trim());
                        const property = findPropertyForTask(record, task);
                        const row = buildDistributionTableRow(
                          task,
                          property,
                          record,
                        );
                        const parties = showPartyColumns
                          ? buildCaseStudyPartyAssignees(task, tasks ?? [])
                          : [];
                        const active = selectedId === task.id;
                        const moreItems = resolveRowMoreItems(task, property?.id);
                        return (
                          <Tr
                            key={task.id}
                            hoverable={false}
                            className={cn(ROW, active && ROW_ACTIVE)}
                            onClick={() =>
                              handleDistributionRowClick(task, property?.id)
                            }
                          >
                            <Td>
                              {property?.id ? (
                                <Link
                                  href={poPropertyDetailPath(
                                    task.poNumber,
                                    property.id,
                                    "basic",
                                  )}
                                  dir="ltr"
                                  className="relative z-[1] inline-block text-[11px] font-semibold text-primary no-underline hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {row.deedLabel}
                                </Link>
                              ) : (
                                <span
                                  dir="ltr"
                                  className="inline-block text-[11px] font-semibold text-primary"
                                >
                                  {row.deedLabel}
                                </span>
                              )}
                            </Td>
                            <Td className="text-text-2">
                              <PoNumber value={task.poNumber} link />
                            </Td>
                            <Td className="text-text-2">{row.city}</Td>
                            <Td className="text-text-2">{row.district}</Td>
                            <Td className="text-text-2">{row.propertyType}</Td>
                            <Td className="text-text-2">{row.classification}</Td>
                            <Td className="text-text-2">{row.area}</Td>
                            {showPartyColumns
                              ? parties.map((party) => (
                                  <Td
                                    key={party.trackId}
                                    className="max-w-0 overflow-hidden text-ellipsis text-text-2"
                                  >
                                    <PartyAssigneeCell party={party} />
                                  </Td>
                                ))
                              : null}
                            <TdAction>
                              <RowMoreMenu items={moreItems} />
                            </TdAction>
                          </Tr>
                        );
                      })
                      )}
                    </TBody>
                  </Table>
                ) : (
                  <Table className="w-full" pending={queuePending}>
                    <THead>
                      <Tr hoverable={false}>
                        <Th>رقم الصك</Th>
                        <Th>أمر العمل</Th>
                        <Th>نوع الإسناد</Th>
                        <Th>أخصائي الإسناد</Th>
                        <Th>{config.statusColumnLabel ?? "المدة المتبقية"}</Th>
                        <ThAction aria-label="المزيد" />
                      </Tr>
                    </THead>
                    <TBody>
                      {queuePending && listed.length === 0 ? (
                        <SkeletonTableRows rows={6} cols={primarySkeletonCols} />
                      ) : (
                        listed.map((task) => {
                        const record = poByNumber.get(task.poNumber.trim());
                        const property = findPropertyForTask(record, task);
                        const row = buildPrimaryDataTableRow(
                          task,
                          property,
                          record,
                          now,
                        );
                        const active = selectedId === task.id;
                        const moreItems = resolveRowMoreItems(task, property?.id);
                        return (
                          <Tr
                            key={task.id}
                            hoverable={false}
                            className={cn(ROW, active && ROW_ACTIVE)}
                            onClick={() => handleRowClick(task.id)}
                          >
                            <Td className="whitespace-nowrap">
                              <span
                                dir="ltr"
                                className="inline-block text-[11px] font-semibold text-primary"
                              >
                                {row.propertySlot}
                              </span>
                            </Td>
                            <Td className="text-text-2">
                              <PoNumber value={task.poNumber} link />
                            </Td>
                            <Td className="text-text-2">{row.assignmentType}</Td>
                            <Td
                              className="max-w-0 overflow-hidden text-ellipsis text-text-2"
                              title={row.assignmentSpecialist}
                            >
                              {row.assignmentSpecialist}
                            </Td>
                            <Td>
                              {renderStatusOrRemaining(task, row.remainingTime)}
                            </Td>
                            <TdAction>
                              <RowMoreMenu items={moreItems} />
                            </TdAction>
                          </Tr>
                        );
                      })
                      )}
                    </TBody>
                  </Table>
                )}
              </div>
              <QueueTableHint>
                {config.tableHint ??
                  (useFullPage
                    ? "اضغط الصف لفتح دراسة الحالة."
                    : "اضغط الصف لفتح التوزيع — اضغط نفس الصف مرة أخرى للإغلاق.")}
              </QueueTableHint>
            </>
          )}
        </OperationalPanel>

        {hasRail && renderPanel ? (
          <OperationalPanel
            id={config.panelId}
            className={cn(
              "min-h-0 min-w-0 self-stretch opacity-0 invisible",
              panelOpen && "visible opacity-100",
            )}
          >
            {panelOpen && selectedTask
              ? renderPanel({
                  task: selectedTask,
                  onRefresh: refreshWork,
                  onClose: closePanel,
                })
              : null}
          </OperationalPanel>
        ) : null}
      </div>
    </div>
  );
}
