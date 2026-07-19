"use client";

import type { MutableRefObject, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Button,
  Note,
  OperationalPanel,
  OperationalToolbarSearch,
  OperationalToolbarSelect,
  PageShellHeader,
  PageToolbar,
  QueueTableHint,
  SkeletonTableRows,
  StatusPill,
  Table,
  TBody,
  Td,
  TdAction,
  Th,
  ThAction,
  THead,
  Tr,
  cn,
  EmptyState,
  queueLegacyStatusStyle,
  queueTableRowActiveClassName,
  queueTableRowClassName,
  queueTableWrapClassName,
  useToast,
} from "@platform/design-system";
import { PoNumber } from "@case-study/mfe/components/ui/PoNumber";
import { RemainingTimeCell } from "@case-study/mfe/components/ui/RemainingTimeCell";
import { RowMoreMenu } from "@case-study/mfe/components/ui/RowMoreMenu";
import type { RowMoreMenuItem } from "@case-study/mfe/components/ui/RowMoreMenu";
import { PartyAssigneeCell } from "../components/ui/PartyAssigneeCell";
import { buildActiveQueueRowMoreItems } from "../lib/prototype/active-queue-row-menu";
import { CopyFromPriorTransactionModal } from "../components/po-intake/CopyFromPriorTransactionModal";
import { buildCopyPriorTargetOptions } from "../lib/prototype/po-intake-storage";
import { buildCaseStudyPartyAssignees } from "../lib/prototype/case-study-tracks";
import {
  computePartyCaseStudyProgress,
  loadPartyCaseStudyAnswersByParty,
} from "../lib/prototype/case-study-party-progress";
import { PARTY_CASE_STUDY_FORM_CHANGED_EVENT } from "../lib/prototype/case-study-form-storage";
import { getAuthSession } from "@platform/auth-client";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import { emptyCaseStudyInfoRolesConfig } from "@settings/mfe";
import {
  useCaseStudyInfoRolesQuery,
  useStaffUsersQuery,
} from "@settings/mfe/query/settings-queries";
import type { CaseStudyInfoPartyId } from "@settings/mfe/lib/prototype/case-study-info-roles-data";
import type { PageId, RoleId } from "@platform/types";
import { poPropertyDetailPath } from "../lib/po-routes";
import {
  buildDistributionTableRow,
  buildPrimaryDataTableRow,
  compareQueueTasksOldestFirst,
  compareQueueTasksNewestFirst,
  findPropertyForTask,
} from "../lib/prototype/my-task-row";
import type { PoIntakeRecord } from "../lib/prototype/po-intake-data";
import { skipsBourseForIdentifier } from "../lib/prototype/po-intake-data";
import { isTaskOnSuspendedProperty } from "../lib/prototype/suspended-transactions-storage";
import {
  TASKS_CHANGED_EVENT,
  type WorkflowTask,
} from "../lib/prototype/tasks-storage";
import { resolveQueueTasksForViewer } from "../lib/prototype/viewer-task-access";
import {
  buildDistributionQueueRowMeta,
  buildPrimaryQueueRowMeta,
  filterDistributionQueueRows,
  filterPrimaryQueueRows,
  resolveQueueTaskStatusBadge,
  uniqueSortedLabels,
} from "../lib/prototype/active-queue-list-filters";
import { useFieldInspectionWorkspacesQuery } from "../query/field-inspection-workspaces-queries";
import {
  getCachedPartySubmission,
  partySubmissionTaskIdsKey,
  prefetchPartySubmissionsForTasks,
} from "@platform/app-shared/prototype/party-submission-api";
import {
  usePoRecordsQuery,
  useWorkflowTasksQuery,
} from "@case-study/mfe/query/case-study-queries";
import { useQueryClient } from "@tanstack/react-query";
import { ActiveTransactionPageLayout } from "../components/active-transactions/ActiveTransactionPageLayout";
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
  /** Per-task full-page navigation (e.g. جميع المعاملات for mixed party queues). */
  resolveFullPageTaskPath?: (task: WorkflowTask) => string | undefined;
  filterListed: (
    mine: WorkflowTask[],
    poByNumber: Map<string, PoIntakeRecord>,
  ) => WorkflowTask[];
  /** Override row ⋮ menu (e.g. appraiser recall). */
  buildRowMoreItems?: (ctx: ActiveQueueRowMoreContext) => RowMoreMenuItem[];
  /** Enable «إرجاع لمرحلة سابقة» in the default ⋮ menu. */
  allowPhaseRevert?: boolean;
  /** Enable «نسخ من معاملة سابقة» in the default ⋮ menu (target = this row). */
  allowCopyFromPrior?: boolean;
  /** Enable «حذف المعاملة» in the default ⋮ menu. */
  allowDeleteTransaction?: boolean;
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
  /** Default: newest PO / task first (same as البيانات الأولية). */
  queueSort?: "oldest-first" | "newest-first";
  /** When true, list open, blocked, and completed tasks (e.g. جميع المعاملات). */
  includeAllStatuses?: boolean;
};

export type ActiveQueueRowMoreContext = {
  task: WorkflowTask;
  propertyId?: string;
  openTask: () => void;
  router: { push: (href: string) => void };
  refreshQueue: () => void;
  showToast: (message: string, tone?: "success" | "error" | "info") => void;
  poByNumber: Map<string, PoIntakeRecord>;
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
const DEFAULT_INFO_ROLES = emptyCaseStudyInfoRolesConfig();

type PartyProgressByTask = Map<
  string,
  Partial<Record<CaseStudyInfoPartyId, number>>
>;

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
  const { showToast } = useToast();
  const selectedId = searchParams.get("task");
  const { role, viewerEmail, distributionAssigneeId } = usePrototype();
  const { data: staffResult } = useStaffUsersQuery();
  const { data: infoRolesData } = useCaseStudyInfoRolesQuery();
  const infoRolesMatrix = infoRolesData?.matrix ?? DEFAULT_INFO_ROLES.matrix;
  const staffUsers = staffResult?.users ?? [];
  const needsInspectionWorkspaces = Boolean(config.getTaskStatusBadge);
  const needsPartySubmissions = Boolean(config.getTaskStatusBadge);
  const { data: inspectionWorkspaces = [] } = useFieldInspectionWorkspacesQuery(
    needsInspectionWorkspaces,
  );
  const inspectionWorkspaceByTaskId = useMemo(() => {
    const map = new Map(
      inspectionWorkspaces.map((row) => [row.workflowTaskId, row]),
    );
    return map;
  }, [inspectionWorkspaces]);
  const {
    data: tasks,
    refetch: refetchTasks,
    isFetched: tasksFetched,
    isError: tasksError,
    error: tasksQueryError,
  } = useWorkflowTasksQuery({ live: true });
  const {
    data: poRecords = [],
    isFetched: poRecordsFetched,
    isError: poRecordsError,
    error: poRecordsQueryError,
    refetch: refetchPoRecords,
  } = usePoRecordsQuery();
  const queueLoadError = tasksError || poRecordsError;
  const queueErrorMessage =
    (tasksQueryError instanceof Error ? tasksQueryError.message : null) ??
    (poRecordsQueryError instanceof Error ? poRecordsQueryError.message : null) ??
    "تعذّر تحميل قائمة المعاملات";
  const queueReady = tasksFetched && poRecordsFetched && !queueLoadError;
  const queuePending = !tasksFetched || !poRecordsFetched;
  const [now, setNow] = useState(() => new Date());
  const [panelOpen, setPanelOpen] = useState(() => Boolean(selectedId));
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const advancingRef = useRef(false);
  const [, bump] = useState(0);
  const [submissionCacheGen, setSubmissionCacheGen] = useState(0);
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [copyPoNumber, setCopyPoNumber] = useState("");
  const [copyTargetKey, setCopyTargetKey] = useState<string | null>(null);
  const [partyProgressRevision, setPartyProgressRevision] = useState(0);
  const [partyProgressByTask, setPartyProgressByTask] =
    useState<PartyProgressByTask>(() => new Map());

  const retryQueueLoad = useCallback(() => {
    void refetchPoRecords();
    void refetchTasks();
  }, [refetchPoRecords, refetchTasks]);

  const refreshWork = useCallback(() => {
    bump((n) => n + 1);
    if (needsPartySubmissions) {
      setSubmissionCacheGen((n) => n + 1);
    }
    void refetchTasks();
    void refetchPoRecords();
    if (needsInspectionWorkspaces) {
      void queryClient.invalidateQueries({
        queryKey: prototypeKeys.fieldInspectionWorkspaces(),
      });
    }
  }, [
    refetchTasks,
    refetchPoRecords,
    queryClient,
    needsInspectionWorkspaces,
    needsPartySubmissions,
  ]);

  const syncQueue = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: prototypeKeys.poRecords() });
    await queryClient.invalidateQueries({
      queryKey: prototypeKeys.workflowTasks(),
    });
    if (needsInspectionWorkspaces) {
      await queryClient.invalidateQueries({
        queryKey: prototypeKeys.fieldInspectionWorkspaces(),
      });
    }
    bump((n) => n + 1);
    await refetchTasks();
  }, [queryClient, refetchTasks, needsInspectionWorkspaces]);

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    const events = config.refreshOnWindowEvents;
    if (!events?.length) return;
    // TASKS_CHANGED must not call refetchPoRecords: that re-runs sync and
    // notifyTasksChanged, which would loop while this queue is open.
    const handler = (ev: Event) => {
      if (ev.type === TASKS_CHANGED_EVENT) {
        bump((n) => n + 1);
        if (needsPartySubmissions) {
          setSubmissionCacheGen((n) => n + 1);
        }
        void refetchTasks();
        return;
      }
      refreshWork();
    };
    for (const ev of events) window.addEventListener(ev, handler);
    return () => {
      for (const ev of events) window.removeEventListener(ev, handler);
    };
  }, [
    config.refreshOnWindowEvents,
    refreshWork,
    refetchTasks,
    needsPartySubmissions,
  ]);

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
      viewerAssigneeId: distributionAssigneeId,
      staffUsers,
    });
  }, [
    config.assigneeRole,
    config.pageId,
    config.partyAssignee,
    viewerEmail,
    distributionAssigneeId,
    role,
    tasks,
    staffUsers,
  ]);

  const listed = useMemo(
    () => {
      const compare =
        config.queueSort === "oldest-first"
          ? compareQueueTasksOldestFirst
          : compareQueueTasksNewestFirst;
      return config
        .filterListed(mine, poByNumber)
        .filter((t) => {
          if (isTaskOnSuspendedProperty(t)) return false;
          if (config.includeAllStatuses) return true;
          return t.status === "open" || t.status === "blocked";
        })
        .sort((a, b) => compare(a, b, poByNumber));
    },
    [config, mine, poByNumber],
  );

  const listedTaskIdsKey = useMemo(
    () => partySubmissionTaskIdsKey(listed.map((t) => t.id)),
    [listed],
  );

  const selectedTask = useMemo((): WorkflowTask | null => {
    if (!selectedId) return null;
    return listed.find((t) => t.id === selectedId) ?? null;
  }, [selectedId, listed]);

  const closePanel = useCallback(() => {
    router.replace(config.getBasePath(), { scroll: false });
  }, [router, config]);

  useEffect(() => {
    if (!selectedId || !queueReady) return;
    if (!listed.some((t) => t.id === selectedId)) {
      closePanel();
    }
  }, [selectedId, listed, queueReady, closePanel]);

  const useFullPage = Boolean(
    config.fullPageTaskPath || config.resolveFullPageTaskPath,
  );

  const resolveTaskFullPagePath = useCallback(
    (task: WorkflowTask): string | undefined => {
      const perTask = config.resolveFullPageTaskPath?.(task);
      if (perTask) return perTask;
      if (config.fullPageTaskPath) return config.fullPageTaskPath(task.id);
      return undefined;
    },
    [config],
  );

  const openTask = useCallback(
    (taskId: string, task?: WorkflowTask) => {
      const fullPath = task ? resolveTaskFullPagePath(task) : undefined;
      if (fullPath) {
        router.push(fullPath);
        return;
      }
      if (config.fullPageTaskPath) {
        router.push(config.fullPageTaskPath(taskId));
        return;
      }
      setPanelOpen(true);
      router.replace(config.getTaskPath(taskId), { scroll: false });
    },
    [router, config, resolveTaskFullPagePath],
  );

  const handleRowClick = useCallback(
    (taskId: string) => {
      const task = listed.find((t) => t.id === taskId);
      if (task && config.canOpenTask && !config.canOpenTask(task)) return;

      const fullPath = task ? resolveTaskFullPagePath(task) : undefined;
      if (fullPath) {
        router.push(fullPath);
        return;
      }
      if (useFullPage) {
        openTask(taskId, task);
        return;
      }
      if (selectedId === taskId) {
        closePanel();
        return;
      }
      openTask(taskId);
    },
    [useFullPage, selectedId, closePanel, openTask, listed, config, resolveTaskFullPagePath, router],
  );

  const resolveRowMoreItems = useCallback(
    (task: WorkflowTask, propertyId: string | undefined) => {
      const record = poByNumber.get(task.poNumber.trim());
      const property = findPropertyForTask(record, task);
      const openCopyFromPrior = () => {
        const key = propertyId?.trim()
          ? `property:${propertyId.trim()}`
          : `slot:${task.id}`;
        setCopyPoNumber(task.poNumber.trim());
        setCopyTargetKey(key);
        setCopyModalOpen(true);
      };
      const ctx: ActiveQueueRowMoreContext = {
        task,
        propertyId,
        openTask: () => handleRowClick(task.id),
        router,
        refreshQueue: refreshWork,
        showToast,
        poByNumber,
      };
      if (config.buildRowMoreItems) {
        return config.buildRowMoreItems(ctx);
      }
      return buildActiveQueueRowMoreItems({
        ...ctx,
        allowPhaseRevert: Boolean(config.allowPhaseRevert),
        skipsBourse: property
          ? skipsBourseForIdentifier(property.identifierType)
          : false,
        onCopyFromPrior: config.allowCopyFromPrior
          ? openCopyFromPrior
          : undefined,
        allowDeleteTransaction: Boolean(config.allowDeleteTransaction),
        viewerRole: role,
      });
    },
    [
      config,
      handleRowClick,
      router,
      refreshWork,
      showToast,
      poByNumber,
      role,
    ],
  );

  const copyTargets = useMemo(() => {
    if (!copyPoNumber) return [];
    const record = poByNumber.get(copyPoNumber);
    if (!record) return [];
    return buildCopyPriorTargetOptions(record, tasks ?? []);
  }, [copyPoNumber, poByNumber, tasks]);

  const handleCopiedFromPrior = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: prototypeKeys.poRecord(copyPoNumber),
    });
    void queryClient.invalidateQueries({
      queryKey: prototypeKeys.poRecords(),
    });
    void queryClient.invalidateQueries({
      queryKey: prototypeKeys.workflowTasks(),
    });
    void queryClient.invalidateQueries({
      queryKey: prototypeKeys.pendingBourseItems(),
    });
    refreshWork();
  }, [queryClient, copyPoNumber, refreshWork]);

  useEffect(() => {
    if (!needsPartySubmissions || listedTaskIdsKey.length === 0) return;
    const ids = listedTaskIdsKey.split("\0");
    void prefetchPartySubmissionsForTasks(ids)
      .then(() => {
        setSubmissionCacheGen((n) => n + 1);
      })
      .catch((err: unknown) => {
        console.warn(
          "Party submission prefetch failed:",
          err instanceof Error ? err.message : err,
        );
      });
  }, [listedTaskIdsKey, needsPartySubmissions]);

  const renderStatusOrRemaining = useCallback(
    (
      task: WorkflowTask,
      remainingTime: Parameters<typeof RemainingTimeCell>[0]["state"],
    ) => {
      const badge = resolveQueueTaskStatusBadge(task, {
        getTaskStatusBadge: config.getTaskStatusBadge,
        inspectionWorkspace: inspectionWorkspaceByTaskId.get(task.id),
        partySubmission: getCachedPartySubmission(task.id),
      });
      if (badge) {
        return (
          <StatusPill
            label={badge.label}
            style={queueLegacyStatusStyle(badge.className)}
          />
        );
      }
      return <RemainingTimeCell state={remainingTime} />;
    },
    [config, inspectionWorkspaceByTaskId, submissionCacheGen],
  );

  const resolveTaskBadge = useCallback(
    (task: WorkflowTask) =>
      resolveQueueTaskStatusBadge(task, {
        getTaskStatusBadge: config.getTaskStatusBadge,
        inspectionWorkspace: inspectionWorkspaceByTaskId.get(task.id),
        partySubmission: getCachedPartySubmission(task.id),
      }),
    [config, inspectionWorkspaceByTaskId, submissionCacheGen],
  );

  const isDistributionTable =
    config.tableLayout === "distribution" ||
    config.tableLayout === "case-study";
  const showPartyColumns = config.tableLayout === "case-study";
  const distributionSkeletonCols = 8 + (showPartyColumns ? 4 : 0);
  const primarySkeletonCols = 6;

  const primaryRowMeta = useMemo(() => {
    if (isDistributionTable) return [];
    return buildPrimaryQueueRowMeta(listed, poByNumber, now, resolveTaskBadge);
  }, [isDistributionTable, listed, poByNumber, now, resolveTaskBadge]);

  const distributionRowMeta = useMemo(() => {
    if (!isDistributionTable) return [];
    return buildDistributionQueueRowMeta(listed, poByNumber);
  }, [isDistributionTable, listed, poByNumber]);

  const assignmentTypes = useMemo(
    () =>
      uniqueSortedLabels(
        isDistributionTable
          ? distributionRowMeta.map((row) => row.assignmentType)
          : primaryRowMeta.map((row) => row.assignmentType),
      ),
    [isDistributionTable, distributionRowMeta, primaryRowMeta],
  );

  const statusOptions = useMemo(
    () => uniqueSortedLabels(primaryRowMeta.map((row) => row.statusLabel)),
    [primaryRowMeta],
  );

  const filteredListed = useMemo(() => {
    if (isDistributionTable) {
      return filterDistributionQueueRows(distributionRowMeta, {
        search,
        typeFilter,
      });
    }
    return filterPrimaryQueueRows(primaryRowMeta, {
      search,
      statusFilter,
      typeFilter,
    });
  }, [
    isDistributionTable,
    distributionRowMeta,
    primaryRowMeta,
    search,
    statusFilter,
    typeFilter,
  ]);

  useEffect(() => {
    const refresh = () => setPartyProgressRevision((revision) => revision + 1);
    window.addEventListener(PARTY_CASE_STUDY_FORM_CHANGED_EVENT, refresh);
    return () =>
      window.removeEventListener(PARTY_CASE_STUDY_FORM_CHANGED_EVENT, refresh);
  }, []);

  useEffect(() => {
    if (!showPartyColumns || !tasks) {
      setPartyProgressByTask(new Map());
      return;
    }

    let cancelled = false;
    void Promise.all(
      listed.map(async (parent) => {
        try {
          const answers = await loadPartyCaseStudyAnswersByParty(parent, tasks);
          const rows = computePartyCaseStudyProgress(
            infoRolesMatrix,
            answers,
            { includeSpecialistAnswers: false },
          );
          const progress: Partial<Record<CaseStudyInfoPartyId, number>> = {};
          for (const row of rows) progress[row.partyId] = row.pct;
          return [parent.id, progress] as const;
        } catch {
          return [
            parent.id,
            {} as Partial<Record<CaseStudyInfoPartyId, number>>,
          ] as const;
        }
      }),
    ).then((entries) => {
      if (!cancelled) setPartyProgressByTask(new Map(entries));
    });

    return () => {
      cancelled = true;
    };
  }, [
    showPartyColumns,
    listed,
    tasks,
    infoRolesMatrix,
    partyProgressRevision,
  ]);

  useEffect(() => {
    setStatusFilter("");
    setTypeFilter("");
    setSearch("");
  }, [config.pageId]);

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

  const queueToolbar = queueReady ? (
    <PageToolbar className="shrink-0 flex-wrap items-center justify-between gap-2.5 border-b border-border bg-surface-2">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2.5">
        <OperationalToolbarSearch
          type="search"
          placeholder={
            isDistributionTable
              ? "رقم الصك أو PO أو المدينة…"
              : "رقم الصك أو نوع الإسناد أو المدينة…"
          }
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="بحث المعاملات"
        />
        {!isDistributionTable ? (
          <OperationalToolbarSelect
            className="!w-auto min-w-[148px] max-w-full shrink-0 sm:w-[148px]"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="تصفية الحالة"
          >
            <option value="">جميع الحالات</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </OperationalToolbarSelect>
        ) : null}
        <OperationalToolbarSelect
          className="!w-auto min-w-[168px] max-w-full shrink-0 sm:w-[168px]"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          aria-label="تصفية نوع الإسناد"
        >
          <option value="">جميع أنواع الإسناد</option>
          {assignmentTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </OperationalToolbarSelect>
      </div>
      <span className="shrink-0 text-[11.5px] text-text-3">
        {queueReady ? `${filteredListed.length} نتيجة` : "—"}
      </span>
    </PageToolbar>
  ) : null;

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

  const hasRail =
    !useFullPage && queueReady && listed.length > 0 && Boolean(renderPanel);

  const queuePanel = (
        <OperationalPanel
          className={cn(
            "min-h-0 flex-1",
            hasRail && panelOpen ? undefined : "flex-none",
          )}
        >
          {!config.hidePageTitle && config.pageTitle ? (
            <PageShellHeader title={config.pageTitle} />
          ) : null}

          {config.renderQueueHeader && queueReady && listed.length > 0
            ? config.renderQueueHeader(listed)
            : null}

          {queueLoadError ? (
            <div className="flex flex-col gap-3 p-4">
              <Note tone="warn">{queueErrorMessage}</Note>
              <Button type="button" variant="outline" size="sm" onClick={retryQueueLoad}>
                إعادة المحاولة
              </Button>
            </div>
          ) : queueReady && listed.length === 0 ? (
            <EmptyState line={config.emptyLine} hint={config.emptyHint} />
          ) : (
            <>
              {queueToolbar}
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
                        filteredListed.map((task, index) => {
                        const record = poByNumber.get(task.poNumber.trim());
                        const property = findPropertyForTask(record, task);
                        const row = buildDistributionTableRow(
                          task,
                          property,
                          record,
                        );
                        const parties = showPartyColumns
                          ? buildCaseStudyPartyAssignees(
                              task,
                              tasks ?? [],
                              partyProgressByTask.get(task.id) ?? {},
                            )
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
                              <span className="inline-flex min-w-0 items-center justify-end gap-2">
                                <span
                                  className="inline-flex h-[22px] min-w-[22px] shrink-0 items-center justify-center rounded-md bg-surface-3 text-[10px] font-semibold text-text-3"
                                  aria-hidden
                                >
                                  {index + 1}
                                </span>
                                {property?.id ? (
                                  <Link
                                    href={poPropertyDetailPath(
                                      task.poNumber,
                                      property.id,
                                      "basic",
                                    )}
                                    dir="ltr"
                                    className="relative z-[1] inline-block text-[13px] font-medium text-primary no-underline hover:underline"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {row.deedLabel}
                                  </Link>
                                ) : (
                                  <span
                                    dir="ltr"
                                    className="inline-block text-[13px] font-medium text-primary"
                                  >
                                    {row.deedLabel}
                                  </span>
                                )}
                              </span>
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
                        <Th>نوع الإسناد</Th>
                        <Th>المدينة</Th>
                        <Th>الحي</Th>
                        <Th>{config.statusColumnLabel ?? "الحالة"}</Th>
                        <ThAction aria-label="المزيد" />
                      </Tr>
                    </THead>
                    <TBody>
                      {queuePending && listed.length === 0 ? (
                        <SkeletonTableRows rows={6} cols={primarySkeletonCols} />
                      ) : (
                        filteredListed.map((task) => {
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
                                className="inline-block text-[12px] font-medium text-primary"
                              >
                                {row.propertySlot}
                              </span>
                            </Td>
                            <Td className="text-text-2">{row.assignmentType}</Td>
                            <Td className="text-text-2">{row.city}</Td>
                            <Td className="text-text-2">{row.district}</Td>
                            <Td className="text-text-2">
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
              <QueueTableHint
                className={cn(
                  (config.pageId === "all-transactions" ||
                    config.pageId === "active-primary-data") &&
                    "border-t border-border bg-surface-2",
                )}
              >
                {config.tableHint ??
                  (useFullPage
                    ? "اضغط الصف لفتح دراسة الحالة."
                    : "اضغط الصف لفتح التوزيع — اضغط نفس الصف مرة أخرى للإغلاق.")}
              </QueueTableHint>
            </>
          )}
        </OperationalPanel>
  );

  const sidePanel =
    hasRail && renderPanel ? (
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
    ) : null;

  return (
    <>
      <ActiveTransactionPageLayout
        pageId={config.pageId ?? "active-primary-data"}
        hasRail={hasRail}
        panelOpen={panelOpen}
        queuePanel={queuePanel}
        sidePanel={sidePanel}
      />
      {config.allowCopyFromPrior && copyPoNumber ? (
        <CopyFromPriorTransactionModal
          open={copyModalOpen}
          poNumber={copyPoNumber}
          targets={copyTargets}
          initialTargetKey={copyTargetKey}
          lockTarget
          onClose={() => {
            setCopyModalOpen(false);
            setCopyTargetKey(null);
            setCopyPoNumber("");
          }}
          onCopied={handleCopiedFromPrior}
        />
      ) : null}
    </>
  );
}
