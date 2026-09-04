"use client";

/**
 * Everything the engineering survey work screen loads and derives: the draft
 * load/merge cycle, the debounced field persistence, the documentary gate and
 * the lock/readonly flags the panel renders from. Writes live in
 * `useEngineeringSurveyCommands`; this hook owns the state they mutate.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@platform/ui-kit";
import type { WorkflowTask } from "@case-study/mfe/lib/app-data/tasks-storage";
import { surveyWorkGate } from "@case-study/mfe/lib/app-data/documentary-workflow-gates";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import {
  usePoRecordQuery,
  useWorkflowTasksQuery,
} from "@case-study/mfe/query/case-study-queries";
import { useInspectorFeesQuery } from "@case-study/mfe/query/inspector-fees-queries";
import { blockingFailureForProperty } from "@failures/mfe/lib/failure-property-match";
import { useFailuresQuery } from "@failures/mfe/query/failures-queries";
import { isActiveFailureStatus } from "@platform/app-shared/failures/failures-types";
import {
  createEngineeringSurveyDraft,
  isEngineeringSurveyFormLocked,
  type EngineeringSurveySubmission,
} from "../lib/engineering-survey-data";
import { fetchEngineeringSurveySubmission } from "../lib/engineering-survey-submission-reads";
import {
  getOrCreateEngineeringSurveyDraft,
  updateEngineeringSurveyDraft,
} from "../lib/engineering-survey-submission-commands";
import type { EngineeringSurveyFieldErrors } from "../lib/engineering-survey-validation";
import type { EngineeringSurveyWindowHostRefObject } from "../lib/engineering-survey-window-host";
import { isEngineeringSurveyTransactionActive } from "../lib/engineering-survey-transaction-active";
import {
  EMPTY_FIELD_ERRORS,
  localFieldsFromDraft,
  mergeRemoteSurveyDraft,
  type LocalTextFields,
  type WorkTab,
} from "./EngineeringSurveyWorkParts";

export type EngineeringSurveyDataArgs = {
  childTask: WorkflowTask;
  hostRef: EngineeringSurveyWindowHostRefObject;
  deedNumber: string;
  variant: "workspace" | "entry";
  forceReadOnly: boolean;
};

export function useEngineeringSurveyData({
  childTask: task,
  hostRef,
  deedNumber,
  variant,
  forceReadOnly,
}: EngineeringSurveyDataArgs) {
  const { role } = useAppAccess();
  const viewOnly = variant === "workspace";
  const propertyId = task.propertyId ?? "";
  const { showToast, runWithUploadToast } = useToast();
  const { data: record } = usePoRecordQuery(task.poNumber);
  const property = record?.properties.find((p) => p.id === propertyId);
  const { data: failures = [] } = useFailuresQuery();
  const { data: workflowTasks = [] } = useWorkflowTasksQuery();
  const { data: feesSummary } = useInspectorFeesQuery({
    workflowTaskId: task.id,
    submittedOnly: false,
  });

  const feeForTask = useMemo(() => {
    const rows = feesSummary?.rows ?? [];
    return rows.find((r) => r.workflowTaskId === task.id) ?? null;
  }, [feesSummary?.rows, task.id]);

  const activeFailureCount = useMemo(() => {
    if (!propertyId) return 0;
    return failures.filter(
      (f) =>
        f.poNumber === task.poNumber &&
        f.propertyId === propertyId &&
        isActiveFailureStatus(f.status),
    ).length;
  }, [failures, propertyId, task.poNumber]);

  const blockingFailure = useMemo(() => {
    if (!propertyId) return null;
    return blockingFailureForProperty(failures, {
      poNumber: task.poNumber,
      propertyId,
      deedNumber,
    });
  }, [deedNumber, failures, propertyId, task.poNumber]);

  const [draft, setDraft] = useState<EngineeringSurveySubmission | null>(null);
  const [localFields, setLocalFields] = useState<LocalTextFields | null>(null);
  const [workTab, setWorkTab] = useState<WorkTab>("survey");
  const [fieldErrors, setFieldErrors] =
    useState<EngineeringSurveyFieldErrors>(EMPTY_FIELD_ERRORS);
  const [formError, setFormError] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [savingLocal, setSavingLocal] = useState(false);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPatchRef = useRef<Parameters<
    typeof updateEngineeringSurveyDraft
  >[1]>({});
  const localFieldsRef = useRef(localFields);
  localFieldsRef.current = localFields;
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const applyRemoteDraft = useCallback((next: EngineeringSurveySubmission) => {
    setDraft(
      mergeRemoteSurveyDraft(
        next,
        draftRef.current,
        localFieldsRef.current,
        pendingPatchRef.current.checklist,
      ),
    );
  }, []);

  const liveSurveyTask = useMemo(
    () => workflowTasks.find((t) => t.id === task.id) ?? task,
    [task, workflowTasks],
  );

  const documentaryGate = useMemo(
    () =>
      surveyWorkGate({
        role,
        surveyTask: liveSurveyTask,
        tasks: workflowTasks,
        hasActiveFailure: Boolean(blockingFailure) || activeFailureCount > 0,
        fieldInspectionCompleted:
          draft?.fieldInspectionCompleted ??
          liveSurveyTask.fieldInspectionCompleted,
      }),
    [
      activeFailureCount,
      blockingFailure,
      draft?.fieldInspectionCompleted,
      liveSurveyTask,
      role,
      workflowTasks,
    ],
  );

  useEffect(() => {
    if (!propertyId) return;
    let cancelled = false;
    const readOnly = forceReadOnly || viewOnly;
    const load = readOnly
      ? fetchEngineeringSurveySubmission(task.id).then(
          (existing) =>
            existing ??
            createEngineeringSurveyDraft({
              taskId: task.id,
              propertyId,
              poNumber: task.poNumber,
            }),
        )
      : getOrCreateEngineeringSurveyDraft({
          taskId: task.id,
          propertyId,
          poNumber: task.poNumber,
        });
    void load
      .then((loaded) => {
        if (cancelled) return;
        setDraft(loaded);
        setLocalFields(localFieldsFromDraft(loaded));
        setNoteDraft(loaded.transactionNote ?? "");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setFormError(
          err instanceof Error ? err.message : "تعذّر تحميل مسودة الرفع المساحي",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [task.id, task.poNumber, propertyId, forceReadOnly, viewOnly]);

  // Refresh inspection-completed flag without discarding in-progress form edits.
  useEffect(() => {
    if (!task.id) return;
    let cancelled = false;
    const refreshGate = () => {
      void fetchEngineeringSurveySubmission(task.id).then((fresh) => {
        if (cancelled || !fresh) return;
        if (typeof fresh.fieldInspectionCompleted !== "boolean") return;
        setDraft((prev) => {
          if (!prev) return prev;
          if (prev.fieldInspectionCompleted === fresh.fieldInspectionCompleted) {
            return prev;
          }
          return {
            ...prev,
            fieldInspectionCompleted: fresh.fieldInspectionCompleted,
          };
        });
      });
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshGate();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", refreshGate);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", refreshGate);
    };
  }, [task.id]);

  const locked =
    (draft ? isEngineeringSurveyFormLocked(draft.status) : false) ||
    forceReadOnly ||
    task.status === "completed";
  const formDisabled = locked || viewOnly || !documentaryGate.ready;

  const transactionActive = useMemo(
    () => isEngineeringSurveyTransactionActive(task.status, draft?.status),
    [draft?.status, task.status],
  );
  const notesEditable = !locked && !viewOnly && documentaryGate.ready;
  const savedNote = draft?.transactionNote?.trim() ?? "";

  const persist = useCallback(
    (patch: Parameters<typeof updateEngineeringSurveyDraft>[1]) => {
      if (!task.id) return;
      void updateEngineeringSurveyDraft(task.id, patch)
        .then((next) => {
          if (!next) return;
          applyRemoteDraft(next);
        })
        .catch((err: unknown) => {
          showToast(
            err instanceof Error
              ? err.message
              : "تعذّر حفظ الرفع المساحي — حاول مرة أخرى",
            "error",
          );
        });
    },
    [task.id, showToast, applyRemoteDraft],
  );

  const flushPendingPersist = useCallback(async () => {
    if (persistTimerRef.current) {
      clearTimeout(persistTimerRef.current);
      persistTimerRef.current = null;
    }
    const patch = pendingPatchRef.current;
    pendingPatchRef.current = {};
    if (!task.id || Object.keys(patch).length === 0) return;
    try {
      const next = await updateEngineeringSurveyDraft(task.id, patch);
      if (next) applyRemoteDraft(next);
    } catch (err: unknown) {
      showToast(
        err instanceof Error
          ? err.message
          : "تعذّر حفظ الرفع المساحي — حاول مرة أخرى",
        "error",
      );
    }
  }, [showToast, task.id, applyRemoteDraft]);

  const schedulePersist = useCallback(
    (patch: Parameters<typeof updateEngineeringSurveyDraft>[1]) => {
      pendingPatchRef.current = { ...pendingPatchRef.current, ...patch };
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
      persistTimerRef.current = setTimeout(() => {
        void flushPendingPersist();
      }, 350);
    },
    [flushPendingPersist],
  );

  useEffect(() => {
    return () => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    };
  }, []);

  const onWorkTabChange = useCallback((id: string) => {
    setWorkTab(id as WorkTab);
  }, []);

  return {
    // Context.
    role,
    viewOnly,
    propertyId,
    record,
    property,
    task,
    hostRef,
    liveSurveyTask,
    // Draft state.
    draft,
    setDraft,
    draftRef,
    localFields,
    setLocalFields,
    fieldErrors,
    setFieldErrors,
    formError,
    setFormError,
    savingLocal,
    setSavingLocal,
    // Gates and flags.
    documentaryGate,
    locked,
    formDisabled,
    transactionActive,
    notesEditable,
    blockingFailure,
    activeFailureCount,
    feeForTask,
    // Tabs and notes.
    workTab,
    setWorkTab,
    onWorkTabChange,
    savedNote,
    noteDraft,
    setNoteDraft,
    // Persistence.
    persist,
    schedulePersist,
    flushPendingPersist,
    applyRemoteDraft,
    showToast,
    runWithUploadToast,
  };
}

export type EngineeringSurveyData = ReturnType<typeof useEngineeringSurveyData>;
