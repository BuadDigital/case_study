"use client";

import type { MutableRefObject, ReactNode } from "react";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import {
  Button,
  cn,
  EmptyState,
  Note,
  OperationalPanel,
  PageShellHeader,
  queueLegacyStatusStyle,
  QueueTableHint,
  type RowMoreMenuItem,
  StatusPill,
  TableFrame,
  useToast,
} from "@platform/ui-kit";
import { PoNumber } from "@case-study/mfe/components/ui/PoNumber";
import {
  RemainingTimeCell,
  TickingRemainingTimeCell,
} from "@case-study/mfe/components/ui/RemainingTimeCell";
import { useTickingMinute } from "@platform/app-shared/hooks/use-ticking-now";
import { useViewportDesktop } from "@platform/app-shared/hooks/use-viewport-desktop";
import { buildActiveQueueRowMoreItems } from "../lib/prototype/active-queue-row-menu";
const CopyFromPriorTransactionModal = dynamic(
  () =>
    import("../components/po-intake/CopyFromPriorTransactionModal").then(
      (m) => m.CopyFromPriorTransactionModal,
    ),
  { ssr: false },
);
import { buildCopyPriorTargetOptions } from "../lib/prototype/po-intake-storage";
import {
  computePartyCaseStudyProgress,
  loadPartyCaseStudyAnswersByParty,
} from "../lib/prototype/case-study-party-progress";
import { PARTY_CASE_STUDY_FORM_CHANGED_EVENT } from "../lib/prototype/case-study-form-storage";
import { getAuthSession } from "@platform/auth-client";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import { emptyCaseStudyInfoRolesConfig } from "@settings/mfe/lib/prototype/case-study-info-roles-storage";
import {
  useCaseStudyInfoRolesQuery,
  useStaffUsersQuery,
} from "@settings/mfe/query/settings-queries";
import type { CaseStudyInfoPartyId } from "@settings/mfe/lib/prototype/case-study-info-roles-data";
import type { PageId, RoleId } from "@platform/types";
import { poPropertiesPath, poPropertyDetailPath } from "@platform/app-shared/domain/po-routes";
import {
  buildDistributionTableRow,
  compareQueueTasksOldestFirst,
  compareQueueTasksNewestFirst,
  compareQueueTasksByUpdatedNewestFirst,
  findPropertyForTask,
  formatRemainingDuration,
  remainingTimerTick,
  resolveSlaTimerRatio,
} from "../lib/prototype/my-task-row";
import type { PoIntakeRecord } from "../lib/prototype/po-intake-data";
import {
  formatPoDisplay,
  skipsBourseForIdentifier,
} from "../lib/prototype/po-intake-data";
import {
  ActiveQueueMobileCards,
  toneFromLegacyBadge,
  type ActiveQueueMobileCardItem,
} from "@platform/app-shared/components/ActiveQueueMobileCards";
import { InspectorMobileQueue } from "../components/field-inspection/InspectorMobileQueue";
import { isListedQueueTask } from "../lib/prototype/suspended-transactions-storage";
import {
  TASKS_CHANGED_EVENT,
  type WorkflowTask,
} from "../lib/prototype/tasks-storage";
import { resolveQueueTasksForViewer } from "../lib/prototype/viewer-task-access";
import {
  buildRowAttentionFingerprint,
  rowHasAttentionDot,
  useRowAttentionSeenMap,
} from "../lib/prototype/row-attention-storage";
import {
  buildDistributionQueueRowMeta,
  buildPrimaryQueueRowMeta,
  filterDistributionQueueRows,
  filterPrimaryQueueRowMeta,
  resolveQueueTaskStatusBadge,
  uniqueSortedLabels,
} from "../lib/prototype/active-queue-list-filters";
import {
  allTransactionsPhaseStyle,
  buildAllTransactionsQueueRowMeta,
  filterAllTransactionsQueueRows,
  uniqueSortedPoOrder,
} from "../lib/prototype/all-transactions-queue";
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
import {
  appraiserQueueStatusGroup,
} from "../lib/evaluator-bridge";
import { ActiveTransactionPageLayout } from "../components/active-transactions/ActiveTransactionPageLayout";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import {
  AllTransactionsQueueTable,
  DistributionQueueTable,
  EngineeringSurveyQueueTable,
  PrimaryQueueTable,
  PropertyAppraisalQueueTable,
  QueueFiltersToolbar,
  type PartyProgressByTask,
  type QueueRowContext,
} from "./active-transaction-queue-tables";

const APPRAISAL_STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "new", label: "جديدة" },
  { value: "wait_inspection", label: "تراقب تقدم الأطراف" },
  { value: "wait_specialist", label: "بانتظار اعتماد بيانات المعاينة" },
  { value: "ready", label: "جاهزة للتقييم" },
  { value: "submitted", label: "مُرسَلة للأخصائي" },
  { value: "closed", label: "مكتملة على النظام" },
  { value: "reopened", label: "معادة للتصحيح" },
];

export type ActiveTransactionQueueTableLayout =
  | "primary-data"
  | "distribution"
  | "case-study"
  | "all-transactions"
  | "engineering-survey"
  | "property-appraisal";

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
  /** Filter by prototype assignee id from transaction distribution. */
  partyAssignee?: boolean;
  /** Page id for queue context (e.g. party pages). */
  pageId?: PageId;
  /** Role whose queue is shown (party pages); CDO uses this to see all assignees. */
  assigneeRole?: RoleId;
  getBasePath: () => string;
  getTaskPath: (taskId: string) => string;
  /** Navigate to a dedicated page instead of opening the side panel. */
  fullPageTaskPath?: (taskId: string) => string;
  /** Per-task full-page navigation (e.g. all-transactions for mixed party queues). */
  resolveFullPageTaskPath?: (task: WorkflowTask) => string | undefined;
  filterListed: (
    mine: WorkflowTask[],
    poByNumber: Map<string, PoIntakeRecord>,
    options?: { showCompleted?: boolean },
  ) => WorkflowTask[];
  /** Override row ⋮ menu (e.g. appraiser recall). */
  buildRowMoreItems?: (ctx: ActiveQueueRowMoreContext) => RowMoreMenuItem[];
  /** When true, table/card row click does nothing; deed, PO, and ⋮ stay clickable. */
  disableRowOpen?: boolean;
  /** Enable «return to previous stage» in the default ⋮ menu. */
  allowPhaseRevert?: boolean;
  /** Enable «copy from previous transaction» in the default ⋮ menu (target = this row). */
  allowCopyFromPrior?: boolean;
  /** Enable «delete transaction» in the default ⋮ menu. */
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
  /** Default: most recently updated / distributed task first. */
  queueSort?: "oldest-first" | "newest-first" | "distributed-newest-first";
  /** When true, list open, blocked, and completed tasks (e.g. all-transactions). */
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
  viewerRole: RoleId;
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

const DEFAULT_INFO_ROLES = emptyCaseStudyInfoRolesConfig();
/* Stable empty refs for loading — a fresh `[]` each render invalidates every useMemo
   and memoized rows below (rerender-memo-with-default-value). */
const EMPTY_PO_RECORDS: PoIntakeRecord[] = [];
const EMPTY_TASKS: WorkflowTask[] = [];
const EMPTY_STAFF_USERS: NonNullable<
  ReturnType<typeof useStaffUsersQuery>["data"]
>["users"] = [];
const EMPTY_INSPECTION_WORKSPACES: NonNullable<
  ReturnType<typeof useFieldInspectionWorkspacesQuery>["data"]
> = [];
// Prefetch on hover/focus of queue rows — the row opens an Infath step
// in the work screen, and its chunk was only fetched after click (bundle-preload).
const preloadPoPropertyEnfathForm = () =>
  void import("@case-study/mfe/components/po-intake/PoPropertyEnfathForm");

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
  const [isOpeningTask, startOpenTask] = useTransition();
  const [openingTaskId, setOpeningTaskId] = useState<string | null>(null);
  const { role, viewerEmail, distributionAssigneeId } = usePrototype();
  const { data: staffResult } = useStaffUsersQuery();
  const { data: infoRolesData } = useCaseStudyInfoRolesQuery();
  const infoRolesMatrix = infoRolesData?.matrix ?? DEFAULT_INFO_ROLES.matrix;
  const staffUsers = staffResult?.users ?? EMPTY_STAFF_USERS;
  const needsInspectionWorkspaces = Boolean(config.getTaskStatusBadge);
  const needsPartySubmissions = Boolean(config.getTaskStatusBadge);
  const { data: inspectionWorkspaces = EMPTY_INSPECTION_WORKSPACES } =
    useFieldInspectionWorkspacesQuery(needsInspectionWorkspaces);
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
    data: poRecords = EMPTY_PO_RECORDS,
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
  // Minute precision is enough to build rows and filters — the per-second timer lives in
  // the timer cells themselves, so every row is not rebuilt each second (rerender-defer-reads).
  const nowMinuteMs = useTickingMinute();
  const now = useMemo(() => new Date(nowMinuteMs), [nowMinuteMs]);
  // After hydration mount only one tree (cards or table) — display:none hid
  // paint while rows were still built twice every render.
  const isDesktopViewport = useViewportDesktop();
  const [panelOpen, setPanelOpen] = useState(() => Boolean(selectedId));
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);
  const [groupByPo, setGroupByPo] = useState(false);
  const [groupGatherAnim, setGroupGatherAnim] = useState(false);
  const groupGatherTimerRef = useRef<number | null>(null);
  const [collapsedPo, setCollapsedPo] = useState<Record<string, boolean>>({});
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
    if (config.allowPhaseRevert) {
      void queryClient.invalidateQueries({
        queryKey: prototypeKeys.pendingBourseItems(),
      });
    }
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
    config.allowPhaseRevert,
  ]);

  const syncQueue = useCallback(async () => {
    // Independent keys in parallel; invalidating workflowTasks refetches on its own —
    // the extra refetchTasks was a duplicate identical GET (async-parallel).
    const invalidations = [
      queryClient.invalidateQueries({ queryKey: prototypeKeys.poRecords() }),
      queryClient.invalidateQueries({ queryKey: prototypeKeys.workflowTasks() }),
    ];
    if (config.allowPhaseRevert) {
      invalidations.push(
        queryClient.invalidateQueries({
          queryKey: prototypeKeys.pendingBourseItems(),
        }),
      );
    }
    if (needsInspectionWorkspaces) {
      invalidations.push(
        queryClient.invalidateQueries({
          queryKey: prototypeKeys.fieldInspectionWorkspaces(),
        }),
      );
    }
    await Promise.all(invalidations);
    bump((n) => n + 1);
  }, [
    queryClient,
    refetchTasks,
    needsInspectionWorkspaces,
    config.allowPhaseRevert,
  ]);

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
      const sortMode = config.queueSort ?? "distributed-newest-first";
      const compare =
        sortMode === "oldest-first"
          ? compareQueueTasksOldestFirst
          : sortMode === "newest-first"
            ? compareQueueTasksNewestFirst
            : compareQueueTasksByUpdatedNewestFirst;
      const isSurveyLayout = config.tableLayout === "engineering-survey";
      const isAppraisalLayout = config.tableLayout === "property-appraisal";
      const showAllToggle = isSurveyLayout || isAppraisalLayout;
      return config
        .filterListed(mine, poByNumber, {
          showCompleted: showAllToggle ? showCompleted : undefined,
        })
        .filter((t) =>
          isListedQueueTask(t, {
            includeAllStatuses:
              config.includeAllStatuses ||
              (showAllToggle && showCompleted),
          }),
        )
        .sort((a, b) => compare(a, b, poByNumber));
    },
    [config, mine, poByNumber, showCompleted],
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

  const resolveTaskBadge = useCallback(
    (task: WorkflowTask) =>
      resolveQueueTaskStatusBadge(task, {
        getTaskStatusBadge: config.getTaskStatusBadge,
        inspectionWorkspace: inspectionWorkspaceByTaskId.get(task.id),
        partySubmission: getCachedPartySubmission(task.id),
      }),
    [config, inspectionWorkspaceByTaskId, submissionCacheGen],
  );

  const [rowAttentionSeen, markRowAttentionSeen] = useRowAttentionSeenMap();

  /** Outlook-style unread dot: new task, status change, or badge change
   * (return / reply / new action) that the row hasn't been opened since. */
  const resolveRowAttention = useCallback(
    (task: WorkflowTask): boolean =>
      rowHasAttentionDot(
        task.id,
        buildRowAttentionFingerprint(task, resolveTaskBadge(task)?.className),
        rowAttentionSeen,
      ),
    [resolveTaskBadge, rowAttentionSeen],
  );

  const markTaskRowSeen = useCallback(
    (task: WorkflowTask) => {
      markRowAttentionSeen(
        task.id,
        buildRowAttentionFingerprint(task, resolveTaskBadge(task)?.className),
      );
    },
    [markRowAttentionSeen, resolveTaskBadge],
  );

  const handleRowClick = useCallback(
    (taskId: string) => {
      const task = listed.find((t) => t.id === taskId);
      if (task && config.canOpenTask && !config.canOpenTask(task)) return;
      if (task) markTaskRowSeen(task);

      const fullPath = task ? resolveTaskFullPagePath(task) : undefined;
      // Closing the open row should not flash a loading state.
      if (!fullPath && !useFullPage && selectedId === taskId) {
        setOpeningTaskId(null);
        closePanel();
        return;
      }

      setOpeningTaskId(taskId);
      startOpenTask(() => {
        if (fullPath) {
          router.push(fullPath);
          return;
        }
        if (useFullPage) {
          openTask(taskId, task);
          return;
        }
        openTask(taskId);
      });
    },
    [
      useFullPage,
      selectedId,
      closePanel,
      openTask,
      listed,
      config,
      resolveTaskFullPagePath,
      router,
      markTaskRowSeen,
    ],
  );

  useEffect(() => {
    if (selectedId && selectedId === openingTaskId) {
      // Keep spinner visible briefly so the open feels intentional.
      const t = window.setTimeout(() => setOpeningTaskId(null), 280);
      return () => window.clearTimeout(t);
    }
  }, [selectedId, openingTaskId]);

  useEffect(() => {
    if (isOpeningTask || !openingTaskId) return;
    // Full-page navigation or transition end: clear after a short dwell.
    const t = window.setTimeout(() => {
      setOpeningTaskId((id) => (id === openingTaskId ? null : id));
    }, 400);
    return () => window.clearTimeout(t);
  }, [isOpeningTask, openingTaskId]);

  const isTaskOpening = useCallback(
    (taskId: string) => openingTaskId === taskId,
    [openingTaskId],
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
        viewerRole: role,
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
    // Re-run on every fresh `tasks` fetch (live poll or a server-pushed
    // workflow notification), not just when the id set changes — a returned/
    // reopened submission on an already-listed task needs a fresh badge too.
  }, [listedTaskIdsKey, needsPartySubmissions, tasks]);

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
      const dueIso = poByNumber.get(task.poNumber.trim())?.dueDateAt ?? "";
      // Per-second timer updates inside the cell — the row itself rebuilds at minute precision only.
      if (dueIso) return <TickingRemainingTimeCell dueIso={dueIso} />;
      return <RemainingTimeCell state={remainingTime} />;
    },
    [config, inspectionWorkspaceByTaskId, submissionCacheGen, poByNumber],
  );

  const isPropertyInspectionQueue =
    config.pageId === "property-inspection" ||
    config.pageId === "active-inspection";

  const isDistributionTable =
    config.tableLayout === "distribution" ||
    config.tableLayout === "case-study";
  const isAllTransactionsTable = config.tableLayout === "all-transactions";
  const isEngineeringSurveyTable = config.tableLayout === "engineering-survey";
  const isPropertyAppraisalTable = config.tableLayout === "property-appraisal";
  const isPartyQueueToggleTable =
    isEngineeringSurveyTable || isPropertyAppraisalTable;
  const showPartyColumns = config.tableLayout === "case-study";
  // Rows in these two branches open the transaction work screen that starts with the Infath form.
  const preloadRowWork =
    isAllTransactionsTable ||
    (!isDistributionTable && !isPartyQueueToggleTable)
      ? preloadPoPropertyEnfathForm
      : undefined;

  const allTransactionsRowMeta = useMemo(() => {
    if (!isAllTransactionsTable) return [];
    return buildAllTransactionsQueueRowMeta(listed, poByNumber, now);
  }, [isAllTransactionsTable, listed, poByNumber, now]);

  const primaryRowMeta = useMemo(() => {
    if (isDistributionTable || isAllTransactionsTable) return [];
    return buildPrimaryQueueRowMeta(listed, poByNumber, now, resolveTaskBadge);
  }, [
    isDistributionTable,
    isAllTransactionsTable,
    listed,
    poByNumber,
    now,
    resolveTaskBadge,
  ]);

  const distributionRowMeta = useMemo(() => {
    if (!isDistributionTable) return [];
    return buildDistributionQueueRowMeta(listed, poByNumber);
  }, [isDistributionTable, listed, poByNumber]);

  /* Hide city/district columns when none carry data at this stage — «—» in every row is noise.
     One pass over rows gathers type/status options and location checks together (js-combine-iterations). */
  const { primaryHasLocation, assignmentTypes, statusOptions } = useMemo(() => {
    let hasLocation = false;
    const types: string[] = [];
    const statuses: string[] = [];
    if (isAllTransactionsTable) {
      for (const row of allTransactionsRowMeta) {
        types.push(row.assignmentType);
        statuses.push(row.phaseLabel);
      }
    } else if (isDistributionTable) {
      for (const row of distributionRowMeta) types.push(row.assignmentType);
    } else {
      for (const row of primaryRowMeta) {
        types.push(row.assignmentType);
        statuses.push(row.statusLabel);
        if (
          (row.city && row.city !== "—") ||
          (row.district && row.district !== "—")
        ) {
          hasLocation = true;
        }
      }
    }
    return {
      primaryHasLocation: hasLocation,
      assignmentTypes: uniqueSortedLabels(types),
      statusOptions: isPropertyAppraisalTable
        ? APPRAISAL_STATUS_FILTERS.map((o) => o.label)
        : uniqueSortedLabels(statuses),
    };
  }, [
    isAllTransactionsTable,
    isDistributionTable,
    isPropertyAppraisalTable,
    allTransactionsRowMeta,
    distributionRowMeta,
    primaryRowMeta,
  ]);

  // Typing in search stays immediate while filtering unbounded lists is deferred one frame
  // (rerender-use-deferred-value) — no network here, local filtering only.
  const deferredSearch = useDeferredValue(search);

  // meta for filtered rows — tables and cards read the prebuilt row instead of calling
  // buildPrimaryDataTableRow 3–4 times per task every render (js-combine-iterations).
  const filteredPrimaryMeta = useMemo(() => {
    if (isAllTransactionsTable || isDistributionTable) return [];
    if (isPropertyAppraisalTable) {
      const q = deferredSearch.trim();
      const statusValue =
        APPRAISAL_STATUS_FILTERS.find((o) => o.label === statusFilter)?.value ??
        "";
      return primaryRowMeta.filter((meta) => {
        // With no search, skip building the match text entirely — used to allocate an array and string
        // per row then discard them (js-early-exit).
        if (q) {
          const cityDistrict = [meta.row.city, meta.row.district]
            .filter((v) => v && v !== "—")
            .join(" — ");
          const hay = `${meta.row.deedLabel} ${cityDistrict} ${meta.row.propertySlot}`;
          if (!hay.includes(q)) return false;
        }
        if (statusValue) {
          const group = appraiserQueueStatusGroup(
            meta.task,
            tasks ?? EMPTY_TASKS,
          );
          if (group !== statusValue) return false;
        }
        return true;
      });
    }
    return filterPrimaryQueueRowMeta(primaryRowMeta, {
      search: deferredSearch,
      statusFilter,
      typeFilter,
    });
  }, [
    isAllTransactionsTable,
    isDistributionTable,
    isPropertyAppraisalTable,
    primaryRowMeta,
    tasks,
    deferredSearch,
    statusFilter,
    typeFilter,
  ]);

  const filteredListed = useMemo(() => {
    if (isAllTransactionsTable) {
      return filterAllTransactionsQueueRows(allTransactionsRowMeta, {
        search: deferredSearch,
        statusFilter,
        typeFilter,
      });
    }
    if (isDistributionTable) {
      return filterDistributionQueueRows(distributionRowMeta, {
        search: deferredSearch,
        typeFilter,
      });
    }
    return filteredPrimaryMeta.map((meta) => meta.task);
  }, [
    isAllTransactionsTable,
    isDistributionTable,
    allTransactionsRowMeta,
    distributionRowMeta,
    filteredPrimaryMeta,
    deferredSearch,
    statusFilter,
    typeFilter,
  ]);

  const filteredAllTxMeta = useMemo(() => {
    if (!isAllTransactionsTable) return [];
    const ids = new Set(filteredListed.map((t) => t.id));
    return allTransactionsRowMeta.filter((row) => ids.has(row.task.id));
  }, [isAllTransactionsTable, filteredListed, allTransactionsRowMeta]);

  const allTxPoGroups = useMemo(() => {
    if (!isAllTransactionsTable || !groupByPo) return [];
    const byPo = new Map<string, typeof filteredAllTxMeta>();
    for (const row of filteredAllTxMeta) {
      const list = byPo.get(row.poNumber) ?? [];
      list.push(row);
      byPo.set(row.poNumber, list);
    }
    return uniqueSortedPoOrder(filteredAllTxMeta.map((r) => r.poNumber)).map(
      (po) => ({
        po,
        rows: byPo.get(po) ?? [],
      }),
    );
  }, [isAllTransactionsTable, groupByPo, filteredAllTxMeta]);

  const toggleGroupByPo = useCallback(() => {
    setGroupByPo((prev) => {
      const next = !prev;
      if (next) {
        const collapsed: Record<string, boolean> = {};
        for (const row of allTransactionsRowMeta) {
          collapsed[row.poNumber] = true;
        }
        setCollapsedPo(collapsed);
        if (groupGatherTimerRef.current != null) {
          window.clearTimeout(groupGatherTimerRef.current);
        }
        setGroupGatherAnim(true);
        groupGatherTimerRef.current = window.setTimeout(() => {
          setGroupGatherAnim(false);
          groupGatherTimerRef.current = null;
        }, 520);
      }
      return next;
    });
  }, [allTransactionsRowMeta]);

  useEffect(() => {
    return () => {
      if (groupGatherTimerRef.current != null) {
        window.clearTimeout(groupGatherTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const refresh = () => setPartyProgressRevision((revision) => revision + 1);
    window.addEventListener(PARTY_CASE_STUDY_FORM_CHANGED_EVENT, refresh);
    return () =>
      window.removeEventListener(PARTY_CASE_STUDY_FORM_CHANGED_EVENT, refresh);
  }, []);

  useEffect(() => {
    if (!showPartyColumns || !tasks) {
      // Avoid a new Map() every run — that re-renders and can loop when deps churn.
      setPartyProgressByTask((prev) => (prev.size === 0 ? prev : new Map()));
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
    // Prefer id key over `listed` identity — a fresh array each render was looping with setState.
    listedTaskIdsKey,
    tasks,
    infoRolesMatrix,
    partyProgressRevision,
  ]);

  useEffect(() => {
    setStatusFilter("");
    setTypeFilter("");
    setSearch("");
    setShowCompleted(false);
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

  useEffect(() => {
    if (!selectedTask) return;
    markTaskRowSeen(selectedTask);
  }, [selectedTask, markTaskRowSeen]);

  /* A fresh literal object each render broke row memoization despite stable handlers —
     the screen re-renders on search keystrokes, minute ticks, and every bump (rerender-memo). */
  const rowCtx: QueueRowContext = useMemo(
    () => ({
      queuePending,
      showSkeleton: queuePending && listed.length === 0,
      selectedId,
      isTaskOpening,
      handleRowClick,
      resolveRowAttention,
      resolveRowMoreItems,
    }),
    [
      queuePending,
      listed.length,
      selectedId,
      isTaskOpening,
      handleRowClick,
      resolveRowAttention,
      resolveRowMoreItems,
    ],
  );

  const queueToolbar = queueReady ? (
    <QueueFiltersToolbar
      queueReady={queueReady}
      isPartyQueueToggleTable={isPartyQueueToggleTable}
      isPropertyAppraisalTable={isPropertyAppraisalTable}
      isDistributionTable={isDistributionTable}
      isAllTransactionsTable={isAllTransactionsTable}
      search={search}
      onSearchChange={setSearch}
      statusFilter={statusFilter}
      onStatusFilterChange={setStatusFilter}
      statusOptions={statusOptions}
      typeFilter={typeFilter}
      onTypeFilterChange={setTypeFilter}
      assignmentTypes={assignmentTypes}
      showCompleted={showCompleted}
      onToggleShowCompleted={() => setShowCompleted((v) => !v)}
      groupByPo={groupByPo}
      groupGatherAnim={groupGatherAnim}
      onToggleGroupByPo={toggleGroupByPo}
      filteredCount={filteredListed.length}
    />
  ) : null;

  const openPropertyDetailFromQueue = useCallback(
    (task: WorkflowTask, propertyId: string | undefined) => {
      if (!propertyId) return;
      markTaskRowSeen(task);
      setOpeningTaskId(task.id);
      startOpenTask(() => {
        router.push(poPropertyDetailPath(task.poNumber, propertyId, "basic"));
      });
    },
    [router, markTaskRowSeen],
  );

  const handleDistributionRowClick = useCallback(
    (task: WorkflowTask, propertyId: string | undefined) => {
      markTaskRowSeen(task);
      if (showPartyColumns && propertyId) {
        openPropertyDetailFromQueue(task, propertyId);
        return;
      }
      handleRowClick(task.id);
    },
    [
      showPartyColumns,
      handleRowClick,
      markTaskRowSeen,
      openPropertyDetailFromQueue,
    ],
  );

  const mobileQueueCardItems = useMemo((): ActiveQueueMobileCardItem[] => {
    // Mobile tree does not mount on desktop — no need to build its elements.
    if (isDesktopViewport === true) return [];
    if (isPropertyInspectionQueue) return [];

    if (isAllTransactionsTable) {
      return filteredAllTxMeta.map((meta) => {
        const metaLines = [
          { text: formatPoDisplay(meta.poNumber), kind: "po" as const },
          meta.city !== "—"
            ? { text: meta.city, kind: "place" as const }
            : null,
          meta.district !== "—"
            ? { text: meta.district, kind: "place" as const }
            : null,
          meta.assignmentType !== "—"
            ? { text: meta.assignmentType, kind: "type" as const }
            : null,
        ].filter((v): v is NonNullable<typeof v> => Boolean(v));
        const done = meta.phaseLabel === "مكتمل";
        return {
          id: meta.task.id,
          title: meta.deedCell,
          meta: metaLines,
          statusLabel: meta.phaseLabel,
          statusStyle: allTransactionsPhaseStyle(meta.task),
          tone: done ? "done" : "pending",
          moreItems: resolveRowMoreItems(meta.task, meta.propertyId),
          onOpen: () => handleRowClick(meta.task.id),
          loading: isTaskOpening(meta.task.id),
        };
      });
    }

    if (isDistributionTable) {
      return filteredListed.map((task) => {
        const record = poByNumber.get(task.poNumber.trim());
        const property = findPropertyForTask(record, task);
        const row = buildDistributionTableRow(task, property, record);
        const deed =
          row.deedLabel && row.deedLabel !== "—"
            ? row.deedLabel.startsWith("صك")
              ? row.deedLabel
              : `صك ${row.deedLabel}`
            : `مهمة ${task.id}`;
        const meta = [
          config.disableRowOpen
            ? null
            : { text: formatPoDisplay(task.poNumber), kind: "po" as const },
          row.city !== "—" ? { text: row.city, kind: "place" as const } : null,
          row.district !== "—"
            ? { text: row.district, kind: "place" as const }
            : null,
          row.propertyType !== "—"
            ? { text: row.propertyType, kind: "type" as const }
            : null,
        ].filter((v): v is NonNullable<typeof v> => Boolean(v));
        const openDetail = () =>
          handleDistributionRowClick(task, property?.id);
        return {
          id: task.id,
          title: deed,
          meta,
          tone: "new" as const,
          moreItems: resolveRowMoreItems(task, property?.id),
          onOpen: config.disableRowOpen ? undefined : openDetail,
          onTitleClick: config.disableRowOpen ? openDetail : undefined,
          footer: config.disableRowOpen ? (
            <PoNumber value={task.poNumber} link className="text-[12px]" />
          ) : undefined,
          loading: isTaskOpening(task.id),
        };
      });
    }

    return filteredPrimaryMeta.map(({ task, record, property, row }) => {
      const badge = resolveTaskBadge(task);
      const tone = toneFromLegacyBadge(badge?.className);
      const timer = formatRemainingDuration(record?.dueDateAt ?? "", now);
      const showTimer = timer.remainingDuration !== "—";
      const titleParts = [
        row.propertySlot !== "—" ? row.propertySlot : null,
        property?.plotNumber?.trim()
          ? `قطعة ${property.plotNumber.trim()}`
          : null,
        row.district !== "—" ? row.district : null,
      ].filter(Boolean);
      const meta = [
        { text: formatPoDisplay(task.poNumber), kind: "po" as const },
        row.city !== "—" ? { text: row.city, kind: "place" as const } : null,
        row.assignmentType !== "—"
          ? { text: row.assignmentType, kind: "type" as const }
          : null,
      ].filter((v): v is NonNullable<typeof v> => Boolean(v));
      return {
        id: task.id,
        title:
          titleParts.length > 0 ? titleParts.join(" — ") : `مهمة ${task.id}`,
        meta,
        statusLabel: badge?.label,
        statusClassName: badge?.className,
        tone,
        timerLabel: showTimer
          ? timer.remainingOverdue
            ? "متأخرة"
            : `متبقي ${timer.remainingDuration}`
          : undefined,
        timerTick: showTimer
          ? remainingTimerTick(record?.dueDateAt ?? "")
          : undefined,
        timerOverdue: showTimer ? timer.remainingOverdue : undefined,
        timerRatio: showTimer
          ? resolveSlaTimerRatio(
              record?.dueDateAt ?? "",
              task.createdAt ?? "",
              now,
            )
          : undefined,
        moreItems: resolveRowMoreItems(task, property?.id),
        onOpen: () => handleRowClick(task.id),
        loading: isTaskOpening(task.id),
      };
    });
  }, [
    isDesktopViewport,
    isPropertyInspectionQueue,
    isAllTransactionsTable,
    isDistributionTable,
    filteredAllTxMeta,
    filteredListed,
    filteredPrimaryMeta,
    poByNumber,
    now,
    resolveRowMoreItems,
    resolveTaskBadge,
    handleRowClick,
    handleDistributionRowClick,
    isTaskOpening,
    config.disableRowOpen,
  ]);

  const hasRail =
    !useFullPage && queueReady && listed.length > 0 && Boolean(renderPanel);

  const queuePanel = (
        <OperationalPanel
          className={cn(
            "min-h-0 flex-1",
            hasRail && panelOpen ? undefined : "flex-none",
            /* Desktop menus may escape; never let X overflow widen the mobile page. */
            isPartyQueueToggleTable && "max-lg:overflow-x-hidden lg:overflow-visible",
            /* Mobile: drop heavy table panel chrome — cards float on canvas. */
            "max-lg:border-0 max-lg:bg-transparent max-lg:shadow-none max-lg:rounded-none",
          )}
        >
          {!config.hidePageTitle && config.pageTitle ? (
            <PageShellHeader title={config.pageTitle} />
          ) : null}

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
              {isDesktopViewport === true ? null : isPropertyInspectionQueue ? (
                <div className="pb-3 lg:hidden max-lg:px-0">
                  <InspectorMobileQueue
                    tasks={filteredListed}
                    poByNumber={poByNumber}
                    now={now}
                    pending={queuePending}
                    onOpen={handleRowClick}
                    resolveBadge={resolveTaskBadge}
                    resolveMoreItems={resolveRowMoreItems}
                    isOpening={isTaskOpening}
                  />
                </div>
              ) : (
                <div
                  className="pb-3 lg:hidden max-lg:px-0"
                  onMouseEnter={preloadRowWork}
                  onFocus={preloadRowWork}
                >
                  <ActiveQueueMobileCards
                    items={mobileQueueCardItems}
                    pending={queuePending}
                    emptyMessage={
                      isEngineeringSurveyTable
                        ? "لا توجد أوامر رفع مطابقة."
                        : isAllTransactionsTable
                          ? "لا توجد معاملات مطابقة."
                          : (config.emptyLine ?? "لا توجد معاملات مطابقة.")
                    }
                  />
                </div>
              )}
              {isDesktopViewport === false ? null : (
              <TableFrame
                className="max-lg:hidden lg:block"
                onMouseEnter={preloadRowWork}
                onFocus={preloadRowWork}
              >
                {isAllTransactionsTable ? (
                  <AllTransactionsQueueTable
                    ctx={rowCtx}
                    filteredMeta={filteredAllTxMeta}
                    groupByPo={groupByPo}
                    poGroups={allTxPoGroups}
                    collapsedPo={collapsedPo}
                    onToggleCollapsed={(po) =>
                      setCollapsedPo((prev) => ({ ...prev, [po]: !prev[po] }))
                    }
                    onOpenPoProperties={(po) =>
                      router.push(poPropertiesPath(po))
                    }
                  />
                ) : isDistributionTable ? (
                  <DistributionQueueTable
                    ctx={rowCtx}
                    showPartyColumns={showPartyColumns}
                    disableRowOpen={Boolean(config.disableRowOpen)}
                    filteredListed={filteredListed}
                    poByNumber={poByNumber}
                    tasks={tasks ?? EMPTY_TASKS}
                    partyProgressByTask={partyProgressByTask}
                    staffUsers={staffUsers}
                    onRowClick={handleDistributionRowClick}
                    openPropertyDetail={openPropertyDetailFromQueue}
                  />
                ) : isEngineeringSurveyTable ? (
                  <EngineeringSurveyQueueTable
                    ctx={rowCtx}
                    filteredMeta={filteredPrimaryMeta}
                    resolveTaskBadge={resolveTaskBadge}
                    statusColumnLabel={config.statusColumnLabel}
                  />
                ) : isPropertyAppraisalTable ? (
                  <PropertyAppraisalQueueTable
                    ctx={rowCtx}
                    filteredMeta={filteredPrimaryMeta}
                    tasks={tasks ?? EMPTY_TASKS}
                    openPropertyDetail={openPropertyDetailFromQueue}
                    statusColumnLabel={config.statusColumnLabel}
                  />
                ) : (
                  <PrimaryQueueTable
                    ctx={rowCtx}
                    filteredMeta={filteredPrimaryMeta}
                    primaryHasLocation={primaryHasLocation}
                    renderStatusOrRemaining={renderStatusOrRemaining}
                    statusColumnLabel={config.statusColumnLabel}
                  />
                )}
                <QueueTableHint
                  className={cn(
                    (config.pageId === "all-transactions" ||
                      config.pageId === "active-primary-data" ||
                      isPartyQueueToggleTable) &&
                      "border-t border-border bg-surface-2",
                  )}
                >
                  {config.tableHint ??
                    (config.disableRowOpen
                      ? "افتح عبر رقم الصك أو أمر العمل أو قائمة ⋮."
                      : useFullPage
                        ? "اضغط الصف لفتح دراسة الحالة."
                        : "اضغط الصف للفتح أو الإغلاق.")}
                </QueueTableHint>
              </TableFrame>
              )}
            </>
          )}
        </OperationalPanel>
  );

  const sidePanel =
    hasRail && renderPanel ? (
      <OperationalPanel
        id={config.panelId}
        className={cn(
          "flex h-full min-h-0 min-w-0 flex-1 flex-col !overflow-hidden",
          /* Mobile: fully remove closed rail (invisible still widens the page). */
          panelOpen
            ? "visible opacity-100"
            : "pointer-events-none max-lg:hidden lg:invisible lg:opacity-0",
        )}
      >
        {panelOpen && selectedTask ? (
          <div
            key={selectedTask.id}
            className="ui-queue-panel-in flex min-h-0 min-w-0 flex-1 flex-col"
          >
            {renderPanel({
              task: selectedTask,
              onRefresh: refreshWork,
              onClose: closePanel,
            })}
          </div>
        ) : null}
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
