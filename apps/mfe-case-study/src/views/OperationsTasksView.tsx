"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  KpiBand,
  KpiCell,
  MobileKpiStatCards,
  Note,
  OperationalPanel,
  OperationalToolbarPrimaryButton,
  OperationalToolbarSearch,
  OperationalToolbarSelect,
  PageShell,
  PanelSkeleton,
  StatusPill,
  cn,
  useToast,
  Spinner,
} from "@platform/ui-kit";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import type { StaffUser } from "@platform/app-shared/prototype/constants";
import { displayPersonName } from "@platform/app-shared/prototype/person-display-name";
import {
  useStaffUsersQuery,
  useDistributionAssigneesQuery,
} from "@settings/mfe/query/settings-queries";
import { usePoRecordsQuery } from "../query/case-study-queries";
import { useOperationsTasksQuery } from "../query/operations-tasks-queries";
import {
  addOperationsTaskCommentRecord,
  isActiveOperationsTask,
  isTerminalOperationsTask,
  patchOperationsTaskRecord,
  reassignOperationsTaskRecord,
  remindOperationsTaskRecord,
  type OperationsTask,
} from "../lib/prototype/operations-tasks-storage";
import {
  OPERATIONS_TASK_PRIORITY_COLORS,
  OPERATIONS_TASK_REMIND_LABELS,
  OPERATIONS_TASK_SCOPE_LABELS,
  OPERATIONS_TASK_STATUS_COLORS,
  OPERATIONS_TASK_STATUS_LABELS,
  formatTaskDueLabel,
  isTerminalOperationsTaskStatus,
  operationsTaskLinkLabel,
  operationsTaskPriorityLabel,
  operationsTaskReceiptLabel,
  operationsTaskScopeLabel,
  operationsTaskStatusLabel,
  operationsTaskTypeLabel,
  printOperationsTaskDelegationLetter,
  taskCountdown,
} from "../lib/prototype/operations-task-display";
import { resolveSlaTimerRatio } from "../lib/prototype/my-task-row";
import { useTickingMinute } from "@platform/app-shared/hooks/use-ticking-now";
import {
  canManageOperationsTasks,
  canRemindOperationsTasks,
  operationsTasksUseAssigneeScope,
} from "../lib/prototype/operations-task-roles";
import { failureTargetsForOperationsTask } from "../lib/prototype/operations-task-failure-targets";
import type { OperationsTaskFailureTarget } from "../lib/prototype/operations-task-failure-targets";
import {
  isOperationsTaskBlockedByFailure,
  isOpsTaskFailurePauseReason,
  OPS_TASK_FAILURE_PAUSE_REASON,
} from "../lib/prototype/operations-task-failure-obstruction";
import { GOVERNMENT_REVIEWER_FAILURE_RAISER } from "@failures/mfe/lib/failure-party-roles";
import { useFailuresQuery } from "@failures/mfe/query/failures-queries";
import { FailureRaiseModal } from "../components/failures/FailureRaiseModal";
import { agentInfoFromStaff } from "../lib/prototype/internal-delegation-letters";
import { partyAccountForRole, partyAccountForViewer } from "../lib/prototype/distribution-parties";
import { AppModal } from "../components/ui/AppModal";
import { RowMoreMenu, RowMoreMenuIcons, type RowMoreMenuItem } from "../components/ui/RowMoreMenu";
import {
  ActiveQueueMobileCards,
  type ActiveQueueMobileCardItem,
} from "../components/queue/ActiveQueueMobileCards";
import dynamic from "next/dynamic";
import type { CreateOperationsTaskPrefill } from "../components/CreateOperationsTaskModal";

// المودال ٩٣٤ سطراً ويُعرض عند الطلب فقط — لا يركب في حزمة الشاشة (bundle-dynamic-imports).
const CreateOperationsTaskModal = dynamic(
  () =>
    import("../components/CreateOperationsTaskModal").then(
      (m) => m.CreateOperationsTaskModal,
    ),
  { ssr: false },
);
// تحميل مسبق عند التحويم على زر الإنشاء — يختفي زمن جلب الحزمة (bundle-preload).
const preloadCreateOperationsTaskModal = () =>
  void import("../components/CreateOperationsTaskModal");
import {
  TASKS_LIST_COLS,
  TASKS_LIST_FOOTER,
  TasksEmptyRows,
  TasksKpiActiveIcon,
  TasksKpiCompletedIcon,
  TasksKpiCreatedIcon,
  TasksKpiInProgressIcon,
  TasksSectionNote,
  TasksShowAllEye,
  tasksDescClassName,
} from "../components/tasks/TasksHtmlPrimitives";
import { ReassignOperationsTaskModal } from "../components/tasks/ReassignOperationsTaskModal";
import {
  opsAttachBtn,
  opsBulk,
  opsBulkClear,
  opsBtnGhost,
  opsBtnPrimary,
  opsCdDot,
  opsCdTip,
  opsCdWrap,
  opsCmt,
  opsCmtAv,
  opsCmtBar,
  opsCmtBody,
  opsCmtComposer,
  opsCmtFiles,
  opsCmtH,
  opsCmtName,
  opsCmtRole,
  opsCmtText,
  opsCmtTextarea,
  opsCmtThread,
  opsCmtTime,
  opsCmtEvent,
  opsDueCd,
  opsDueCdOver,
  opsDotSep,
  opsFileSize,
  opsBulkCount,
  opsListCount,
  opsLetterRow,
  opsTypeIconSm,
  opsRowTitle,
  opsRowMeta,
  opsEmptyHint,
  opsEventAv,
  opsFileChip,
  opsFileChipFx,
  opsFilters,
  opsGridRow,
  opsHeadRow,
  opsIconBoxGold,
  opsLetterBodyPad,
  opsLetterCard,
  opsLetterHead,
  opsLetterMeta,
  opsLetterSub,
  opsLetterTitle,
  opsMutedHint,
  opsPpBadge,
  opsPpCell,
  opsPpCellK,
  opsPpCellV,
  opsPpHead,
  opsPpMeta,
  opsPpSummary,
  opsPpTitle,
  opsReceiptConfirmBtn,
  opsReceiptConfirmWrap,
  opsRemindBtn,
  opsRemindCard,
  opsRemindMini,
  opsShowAllBtn,
  opsShowAllBtnOn,
  opsStep,
  opsStepDot,
  opsStepDotActive,
  opsStepDotCancel,
  opsStepDotDone,
  opsStepDotIdle,
  opsStepFlow,
  opsStepLbl,
  opsStepLblOn,
  opsStepLine,
  opsStepLineOn,
  opsTd,
  opsTdC,
  opsTh,
  opsThStart,
  opsThead,
  opsTkCheck,
  opsTkCheckInput,
  opsToolbar,
  opsTfActions,
  opsTfChip,
  opsTfLbl,
  opsTfSeg,
  opsTfSegActive,
  opsTfSegRow,
} from "../lib/prototype/ops-tasks-tw";
import {
  PRIORITY_OFFSET_MS,
  DraftFile,
  uploadDraftFiles,
  TypeIcon,
  BellIcon,
  CourtVisitKind,
  CourtVisitContactDraft,
  CloseTaskModalBody,
  PauseModalBody,
  PriorityModalBody,
  PlusIcon,
  toLocalDateValue,
  toLocalTimeValue,
  assigneesForType,
  assigneeRoleLabel,
  TaskStatusPill,
  DueCell,
  TaskStepper,
  TickingRemindCountdown,
  CommentThread,
  LetterTable,
} from "./OperationsTasksViewParts";

export function OperationsTasksView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const deepLinkTaskId = searchParams.get("task")?.trim() || null;
  const createFlag = searchParams.get("create");
  const prefillPo = searchParams.get("po")?.trim() || undefined;
  const prefillType = searchParams.get("type")?.trim() || undefined;
  const prefillScope = searchParams.get("scope")?.trim() || undefined;
  const prefillDeed = searchParams.get("deed")?.trim() || undefined;
  const { showToast } = useToast();

  const { role, viewerEmail, viewerDisplayName } = usePrototype();
  const { data: staffResult, isPending: staffPending } = useStaffUsersQuery();
  const { data: distResult, isPending: distPending } =
    useDistributionAssigneesQuery();
  const staffUsers = useMemo(() => {
    const byId = new Map<string, StaffUser>();
    for (const u of staffResult?.users ?? []) byId.set(u.id, u);
    for (const u of distResult?.users ?? []) {
      if (!byId.has(u.id)) byId.set(u.id, u);
    }
    return [...byId.values()];
  }, [staffResult?.users, distResult?.users]);
  const staffLoadError =
    staffResult?.loadError ?? distResult?.loadError ?? null;
  const staffLoading = staffPending || distPending;
  const { data: poRecords = [] } = usePoRecordsQuery();

  const canCreate = canManageOperationsTasks(role);
  const canRemind = canRemindOperationsTasks(role);
  const useIndependentQueue = operationsTasksUseAssigneeScope(role);

  /** Viewer account for executor queues (assignee-scoped), fallback to role prototype seed. */
  const partyAccount = useMemo(
    () =>
      partyAccountForViewer(role, viewerEmail, staffUsers) ??
      partyAccountForRole(role, staffUsers),
    [role, viewerEmail, staffUsers],
  );

  /** Keep local name used by court/credit UI that expects government-reviewer account. */
  const reviewerAccount = partyAccount;

  const assigneeScopeId = useIndependentQueue
    ? partyAccount?.assigneeId?.trim() || undefined
    : undefined;

  const { data: tasks = [], isFetched, refetch, isFetching } = useOperationsTasksQuery({
    live: true,
    assigneeId: assigneeScopeId,
  });
  const { data: failures = [] } = useFailuresQuery();
  const failureResumeBusyRef = useRef(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [scopeFilter, setScopeFilter] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(deepLinkTaskId);
  const [detailId, setDetailId] = useState<string | null>(deepLinkTaskId);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [createPrefill, setCreatePrefill] = useState<CreateOperationsTaskPrefill | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [commentFiles, setCommentFiles] = useState<DraftFile[]>([]);
  const [closeText, setCloseText] = useState("");
  const [closeFiles, setCloseFiles] = useState<DraftFile[]>([]);
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeFormError, setCloseFormError] = useState<string | null>(null);
  const [closeOutcome, setCloseOutcome] = useState<"completed" | "cancelled">(
    "completed",
  );
  const [cancelReason, setCancelReason] = useState("");
  const [courtKind, setCourtKind] = useState<CourtVisitKind>("");
  const [courtOtherText, setCourtOtherText] = useState("");
  const [courtStatement, setCourtStatement] = useState("");
  const [courtPerDeed, setCourtPerDeed] = useState<Record<string, string>>({});
  const [courtContacts, setCourtContacts] = useState<CourtVisitContactDraft[]>([]);
  const [creditAssigneeId, setCreditAssigneeId] = useState("");
  const [creditAssigneeName, setCreditAssigneeName] = useState("");
  const [pauseOpen, setPauseOpen] = useState(false);
  const [pauseTaskId, setPauseTaskId] = useState<string | null>(null);
  const [pauseReason, setPauseReason] = useState("");
  const [pauseError, setPauseError] = useState<string | null>(null);
  const [prioOpen, setPrioOpen] = useState(false);
  const [prioValue, setPrioValue] = useState("medium");
  const [prioEditDue, setPrioEditDue] = useState(false);
  const [prioDueDate, setPrioDueDate] = useState("");
  const [prioDueTime, setPrioDueTime] = useState("12:00");
  const [reassignOpen, setReassignOpen] = useState(false);
  const [reassignAssigneeId, setReassignAssigneeId] = useState("");
  const [reassignAssigneeName, setReassignAssigneeName] = useState("");
  const [reassignDueDate, setReassignDueDate] = useState("");
  const [reassignDueTime, setReassignDueTime] = useState("12:00");
  const [reassignReason, setReassignReason] = useState("");
  const [reassignError, setReassignError] = useState<string | null>(null);
  const [govFailureTarget, setGovFailureTarget] =
    useState<OperationsTaskFailureTarget | null>(null);
  // دقّة الدقيقة تكفي لمنطق الشاشة — العدّادات الثانوية (DueCell وبطاقات الجوال)
  // تشترك بالساعة بنفسها، فلا يعاد بناء كل الصفوف كل ثانية (rerender-defer-reads).
  const now = useTickingMinute();
  const commentFileInputRef = useRef<HTMLInputElement>(null);
  const closeFileInputRef = useRef<HTMLInputElement>(null);
  const selAllRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!deepLinkTaskId) return;
    setSelectedId(deepLinkTaskId);
    setDetailId(deepLinkTaskId);
    setShowAll(true);
  }, [deepLinkTaskId]);

  useEffect(() => {
    if (!canCreate) return;
    if (createFlag !== "1" && createFlag !== "true") return;
    setCreatePrefill({
      type: prefillType || "general",
      scope:
        prefillScope ||
        (prefillType === "court_visit" ? "work_order" : prefillPo ? "transaction" : "work_order"),
      poNumber: prefillPo,
      deed: prefillDeed,
    });
    setCreateOpen(true);
  }, [canCreate, createFlag, prefillPo, prefillType, prefillScope, prefillDeed]);

  const queueTasks = useMemo(() => {
    if (!useIndependentQueue) return tasks;
    // Hide while a linked failure is open, or while parked for failure pause
    // (until auto-resume / staff clears the obstruction).
    return tasks.filter((t) => {
      if (
        t.status === "paused" &&
        isOpsTaskFailurePauseReason(t.pauseReason)
      ) {
        return false;
      }
      return !isOperationsTaskBlockedByFailure(t, failures, poRecords);
    });
  }, [tasks, useIndependentQueue, failures, poRecords]);

  const kpis = useMemo(() => {
    const created = queueTasks.filter((t) => t.status === "created").length;
    const inProgress = queueTasks.filter(
      (t) => t.status === "in_progress",
    ).length;
    const paused = queueTasks.filter((t) => t.status === "paused").length;
    const completed = queueTasks.filter((t) => t.status === "completed").length;
    return {
      active: created + inProgress,
      created,
      paused,
      inProgress,
      completed,
    };
  }, [queueTasks]);

  const visibleTasks = useMemo(() => {
    const q = search.trim();
    const list = queueTasks.filter((t) => {
      const hay = `${t.title} ${t.assigneeName} ${t.displayId} ${t.poNumber ?? ""} ${t.deeds.join(" ")}`;
      const okQ = !q || hay.includes(q);
      const okS = !statusFilter || t.status === statusFilter;
      const okC = !scopeFilter || t.scope === scopeFilter;
      const okShow = showAll || Boolean(statusFilter) || isActiveOperationsTask(t);
      return okQ && okS && okC && okShow;
    });
    return [...list].sort((a, b) => {
      const rank = (s: string) =>
        s === "paused" ? 1 : isTerminalOperationsTaskStatus(s) ? 2 : 0;
      const ra = rank(a.status);
      const rb = rank(b.status);
      if (ra !== rb) return ra - rb;
      // newest first within the same status band
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [queueTasks, search, statusFilter, scopeFilter, showAll]);

  // When staff resolves a blocking failure, reopen paused-for-failure tasks as
  // «منشأة» so the assignee confirms receipt again (fresh start, not mid-work).
  useEffect(() => {
    if (failureResumeBusyRef.current) return;
    const toReopen = tasks.filter(
      (t) =>
        t.status === "paused" &&
        isOpsTaskFailurePauseReason(t.pauseReason) &&
        !isOperationsTaskBlockedByFailure(t, failures, poRecords),
    );
    if (toReopen.length === 0) return;

    failureResumeBusyRef.current = true;
    void (async () => {
      try {
        for (const task of toReopen) {
          await patchOperationsTaskRecord(task.id, { status: "created" });
        }
        await refetch();
      } finally {
        failureResumeBusyRef.current = false;
      }
    })();
  }, [tasks, failures, poRecords, refetch]);

  const detail = useMemo(
    () => (detailId ? tasks.find((t) => t.id === detailId) ?? null : null),
    [tasks, detailId],
  );

  // Deep-link / stale detail must not keep assignee on a failure-blocked task.
  useEffect(() => {
    if (!useIndependentQueue || !detail) return;
    const parkedForFailure =
      detail.status === "paused" &&
      isOpsTaskFailurePauseReason(detail.pauseReason);
    const blocked = isOperationsTaskBlockedByFailure(
      detail,
      failures,
      poRecords,
    );
    if (!parkedForFailure && !blocked) return;
    setDetailId(null);
    setSelectedId(null);
  }, [useIndependentQueue, detail, failures, poRecords]);

  const reviewerStaff = useMemo(() => {
    const id = reviewerAccount?.assigneeId?.trim();
    if (!id) return null;
    return staffUsers.find((u) => u.distributionAssigneeId?.trim() === id) ?? null;
  }, [reviewerAccount, staffUsers]);

  const selectedCount = useMemo(
    () => Object.values(selectedIds).filter(Boolean).length,
    [selectedIds],
  );

  const allVisibleActiveChecked = useMemo(() => {
    const active = visibleTasks.filter(isActiveOperationsTask);
    if (active.length === 0) return false;
    return active.every((t) => selectedIds[t.id]);
  }, [visibleTasks, selectedIds]);

  const activeVisible = useMemo(
    () => visibleTasks.filter(isActiveOperationsTask),
    [visibleTasks],
  );
  const selectedActiveCount = useMemo(
    () => activeVisible.filter((t) => selectedIds[t.id]).length,
    [activeVisible, selectedIds],
  );

  useEffect(() => {
    if (!selAllRef.current) return;
    selAllRef.current.indeterminate =
      selectedActiveCount > 0 && selectedActiveCount < activeVisible.length;
  }, [selectedActiveCount, activeVisible.length]);

  const openPriorityModal = useCallback((task: OperationsTask) => {
    setSelectedId(task.id);
    setDetailId(task.id);
    setPrioValue(task.priority);
    setPrioEditDue(false);
    const due = task.dueAt ? new Date(task.dueAt) : null;
    if (due && !Number.isNaN(due.getTime())) {
      setPrioDueDate(toLocalDateValue(due));
      setPrioDueTime(toLocalTimeValue(due));
    } else {
      setPrioDueDate("");
      setPrioDueTime("12:00");
    }
    setPrioOpen(true);
  }, []);

  const openCloseModal = useCallback((task: OperationsTask) => {
    setSelectedId(task.id);
    setDetailId(task.id);
    setCloseText("");
    setCloseFiles([]);
    setCloseFormError(null);
    setCancelReason("");
    setCloseOutcome(
      canCreate && task.status === "created" ? "cancelled" : "completed",
    );
    setCourtKind("");
    setCourtOtherText("");
    setCourtStatement("");
    setCourtPerDeed({});
    setCourtContacts([]);
    const defaultCreditId = task.originalAssigneeId?.trim() || task.assigneeId || "";
    const defaultCreditName =
      task.originalAssigneeName?.trim() || task.assigneeName || "";
    setCreditAssigneeId(defaultCreditId);
    setCreditAssigneeName(defaultCreditName);
    setCloseOpen(true);
  }, [canCreate]);

  const openPauseModal = useCallback((task: OperationsTask) => {
    setPauseTaskId(task.id);
    setPauseReason("");
    setPauseError(null);
    setPauseOpen(true);
  }, []);

  const applyPrioDueFromOffset = useCallback(() => {
    const ms = PRIORITY_OFFSET_MS[prioValue] ?? PRIORITY_OFFSET_MS.medium;
    const due = new Date(Date.now() + ms!);
    setPrioDueDate(toLocalDateValue(due));
    setPrioDueTime(toLocalTimeValue(due));
  }, [prioValue]);

  const runPatch = useCallback(
    async (id: string, body: Parameters<typeof patchOperationsTaskRecord>[1]) => {
      setBusy(true);
      setError(null);
      const patch = await patchOperationsTaskRecord(id, body);
      if (!patch.ok) {
        setError(patch.error);
        setBusy(false);
        return false;
      }
      await refetch();
      setBusy(false);
      return true;
    },
    [refetch],
  );

  const confirmPauseTask = useCallback(async () => {
    if (!pauseTaskId) return;
    const reason = pauseReason.trim();
    if (!reason) {
      setPauseError("سبب الإيقاف المؤقت مطلوب");
      return;
    }
    setPauseError(null);
    const ok = await runPatch(pauseTaskId, {
      status: "paused",
      pauseReason: reason,
    });
    if (ok) {
      setPauseOpen(false);
      setPauseTaskId(null);
      setPauseReason("");
      showToast("تم إيقاف المهمة مؤقتاً", "info");
    }
  }, [pauseTaskId, pauseReason, runPatch, showToast]);

  const runStatus = useCallback(
    async (
      id: string,
      status: string,
      closeComment?: string,
      files?: DraftFile[],
      courtVisitResult?: Parameters<typeof patchOperationsTaskRecord>[1]["courtVisitResult"],
      credit?: { assigneeId?: string; assigneeName?: string },
      cancelReasonText?: string,
    ) => {
      const taskBefore = tasks.find((t) => t.id === id) ?? null;
      if (
        status === "completed" &&
        (closeComment?.trim() || (files && files.length > 0))
      ) {
        setBusy(true);
        const uploadedFiles = files && files.length > 0 ? await uploadDraftFiles(id, files) : undefined;
        const commentRes = await addOperationsTaskCommentRecord(
          id,
          closeComment?.trim() ?? "",
          "close",
          uploadedFiles,
        );
        if (!commentRes.ok) {
          setError(commentRes.error);
          setBusy(false);
          return;
        }
      }
      const patchBody: Parameters<typeof patchOperationsTaskRecord>[1] = { status };
      if (status === "completed" && courtVisitResult) {
        patchBody.courtVisitResult = courtVisitResult;
      }
      if (status === "completed" && credit?.assigneeId?.trim()) {
        patchBody.creditAssigneeId = credit.assigneeId.trim();
        patchBody.creditAssigneeName = credit.assigneeName?.trim() || undefined;
      }
      if (status === "cancelled") {
        patchBody.cancelReason = cancelReasonText?.trim() || undefined;
      }
      const ok = await runPatch(id, patchBody);
      if (!ok) return;
      setCloseOpen(false);
      setCloseText("");
      setCloseFiles([]);
      setCloseFormError(null);
      setCancelReason("");
      setCloseOutcome("completed");
      setCourtKind("");
      setCourtOtherText("");
      setCourtStatement("");
      setCourtPerDeed({});
      setCourtContacts([]);
      setCreditAssigneeId("");
      setCreditAssigneeName("");
      if (status === "cancelled") {
        showToast("أُلغيت المهمة", "info");
        return;
      }
      if (status === "completed" && taskBefore?.type === "court_visit") {
        if (courtVisitResult?.kind === "received" && !taskBefore.linkedEnvelopeId) {
          showToast("أُغلقت المهمة — سجّل الظرف المستلم الآن", "success");
          const params = new URLSearchParams({ register: "1" });
          const request = taskBefore.letterRows[0]?.request?.trim();
          if (request) params.set("request", request);
          params.set("task", taskBefore.id);
          router.push(`/keys?${params.toString()}`);
          return;
        }
        showToast(
          "تم إكمال زيارة المحكمة",
          "success",
        );
      }
    },
    [runPatch, tasks, showToast, router],
  );

  const confirmCloseTask = useCallback(
    (task: OperationsTask) => {
      if (closeOutcome === "cancelled") {
        if (!canCreate) {
          setCloseFormError("الإلغاء متاح للمنشئ أو المشرف فقط");
          return;
        }
        if (!cancelReason.trim()) {
          setCloseFormError("سبب الإلغاء مطلوب");
          return;
        }
        setCloseFormError(null);
        void runStatus(
          task.id,
          "cancelled",
          undefined,
          undefined,
          undefined,
          undefined,
          cancelReason,
        );
        return;
      }

      if (task.type === "court_visit") {
        if (!courtKind) {
          setCloseFormError("اختر موقف المفاتيح لدى المحكمة");
          return;
        }
        if (courtKind === "other" && !courtOtherText.trim()) {
          setCloseFormError("يلزم توضيح النتيجة عند اختيار «أخرى»");
          return;
        }
        const contacts = courtContacts
          .map((c) => ({
            scope: c.scope || "property",
            name: c.name.trim(),
            role: c.role.trim() || null,
            phone: c.phone.trim() || null,
            note: c.note.trim() || null,
          }))
          .filter((c) => c.name || c.phone);
        if (courtKind === "other_party" && contacts.length === 0) {
          setCloseFormError(
            "يلزم إدخال جهة اتصال واحدة على الأقل عندما يكون الظرف عند طرف آخر",
          );
          return;
        }
        if (canCreate && task.originalAssigneeId && !creditAssigneeId.trim()) {
          setCloseFormError("اختر من يحصل على مسؤولية التنفيذ");
          return;
        }
        setCloseFormError(null);
        const perDeed = Object.entries(courtPerDeed)
          .map(([deed, text]) => ({ deed, text: text.trim() }))
          .filter((p) => p.deed && p.text);
        void runStatus(
          task.id,
          "completed",
          closeText,
          closeFiles,
          {
            kind: courtKind,
            other: courtKind === "other" ? courtOtherText.trim() : null,
            statement: courtStatement.trim() || null,
            perDeed,
            contacts,
          },
          canCreate && task.originalAssigneeId
            ? { assigneeId: creditAssigneeId, assigneeName: creditAssigneeName }
            : undefined,
        );
        return;
      }
      if (canCreate && task.originalAssigneeId && !creditAssigneeId.trim()) {
        setCloseFormError("اختر من يحصل على مسؤولية التنفيذ");
        return;
      }
      void runStatus(
        task.id,
        "completed",
        closeText,
        closeFiles,
        undefined,
        canCreate && task.originalAssigneeId
          ? { assigneeId: creditAssigneeId, assigneeName: creditAssigneeName }
          : undefined,
      );
    },
    [
      closeOutcome,
      cancelReason,
      courtKind,
      courtOtherText,
      courtContacts,
      courtPerDeed,
      courtStatement,
      closeText,
      closeFiles,
      creditAssigneeId,
      creditAssigneeName,
      canCreate,
      runStatus,
    ],
  );

  const openKeysRegisterFromTask = useCallback(
    (task: OperationsTask) => {
      const params = new URLSearchParams({ register: "1" });
      const request = task.letterRows[0]?.request?.trim();
      if (request) params.set("request", request);
      params.set("task", task.id);
      router.push(`/keys?${params.toString()}`);
    },
    [router],
  );

  const applyPriority = useCallback(
    async (id: string) => {
      const body: Parameters<typeof patchOperationsTaskRecord>[1] = {
        priority: prioValue,
      };
      if (prioEditDue && prioDueDate.trim()) {
        const [y, mo, da] = prioDueDate.split("-").map(Number);
        const [hh, mm] = (prioDueTime || "12:00").split(":").map(Number);
        const dueAt = new Date(y!, (mo ?? 1) - 1, da ?? 1, hh ?? 12, mm ?? 0);
        body.dueAtUtc = dueAt.toISOString();
      }
      const ok = await runPatch(id, body);
      if (ok) {
        setPrioOpen(false);
        setPrioEditDue(false);
        showToast("تم تحديث المهمة", "success");
      }
    },
    [prioValue, prioEditDue, prioDueDate, prioDueTime, runPatch, showToast],
  );

  const remindTask = useCallback(
    async (task: OperationsTask) => {
      if (!isActiveOperationsTask(task)) return;
      setBusy(true);
      const res = await remindOperationsTaskRecord(task.id);
      setBusy(false);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      showToast(`أُرسل تذكير إلى ${task.assigneeName || "المنفّذ"}`, "info");
      await refetch();
    },
    [showToast, refetch],
  );

  const bulkRemind = useCallback(async () => {
    const ids = Object.entries(selectedIds)
      .filter(([, on]) => on)
      .map(([id]) => id);
    let n = 0;
    setBusy(true);
    for (const id of ids) {
      const task = tasks.find((t) => t.id === id);
      if (!task || !isActiveOperationsTask(task)) continue;
      const res = await remindOperationsTaskRecord(id);
      if (res.ok) n += 1;
    }
    setBusy(false);
    setSelectedIds({});
    showToast(n ? `تم تذكير ${n} مهمة` : "لا مهام قابلة للتذكير", "info");
    await refetch();
  }, [selectedIds, tasks, showToast, refetch]);

  const openReassign = useCallback((task: OperationsTask) => {
    setSelectedId(task.id);
    setDetailId(task.id);
    setReassignAssigneeId(task.assigneeId || "");
    setReassignAssigneeName(task.assigneeName || "");
    const due = task.dueAt ? new Date(task.dueAt) : null;
    if (due && !Number.isNaN(due.getTime())) {
      setReassignDueDate(toLocalDateValue(due));
      setReassignDueTime(toLocalTimeValue(due));
    } else {
      setReassignDueDate("");
      setReassignDueTime("12:00");
    }
    setReassignReason("");
    setReassignError(null);
    setReassignOpen(true);
  }, []);

  const submitReassign = useCallback(async () => {
    const taskId = selectedId ?? detailId;
    if (!taskId) return;
    if (!reassignAssigneeId.trim()) {
      setReassignError("اختر المنفّذ.");
      return;
    }
    if (!reassignReason.trim()) {
      setReassignError("سبب إعادة التوجيه مطلوب.");
      return;
    }
    if (!reassignDueDate.trim()) {
      setReassignError("حدد موعد الاستحقاق.");
      return;
    }
    const [y, mo, da] = reassignDueDate.split("-").map(Number);
    const [hh, mm] = (reassignDueTime || "12:00").split(":").map(Number);
    const due = new Date(y, (mo ?? 1) - 1, da ?? 1, hh ?? 12, mm ?? 0, 0, 0);
    setBusy(true);
    setReassignError(null);
    const res = await reassignOperationsTaskRecord(taskId, {
      assigneeId: reassignAssigneeId.trim(),
      assigneeName: reassignAssigneeName.trim() || undefined,
      dueAtUtc: due.toISOString(),
      reason: reassignReason.trim(),
    });
    setBusy(false);
    if (!res.ok) {
      setReassignError(res.error);
      return;
    }
    setReassignOpen(false);
    setReassignReason("");
    showToast("تم إعادة التوجيه والإسناد", "success");
    await refetch();
  }, [
    selectedId,
    detailId,
    reassignAssigneeId,
    reassignAssigneeName,
    reassignDueDate,
    reassignDueTime,
    reassignReason,
    showToast,
    refetch,
  ]);

  const reassignTask = useMemo(() => {
    const id = selectedId ?? detailId;
    return id ? tasks.find((t) => t.id === id) ?? null : null;
  }, [tasks, selectedId, detailId]);

  const reassignAssignees = useMemo(
    () =>
      reassignTask
        ? assigneesForType(reassignTask.type, staffUsers)
        : [],
    [reassignTask, staffUsers],
  );

  const closeTargetTask = useMemo(() => {
    const id = detailId ?? selectedId;
    if (!id) return null;
    return tasks.find((t) => t.id === id) ?? null;
  }, [detailId, selectedId, tasks]);

  const creditAssignees = useMemo(() => {
    if (!closeTargetTask) return [];
    const base = [...assigneesForType(closeTargetTask.type, staffUsers)];
    const ensure = (id: string | null | undefined, name: string | null | undefined) => {
      const trimmed = id?.trim();
      if (!trimmed) return;
      if (!base.some((a) => a.id === trimmed)) {
        base.push({ id: trimmed, name: name?.trim() || trimmed });
      }
    };
    ensure(closeTargetTask.originalAssigneeId, closeTargetTask.originalAssigneeName);
    ensure(closeTargetTask.assigneeId, closeTargetTask.assigneeName);
    return base;
  }, [closeTargetTask, staffUsers]);

  const showCreditPicker = Boolean(
    canCreate && closeTargetTask?.originalAssigneeId,
  );

  const rowMenu = useCallback(
    (task: OperationsTask): RowMoreMenuItem[] => {
      const items: RowMoreMenuItem[] = [
        {
          id: "detail",
          label: "عرض التفاصيل",
          icon: RowMoreMenuIcons.eye,
          onClick: () => setDetailId(task.id),
        },
      ];
      const rowIsAssignee = (() => {
        const taskAid = task.assigneeId?.trim() ?? "";
        const myAid = reviewerAccount?.assigneeId?.trim() ?? "";
        if (myAid && taskAid && myAid === taskAid) return true;
        const myName = (reviewerAccount?.name ?? "").trim();
        const taskName = task.assigneeName?.trim() ?? "";
        if (myName && taskName && myName === taskName) return true;
        return false;
      })();
      if (task.status === "created" && rowIsAssignee) {
        items.push({
          id: "start",
          label: "✓ تأكيد الاستلام",
          icon: RowMoreMenuIcons.play,
          onClick: () => void runStatus(task.id, "in_progress"),
        });
      }
      if (
        (task.status === "in_progress" && rowIsAssignee) ||
        (canCreate &&
          (task.status === "in_progress" ||
            task.status === "paused" ||
            task.status === "created"))
      ) {
        items.push({
          id: "complete",
          label: "إغلاق المهمة",
          icon: RowMoreMenuIcons.checkCircle,
          onClick: () => openCloseModal(task),
        });
      }
      if (
        task.type === "court_visit" &&
        !task.linkedEnvelopeId &&
        task.courtVisitResult?.kind === "received" &&
        (task.status === "completed" || task.status === "in_progress")
      ) {
        items.push({
          id: "register-envelope",
          label: "تسجيل الظرف الآن",
          icon: RowMoreMenuIcons.checkCircle,
          onClick: () => openKeysRegisterFromTask(task),
        });
      }
      if (canCreate && (task.status === "created" || task.status === "in_progress")) {
        items.push({
          id: "pause",
          label: "إيقاف مؤقت",
          icon: RowMoreMenuIcons.pause,
          onClick: () => openPauseModal(task),
        });
      }
      if (canCreate && task.status === "paused") {
        items.push({
          id: "resume",
          label: "استئناف المهمة",
          icon: RowMoreMenuIcons.play,
          onClick: () => void runStatus(task.id, "in_progress"),
        });
      }
      if (task.type === "court_visit" && task.letterRows.length > 0) {
        items.push({
          id: "letter",
          label: "عرض خطاب التفويض",
          icon: RowMoreMenuIcons.building,
          onClick: () => setDetailId(task.id),
        });
      }
      if (canRemind && isActiveOperationsTask(task)) {
        items.push({
          id: "remind",
          label: "تذكير المنفّذ",
          icon: RowMoreMenuIcons.bell,
          onClick: () => void remindTask(task),
        });
      }
      if (canCreate && isActiveOperationsTask(task)) {
        items.push({
          id: "prio",
          label: "تغيير الأولوية",
          icon: RowMoreMenuIcons.flag,
          onClick: () => openPriorityModal(task),
        });
        items.push({
          id: "reassign",
          label: "إعادة توجيه وإسناد",
          icon: RowMoreMenuIcons.arrowRight,
          onClick: () => openReassign(task),
        });
      }
      return items;
    },
    [canCreate, canRemind, reviewerAccount, runStatus, remindTask, openReassign, openCloseModal, openPriorityModal, openKeysRegisterFromTask, openPauseModal],
  );

  const mobileCardItems = useMemo((): ActiveQueueMobileCardItem[] => {
    return visibleTasks.map((task) => {
      const cd = taskCountdown(task.dueAt, task.status, now);
      const active = isActiveOperationsTask(task);
      const tone: ActiveQueueMobileCardItem["tone"] =
        task.status === "completed" || task.status === "cancelled"
          ? "done"
          : task.priority === "urgent" || task.priority === "high" || cd.over
            ? "returned"
            : task.status === "in_progress" || task.status === "paused"
              ? "pending"
              : "new";
      const statusColor =
        OPERATIONS_TASK_STATUS_COLORS[task.status] ?? "var(--ink)";
      const link = operationsTaskLinkLabel(task);
      const scope = operationsTaskScopeLabel(task.scope);
      const assignee = (task.assigneeName || task.assigneeId || "").trim();
      return {
        id: task.id,
        title: task.title,
        meta: [
          { text: task.displayId, kind: "po" as const },
          { text: operationsTaskTypeLabel(task.type), kind: "type" as const },
          assignee
            ? { text: assignee, kind: "place" as const }
            : link && link !== "—"
              ? { text: link, kind: "plain" as const }
              : { text: scope, kind: "plain" as const },
        ],
        statusLabel: operationsTaskStatusLabel(task.status),
        statusStyle: { base: statusColor, fg: statusColor },
        tone,
        timerLabel: active
          ? cd.over
            ? "متأخرة"
            : cd.txt !== "—" && cd.txt !== "متوقفة"
              ? cd.txt
              : undefined
          : undefined,
        timerTick: active
          ? (nowMs: number) => {
              const t = taskCountdown(task.dueAt, task.status, nowMs);
              if (t.txt === "—" || t.txt === "متوقفة") return null;
              return { label: t.over ? "متأخرة" : t.txt, overdue: t.over };
            }
          : undefined,
        timerOverdue: active ? cd.over : undefined,
        timerRatio: active
          ? resolveSlaTimerRatio(task.dueAt, task.createdAt ?? "", new Date(now))
          : undefined,
        moreItems: rowMenu(task),
        onOpen: () => {
          setSelectedId(task.id);
          setDetailId(task.id);
        },
        leading: active ? (
          <input
            type="checkbox"
            className={opsTkCheckInput}
            checked={Boolean(selectedIds[task.id])}
            onChange={(e) => {
              const on = e.target.checked;
              setSelectedIds((prev) => {
                const next = { ...prev };
                if (on) next[task.id] = true;
                else delete next[task.id];
                return next;
              });
            }}
            aria-label="تحديد المهمة"
          />
        ) : undefined,
      };
    });
  }, [visibleTasks, now, rowMenu, selectedIds]);

  const isAssignee = useMemo(() => {
    if (!detail) return false;
    // Executor queue is assignee-scoped — any open task row is theirs.
    if (useIndependentQueue) return true;
    const taskAid = detail.assigneeId?.trim() ?? "";
    const myAid = reviewerAccount?.assigneeId?.trim() ?? "";
    if (myAid && taskAid && myAid === taskAid) return true;
    const myName = (reviewerAccount?.name ?? viewerDisplayName ?? "").trim();
    const taskName = detail.assigneeName?.trim() ?? "";
    if (myName && taskName && myName === taskName) return true;
    return false;
  }, [detail, reviewerAccount, viewerDisplayName, useIndependentQueue]);

  /** Government reviewer only: raise failures from the task detail (button → modal). */
  const govFailureTargets = useMemo(() => {
    if (role !== "government-reviewer" || !detail) return [];
    return failureTargetsForOperationsTask(detail, poRecords);
  }, [role, detail, poRecords]);

  const showGovFailureRaise =
    role === "government-reviewer" &&
    isAssignee &&
    Boolean(detail) &&
    detail?.status !== "cancelled" &&
    detail?.status !== "completed" &&
    detail?.status !== "paused" &&
    !isOperationsTaskBlockedByFailure(detail!, failures, poRecords);

  const openGovFailureRaise = useCallback(() => {
    if (govFailureTargets.length === 0) {
      showToast(
        "لا يمكن تسجيل تعذر — اربط المهمة بأمر عمل وصك معروف في النظام",
        "error",
      );
      return;
    }
    // Court-visit letter may list multiple deeds; open the first resolved target.
    setGovFailureTarget(govFailureTargets[0] ?? null);
  }, [govFailureTargets, showToast]);

  const afterGovFailureRaised = useCallback(async () => {
    const taskId = detail?.id;
    setGovFailureTarget(null);
    if (taskId) {
      const pause = await patchOperationsTaskRecord(taskId, {
        status: "paused",
        pauseReason: OPS_TASK_FAILURE_PAUSE_REASON,
      });
      if (!pause.ok) {
        showToast(
          pause.error ||
            "رُفع التعذر لكن تعذّر إيقاف المهمة — أبلغ المشرف",
          "error",
        );
      }
    }
    setDetailId(null);
    setSelectedId(null);
    await refetch();
    // Drop ?task= deep-link so we stay on the list, not the same detail.
    if (deepLinkTaskId) {
      router.replace("/operations-tasks");
    }
  }, [detail?.id, deepLinkTaskId, refetch, router, showToast]);

  if (!isFetched && isFetching) {
    return <PanelSkeleton className="p-4" />;
  }

  if (detail) {
    const overdue =
      !isTerminalOperationsTask(detail) &&
      new Date(detail.dueAt).getTime() < now &&
      detail.status !== "paused";
    const prColor = OPERATIONS_TASK_PRIORITY_COLORS[detail.priority] ?? "#8a8d96";
    const nSent = detail.reminders?.length ?? 0;
    const linkChip =
      detail.scope === "general"
        ? "غير مرتبطة — مهمة مستقلة"
        : `${operationsTaskScopeLabel(detail.scope)} · ${operationsTaskLinkLabel(detail)}`;

    return (
      <PageShell
        variant="canvas"
        className="gap-0 p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6"
      >
        {error ? <Note tone="danger">{error}</Note> : null}

        <div className={opsPpHead}>
          <h1 className={opsPpTitle}>
            <span className="inline-flex items-center gap-[9px]">
              <span className={opsIconBoxGold}>
                <TypeIcon type={detail.type} size={20} />
              </span>
              {detail.title}
            </span>
          </h1>
          <div className={opsPpMeta}>
            <span className={opsPpBadge}>{operationsTaskTypeLabel(detail.type)}</span>
            <span className={opsDotSep}>·</span>
            <TaskStatusPill status={detail.status} />
            <span className={opsDotSep}>·</span>
            <span dir="ltr">{detail.displayId}</span>
            {detail.reference ? (
              <>
                <span className={opsDotSep}>·</span>
                <span>خطاب {detail.reference}</span>
              </>
            ) : null}
          </div>
          <div className="mt-4">
            <TaskStepper status={detail.status} />
          </div>
          <div className={opsPpSummary}>
            <div className={opsPpCell}>
              <div className={opsPpCellK}>المنفّذ</div>
              <div className={opsPpCellV}>
                {detail.assigneeName || detail.assigneeId} —{" "}
                {assigneeRoleLabel(staffUsers, detail.assigneeId)}
              </div>
            </div>
            <div className={opsPpCell}>
              <div className={opsPpCellK}>المنشئ</div>
              <div className={opsPpCellV}>
                {displayPersonName(detail.createdByName, {
                  userId: detail.createdBy,
                  staffUsers,
                  fallback: "—",
                })}
              </div>
            </div>
            <div className={opsPpCell}>
              <div className={opsPpCellK}>النطاق / الربط</div>
              <div className={opsPpCellV}>{linkChip}</div>
            </div>
            <div className={opsPpCell}>
              <div className={opsPpCellK}>الأولوية</div>
              <div className={opsPpCellV}>
                <StatusPill
                  label={operationsTaskPriorityLabel(detail.priority)}
                  style={{ base: prColor, fg: prColor }}
                />
              </div>
            </div>
            <div className={opsPpCell}>
              <div className={opsPpCellK}>تاريخ الإنشاء</div>
              <div className={opsPpCellV}>{formatTaskDueLabel(detail.createdAt)}</div>
            </div>
            <div className={opsPpCell}>
              <div className={opsPpCellK}>موعد الاستحقاق</div>
              <div className={opsPpCellV} style={overdue ? { color: "#d9694f" } : undefined}>
                {overdue ? "متأخرة · " : ""}
                {formatTaskDueLabel(detail.dueAt)}
              </div>
            </div>
            {(() => {
              const receipt = operationsTaskReceiptLabel(detail);
              const canConfirmReceipt =
                detail.status === "created" && isAssignee;
              if (receipt === null && isTerminalOperationsTask(detail)) {
                return null;
              }
              if (canConfirmReceipt) {
                return (
                  <div className={opsReceiptConfirmWrap}>
                    <button
                      type="button"
                      className={opsReceiptConfirmBtn}
                      disabled={busy}
                      aria-busy={busy || undefined}
                      aria-label="تأكيد الاستلام"
                      onClick={() => void runStatus(detail.id, "in_progress")}
                    >
                      {busy ? <Spinner /> : null}
                      <span>
                        {busy ? "جاري التأكيد…" : "✓ تأكيد الاستلام"}
                      </span>
                    </button>
                  </div>
                );
              }
              if (!receipt) return null;
              return (
                <div
                  className={cn(
                    opsPpCell,
                    "max-lg:col-span-2 lg:ms-auto lg:border-s-0 lg:pe-0",
                  )}
                >
                  <div
                    className={opsPpCellV}
                    style={
                      receipt === "مؤكَّد" ? undefined : { color: "#b8860b" }
                    }
                  >
                    {receipt === "مؤكَّد" ? "✓ مؤكَّد" : receipt}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {detail.description ? (
          <div className={tasksDescClassName("plain")}>{detail.description}</div>
        ) : null}

        {isActiveOperationsTask(detail) ? (
          <div className={opsRemindCard}>
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[10px] bg-[color-mix(in_srgb,var(--gold)_18%,transparent)] text-gold-d">
                <BellIcon size={19} />
              </span>
              <div className="min-w-0">
                <div className={opsLetterTitle}>التذكير التلقائي</div>
                <div className="mt-0.5 text-xs text-text-2">
                  أولوية{" "}
                  <b style={{ color: prColor }}>
                    {operationsTaskPriorityLabel(detail.priority)}
                  </b>{" "}
                  ·{" "}
                  {OPERATIONS_TASK_REMIND_LABELS[detail.priority] ??
                    OPERATIONS_TASK_REMIND_LABELS.medium}{" "}
                  — التذكير القادم خلال{" "}
                  <span className="font-bold text-heading" dir="ltr">
                    <TickingRemindCountdown task={detail} />
                  </span>
                  {nSent ? ` · أُرسل ${nSent} تذكير` : ""}
                </div>
              </div>
            </div>
            {canRemind || showGovFailureRaise ? (
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 max-lg:w-full max-lg:flex-col max-lg:items-stretch">
                {canRemind ? (
                  <button
                    type="button"
                    className={opsRemindBtn}
                    disabled={busy}
                    aria-busy={busy || undefined}
                    onClick={() => void remindTask(detail)}
                  >
                    {busy ? <Spinner /> : <BellIcon size={15} />}
                    <span>{busy ? "جاري التذكير…" : "تذكير الآن"}</span>
                  </button>
                ) : null}
                {showGovFailureRaise ? (
                  <button
                    type="button"
                    className={cn(
                      opsBtnGhost,
                      "max-lg:min-h-11 max-lg:w-full max-lg:justify-center",
                    )}
                    disabled={busy}
                    onClick={openGovFailureRaise}
                  >
                    تعذر
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {detail.type === "court_visit" ? (
          <div className={cn(opsLetterCard, "mt-5")}>
            <div className={opsLetterHead}>
              <div className={opsHeadRow}>
                <span className={opsIconBoxGold}>
                  <TypeIcon type="court_visit" size={18} />
                </span>
                <div>
                  <div className={opsLetterTitle}>خطاب التفويض الداخلي</div>
                  <div className={opsLetterSub}>
                    مفتاح التجميع: المحكمة + الدائرة · لقطة (snapshot) عند الإصدار
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 max-lg:w-full max-lg:flex-col max-lg:items-stretch">
                <span className="text-xs font-bold text-text-2">
                  الرقم المرجعي:{" "}
                  <span dir="ltr" className="text-gold-d">
                    {detail.reference || "—"}
                  </span>
                </span>
                {detail.letterRows.length > 0 ? (
                  <button
                    type="button"
                    className={cn(
                      opsBtnGhost,
                      "min-h-9 px-3.5 py-2 text-[12.5px] max-lg:w-full max-lg:min-h-11 max-lg:justify-center",
                    )}
                    onClick={() =>
                      printOperationsTaskDelegationLetter(
                        detail,
                        agentInfoFromStaff(reviewerStaff),
                      )
                    }
                  >
                    طباعة خطاب التفويض
                  </button>
                ) : null}
              </div>
            </div>
            <div className="px-3.5 py-3.5 sm:px-[18px] sm:py-4">
              <LetterTable rows={detail.letterRows} />
              <p className="mx-0.5 mt-3 text-[11.5px] leading-relaxed text-text-3">
                الترميز المرجعي الموحّد + snapshot للبيانات وقت الإصدار — يُطبع على
                الترويسة الرسمية.
              </p>
            </div>
          </div>
        ) : null}

        <div className={opsTfActions}>
          {(detail.status === "in_progress" && isAssignee) ||
          (canCreate &&
            (detail.status === "in_progress" ||
              detail.status === "paused" ||
              detail.status === "created")) ? (
            <button
              type="button"
              className={opsBtnPrimary}
              disabled={busy}
              onClick={() => openCloseModal(detail)}
            >
              إغلاق المهمة
            </button>
          ) : null}
          {canCreate &&
          (detail.status === "created" || detail.status === "in_progress") ? (
            <button
              type="button"
              className={opsBtnGhost}
              disabled={busy}
              onClick={() => openPauseModal(detail)}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
                className="-my-0.5 me-1.5"
              >
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
              إيقاف مؤقت
            </button>
          ) : null}
          {canCreate && detail.status === "paused" ? (
            <button
              type="button"
              className={opsBtnPrimary}
              disabled={busy}
              aria-busy={busy || undefined}
              onClick={() => void runStatus(detail.id, "in_progress")}
            >
              {busy ? <Spinner /> : null}
              <span>{busy ? "جاري الاستئناف…" : "استئناف المهمة"}</span>
            </button>
          ) : null}
          {canCreate && isActiveOperationsTask(detail) ? (
            <button
              type="button"
              className={opsBtnGhost}
              onClick={() => openReassign(detail)}
            >
              إعادة توجيه وإسناد
            </button>
          ) : null}
          {canCreate && isActiveOperationsTask(detail) ? (
            <button
              type="button"
              className={opsBtnGhost}
              onClick={() => openPriorityModal(detail)}
            >
              تغيير الأولوية
            </button>
          ) : null}
        </div>

        {detail.type === "court_visit" &&
        detail.courtVisitResult?.kind === "received" &&
        detail.status === "completed" &&
        !detail.linkedEnvelopeId ? (
          <div className="mt-4 flex w-full flex-col gap-3 rounded-[13px] border border-gold bg-gold-soft px-4 py-3.5 sm:flex-row sm:flex-wrap sm:items-center sm:px-[18px]">
            <span className="min-w-0 flex-1 text-[13px] font-bold leading-snug text-heading">
              استُلم ظرف مفاتيح في هذه الزيارة ولم يُسجَّل بعد — سجّله مربوطاً
              بالمهمة.
            </span>
            <button
              type="button"
              className={cn(
                opsBtnPrimary,
                "w-full shrink-0 max-lg:min-h-12 sm:ms-auto sm:w-auto",
              )}
              onClick={() => openKeysRegisterFromTask(detail)}
            >
              تسجيل الظرف الآن
            </button>
          </div>
        ) : null}

        <CommentThread
          task={detail}
          staffUsers={staffUsers}
          commentText={commentText}
          setCommentText={setCommentText}
          draftFiles={commentFiles}
          setDraftFiles={setCommentFiles}
          fileInputRef={commentFileInputRef}
          busy={busy}
          onSend={() => {
            void (async () => {
              if (!commentText.trim() && commentFiles.length === 0) return;
              setBusy(true);
              const uploadedFiles =
                commentFiles.length > 0 ? await uploadDraftFiles(detail.id, commentFiles) : undefined;
              const res = await addOperationsTaskCommentRecord(
                detail.id,
                commentText.trim(),
                undefined,
                uploadedFiles,
              );
              setBusy(false);
              if (!res.ok) {
                setError(res.error);
                return;
              }
              setCommentText("");
              setCommentFiles([]);
              await refetch();
            })();
          }}
        />

        <AppModal
          open={closeOpen}
          title={
            closeOutcome === "cancelled"
              ? "إلغاء المهمة"
              : "إغلاق المهمة — منجزة"
          }
          subtitle={
            closeOutcome === "cancelled"
              ? "صلاحية منشئ المهمة — يتطلب سبباً إلزامياً"
              : "يقوم المنفّذ بإغلاق المهمة بعد إتمام العمل المطلوب"
          }
          maxWidthPx={540}
          onClose={() => setCloseOpen(false)}
        >
          <CloseTaskModalBody
            taskType={detail.type}
            letterRows={detail.letterRows}
            closeOutcome={closeOutcome}
            setCloseOutcome={setCloseOutcome}
            canCancel={canCreate}
            allowCompleteOutcome={
              detail.status === "in_progress" || detail.status === "paused"
            }
            cancelReason={cancelReason}
            setCancelReason={setCancelReason}
            closeText={closeText}
            setCloseText={setCloseText}
            closeFiles={closeFiles}
            setCloseFiles={setCloseFiles}
            fileInputRef={closeFileInputRef}
            courtKind={courtKind}
            setCourtKind={setCourtKind}
            courtOtherText={courtOtherText}
            setCourtOtherText={setCourtOtherText}
            courtStatement={courtStatement}
            setCourtStatement={setCourtStatement}
            courtPerDeed={courtPerDeed}
            setCourtPerDeed={setCourtPerDeed}
            courtContacts={courtContacts}
            setCourtContacts={setCourtContacts}
            showCreditPicker={showCreditPicker}
            creditAssignees={creditAssignees}
            creditAssigneeId={creditAssigneeId}
            setCreditAssigneeId={setCreditAssigneeId}
            setCreditAssigneeName={setCreditAssigneeName}
            formError={closeFormError}
            busy={busy}
            onCancel={() => setCloseOpen(false)}
            onConfirm={() => confirmCloseTask(detail)}
          />
        </AppModal>

        {govFailureTarget ? (
          <FailureRaiseModal
            open
            onClose={() => setGovFailureTarget(null)}
            poNumber={govFailureTarget.poNumber}
            propertyId={govFailureTarget.propertyId}
            deedNumber={govFailureTarget.deedNumber}
            specialist={
              detail.assigneeName?.trim() || GOVERNMENT_REVIEWER_FAILURE_RAISER
            }
            raisedByRole={GOVERNMENT_REVIEWER_FAILURE_RAISER}
            onSubmitted={() => {
              void afterGovFailureRaised();
            }}
          />
        ) : null}

        <AppModal
          open={pauseOpen}
          title="إيقاف مؤقت"
          subtitle="دورة المعاملة قصيرة (4–5 أيام عمل) — حد الإيقاف يوم عمل واحد"
          maxWidthPx={460}
          onClose={() => setPauseOpen(false)}
        >
          <PauseModalBody
            pauseReason={pauseReason}
            setPauseReason={setPauseReason}
            pauseError={pauseError}
            busy={busy}
            onCancel={() => setPauseOpen(false)}
            onConfirm={() => void confirmPauseTask()}
          />
        </AppModal>

        <AppModal
          open={prioOpen}
          title="تغيير الأولوية"
          onClose={() => setPrioOpen(false)}
        >
          <PriorityModalBody
            task={detail}
            prioValue={prioValue}
            setPrioValue={setPrioValue}
            prioEditDue={prioEditDue}
            setPrioEditDue={setPrioEditDue}
            prioDueDate={prioDueDate}
            setPrioDueDate={setPrioDueDate}
            prioDueTime={prioDueTime}
            setPrioDueTime={setPrioDueTime}
            onFitPriorityDue={applyPrioDueFromOffset}
            busy={busy}
            onCancel={() => setPrioOpen(false)}
            onApply={() => void applyPriority(detail.id)}
          />
        </AppModal>

        <ReassignOperationsTaskModal
          open={reassignOpen}
          currentAssigneeName={detail.assigneeName}
          currentAssigneeRole={
            reassignAssignees.find((a) => a.id === detail.assigneeId)?.subtitle
          }
          assignees={reassignAssignees}
          assigneeId={reassignAssigneeId}
          dueDate={reassignDueDate}
          dueTime={reassignDueTime}
          reason={reassignReason}
          error={reassignError}
          busy={busy}
          onAssigneeChange={(id, name) => {
            setReassignAssigneeId(id);
            setReassignAssigneeName(name);
          }}
          onDueDateChange={setReassignDueDate}
          onDueTimeChange={setReassignDueTime}
          onReasonChange={setReassignReason}
          onClose={() => setReassignOpen(false)}
          onSubmit={() => void submitReassign()}
        />
      </PageShell>
    );
  }

  return (
    <PageShell variant="canvas" className="gap-3.5 p-4 sm:gap-3.5 sm:p-6">
      {/* Desktop: connected KPI band */}
      <KpiBand className="mb-0 hidden shrink-0 !rounded-[12px] lg:flex">
        <KpiCell
          first
          icon={<TasksKpiActiveIcon />}
          iconClass="bg-gold-soft text-gold-d"
          label="مهام نشطة"
          value={kpis.active}
          sub="قيد الإسناد والتنفيذ"
          dot
        />
        <KpiCell
          icon={<TasksKpiCreatedIcon />}
          iconClass="bg-[color-mix(in_srgb,var(--ink)_10%,transparent)] text-ink"
          label="منشأة"
          value={kpis.created}
          sub="بانتظار البدء"
        />
        <KpiCell
          icon={<TasksKpiInProgressIcon />}
          iconClass="bg-[color-mix(in_srgb,#d9a441_20%,transparent)] text-[#8a5e14]"
          label="قيد التنفيذ"
          value={kpis.inProgress}
          sub="جارية الآن"
        />
        <KpiCell
          last
          icon={<TasksKpiCompletedIcon />}
          iconClass="bg-[color-mix(in_srgb,#3f8f5f_16%,transparent)] text-[#2f7a4d]"
          label="مكتملة"
          value={kpis.completed}
          sub="أُنجزت مؤخراً"
        />
      </KpiBand>

      {/* Mobile: معاينة العقار-style 2×2 stat cards */}
      <MobileKpiStatCards
        className="mb-0"
        items={[
          {
            key: "active",
            label: "مهام نشطة",
            sub: "قيد الإسناد والتنفيذ",
            value: kpis.active,
            icon: <TasksKpiActiveIcon />,
            iconClass: "bg-gold-soft text-gold-d",
            tone: "gold",
            valueClass: "!text-gold-d",
          },
          {
            key: "created",
            label: "منشأة",
            sub: "بانتظار البدء",
            value: kpis.created,
            icon: <TasksKpiCreatedIcon />,
            iconClass:
              "bg-[color-mix(in_srgb,var(--ink)_10%,transparent)] text-ink",
            tone: "ink",
          },
          {
            key: "inProgress",
            label: "قيد التنفيذ",
            sub: "جارية الآن",
            value: kpis.inProgress,
            icon: <TasksKpiInProgressIcon />,
            iconClass:
              "bg-[color-mix(in_srgb,#d9a441_20%,transparent)] text-[#8a5e14]",
            tone: "gold",
            valueClass: "!text-gold-d",
          },
          {
            key: "completed",
            label: "مكتملة",
            sub: "أُنجزت مؤخراً",
            value: kpis.completed,
            icon: <TasksKpiCompletedIcon />,
            iconClass:
              "bg-[color-mix(in_srgb,var(--ink)_10%,transparent)] text-ink",
            tone: "ink",
            valueClass: "!text-ink",
          },
        ]}
      />

      <div className={opsToolbar}>
        <div className={cn(opsFilters, "flex-1")}>
          <OperationalToolbarSearch
            type="search"
            placeholder="عنوان المهمة أو المنفّذ أو رقم الصك…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="بحث المهام"
          />
          <div className="flex flex-wrap items-center gap-2.5 max-lg:grid max-lg:w-full max-lg:grid-cols-2 lg:contents">
            <OperationalToolbarSelect
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="تصفية الحالة"
            >
              <option value="">جميع الحالات</option>
              {Object.entries(OPERATIONS_TASK_STATUS_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </OperationalToolbarSelect>
            <OperationalToolbarSelect
              value={scopeFilter}
              onChange={(e) => setScopeFilter(e.target.value)}
              aria-label="تصفية النطاق"
            >
              <option value="">كل النطاقات</option>
              {Object.entries(OPERATIONS_TASK_SCOPE_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </OperationalToolbarSelect>
          </div>
          <div className="flex items-center gap-2 max-lg:w-full lg:contents">
            <button
              type="button"
              className={showAll ? opsShowAllBtnOn : opsShowAllBtn}
              onClick={() => setShowAll((v) => !v)}
            >
              <TasksShowAllEye />
              <span>{showAll ? "النشطة فقط" : "إظهار جميع المهام"}</span>
            </button>
            <span className={opsListCount} aria-live="polite">
              {visibleTasks.length}
              <span>نتيجة</span>
            </span>
          </div>
        </div>
        {canCreate ? (
          <OperationalToolbarPrimaryButton
            className="ms-3 max-lg:ms-0"
            onClick={() => {
              setCreatePrefill(null);
              setCreateOpen(true);
            }}
            onMouseEnter={preloadCreateOperationsTaskModal}
            onFocus={preloadCreateOperationsTaskModal}
          >
            <PlusIcon />
            <span>إنشاء مهمة</span>
          </OperationalToolbarPrimaryButton>
        ) : null}
      </div>

      {selectedCount > 0 && canRemind ? (
        <div className={opsBulk}>
          <BellIcon size={16} />
          <span className={opsBulkCount}>{selectedCount} مهمة محددة</span>
          <button
            type="button"
            className={cn(opsRemindBtn, "ms-auto")}
            disabled={busy}
            aria-busy={busy || undefined}
            onClick={() => void bulkRemind()}
          >
            {busy ? <Spinner /> : <BellIcon size={15} />}
            <span>{busy ? "جاري التذكير…" : "تذكير المحدد دفعة واحدة"}</span>
          </button>
          <button
            type="button"
            className={opsBulkClear}
            onClick={() => setSelectedIds({})}
          >
            إلغاء التحديد
          </button>
        </div>
      ) : selectedCount > 0 ? (
        <div className={opsBulk}>
          <span className={opsBulkCount}>{selectedCount} مهمة محددة</span>
          <button
            type="button"
            className={opsBulkClear}
            onClick={() => setSelectedIds({})}
          >
            إلغاء التحديد
          </button>
        </div>
      ) : null}

      {error ? <Note tone="danger">{error}</Note> : null}

      <OperationalPanel className="min-h-0 flex-1 overflow-hidden !rounded-[12px] p-0 max-lg:border-0 max-lg:bg-transparent max-lg:!rounded-none max-lg:shadow-none">
        {/* Desktop table */}
        <div className="hidden overflow-x-auto lg:block">
          <div className="min-w-[900px]">
            <div className={opsThead} style={{ gridTemplateColumns: TASKS_LIST_COLS }}>
              <div className={cn(opsTh, opsTdC)}>
                <input
                  ref={selAllRef}
                  type="checkbox"
                  aria-label="تحديد الكل"
                  className="size-[17px] accent-gold-d"
                  checked={allVisibleActiveChecked}
                  onChange={(e) => {
                    const on = e.target.checked;
                    const next = { ...selectedIds };
                    for (const t of visibleTasks) {
                      if (!isActiveOperationsTask(t)) continue;
                      if (on) next[t.id] = true;
                      else delete next[t.id];
                    }
                    setSelectedIds(next);
                  }}
                />
              </div>
              {/* Text headers: start-aligned with body cells (not center). */}
              <div className={opsThStart}>المهمة</div>
              <div className={opsThStart}>النطاق / الربط</div>
              <div className={opsThStart}>المنفّذ</div>
              <div className={opsThStart}>الاستحقاق</div>
              <div className={cn(opsTh, opsTdC)}>الحالة</div>
              <div className={cn(opsTh, opsTdC)}>إجراءات</div>
            </div>

            {visibleTasks.length === 0 ? (
              <TasksEmptyRows />
            ) : (
              visibleTasks.map((task) => {
                const prColor =
                  OPERATIONS_TASK_PRIORITY_COLORS[task.priority] ?? "#8a8d96";
                return (
                  <div
                    key={task.id}
                    role="button"
                    tabIndex={0}
                    className={opsGridRow}
                    style={{ gridTemplateColumns: TASKS_LIST_COLS }}
                    onClick={() => {
                      setSelectedId(task.id);
                      setDetailId(task.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setDetailId(task.id);
                      }
                    }}
                  >
                    <div
                      className={cn(opsTd, opsTdC)}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {isActiveOperationsTask(task) ? (
                        <label className={opsTkCheck}>
                          <input
                            type="checkbox"
                            className={opsTkCheckInput}
                            checked={Boolean(selectedIds[task.id])}
                            onChange={(e) => {
                              const on = e.target.checked;
                              setSelectedIds((prev) => {
                                const next = { ...prev };
                                if (on) next[task.id] = true;
                                else delete next[task.id];
                                return next;
                              });
                            }}
                          />
                        </label>
                      ) : null}
                    </div>
                    <div className={opsTd}>
                      <div className="flex min-w-0 items-center gap-[11px]">
                        <span className={opsTypeIconSm}>
                          <TypeIcon type={task.type} size={15} />
                        </span>
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <span className={opsRowTitle}>{task.title}</span>
                          <span className={opsRowMeta}>
                            <span dir="ltr">{task.displayId}</span>
                            <span>·</span>
                            <span>{operationsTaskTypeLabel(task.type)}</span>
                            <span>·</span>
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                color: prColor,
                                fontWeight: 700,
                              }}
                            >
                              <span
                                style={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: "50%",
                                  background: prColor,
                                }}
                              />
                              {operationsTaskPriorityLabel(task.priority)}
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className={opsTd}>
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="text-[13px] font-semibold text-text">
                          {operationsTaskScopeLabel(task.scope)}
                        </span>
                        <span dir="ltr" className="text-[11.5px] text-text-3">
                          {operationsTaskLinkLabel(task)}
                        </span>
                      </div>
                    </div>
                    <div className={opsTd}>
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="text-[13px] font-semibold text-heading">
                          {task.assigneeName || task.assigneeId}
                        </span>
                        <span className="text-[11.5px] text-text-3">
                          {assigneeRoleLabel(staffUsers, task.assigneeId)}
                        </span>
                      </div>
                    </div>
                    <div className={opsTd}>
                      <DueCell task={task} />
                    </div>
                    <div className={cn(opsTd, opsTdC)}>
                      <TaskStatusPill status={task.status} />
                    </div>
                    <div
                      className={cn(opsTd, opsTdC)}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex w-full items-center justify-center gap-0.5">
                        {canRemind && isActiveOperationsTask(task) ? (
                          <button
                            type="button"
                            className={opsRemindMini}
                            title="تذكير المنفّذ"
                            aria-label="تذكير"
                            onClick={() => void remindTask(task)}
                          >
                            <BellIcon size={16} />
                          </button>
                        ) : null}
                        <RowMoreMenu items={rowMenu(task)} />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Mobile card list */}
        <div className="px-3 pb-3 lg:hidden max-lg:px-0">
          <ActiveQueueMobileCards
            items={mobileCardItems}
            emptyMessage={
              useIndependentQueue
                ? "لا توجد مهام مسندة إليك."
                : "لا توجد مهام مطابقة."
            }
          />
        </div>
        <TasksSectionNote>{TASKS_LIST_FOOTER}</TasksSectionNote>
      </OperationalPanel>

      {/* تركيب مشروط — الركوب الدائم كان يجلب الحزمة عند فتح الشاشة رغم التقسيم. */}
      {createOpen ? (
        <CreateOperationsTaskModal
          open={createOpen}
          poRecords={poRecords}
          staffUsers={staffUsers}
          staffLoadError={staffLoadError}
          staffLoading={staffLoading}
          prefill={createPrefill}
          onClose={() => {
            setCreateOpen(false);
            setCreatePrefill(null);
          }}
          onCreated={(taskId) => {
            setSelectedId(taskId);
            setDetailId(taskId);
            void refetch();
          }}
        />
      ) : null}

      <AppModal
        open={closeOpen}
        title={
          closeOutcome === "cancelled"
            ? "إلغاء المهمة"
            : "إغلاق المهمة — منجزة"
        }
        subtitle={
          closeOutcome === "cancelled"
            ? "صلاحية منشئ المهمة — يتطلب سبباً إلزامياً"
            : "يقوم المنفّذ بإغلاق المهمة بعد إتمام العمل المطلوب"
        }
        maxWidthPx={540}
        onClose={() => setCloseOpen(false)}
      >
        <CloseTaskModalBody
          taskType={tasks.find((t) => t.id === selectedId)?.type}
          letterRows={tasks.find((t) => t.id === selectedId)?.letterRows}
          closeOutcome={closeOutcome}
          setCloseOutcome={setCloseOutcome}
          canCancel={canCreate}
          allowCompleteOutcome={(() => {
            const st = tasks.find((t) => t.id === selectedId)?.status;
            return st === "in_progress" || st === "paused";
          })()}
          cancelReason={cancelReason}
          setCancelReason={setCancelReason}
          closeText={closeText}
          setCloseText={setCloseText}
          closeFiles={closeFiles}
          setCloseFiles={setCloseFiles}
          fileInputRef={closeFileInputRef}
          courtKind={courtKind}
          setCourtKind={setCourtKind}
          courtOtherText={courtOtherText}
          setCourtOtherText={setCourtOtherText}
          courtStatement={courtStatement}
          setCourtStatement={setCourtStatement}
          courtPerDeed={courtPerDeed}
          setCourtPerDeed={setCourtPerDeed}
          courtContacts={courtContacts}
          setCourtContacts={setCourtContacts}
          showCreditPicker={showCreditPicker}
          creditAssignees={creditAssignees}
          creditAssigneeId={creditAssigneeId}
          setCreditAssigneeId={setCreditAssigneeId}
          setCreditAssigneeName={setCreditAssigneeName}
          formError={closeFormError}
          busy={busy}
          onCancel={() => setCloseOpen(false)}
          onConfirm={() => {
            const task = tasks.find((t) => t.id === selectedId);
            if (!task) return;
            confirmCloseTask(task);
          }}
        />
      </AppModal>

      <AppModal
        open={pauseOpen}
        title="إيقاف مؤقت"
        subtitle="دورة المعاملة قصيرة (4–5 أيام عمل) — حد الإيقاف يوم عمل واحد"
        maxWidthPx={460}
        onClose={() => setPauseOpen(false)}
      >
        <PauseModalBody
          pauseReason={pauseReason}
          setPauseReason={setPauseReason}
          pauseError={pauseError}
          busy={busy}
          onCancel={() => setPauseOpen(false)}
          onConfirm={() => void confirmPauseTask()}
        />
      </AppModal>

      <AppModal open={prioOpen} title="تغيير الأولوية" onClose={() => setPrioOpen(false)}>
        {selectedId && tasks.find((t) => t.id === selectedId) ? (
          <PriorityModalBody
            task={tasks.find((t) => t.id === selectedId)!}
            prioValue={prioValue}
            setPrioValue={setPrioValue}
            prioEditDue={prioEditDue}
            setPrioEditDue={setPrioEditDue}
            prioDueDate={prioDueDate}
            setPrioDueDate={setPrioDueDate}
            prioDueTime={prioDueTime}
            setPrioDueTime={setPrioDueTime}
            onFitPriorityDue={applyPrioDueFromOffset}
            busy={busy}
            onCancel={() => setPrioOpen(false)}
            onApply={() => {
              if (!selectedId) return;
              void applyPriority(selectedId);
            }}
          />
        ) : null}
      </AppModal>

      <ReassignOperationsTaskModal
        open={reassignOpen}
        currentAssigneeName={reassignTask?.assigneeName ?? ""}
        currentAssigneeRole={
          reassignTask
            ? reassignAssignees.find((a) => a.id === reassignTask.assigneeId)
                ?.subtitle
            : undefined
        }
        assignees={reassignAssignees}
        assigneeId={reassignAssigneeId}
        dueDate={reassignDueDate}
        dueTime={reassignDueTime}
        reason={reassignReason}
        error={reassignError}
        busy={busy}
        onAssigneeChange={(id, name) => {
          setReassignAssigneeId(id);
          setReassignAssigneeName(name);
        }}
        onDueDateChange={setReassignDueDate}
        onDueTimeChange={setReassignDueTime}
        onReasonChange={setReassignReason}
        onClose={() => setReassignOpen(false)}
        onSubmit={() => void submitReassign()}
      />
    </PageShell>
  );
}
