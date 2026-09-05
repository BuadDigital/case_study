"use client";

/**
 * Write half of `useOperationsTasksWorkflow`: the status patches, the close /
 * pause modals, the comment composer, reminders, the failure auto-resume sweep
 * and the government-reviewer failure raise. Priority and reassignment live in
 * `useOperationsTasksAssignmentCommands`. Reads the state owned by
 * `useOperationsTasksData`.
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@platform/ui-kit";
import {
  isActiveOperationsTask,
  type OperationsTask,
} from "../lib/app-data/operations-tasks-model";
import {
  addOperationsTaskCommentRecord,
  patchOperationsTaskRecord,
  remindOperationsTaskRecord,
} from "../lib/app-data/operations-tasks-commands";
import type { OperationsTaskFailureTarget } from "../lib/app-data/operations-task-failure-targets";
import { OPS_TASK_FAILURE_PAUSE_REASON } from "../lib/app-data/operations-task-failure-obstruction";
import { uploadDraftFiles, type DraftFile } from "./OperationsTasksViewShared";
import type {
  CourtVisitContactDraft,
  CourtVisitKind,
} from "./OperationsTasksCloseModal";
import {
  buildCloseTaskSubmission,
  buildStatusPatchBody,
  closeModalDefaults,
  keysRegisterPathForTask,
  operationsTasksToResumeAfterFailure,
  type CourtVisitResultPatch,
  type OperationsTaskPatch,
} from "./operations-tasks-view-state";
import type { OperationsTasksData } from "./useOperationsTasksData";

export function useOperationsTasksCommands(data: OperationsTasksData) {
  const {
    deepLinkTaskId,
    poRecords,
    canCreate,
    tasks,
    refetch,
    pausedTasks,
    refetchPaused,
    failures,
    setSelectedId,
    setDetailId,
    selectedIds,
    setSelectedIds,
    detail,
    govFailureTargets,
  } = data;
  const router = useRouter();
  const { showToast } = useToast();
  const failureResumeBusyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [bulkReminding, startBulkRemind] = useTransition();
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
  const [govFailureTarget, setGovFailureTarget] =
    useState<OperationsTaskFailureTarget | null>(null);
  const commentFileInputRef = useRef<HTMLInputElement>(null);
  const closeFileInputRef = useRef<HTMLInputElement>(null);

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

  const openCloseModal = useCallback((task: OperationsTask) => {
    setSelectedId(task.id);
    setDetailId(task.id);
    setCloseText("");
    setCloseFiles([]);
    setCloseFormError(null);
    setCancelReason("");
    const defaults = closeModalDefaults(task, canCreate);
    setCloseOutcome(defaults.closeOutcome);
    setCourtKind("");
    setCourtOtherText("");
    setCourtStatement("");
    setCourtPerDeed({});
    setCourtContacts([]);
    setCreditAssigneeId(defaults.creditAssigneeId);
    setCreditAssigneeName(defaults.creditAssigneeName);
    setCloseOpen(true);
  }, [canCreate, setSelectedId, setDetailId]);

  const openPauseModal = useCallback((task: OperationsTask) => {
    setPauseTaskId(task.id);
    setPauseReason("");
    setPauseError(null);
    setPauseOpen(true);
  }, []);

  const runPatch = useCallback(
    async (id: string, body: OperationsTaskPatch) => {
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
      courtVisitResult?: CourtVisitResultPatch,
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
      const ok = await runPatch(
        id,
        buildStatusPatchBody({
          status,
          courtVisitResult,
          credit,
          cancelReason: cancelReasonText,
        }),
      );
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
          router.push(keysRegisterPathForTask(taskBefore));
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
      const result = buildCloseTaskSubmission(
        task,
        {
          closeOutcome,
          cancelReason,
          closeText,
          closeFiles,
          courtKind,
          courtOtherText,
          courtStatement,
          courtPerDeed,
          courtContacts,
          creditAssigneeId,
          creditAssigneeName,
        },
        canCreate,
      );
      if (!result.ok) {
        setCloseFormError(result.error);
        return;
      }
      // Cancelling and the court-visit close clear the form error up front; the
      // plain close leaves it to `runStatus` on success (as it always has).
      if (result.submission.status === "cancelled" || task.type === "court_visit") {
        setCloseFormError(null);
      }
      const s = result.submission;
      void runStatus(
        task.id,
        s.status,
        s.closeComment,
        s.files,
        s.courtVisitResult,
        s.credit,
        s.cancelReason,
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
      router.push(keysRegisterPathForTask(task));
    },
    [router],
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
  }, [selectedIds, tasks, showToast, refetch, setSelectedIds]);

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
  }, [detail?.id, deepLinkTaskId, refetch, router, showToast, setDetailId, setSelectedId]);

  return {
    router,
    showToast,
    busy,
    setBusy,
    bulkReminding,
    error,
    setError,
    commentFileInputRef,
    closeFileInputRef,
    commentText,
    setCommentText,
    commentFiles,
    setCommentFiles,
    closeText,
    setCloseText,
    closeFiles,
    setCloseFiles,
    closeOpen,
    setCloseOpen,
    closeFormError,
    closeOutcome,
    setCloseOutcome,
    cancelReason,
    setCancelReason,
    courtKind,
    setCourtKind,
    courtOtherText,
    setCourtOtherText,
    courtStatement,
    setCourtStatement,
    courtPerDeed,
    setCourtPerDeed,
    courtContacts,
    setCourtContacts,
    creditAssigneeId,
    setCreditAssigneeId,
    setCreditAssigneeName,
    pauseOpen,
    setPauseOpen,
    pauseReason,
    setPauseReason,
    pauseError,
    govFailureTarget,
    setGovFailureTarget,
    openCloseModal,
    openPauseModal,
    runPatch,
    confirmPauseTask,
    runStatus,
    confirmCloseTask,
    sendComment,
    openKeysRegisterFromTask,
    remindTask,
    bulkRemind,
    openGovFailureRaise,
    afterGovFailureRaised,
  };
}

export type OperationsTasksCommands = ReturnType<
  typeof useOperationsTasksCommands
>;
