"use client";

import type { MutableRefObject, ReactNode } from "react";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import "./active-queue-group-by-po.css";
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
} from "@platform/design-system";
import { PoNumber } from "@case-study/mfe/components/ui/PoNumber";
import { RemainingTimeCell } from "@case-study/mfe/components/ui/RemainingTimeCell";
import { RowMoreMenu } from "@case-study/mfe/components/ui/RowMoreMenu";
import type { RowMoreMenuItem } from "@case-study/mfe/components/ui/RowMoreMenu";
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
  findPropertyForTask,
  type RemainingTimeState,
} from "../lib/prototype/my-task-row";
import type { PoIntakeRecord } from "../lib/prototype/po-intake-data";
import { skipsBourseForIdentifier } from "../lib/prototype/po-intake-data";
import { isListedQueueTask } from "../lib/prototype/suspended-transactions-storage";
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
import { loadEvaluatorSubmission } from "@evaluator/mfe/lib/evaluator/evaluator-submission-storage";
import { ActiveTransactionPageLayout } from "../components/active-transactions/ActiveTransactionPageLayout";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";

const APPRAISAL_STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "new", label: "جديدة" },
  { value: "wait_inspection", label: "بانتظار المعاينة" },
  { value: "wait_survey", label: "بانتظار الرفع المساحي" },
  { value: "ready", label: "جاهزة للتقييم" },
  { value: "submitted", label: "مُرسَلة للأخصائي" },
  { value: "closed", label: "مكتملة على النظام" },
  { value: "reopened", label: "مُعادة للتعديل" },
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
      const compare =
        config.queueSort === "oldest-first"
          ? compareQueueTasksOldestFirst
          : compareQueueTasksNewestFirst;
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
  const isAllTransactionsTable = config.tableLayout === "all-transactions";
  const isEngineeringSurveyTable = config.tableLayout === "engineering-survey";
  const isPropertyAppraisalTable = config.tableLayout === "property-appraisal";
  const isPartyQueueToggleTable =
    isEngineeringSurveyTable || isPropertyAppraisalTable;
  const showPartyColumns = config.tableLayout === "case-study";
  const distributionSkeletonCols = 8 + (showPartyColumns ? 4 : 0);
  const primarySkeletonCols = 6;
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

  const queueToolbar = queueReady ? (
    <PageToolbar className="shrink-0 flex-wrap items-center justify-between gap-2.5 border-b border-border bg-surface-2">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2.5">
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
              "inline-flex items-center gap-1.5 rounded-lg border px-[13px] py-2 text-[12.5px] font-bold transition-colors",
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
        {isAllTransactionsTable ? (
          <button
            type="button"
            onClick={toggleGroupByPo}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-[13px] py-2 text-[12.5px] font-bold transition-colors",
              groupByPo
                ? "border-ink bg-ink text-white"
                : "border-border-md bg-surface text-text-2 hover:bg-surface-2",
            )}
            aria-pressed={groupByPo}
          >
            <span
              className={cn(
                "atq-group-ico",
                groupByPo && "is-on",
                groupGatherAnim && "is-gathering",
              )}
              aria-hidden
            >
              <svg
                className="ico-grid"
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
                className="ico-stack"
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
        {isPartyQueueToggleTable ? (
          <span className="ms-auto shrink-0 rounded-full bg-gold-soft px-3 py-[5px] text-[12px] font-bold text-gold-d">
            {queueReady
              ? isPropertyAppraisalTable
                ? `${filteredListed.length} عقار`
                : `${filteredListed.length} صك`
              : "—"}
          </span>
        ) : null}
      </div>
      {!isPartyQueueToggleTable ? (
        <span className="shrink-0 text-[12.5px] font-semibold text-text-3">
          {queueReady ? `${filteredListed.length} نتيجة` : "—"}
        </span>
      ) : null}
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
            isPartyQueueToggleTable && "overflow-visible",
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
              <div
                className={cn(
                  queueTableWrapClassName,
                  (isDistributionTable || isAllTransactionsTable) &&
                    "overflow-x-auto",
                )}
              >
                {isAllTransactionsTable ? (
                  <Table className="w-full min-w-[720px]" pending={queuePending}>
                    <THead>
                      <Tr hoverable={false}>
                        <Th>رقم الصك</Th>
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
                                className="atq-po-group-row cursor-pointer bg-surface-2"
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
                                          ROW,
                                          active && ROW_ACTIVE,
                                        )}
                                        onClick={() =>
                                          handleRowClick(meta.task.id)
                                        }
                                      >
                                        <Td className="whitespace-nowrap">
                                          <span
                                            dir="ltr"
                                            className="inline-block text-[12.5px] font-bold text-primary"
                                          >
                                            {meta.deedCell}
                                          </span>
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
                              className={cn(ROW, active && ROW_ACTIVE)}
                              onClick={() => handleRowClick(meta.task.id)}
                            >
                              <Td className="whitespace-nowrap">
                                <span
                                  dir="ltr"
                                  className="inline-block text-[12.5px] font-bold text-primary"
                                >
                                  {meta.deedCell}
                                </span>
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
                ) : isEngineeringSurveyTable ? (
                  <Table
                    className="w-full"
                    pending={queuePending}
                    wrapClassName="min-w-0 overflow-x-auto overflow-y-visible [-webkit-overflow-scrolling:touch]"
                  >
                    <THead>
                      <Tr hoverable={false}>
                        <Th>الصك</Th>
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
                          const isNewFresh =
                            statusClass === "b-new" && !missingPhone;
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
                                ROW,
                                active && ROW_ACTIVE,
                                missingPhone && "opacity-55",
                              )}
                              onClick={() => handleRowClick(task.id)}
                            >
                              <Td className="whitespace-nowrap">
                                <span className="inline-flex flex-col gap-0.5">
                                  <span
                                    dir="ltr"
                                    className="inline-flex items-center justify-end gap-1.5 text-end text-[13.5px] font-bold text-gold-d"
                                  >
                                    {row.propertySlot}
                                    {isNewFresh ? (
                                      <span
                                        className="ui-status-dot-live size-2 shrink-0 rounded-full bg-[#2f7de1]"
                                        aria-hidden
                                      />
                                    ) : null}
                                  </span>
                                  {propertyType ? (
                                    <span className="text-[11.5px] text-text-3">
                                      {propertyType}
                                    </span>
                                  ) : null}
                                </span>
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
                              <Td
                                dir="ltr"
                                className="text-[12.5px] text-text-2"
                              >
                                {assignedLabel}
                              </Td>
                              <Td>
                                <div className="flex flex-col items-start gap-1">
                                  <StatusPill
                                    label={statusLabel}
                                    style={engSurveyStatusPillStyle(
                                      statusClass,
                                    )}
                                  />
                                  {isNewFresh ? (
                                    <span className="text-[10px] font-bold tracking-wide text-[#8a5e14]">
                                      لم يُتخذ إجراء بعد
                                    </span>
                                  ) : null}
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
                        <Th>الصك</Th>
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
                          const sub = loadEvaluatorSubmission(task.id);
                          const isFreshDraft =
                            (!sub || sub.status === "draft") &&
                            !sub?.reportFileName &&
                            !sub?.landValue?.trim();
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
                                ROW,
                                active && ROW_ACTIVE,
                                !inspected && "opacity-55",
                              )}
                              onClick={() => handleRowClick(task.id)}
                            >
                              <Td className="whitespace-nowrap">
                                <span className="inline-flex flex-col gap-0.5">
                                  <span
                                    dir="ltr"
                                    className="inline-flex items-center justify-end gap-1.5 text-end text-[13.5px] font-bold text-gold-d"
                                  >
                                    {row.propertySlot}
                                    {isFreshDraft ? (
                                      <span
                                        className="ui-status-dot-live size-2 shrink-0 rounded-full bg-[#2f7de1]"
                                        title="معاملة جديدة — لم يُتخذ عليها إجراء"
                                        aria-hidden
                                      />
                                    ) : null}
                                  </span>
                                  {propertyType ? (
                                    <span className="text-[11.5px] text-text-3">
                                      {propertyType}
                                    </span>
                                  ) : null}
                                </span>
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
                              <Td
                                dir="ltr"
                                className="text-center text-[12.5px] text-text-2"
                              >
                                {assignedLabel}
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
