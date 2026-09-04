"use client";

/**
 * All non-rendering workflow behind `OperationsTasksView`: queries, queue
 * filters, modal state, and the patch/remind/reassign/close writes. The view
 * consumes the returned bag and keeps JSX plus event wiring only.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  RowMoreMenuIcons,
  type RowMoreMenuItem,
  useShowAllEyeBlink,
  useToast,
} from "@platform/ui-kit";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import type { StaffUser } from "@platform/app-shared/app-data/constants";
import {
  useStaffUsersQuery,
  useDistributionAssigneesQuery,
} from "@settings/mfe/query/settings-queries";
import { useDebouncedValue } from "@platform/app-shared/hooks/use-debounced-value";
import { useTickingMinute } from "@platform/app-shared/hooks/use-ticking-now";
import { useViewportDesktop } from "@platform/app-shared/hooks/use-viewport-desktop";
import { useFailuresQuery } from "@failures/mfe/query/failures-queries";
import { usePoRecordsQuery } from "../query/case-study-queries";
import {
  useOperationsTasksFilteredQuery,
  useOperationsTaskStatusCounts,
} from "../query/operations-tasks-queries";
import {
  isActiveOperationsTask,
  type OperationsTask,
} from "../lib/app-data/operations-tasks-model";
import {
  addOperationsTaskCommentRecord,
  patchOperationsTaskRecord,
  reassignOperationsTaskRecord,
  remindOperationsTaskRecord,
} from "../lib/app-data/operations-tasks-commands";
import {
  canManageOperationsTasks,
  canRemindOperationsTasks,
  operationsTasksUseAssigneeScope,
} from "../lib/app-data/operations-task-roles";
import { failureTargetsForOperationsTask } from "../lib/app-data/operations-task-failure-targets";
import type { OperationsTaskFailureTarget } from "../lib/app-data/operations-task-failure-targets";
import {
  isOperationsTaskBlockedByFailure,
  OPS_TASK_FAILURE_PAUSE_REASON,
} from "../lib/app-data/operations-task-failure-obstruction";
import {
  partyAccountForRole,
  partyAccountForViewer,
} from "../lib/app-data/distribution-parties";
import type { CreateOperationsTaskPrefill } from "../components/CreateOperationsTaskModal";
import {
  assigneesForType,
  toLocalDateValue,
  toLocalTimeValue,
  uploadDraftFiles,
  PRIORITY_OFFSET_MS,
  type CourtVisitContactDraft,
  type CourtVisitKind,
  type DraftFile,
} from "./OperationsTasksViewParts";
import {
  creditAssigneeOptions,
  dueDateFromLocalParts,
  matchesOperationsTaskAssignee,
  operationsTaskHiddenByFailure,
  INITIAL_OPERATIONS_TASK_QUERY,
  operationsTaskQueryReducer,
  toOperationsTaskListQuery,
  operationsTasksToResumeAfterFailure,
  queueTasksForViewer,
  reviewerStaffForAccount,
  visibleOperationsTasks,
} from "./operations-tasks-view-state";

export function useOperationsTasksWorkflow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const deepLinkTaskId = searchParams.get("task")?.trim() || null;
  const createFlag = searchParams.get("create");
  const prefillPo = searchParams.get("po")?.trim() || undefined;
  const prefillType = searchParams.get("type")?.trim() || undefined;
  const prefillScope = searchParams.get("scope")?.trim() || undefined;
  const prefillDeed = searchParams.get("deed")?.trim() || undefined;
  const { showToast } = useToast();

  const { role, viewerEmail, viewerDisplayName } = useAppAccess();
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

  const [query, dispatchQuery] = useReducer(
    operationsTaskQueryReducer,
    INITIAL_OPERATIONS_TASK_QUERY,
  );
  const { search, statusFilter, scopeFilter, showAll } = query;
  const setSearch = (value: string) => dispatchQuery({ type: "search", value });
  const setStatusFilter = (value: string) =>
    dispatchQuery({ type: "status", value });
  const setScopeFilter = (value: string) =>
    dispatchQuery({ type: "scope", value });
  const setShowAll = (value: boolean | ((prev: boolean) => boolean)) =>
    dispatchQuery({
      type: "showAll",
      value: typeof value === "function" ? value(query.showAll) : value,
    });
  const { blink: showAllEyeBlink, toggleOpen: toggleShowAll, triggerBlink } =
    useShowAllEyeBlink();

  // The search box drives a server request now — debounce it instead of
  // deferring a local pass, so typing does not fire one GET per keystroke.
  const debouncedSearch = useDebouncedValue(search, 300);
  const serverQuery = useMemo(
    () =>
      toOperationsTaskListQuery(query, {
        assigneeId: assigneeScopeId,
        // The pause-reason half of the hidden-by-failure rule is a column the
        // endpoint can answer; the rest stays in `queueTasksForViewer`.
        excludeFailurePaused: useIndependentQueue,
        search: debouncedSearch,
      }),
    [query, assigneeScopeId, useIndependentQueue, debouncedSearch],
  );

  const { data: tasks = [], isFetched, refetch, isFetching } =
    useOperationsTasksFilteredQuery(serverQuery, { live: true });
  /*
   * The auto-resume sweep needs the paused rows, which the queue's own filters
   * hide (`activeOnly`, `excludeFailurePaused`) — pagination-contract §3,
   * "still client-side" #4. One narrow `status=paused` request instead of
   * re-loading the whole queue.
   */
  const { data: pausedTasks = [], refetch: refetchPaused } =
    useOperationsTasksFilteredQuery({
      ...(assigneeScopeId ? { assigneeId: assigneeScopeId } : {}),
      status: "paused",
    });
  const { data: failures = [] } = useFailuresQuery();
  const failureResumeBusyRef = useRef(false);
  const [selectedId, setSelectedId] = useState<string | null>(deepLinkTaskId);
  const [detailId, setDetailId] = useState<string | null>(deepLinkTaskId);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [createPrefill, setCreatePrefill] = useState<CreateOperationsTaskPrefill | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [bulkReminding, startBulkRemind] = useTransition();
  const [reassigning, startReassign] = useTransition();
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
  // Minute precision is enough for screen logic — per-second timers (DueCell and mobile cards)
  // subscribe to the clock themselves, so every row is not rebuilt each second (rerender-defer-reads).
  const now = useTickingMinute();
  // After hydration mount only one tree (table or cards) — both used to be built together.
  const isDesktopViewport = useViewportDesktop();
  const commentFileInputRef = useRef<HTMLInputElement>(null);
  const closeFileInputRef = useRef<HTMLInputElement>(null);
  const selAllRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!deepLinkTaskId) return;
    setSelectedId(deepLinkTaskId);
    setDetailId(deepLinkTaskId);
    setShowAll((prev) => {
      if (!prev) triggerBlink();
      return true;
    });
  }, [deepLinkTaskId, triggerBlink]);

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

  const queueTasks = useMemo(
    () => queueTasksForViewer(tasks, useIndependentQueue, failures, poRecords),
    [tasks, useIndependentQueue, failures, poRecords],
  );

  // Counted by the endpoint, not over the loaded rows — the list is narrowed
  // server-side now, so `operationsTaskKpis(queueTasks)` would count a slice.
  const kpis = useOperationsTaskStatusCounts({
    assigneeId: assigneeScopeId,
    excludeFailurePaused: useIndependentQueue,
    live: true,
  });

  // No search argument: `q` — deed numbers included — is answered in the query
  // (pagination-contract §3), so the page is rendered as it arrived.
  const visibleTasks = useMemo(
    () =>
      visibleOperationsTasks(queueTasks, {
        statusFilter,
        scopeFilter,
        showAll,
      }),
    [queueTasks, statusFilter, scopeFilter, showAll],
  );

  // When staff resolves a blocking failure, reopen paused-for-failure tasks as
  // «Created» so the assignee confirms receipt again (fresh start, not mid-work).
  useEffect(() => {
    if (failureResumeBusyRef.current) return;
    const toReopen = operationsTasksToResumeAfterFailure(
      pausedTasks,
      failures,
      poRecords,
    );
    if (toReopen.length === 0) return;

    failureResumeBusyRef.current = true;
    void (async () => {
      try {
        await Promise.allSettled(
          toReopen.map((task) => patchOperationsTaskRecord(task.id, { status: "created" })),
        );
        await Promise.all([refetch(), refetchPaused()]);
      } finally {
        failureResumeBusyRef.current = false;
      }
    })();
  }, [pausedTasks, failures, poRecords, refetch, refetchPaused]);

  const detail = useMemo(
    () => (detailId ? tasks.find((t) => t.id === detailId) ?? null : null),
    [tasks, detailId],
  );

  // Deep-link / stale detail must not keep assignee on a failure-blocked task.
  useEffect(() => {
    if (!useIndependentQueue || !detail) return;
    if (!operationsTaskHiddenByFailure(detail, failures, poRecords)) return;
    setDetailId(null);
    setSelectedId(null);
  }, [useIndependentQueue, detail, failures, poRecords]);

  const reviewerStaff = useMemo(
    () => reviewerStaffForAccount(reviewerAccount, staffUsers),
    [reviewerAccount, staffUsers],
  );

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

  // Row handlers stay referentially stable — modal state updates do not break row memo.
  const openTask = useCallback((task: OperationsTask) => {
    setSelectedId(task.id);
    setDetailId(task.id);
  }, []);

  const openTaskDetail = useCallback((task: OperationsTask) => {
    setDetailId(task.id);
  }, []);

  const toggleTaskSelected = useCallback((taskId: string, on: boolean) => {
    setSelectedIds((prev) => {
      const next = { ...prev };
      if (on) next[taskId] = true;
      else delete next[taskId];
      return next;
    });
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

  /** Comment composer on the task detail — upload attachments, then post. */
  const sendComment = useCallback(
    async (taskId: string) => {
      if (!commentText.trim() && commentFiles.length === 0) return;
      setBusy(true);
      const uploadedFiles =
        commentFiles.length > 0
          ? await uploadDraftFiles(taskId, commentFiles)
          : undefined;
      const res = await addOperationsTaskCommentRecord(
        taskId,
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
    },
    [commentText, commentFiles, refetch],
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
        body.dueAtUtc = dueDateFromLocalParts(
          prioDueDate,
          prioDueTime,
        ).toISOString();
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

  // Bulk-remind is the only consumer of this flag here — dedicated transition instead of sharing
  // busy with the other handlers (rendering-usetransition-loading).
  const bulkRemind = useCallback(() => {
    startBulkRemind(async () => {
      const ids = Object.entries(selectedIds)
        .filter(([, on]) => on)
        .map(([id]) => id);
      const settled = await Promise.allSettled(
        ids
          .filter((id) => {
            const task = tasks.find((t) => t.id === id);
            return !!task && isActiveOperationsTask(task);
          })
          .map((id) => remindOperationsTaskRecord(id)),
      );
      const n = settled.filter((r) => r.status === "fulfilled" && r.value.ok).length;
      setSelectedIds({});
      showToast(n ? `تم تذكير ${n} مهمة` : "لا مهام قابلة للتذكير", "info");
      await refetch();
    });
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

  const submitReassign = useCallback(() => {
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
    const due = dueDateFromLocalParts(reassignDueDate, reassignDueTime);
    setReassignError(null);
    // Reassign modal is the visible UI while sending — dedicated transition.
    startReassign(async () => {
      const res = await reassignOperationsTaskRecord(taskId, {
        assigneeId: reassignAssigneeId.trim(),
        assigneeName: reassignAssigneeName.trim() || undefined,
        dueAtUtc: due.toISOString(),
        reason: reassignReason.trim(),
      });
      if (!res.ok) {
        setReassignError(res.error);
        return;
      }
      setReassignOpen(false);
      setReassignReason("");
      showToast("تم إعادة التوجيه والإسناد", "success");
      await refetch();
    });
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

  const creditAssignees = useMemo(
    () => creditAssigneeOptions(closeTargetTask, staffUsers),
    [closeTargetTask, staffUsers],
  );

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
      const rowIsAssignee = matchesOperationsTaskAssignee(task, reviewerAccount);
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

  const isAssignee = useMemo(() => {
    if (!detail) return false;
    // Executor queue is assignee-scoped — any open task row is theirs.
    if (useIndependentQueue) return true;
    return matchesOperationsTaskAssignee(
      detail,
      reviewerAccount,
      viewerDisplayName,
    );
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
  return {
    afterGovFailureRaised,
    allVisibleActiveChecked,
    applyPrioDueFromOffset,
    applyPriority,
    bulkRemind,
    bulkReminding,
    busy,
    canCreate,
    canRemind,
    cancelReason,
    closeFileInputRef,
    closeFiles,
    closeFormError,
    closeOpen,
    closeOutcome,
    closeText,
    commentFileInputRef,
    commentFiles,
    commentText,
    confirmCloseTask,
    confirmPauseTask,
    courtContacts,
    courtKind,
    courtOtherText,
    courtPerDeed,
    courtStatement,
    createOpen,
    createPrefill,
    creditAssigneeId,
    creditAssignees,
    detail,
    error,
    govFailureTarget,
    isAssignee,
    isDesktopViewport,
    isFetched,
    isFetching,
    kpis,
    now,
    openCloseModal,
    openGovFailureRaise,
    openKeysRegisterFromTask,
    openPauseModal,
    openPriorityModal,
    openReassign,
    openTask,
    openTaskDetail,
    pauseError,
    pauseOpen,
    pauseReason,
    poRecords,
    prioDueDate,
    prioDueTime,
    prioEditDue,
    prioOpen,
    prioValue,
    reassignAssigneeId,
    reassignAssignees,
    reassignDueDate,
    reassignDueTime,
    reassignError,
    reassignOpen,
    reassignReason,
    reassignTask,
    reassigning,
    refetch,
    remindTask,
    reviewerStaff,
    rowMenu,
    runStatus,
    scopeFilter,
    search,
    selAllRef,
    selectedCount,
    selectedId,
    sendComment,
    selectedIds,
    setBusy,
    setCancelReason,
    setCloseFiles,
    setCloseOpen,
    setCloseOutcome,
    setCloseText,
    setCommentFiles,
    setCommentText,
    setCourtContacts,
    setCourtKind,
    setCourtOtherText,
    setCourtPerDeed,
    setCourtStatement,
    setCreateOpen,
    setCreatePrefill,
    setCreditAssigneeId,
    setCreditAssigneeName,
    setDetailId,
    setError,
    setGovFailureTarget,
    setPauseOpen,
    setPauseReason,
    setPrioDueDate,
    setPrioDueTime,
    setPrioEditDue,
    setPrioOpen,
    setPrioValue,
    setReassignAssigneeId,
    setReassignAssigneeName,
    setReassignDueDate,
    setReassignDueTime,
    setReassignOpen,
    setReassignReason,
    setScopeFilter,
    setSearch,
    setSelectedId,
    setSelectedIds,
    setShowAll,
    setStatusFilter,
    showAll,
    showAllEyeBlink,
    showCreditPicker,
    showGovFailureRaise,
    staffLoadError,
    staffLoading,
    staffUsers,
    statusFilter,
    submitReassign,
    tasks,
    toggleShowAll,
    toggleTaskSelected,
    useIndependentQueue,
    visibleTasks,
  };
}
