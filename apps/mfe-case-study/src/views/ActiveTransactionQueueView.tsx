"use client";

import type { MutableRefObject, ReactNode } from "react";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
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
  type StatusPillStyle,
} from "@platform/ui-kit";
import { PoNumber } from "@case-study/mfe/components/ui/PoNumber";
import { RemainingTimeCell } from "@case-study/mfe/components/ui/RemainingTimeCell";
import { RowMoreMenu } from "@case-study/mfe/components/ui/RowMoreMenu";
import type { RowMoreMenuItem } from "@case-study/mfe/components/ui/RowMoreMenu";
import { InteractiveDeedCell } from "../components/ui/InteractiveDeedCell";
import { RowAttentionDot } from "../components/ui/RowAttentionDot";
import { PartyAssigneeCell } from "../components/ui/PartyAssigneeCell";
import { HoverPortalCard } from "../components/ui/HoverPortalCard";
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
import { poPropertiesPath, poPropertyDetailPath } from "../lib/po-routes";
import {
  buildDistributionTableRow,
  buildPrimaryDataTableRow,
  compareQueueTasksOldestFirst,
  compareQueueTasksNewestFirst,
  compareQueueTasksByUpdatedNewestFirst,
  findPropertyForTask,
  formatRemainingDuration,
  resolveSlaTimerRatio,
  type RemainingTimeState,
} from "../lib/prototype/my-task-row";
import { INSPECTION_TABLE_TYPE } from "../lib/prototype/queue-table-type";
import type { PoIntakeRecord } from "../lib/prototype/po-intake-data";
import {
  formatPoDisplay,
  PROPERTY_IDENTIFIER_COLUMN_LABEL,
  skipsBourseForIdentifier,
} from "../lib/prototype/po-intake-data";
import {
  ActiveQueueMobileCards,
  toneFromLegacyBadge,
  type ActiveQueueMobileCardItem,
} from "../components/queue/ActiveQueueMobileCards";
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
  filterPrimaryQueueRows,
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
  appraiserInspectionDone,
  appraiserNeedsSurvey,
  appraiserQueueStatusBadge,
  appraiserQueueStatusGroup,
  appraiserSurveyDone,
} from "@evaluator/mfe/lib/evaluator/evaluator-queue";
import { ActiveTransactionPageLayout } from "../components/active-transactions/ActiveTransactionPageLayout";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";

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
    options?: { showCompleted?: boolean },
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
  /** Default: most recently updated / distributed task first. */
  queueSort?: "oldest-first" | "newest-first" | "distributed-newest-first";
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

const ROW = queueTableRowClassName;
const ROW_ACTIVE = queueTableRowActiveClassName;
const DEFAULT_INFO_ROLES = emptyCaseStudyInfoRolesConfig();

/** Case Study.html `ENG_ST` / `VAL` status pill colors. */
function engSurveyStatusPillStyle(className: string): StatusPillStyle {
  if (className.includes("done")) {
    return { base: "#3f8f5f", fg: "#2f7a4d" };
  }
  if (className.includes("fail") || className.includes("returned")) {
    return { base: "#d9694f", fg: "#a5432e" };
  }
  if (className.includes("prog")) {
    return { base: "#d9a441", fg: "#8a5e14" };
  }
  if (className.includes("gold")) {
    return { base: "#a4906f", fg: "#8c7857" };
  }
  if (className.includes("navy")) {
    return { base: "#102B4E", fg: "#102B4E" };
  }
  // جديد — GRAY in prototype (not blue)
  return { base: "#6b7c8f", fg: "#4a5568" };
}

/** Case Study.html remaining column: يومان / N أيام / متأخر. */
function formatEngSurveyRemaining(state: RemainingTimeState): {
  text: string;
  overdue: boolean;
} {
  if (state.status === "missing") return { text: "—", overdue: false };
  if (state.status === "overdue") return { text: "متأخر", overdue: true };
  const days = state.days;
  if (days <= 0) return { text: "0 أيام", overdue: false };
  if (days === 1) return { text: "يوم", overdue: false };
  if (days === 2) return { text: "يومان", overdue: false };
  return { text: `${days} أيام`, overdue: false };
}

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
  const [isOpeningTask, startOpenTask] = useTransition();
  const [openingTaskId, setOpeningTaskId] = useState<string | null>(null);
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
    await queryClient.invalidateQueries({ queryKey: prototypeKeys.poRecords() });
    await queryClient.invalidateQueries({
      queryKey: prototypeKeys.workflowTasks(),
    });
    if (config.allowPhaseRevert) {
      await queryClient.invalidateQueries({
        queryKey: prototypeKeys.pendingBourseItems(),
      });
    }
    if (needsInspectionWorkspaces) {
      await queryClient.invalidateQueries({
        queryKey: prototypeKeys.fieldInspectionWorkspaces(),
      });
    }
    bump((n) => n + 1);
    await refetchTasks();
  }, [
    queryClient,
    refetchTasks,
    needsInspectionWorkspaces,
    config.allowPhaseRevert,
  ]);

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
      return <RemainingTimeCell state={remainingTime} />;
    },
    [config, inspectionWorkspaceByTaskId, submissionCacheGen],
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
  const distributionSkeletonCols = 8 + (showPartyColumns ? 3 : 0);
  const primarySkeletonCols = 7;
  const allTransactionsSkeletonCols = 7;

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

  const assignmentTypes = useMemo(
    () =>
      uniqueSortedLabels(
        isAllTransactionsTable
          ? allTransactionsRowMeta.map((row) => row.assignmentType)
          : isDistributionTable
            ? distributionRowMeta.map((row) => row.assignmentType)
            : primaryRowMeta.map((row) => row.assignmentType),
      ),
    [
      isAllTransactionsTable,
      isDistributionTable,
      allTransactionsRowMeta,
      distributionRowMeta,
      primaryRowMeta,
    ],
  );

  const statusOptions = useMemo(
    () =>
      isPropertyAppraisalTable
        ? APPRAISAL_STATUS_FILTERS.map((o) => o.label)
        : uniqueSortedLabels(
            isAllTransactionsTable
              ? allTransactionsRowMeta.map((row) => row.phaseLabel)
              : primaryRowMeta.map((row) => row.statusLabel),
          ),
    [
      isPropertyAppraisalTable,
      isAllTransactionsTable,
      allTransactionsRowMeta,
      primaryRowMeta,
    ],
  );

  const filteredListed = useMemo(() => {
    if (isAllTransactionsTable) {
      return filterAllTransactionsQueueRows(allTransactionsRowMeta, {
        search,
        statusFilter,
        typeFilter,
      });
    }
    if (isDistributionTable) {
      return filterDistributionQueueRows(distributionRowMeta, {
        search,
        typeFilter,
      });
    }
    if (isPropertyAppraisalTable) {
      const q = search.trim();
      const statusValue =
        APPRAISAL_STATUS_FILTERS.find((o) => o.label === statusFilter)?.value ??
        "";
      return listed.filter((task) => {
        const record = poByNumber.get(task.poNumber.trim());
        const property = findPropertyForTask(record, task);
        const row = buildPrimaryDataTableRow(task, property, record, now);
        const cityDistrict = [row.city, row.district]
          .filter((v) => v && v !== "—")
          .join(" — ");
        const hay = `${row.deedLabel} ${cityDistrict} ${row.propertySlot}`;
        if (q && !hay.includes(q)) return false;
        if (statusValue) {
          const group = appraiserQueueStatusGroup(task, tasks ?? []);
          if (group !== statusValue) return false;
        }
        return true;
      });
    }
    return filterPrimaryQueueRows(primaryRowMeta, {
      search,
      statusFilter,
      typeFilter,
    });
  }, [
    isAllTransactionsTable,
    isDistributionTable,
    isPropertyAppraisalTable,
    allTransactionsRowMeta,
    distributionRowMeta,
    primaryRowMeta,
    listed,
    poByNumber,
    now,
    tasks,
    search,
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

  const resultCountChip = (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-[6px] bg-gold-soft px-2.5 py-[3px] text-[12px] font-bold text-gold-d max-lg:self-start lg:ms-auto"
      aria-live="polite"
    >
      {queueReady
        ? isPartyQueueToggleTable
          ? isPropertyAppraisalTable
            ? `${filteredListed.length} عقار`
            : `${filteredListed.length} صك`
          : (
              <>
                {filteredListed.length}
                <span>نتيجة</span>
              </>
            )
        : "—"}
    </span>
  );

  const queueToolbar = queueReady ? (
    <PageToolbar
      className={cn(
        "shrink-0 flex-wrap items-center gap-2.5",
        /* Desktop: table-header strip. Mobile: HTML-like filter row on canvas. */
        "max-lg:mb-1 max-lg:flex-col max-lg:items-stretch max-lg:border-0 max-lg:bg-transparent max-lg:px-0 max-lg:pb-2 max-lg:pt-0",
        "lg:border-b lg:border-border lg:bg-surface-2",
      )}
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2.5 max-lg:w-full max-lg:flex-col max-lg:items-stretch">
        <OperationalToolbarSearch
          type="search"
          placeholder={
            isPartyQueueToggleTable
              ? "رقم الصك أو المدينة أو الحي…"
              : isDistributionTable
                ? "رقم الصك أو PO أو المدينة…"
                : "رقم الصك أو نوع الإسناد أو المدينة…"
          }
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="بحث المعاملات"
        />
        <div className="flex flex-wrap items-center gap-2.5 max-lg:grid max-lg:w-full max-lg:grid-cols-2 lg:contents">
          {!isDistributionTable ? (
            <OperationalToolbarSelect
              className="shrink-0"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label={
                isAllTransactionsTable ? "تصفية المرحلة" : "تصفية الحالة"
              }
            >
              <option value="">جميع الحالات</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </OperationalToolbarSelect>
          ) : null}
          {isPartyQueueToggleTable ? (
            <button
              type="button"
              onClick={() => setShowCompleted((v) => !v)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-[13px] py-2 text-[12.5px] font-bold transition-colors max-lg:justify-center",
                showCompleted
                  ? "border-ink bg-ink text-white"
                  : "border-border-md bg-surface text-text-2 hover:bg-surface-2",
              )}
              aria-pressed={showCompleted}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <span>
                {isPropertyAppraisalTable
                  ? showCompleted
                    ? "عرض قائمة العمل"
                    : "إظهار الكل"
                  : showCompleted
                    ? "إخفاء المكتملة"
                    : "إظهار المكتملة"}
              </span>
            </button>
          ) : (
            <OperationalToolbarSelect
              className="shrink-0"
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
          )}
        </div>
        {isAllTransactionsTable ? (
          <button
            type="button"
            onClick={toggleGroupByPo}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-[13px] py-2 text-[12.5px] font-bold transition-colors max-lg:w-full max-lg:justify-center",
              groupByPo
                ? "border-ink bg-ink text-white"
                : "border-border-md bg-surface text-text-2 hover:bg-surface-2",
            )}
            aria-pressed={groupByPo}
          >
            <span
              className="relative inline-grid size-[15px] shrink-0 place-items-center"
              aria-hidden
            >
              <svg
                className={cn(
                  "col-start-1 row-start-1 size-[15px] transition-[opacity,transform] duration-[220ms] ease-out motion-reduce:transition-none",
                  groupByPo
                    ? "-translate-y-0.5 scale-[0.86] opacity-0"
                    : "scale-100 opacity-100",
                )}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="7" height="7" rx="1.2" />
                <rect x="14" y="3" width="7" height="7" rx="1.2" />
                <rect x="3" y="14" width="7" height="7" rx="1.2" />
                <rect x="14" y="14" width="7" height="7" rx="1.2" />
              </svg>
              <svg
                className={cn(
                  "col-start-1 row-start-1 size-[15px] transition-[opacity,transform] duration-[280ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
                  groupByPo
                    ? "translate-y-0 scale-100 opacity-100"
                    : "translate-y-0.5 scale-[0.86] opacity-0",
                  groupByPo &&
                    groupGatherAnim &&
                    "animate-[atq-ico-pop_0.38s_cubic-bezier(0.22,1,0.36,1)_both] motion-reduce:animate-none",
                )}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 7h16" />
                <path d="M6 12h12" />
                <path d="M8 17h8" />
              </svg>
            </span>
            <span>تجميع حسب أمر العمل</span>
          </button>
        ) : null}
        {resultCountChip}
      </div>
    </PageToolbar>
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
          { text: formatPoDisplay(task.poNumber), kind: "po" as const },
          row.city !== "—" ? { text: row.city, kind: "place" as const } : null,
          row.district !== "—"
            ? { text: row.district, kind: "place" as const }
            : null,
          row.propertyType !== "—"
            ? { text: row.propertyType, kind: "type" as const }
            : null,
        ].filter((v): v is NonNullable<typeof v> => Boolean(v));
        return {
          id: task.id,
          title: deed,
          meta,
          tone: "new",
          moreItems: resolveRowMoreItems(task, property?.id),
          onOpen: () => handleDistributionRowClick(task, property?.id),
          loading: isTaskOpening(task.id),
        };
      });
    }

    return filteredListed.map((task) => {
      const record = poByNumber.get(task.poNumber.trim());
      const property = findPropertyForTask(record, task);
      const row = buildPrimaryDataTableRow(task, property, record, now);
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
    isPropertyInspectionQueue,
    isAllTransactionsTable,
    isDistributionTable,
    filteredAllTxMeta,
    filteredListed,
    poByNumber,
    now,
    resolveRowMoreItems,
    resolveTaskBadge,
    handleRowClick,
    handleDistributionRowClick,
    isTaskOpening,
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
              {isPropertyInspectionQueue ? (
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
                <div className="pb-3 lg:hidden max-lg:px-0">
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
              <div
                className={cn(
                  queueTableWrapClassName,
                  (isDistributionTable || isAllTransactionsTable) &&
                    "overflow-x-auto",
                  /* Never contribute 720px min-width to mobile layout. */
                  "max-lg:hidden lg:block",
                  "lg:rounded-b-[var(--radius-lg)]",
                )}
              >
                {isAllTransactionsTable ? (
                  <Table className="w-full lg:min-w-[720px]" pending={queuePending}>
                    <THead>
                      <Tr hoverable={false}>
                        <Th>{PROPERTY_IDENTIFIER_COLUMN_LABEL}</Th>
                        <Th>أمر العمل</Th>
                        <Th>نوع الإسناد</Th>
                        <Th>المدينة</Th>
                        <Th>الحي</Th>
                        <Th>المرحلة</Th>
                        <ThAction aria-label="المزيد" />
                      </Tr>
                    </THead>
                    <TBody>
                      {queuePending && listed.length === 0 ? (
                        <SkeletonTableRows
                          rows={6}
                          cols={allTransactionsSkeletonCols}
                        />
                      ) : filteredAllTxMeta.length === 0 ? (
                        <Tr hoverable={false}>
                          <Td
                            colSpan={allTransactionsSkeletonCols}
                            className="!py-11 text-center text-[13.5px] text-text-3"
                          >
                            لا توجد معاملات مطابقة.
                          </Td>
                        </Tr>
                      ) : groupByPo ? (
                        allTxPoGroups.map(({ po, rows }, groupIndex) => {
                          const open = !collapsedPo[po];
                          return (
                            <Fragment key={po}>
                              <Tr
                                hoverable={false}
                                className="cursor-pointer bg-surface-2 animate-[atq-group-row-in_0.28s_ease-out_both] motion-reduce:animate-none"
                                style={{
                                  animationDelay: `${Math.min(groupIndex, 8) * 35}ms`,
                                }}
                                onClick={() =>
                                  router.push(poPropertiesPath(po))
                                }
                              >
                                <Td colSpan={allTransactionsSkeletonCols}>
                                  <div className="flex items-center gap-2.5">
                                    <button
                                      type="button"
                                      className="grid place-items-center rounded-md p-0.5 text-text-3 hover:bg-surface"
                                      title={open ? "طي" : "فتح"}
                                      aria-label={open ? "طي المجموعة" : "فتح المجموعة"}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setCollapsedPo((prev) => ({
                                          ...prev,
                                          [po]: !prev[po],
                                        }));
                                      }}
                                    >
                                      <svg
                                        width="16"
                                        height="16"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className={cn(
                                          "transition-transform duration-150",
                                          !open && "-rotate-90",
                                        )}
                                        aria-hidden
                                      >
                                        <path d="m6 9 6 6 6-6" />
                                      </svg>
                                    </button>
                                    <span
                                      dir="ltr"
                                      className="text-[13px] font-extrabold text-heading"
                                    >
                                      {po}
                                    </span>
                                    <span className="rounded-full bg-gold-soft px-2.5 py-0.5 text-[11.5px] font-bold text-gold-d">
                                      {rows.length} معاملة
                                    </span>
                                    <span className="ms-auto inline-flex items-center gap-1 text-[12px] font-bold text-gold-d">
                                      دخول أمر العمل
                                      <svg
                                        width="15"
                                        height="15"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        aria-hidden
                                      >
                                        <path d="m15 18-6-6 6-6" />
                                      </svg>
                                    </span>
                                  </div>
                                </Td>
                              </Tr>
                              {open
                                ? rows.map((meta) => {
                                    const active =
                                      selectedId === meta.task.id;
                                    const moreItems = resolveRowMoreItems(
                                      meta.task,
                                      meta.propertyId,
                                    );
                                    return (
                                      <Tr
                                        key={meta.task.id}
                                        hoverable={false}
                                        className={cn(
                                          "group/atq-row",
                                          ROW,
                                          active && ROW_ACTIVE,
                                          isTaskOpening(meta.task.id) &&
                                            "ui-queue-row-opening pointer-events-none",
                                        )}
                                        onClick={() =>
                                          handleRowClick(meta.task.id)
                                        }
                                      >
                                        <Td className="whitespace-nowrap">
                                          <InteractiveDeedCell
                                            label={meta.deedCell}
                                            loading={isTaskOpening(
                                              meta.task.id,
                                            )}
                                            trailing={
                                              resolveRowAttention(meta.task) ? (
                                                <RowAttentionDot />
                                              ) : undefined
                                            }
                                          />
                                        </Td>
                                        <Td>
                                          <PoNumber
                                            value={meta.poNumber}
                                            link
                                            className="!text-[12.5px] !font-semibold text-text-2"
                                          />
                                        </Td>
                                        <Td className="text-text-2">
                                          {meta.assignmentType}
                                        </Td>
                                        <Td className="text-text-2">
                                          {meta.city}
                                        </Td>
                                        <Td className="text-text-2">
                                          {meta.district}
                                        </Td>
                                        <Td>
                                          <StatusPill
                                            label={meta.phaseLabel}
                                            style={allTransactionsPhaseStyle(
                                              meta.task,
                                            )}
                                          />
                                        </Td>
                                        <TdAction>
                                          <RowMoreMenu items={moreItems} />
                                        </TdAction>
                                      </Tr>
                                    );
                                  })
                                : null}
                            </Fragment>
                          );
                        })
                      ) : (
                        filteredAllTxMeta.map((meta) => {
                          const active = selectedId === meta.task.id;
                          const moreItems = resolveRowMoreItems(
                            meta.task,
                            meta.propertyId,
                          );
                          return (
                            <Tr
                              key={meta.task.id}
                              hoverable={false}
                              className={cn(
                                "group/atq-row",
                                ROW,
                                active && ROW_ACTIVE,
                                isTaskOpening(meta.task.id) &&
                                  "ui-queue-row-opening pointer-events-none",
                              )}
                              onClick={() => handleRowClick(meta.task.id)}
                            >
                              <Td className="whitespace-nowrap">
                                <InteractiveDeedCell
                                  label={meta.deedCell}
                                  loading={isTaskOpening(meta.task.id)}
                                  trailing={
                                    resolveRowAttention(meta.task) ? (
                                      <RowAttentionDot />
                                    ) : undefined
                                  }
                                />
                              </Td>
                              <Td>
                                <PoNumber
                                  value={meta.poNumber}
                                  link
                                  className="!text-[12.5px] !font-semibold text-text-2"
                                />
                              </Td>
                              <Td className="text-text-2">
                                {meta.assignmentType}
                              </Td>
                              <Td className="text-text-2">{meta.city}</Td>
                              <Td className="text-text-2">{meta.district}</Td>
                              <Td>
                                <StatusPill
                                  label={meta.phaseLabel}
                                  style={allTransactionsPhaseStyle(meta.task)}
                                />
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
                ) : isDistributionTable ? (
                  <Table
                    className={cn(
                      "w-full",
                      showPartyColumns ? "min-w-0" : "lg:min-w-[720px]",
                    )}
                    pending={queuePending}
                  >
                    <THead>
                      <Tr hoverable={false}>
                        <Th>{PROPERTY_IDENTIFIER_COLUMN_LABEL}</Th>
                        <Th>أمر العمل</Th>
                        <Th>المدينة</Th>
                        <Th>الحي</Th>
                        <Th>نوع العقار</Th>
                        <Th>التصنيف</Th>
                        <Th>المساحة</Th>
                        {showPartyColumns ? (
                          <>
                            <Th className="w-[7.5rem] min-w-[7.5rem]">المعاين</Th>
                            <Th className="w-[7.5rem] min-w-[7.5rem]">المقيم</Th>
                            <Th className="w-[7.5rem] min-w-[7.5rem]">المكتب الهندسي</Th>
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
                              staffUsers,
                            )
                          : [];
                        const active = selectedId === task.id;
                        const moreItems = resolveRowMoreItems(task, property?.id);
                        return (
                          <Tr
                            key={task.id}
                            hoverable={false}
                            className={cn(
                              "group/atq-row",
                              ROW,
                              active && ROW_ACTIVE,
                              isTaskOpening(task.id) &&
                                "ui-queue-row-opening pointer-events-none",
                            )}
                            onClick={() =>
                              handleDistributionRowClick(task, property?.id)
                            }
                          >
                            <Td className="whitespace-nowrap">
                              <span className="inline-flex min-w-0 items-center justify-end gap-2">
                                <span
                                  className={cn(
                                    "inline-flex h-[22px] min-w-[22px] shrink-0 items-center justify-center rounded-md bg-surface-3 tabular-nums",
                                    INSPECTION_TABLE_TYPE.ordinal,
                                  )}
                                  aria-hidden
                                >
                                  {index + 1}
                                </span>
                                {property?.id ? (
                                  <button
                                    type="button"
                                    className="relative z-[1] inline-flex max-w-full cursor-pointer border-0 bg-transparent p-0 font-inherit text-start"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      markTaskRowSeen(task);
                                      setOpeningTaskId(task.id);
                                      startOpenTask(() => {
                                        router.push(
                                          poPropertyDetailPath(
                                            task.poNumber,
                                            property.id,
                                            "basic",
                                          ),
                                        );
                                      });
                                    }}
                                  >
                                    <InteractiveDeedCell
                                      label={row.deedLabel}
                                      loading={isTaskOpening(task.id)}
                                      labelClassName={INSPECTION_TABLE_TYPE.deed}
                                      trailing={
                                        resolveRowAttention(task) ? (
                                          <RowAttentionDot />
                                        ) : undefined
                                      }
                                    />
                                  </button>
                                ) : (
                                  <InteractiveDeedCell
                                    label={row.deedLabel}
                                    loading={isTaskOpening(task.id)}
                                    labelClassName={INSPECTION_TABLE_TYPE.deed}
                                    trailing={
                                      resolveRowAttention(task) ? (
                                        <RowAttentionDot />
                                      ) : undefined
                                    }
                                  />
                                )}
                              </span>
                            </Td>
                            <Td className={INSPECTION_TABLE_TYPE.body}>
                              <PoNumber
                                value={task.poNumber}
                                link
                                className={INSPECTION_TABLE_TYPE.po}
                              />
                            </Td>
                            <Td className={INSPECTION_TABLE_TYPE.body}>
                              {row.city}
                            </Td>
                            <Td className={INSPECTION_TABLE_TYPE.body}>
                              {row.district}
                            </Td>
                            <Td className={INSPECTION_TABLE_TYPE.body}>
                              {row.propertyType}
                            </Td>
                            <Td className={INSPECTION_TABLE_TYPE.body}>
                              {row.classification}
                            </Td>
                            <Td className={INSPECTION_TABLE_TYPE.body}>
                              {row.area}
                            </Td>
                            {showPartyColumns
                              ? parties.map((party) => (
                                  <Td
                                    key={party.trackId}
                                    className={cn(
                                      "w-[7.5rem] min-w-[7.5rem] overflow-hidden",
                                      INSPECTION_TABLE_TYPE.body,
                                    )}
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
                ) : isEngineeringSurveyTable ? (
                  <Table
                    className="w-full"
                    pending={queuePending}
                    wrapClassName="min-w-0 overflow-x-auto overflow-y-visible [-webkit-overflow-scrolling:touch]"
                  >
                    <THead>
                      <Tr hoverable={false}>
                        <Th>{PROPERTY_IDENTIFIER_COLUMN_LABEL}</Th>
                        <Th>المدينة / الحي</Th>
                        <Th>ضابط الاتصال</Th>
                        <Th>تاريخ الإسناد</Th>
                        <Th>{config.statusColumnLabel ?? "الحالة"}</Th>
                        <Th>المتبقي</Th>
                        <Th className="w-16 text-center">إجراءات</Th>
                      </Tr>
                    </THead>
                    <TBody>
                      {queuePending && listed.length === 0 ? (
                        <SkeletonTableRows rows={6} cols={7} />
                      ) : filteredListed.length === 0 ? (
                        <Tr hoverable={false}>
                          <Td
                            colSpan={7}
                            className="!py-11 text-center text-[13.5px] text-text-3"
                          >
                            لا توجد أوامر رفع مطابقة.
                          </Td>
                        </Tr>
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
                          const moreItems = resolveRowMoreItems(
                            task,
                            property?.id,
                          );
                          const contact =
                            property?.contacts?.find(
                              (c) =>
                                c.name.trim() ||
                                c.phone.trim() ||
                                c.role.trim(),
                            ) ?? null;
                          const contactName = contact?.name.trim() || "—";
                          const contactPhone = contact?.phone.trim() || "";
                          const contactRole = contact?.role.trim() || "";
                          const missingPhone = !contactPhone;
                          const cityDistrict = [row.city, row.district]
                            .filter((v) => v && v !== "—")
                            .join(" — ");
                          const assignedRaw =
                            task.createdAt ||
                            record?.receivedFromEnfathAt ||
                            "";
                          let assignedLabel = "—";
                          if (assignedRaw) {
                            const d = new Date(assignedRaw);
                            if (!Number.isNaN(d.getTime())) {
                              const y = d.getFullYear();
                              const m = String(d.getMonth() + 1).padStart(
                                2,
                                "0",
                              );
                              const day = String(d.getDate()).padStart(2, "0");
                              assignedLabel = `${y}/${m}/${day}`;
                            }
                          }
                          const badge = resolveTaskBadge(task);
                          const statusLabel = badge?.label ?? "—";
                          const statusClass = badge?.className ?? "b-new";
                          const propertyType =
                            property?.propertyType?.trim() ||
                            property?.classification?.trim() ||
                            "";
                          const remaining = formatEngSurveyRemaining(
                            row.remainingTime,
                          );
                          return (
                            <Tr
                              key={task.id}
                              hoverable={false}
                              className={cn(
                                "group/atq-row",
                                ROW,
                                active && ROW_ACTIVE,
                                missingPhone && "opacity-55",
                                isTaskOpening(task.id) &&
                                  "ui-queue-row-opening pointer-events-none",
                              )}
                              onClick={() => handleRowClick(task.id)}
                            >
                              <Td className="whitespace-nowrap">
                                <InteractiveDeedCell
                                  label={row.propertySlot}
                                  loading={isTaskOpening(task.id)}
                                  tone="gold"
                                  labelClassName="text-[13.5px] justify-end"
                                  trailing={
                                    resolveRowAttention(task) ? (
                                      <RowAttentionDot />
                                    ) : undefined
                                  }
                                  subtitle={
                                    propertyType ? (
                                      <span className="text-[11.5px] font-normal text-text-3 no-underline">
                                        {propertyType}
                                      </span>
                                    ) : null
                                  }
                                />
                              </Td>
                              <Td className="text-[13px] text-text-2">
                                {cityDistrict || "—"}
                              </Td>
                              <Td className="overflow-visible">
                                {contactName !== "—" ? (
                                  <HoverPortalCard
                                    align="start"
                                    triggerClassName="inline-flex"
                                    panelClassName="flex min-w-[220px] flex-col gap-1.5 rounded-[11px] border border-border-md bg-surface p-3 shadow-[0_12px_30px_-8px_rgba(18,40,70,.25)]"
                                    content={
                                      <>
                                        <span className="text-[12.5px] font-bold text-heading">
                                          {contactName}
                                        </span>
                                        {contactRole ? (
                                          <span className="inline-flex items-center gap-1.5 text-[12px] text-text-2">
                                            {contactRole}
                                          </span>
                                        ) : null}
                                        <span
                                          dir="ltr"
                                          className="inline-flex items-center justify-end gap-1.5 text-[12px] text-text-2"
                                        >
                                          {contactPhone ? (
                                            contactPhone
                                          ) : (
                                            <span className="font-bold text-[#a5432e]">
                                              لا يوجد رقم اتصال
                                            </span>
                                          )}
                                        </span>
                                      </>
                                    }
                                  >
                                    <span className="border-b border-dashed border-border-md pb-px text-[13px] font-semibold text-heading">
                                      {contactName}
                                    </span>
                                  </HoverPortalCard>
                                ) : (
                                  <span className="text-[13px] font-semibold text-heading">
                                    —
                                  </span>
                                )}
                              </Td>
                              <Td className="whitespace-nowrap text-[12.5px] text-text-2">
                                {/* Keep YYYY/MM/DD order without flipping cell start edge in RTL */}
                                <span dir="ltr" className="inline-block tabular-nums">
                                  {assignedLabel}
                                </span>
                              </Td>
                              <Td>
                                <div className="flex flex-col items-start gap-1">
                                  <StatusPill
                                    label={statusLabel}
                                    style={engSurveyStatusPillStyle(
                                      statusClass,
                                    )}
                                  />
                                  {missingPhone ? (
                                    <span className="whitespace-nowrap rounded-md border border-[color-mix(in_srgb,#d9694f_28%,transparent)] bg-[color-mix(in_srgb,#d9694f_10%,transparent)] px-[7px] py-0.5 text-[10.5px] font-bold text-[#a5432e]">
                                      بلا رقم اتصال
                                    </span>
                                  ) : null}
                                </div>
                              </Td>
                              <Td
                                className={cn(
                                  "text-[13px] font-semibold",
                                  remaining.overdue
                                    ? "text-[#d9694f]"
                                    : "text-heading",
                                )}
                              >
                                {missingPhone ? (
                                  <span className="inline-flex flex-col gap-px">
                                    <span className="text-text-3">معلّق</span>
                                    <span className="text-[10.5px] font-medium text-text-3">
                                      لا يُحتسب الوقت
                                    </span>
                                  </span>
                                ) : statusClass === "b-fail" ||
                                  statusClass === "b-returned" ? (
                                  <span className="inline-flex flex-col gap-px">
                                    <span className="text-text-3">متوقف</span>
                                    <span className="text-[10.5px] font-medium text-text-3">
                                      بانتظار معالجة التعذر
                                    </span>
                                  </span>
                                ) : (
                                  remaining.text
                                )}
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
                ) : isPropertyAppraisalTable ? (
                  <Table
                    className="w-full"
                    pending={queuePending}
                    wrapClassName="min-w-0 overflow-x-auto overflow-y-visible [-webkit-overflow-scrolling:touch]"
                  >
                    <THead>
                      <Tr hoverable={false}>
                        <Th>{PROPERTY_IDENTIFIER_COLUMN_LABEL}</Th>
                        <Th className="text-center">المدينة / الحي</Th>
                        <Th className="text-center">أمر العمل</Th>
                        <Th className="text-center">تاريخ الإسناد</Th>
                        <Th className="text-center">الأطراف</Th>
                        <Th className="text-center">
                          {config.statusColumnLabel ?? "الحالة"}
                        </Th>
                        <Th className="w-16 text-center">إجراءات</Th>
                      </Tr>
                    </THead>
                    <TBody>
                      {queuePending && listed.length === 0 ? (
                        <SkeletonTableRows rows={6} cols={7} />
                      ) : filteredListed.length === 0 ? (
                        <Tr hoverable={false}>
                          <Td
                            colSpan={7}
                            className="!py-11 text-center text-[13.5px] text-text-3"
                          >
                            لا توجد مهام تقييم مطابقة.
                          </Td>
                        </Tr>
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
                          const moreItems = resolveRowMoreItems(
                            task,
                            property?.id,
                          );
                          const cityDistrict = [row.city, row.district]
                            .filter((v) => v && v !== "—")
                            .join(" — ");
                          const assignedRaw =
                            task.createdAt ||
                            record?.receivedFromEnfathAt ||
                            "";
                          let assignedLabel = "—";
                          if (assignedRaw) {
                            const d = new Date(assignedRaw);
                            if (!Number.isNaN(d.getTime())) {
                              const y = d.getFullYear();
                              const m = String(d.getMonth() + 1).padStart(
                                2,
                                "0",
                              );
                              const day = String(d.getDate()).padStart(2, "0");
                              assignedLabel = `${y}/${m}/${day}`;
                            }
                          }
                          const badge = appraiserQueueStatusBadge(
                            task,
                            tasks ?? [],
                          );
                          const inspected = appraiserInspectionDone(
                            task,
                            tasks ?? [],
                          );
                          const needsSurvey = appraiserNeedsSurvey(
                            task,
                            tasks ?? [],
                          );
                          const surveyed = appraiserSurveyDone(
                            task,
                            tasks ?? [],
                          );
                          const propertyType =
                            property?.propertyType?.trim() ||
                            property?.classification?.trim() ||
                            "";
                          const deps: {
                            name: string;
                            role: string;
                            ok: boolean;
                            letter: string;
                            ink: boolean;
                          }[] = [
                            {
                              name: "المعاين",
                              role: "المعاينة الميدانية",
                              ok: inspected,
                              letter: "م",
                              ink: true,
                            },
                          ];
                          if (needsSurvey) {
                            deps.push({
                              name: "المكتب الهندسي",
                              role: "الرفع المساحي",
                              ok: surveyed,
                              letter: "هـ",
                              ink: false,
                            });
                          }
                          return (
                            <Tr
                              key={task.id}
                              hoverable={false}
                              className={cn(
                                "group/atq-row",
                                ROW,
                                active && ROW_ACTIVE,
                                !inspected && "opacity-55",
                                isTaskOpening(task.id) &&
                                  "ui-queue-row-opening pointer-events-none",
                              )}
                              onClick={() => handleRowClick(task.id)}
                            >
                              <Td className="whitespace-nowrap">
                                {property?.id ? (
                                  <button
                                    type="button"
                                    className="relative z-[1] inline-flex max-w-full cursor-pointer border-0 bg-transparent p-0 font-inherit text-start"
                                    aria-label={`تفاصيل العقار ${row.propertySlot}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openPropertyDetailFromQueue(
                                        task,
                                        property.id,
                                      );
                                    }}
                                  >
                                    <InteractiveDeedCell
                                      label={row.propertySlot}
                                      loading={isTaskOpening(task.id)}
                                      tone="gold"
                                      labelClassName="text-[13.5px] justify-end"
                                      trailing={
                                        resolveRowAttention(task) ? (
                                          <RowAttentionDot />
                                        ) : undefined
                                      }
                                      subtitle={
                                        propertyType ? (
                                          <span className="text-[11.5px] font-normal text-text-3 no-underline">
                                            {propertyType}
                                          </span>
                                        ) : null
                                      }
                                    />
                                  </button>
                                ) : (
                                  <InteractiveDeedCell
                                    label={row.propertySlot}
                                    loading={isTaskOpening(task.id)}
                                    tone="gold"
                                    labelClassName="text-[13.5px] justify-end"
                                    trailing={
                                      resolveRowAttention(task) ? (
                                        <RowAttentionDot />
                                      ) : undefined
                                    }
                                    subtitle={
                                      propertyType ? (
                                        <span className="text-[11.5px] font-normal text-text-3 no-underline">
                                          {propertyType}
                                        </span>
                                      ) : null
                                    }
                                  />
                                )}
                              </Td>
                              <Td className="text-center text-[13px] text-text-2">
                                {cityDistrict || "—"}
                              </Td>
                              <Td
                                dir="ltr"
                                className="text-center text-[12px] text-text-2"
                              >
                                <PoNumber value={task.poNumber} link />
                              </Td>
                              <Td className="whitespace-nowrap text-center text-[12.5px] text-text-2">
                                <span dir="ltr" className="inline-block tabular-nums">
                                  {assignedLabel}
                                </span>
                              </Td>
                              <Td className="overflow-visible text-center">
                                <HoverPortalCard
                                  align="start"
                                  triggerClassName="inline-flex"
                                  panelClassName="flex min-w-[240px] flex-col gap-1 rounded-[11px] border border-border-md bg-surface p-2.5 shadow-[0_12px_30px_-8px_rgba(18,40,70,.25)]"
                                  content={
                                    <>
                                      <span className="mb-1 px-1 text-[11px] font-bold text-text-3">
                                        أطراف المعاملة ({deps.length})
                                      </span>
                                      {deps.map((dep) => (
                                        <div
                                          key={dep.role}
                                          className={cn(
                                            "flex items-center gap-2 rounded-md px-1 py-1",
                                            !dep.ok && "opacity-50",
                                          )}
                                        >
                                          <span
                                            className="grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white"
                                            style={{
                                              background: dep.ink
                                                ? "var(--ink, #102B4E)"
                                                : "var(--gold-d, #8c7857)",
                                            }}
                                          >
                                            {dep.letter}
                                          </span>
                                          <span className="inline-flex min-w-0 flex-col">
                                            <span className="text-[12.5px] font-semibold text-heading">
                                              {dep.name}
                                            </span>
                                            <span className="whitespace-nowrap text-[10.5px] text-text-3">
                                              {dep.role}
                                            </span>
                                          </span>
                                          <span className="ms-auto">
                                            {dep.ok ? (
                                              <svg
                                                width="14"
                                                height="14"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="#2f7a4d"
                                                strokeWidth="2.4"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                aria-hidden
                                              >
                                                <path d="m5 13 4 4L19 7" />
                                              </svg>
                                            ) : (
                                              <svg
                                                width="14"
                                                height="14"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="#9aa0ab"
                                                strokeWidth="1.8"
                                                strokeLinecap="round"
                                                aria-hidden
                                              >
                                                <circle
                                                  cx="12"
                                                  cy="12"
                                                  r="9"
                                                />
                                                <path d="M12 7v5l3 2" />
                                              </svg>
                                            )}
                                          </span>
                                        </div>
                                      ))}
                                    </>
                                  }
                                >
                                  <span className="team inline-flex items-center">
                                    {deps.map((dep, i) => (
                                      <span
                                        key={dep.role}
                                        className="grid size-7 place-items-center rounded-full border-2 border-surface text-[11px] font-bold text-white"
                                        style={{
                                          background: dep.ink
                                            ? "var(--ink, #102B4E)"
                                            : "var(--gold-d, #8c7857)",
                                          marginInlineStart: i === 0 ? 0 : -8,
                                          opacity: dep.ok ? 1 : 0.35,
                                        }}
                                      >
                                        {dep.letter}
                                      </span>
                                    ))}
                                  </span>
                                </HoverPortalCard>
                              </Td>
                              <Td className="text-center">
                                <StatusPill
                                  label={badge.label}
                                  style={engSurveyStatusPillStyle(
                                    badge.className,
                                  )}
                                />
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
                ) : (
                  <Table className="w-full" pending={queuePending}>
                    <THead>
                      <Tr hoverable={false}>
                        <Th>{PROPERTY_IDENTIFIER_COLUMN_LABEL}</Th>
                        <Th>أمر العمل</Th>
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
                        const isStudyLabel = row.propertySlot.startsWith(
                          "قيد الدراسة",
                        );
                        return (
                          <Tr
                            key={task.id}
                            hoverable={false}
                            className={cn(
                              "group/atq-row",
                              ROW,
                              active && ROW_ACTIVE,
                              isTaskOpening(task.id) &&
                                "ui-queue-row-opening pointer-events-none",
                            )}
                            onClick={() => handleRowClick(task.id)}
                          >
                            <Td className="whitespace-nowrap">
                              <InteractiveDeedCell
                                label={row.propertySlot}
                                loading={isTaskOpening(task.id)}
                                tone={isStudyLabel ? "gold" : "primary"}
                                rtl={isStudyLabel}
                              />
                            </Td>
                            <Td className="text-text-2">
                              <PoNumber
                                value={task.poNumber}
                                link
                                className="!text-[12.5px] !font-semibold text-text-2"
                              />
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
                  "hidden lg:block",
                  (config.pageId === "all-transactions" ||
                    config.pageId === "active-primary-data" ||
                    isPartyQueueToggleTable) &&
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
