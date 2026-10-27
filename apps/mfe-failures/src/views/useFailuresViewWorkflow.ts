"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import { useViewportDesktop } from "@platform/app-shared/hooks/use-viewport-desktop";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import { useToast } from "@platform/ui-kit";
import {
  getFailuresCaseStudyBridge,
  usePoRecordsViaBridge,
} from "@platform/app-shared/failures/case-study-bridge";
import type {
  FailureRecord,
  FailureStatus,
} from "@platform/app-shared/failures/failures-types";
import { failureStatusErrorToast } from "../lib/failure-status-toast";
import {
  resolveFailure,
  returnFailure,
  submitFailureForReview,
  upgradeFailureToInternal,
} from "../lib/failures-repository";
import {
  assignmentSpecialistByPo,
  failureBusyKey,
  failuresKpiStats,
  isCaseEditor,
  isResolveDraftComplete,
  isSupervisor,
  patchResolveDraftMap,
  resolveDraftFor,
  resolvedFailureRedirect,
  type ResolveDraft,
} from "../lib/failures-view-state";
import {
  invalidateFailuresRelated,
  optimisticFailureStatus,
  restoreFailuresSnapshot,
} from "../query/failures-queries";
import { useFailuresListPage } from "./useFailuresListPage";

/**
 * Workflow of the failures queue: the paged rows (`useFailuresListPage`), the
 * viewer's powers, the expanded row, the supervisor / resolve drafts and the
 * optimistic status commands. `FailuresView` composes the regions over this
 * bag; pure decisions live in `lib/failures-view-state.ts`.
 */
export function useFailuresViewWorkflow() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("highlight")?.trim() || null;
  const { showToast } = useToast();
  const { role } = useAppAccess();
  const caseEditor = isCaseEditor(role);
  const supervisor = isSupervisor(role);
  // Server-paged rows (pagination contract); `kpiItems` is the whole set the KPI band still needs.
  const {
    rows,
    rowsPage,
    kpiItems,
    tab,
    setTab,
    tabCounts,
    search,
    setSearch,
    setPage,
    pager,
    isFetched,
    isError,
    error,
    refetch,
  } = useFailuresListPage(role, highlightId);
  const { data: poRecords = [] } = usePoRecordsViaBridge();
  const specialistByPo = useMemo(
    () => assignmentSpecialistByPo(poRecords),
    [poRecords],
  );
  // After hydration mount only one tree (table or cards) — both used to build together.
  const isDesktopViewport = useViewportDesktop();
  const [expandedId, setExpandedId] = useState<string | null>(highlightId);
  const [supervisorNote, setSupervisorNote] = useState<Record<string, string>>(
    {},
  );
  const [resolveDraft, setResolveDraft] = useState<Record<string, ResolveDraft>>(
    {},
  );
  const [resolveOpen, setResolveOpen] = useState<Record<string, boolean>>({});
  /** «تصعيد إلى المشرف» form per failure: open flag and the explanation being typed. */
  const [escalateOpen, setEscalateOpen] = useState<Record<string, boolean>>({});
  const [escalateNote, setEscalateNote] = useState<Record<string, string>>({});
  /**
   * «اعتماد التعذّر» opens the final-failure dialog on this failure. How it works: the id is kept,
   * the record read from the visible rows. Edge cases: if the row leaves the page (refetch, tab
   * switch) the record is null and the dialog closes itself instead of posting for a stale row.
   * The button used to approve straight away with the optional note; it now goes through the
   * same dialog as the property ⋮ menu (reason required, notify choice, whole transaction).
   */
  const [finalFailureId, setFinalFailureId] = useState<string | null>(null);
  const finalFailure = finalFailureId
    ? rows.find((f) => f.id === finalFailureId) ?? null
    : null;
  /** `failureId:action` — shows Spinner on the button during the network call. */
  const [busyKey, setBusyKey] = useState<string | null>(null);
  /** Sync guard — React state alone can miss two clicks in the same frame. */
  const busyLockRef = useRef(false);

  // A highlighted failure opens itself, then the row is scrolled into view.
  const highlightKey = highlightId && isFetched ? highlightId : "";
  const [prevHighlightKey, setPrevHighlightKey] = useState(highlightKey);
  if (prevHighlightKey !== highlightKey) {
    setPrevHighlightKey(highlightKey);
    if (highlightKey) setExpandedId(highlightKey);
  }

  useEffect(() => {
    if (!highlightId || !isFetched) return;
    const el = document.getElementById(`failure-${highlightId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightId, isFetched, rows]);

  const router = useRouter();

  const refresh = useCallback(() => {
    invalidateFailuresRelated(queryClient);
    void refetch();
  }, [queryClient, refetch]);

  const stats = useMemo(() => failuresKpiStats(kpiItems), [kpiItems]);

  async function runBusy(
    key: string,
    work: () => Promise<void>,
  ): Promise<void> {
    // One in-flight mutation at a time — overlapping optimistic patches on the
    // same list desync when an earlier request fails after a later one patched.
    if (busyLockRef.current) return;
    busyLockRef.current = true;
    setBusyKey(key);
    try {
      await work();
    } finally {
      busyLockRef.current = false;
      setBusyKey(null);
    }
  }

  async function runOptimisticStatus(
    id: string,
    nextStatus: FailureStatus,
    work: () => Promise<{ ok: true } | { ok: false; error: string }>,
    opts: {
      busyKey: string;
      successToast: string;
      errorToast: string;
      extra?: Partial<FailureRecord>;
      onOk?: () => void;
    },
  ): Promise<void> {
    await runBusy(opts.busyKey, async () => {
      await queryClient.cancelQueries({ queryKey: appDataKeys.failures() });
      const snapshot = optimisticFailureStatus(
        queryClient,
        id,
        nextStatus,
        opts.extra,
      );
      try {
        const result = await work();
        if (!result.ok) {
          restoreFailuresSnapshot(queryClient, snapshot);
          showToast(failureStatusErrorToast(opts.errorToast, result.error), "error");
          return;
        }
        showToast(opts.successToast, "success");
        opts.onOk?.();
        refresh();
      } catch (err) {
        restoreFailuresSnapshot(queryClient, snapshot);
        showToast(failureStatusErrorToast(opts.errorToast, err), "error");
      }
    });
  }

  /**
   * «تأكيد التصعيد إلى المشرف».
   *
   * How it works: sends the typed explanation with the escalation, flips the row to «قيد
   * المراجعة» optimistically (with the note, so the panel shows «سبب التصعيد» at once) and closes
   * the form when the server agrees; a refusal restores the row.
   *
   * Edge cases: a blank note does nothing (the confirm button is disabled for it too) — the
   * escalation used to be one click with no explanation; one is required now.
   */
  function handleSubmit(id: string) {
    const note = (escalateNote[id] ?? "").trim();
    if (!note) return;
    void runOptimisticStatus(id, "review", () => submitFailureForReview(id, note), {
      busyKey: failureBusyKey(id, "submit"),
      successToast: "تم تصعيد التعذّر إلى المشرف",
      errorToast: "تعذّر تصعيد التعذّر — حاول مرة أخرى",
      extra: { escalationNote: note },
      onOk: () => setEscalateOpen((o) => ({ ...o, [id]: false })),
    });
  }

  /** Opens or closes the escalation form; it and the resolve form never show together. */
  function toggleEscalate(id: string) {
    setEscalateOpen((o) => ({ ...o, [id]: !o[id] }));
    setResolveOpen((o) => ({ ...o, [id]: false }));
  }

  function setEscalateNoteFor(id: string, value: string) {
    setEscalateNote((n) => ({ ...n, [id]: value }));
  }

  function handleUpgrade(id: string) {
    void runOptimisticStatus(id, "internal", () => upgradeFailureToInternal(id), {
      busyKey: failureBusyKey(id, "upgrade"),
      successToast: "تم تأكيد التعذّر الداخلي",
      errorToast: "تعذّر ترقية التعذّر — حاول مرة أخرى",
      extra: { severity: "internal" },
    });
  }

  function handleReturn(id: string) {
    const note = supervisorNote[id] ?? "";
    void runOptimisticStatus(id, "returned", () => returnFailure(id, note), {
      busyKey: failureBusyKey(id, "return"),
      successToast: "أُعيد التعذّر للأخصائي",
      errorToast: "تعذّر إرجاع التعذّر — حاول مرة أخرى",
      extra: { finalNote: note },
    });
  }

  async function handleSuspend(id: string) {
    const failure = rows.find((f) => f.id === id);
    if (!failure) return;
    await runOptimisticStatus(
      id,
      "suspended",
      async () => {
        const result = await getFailuresCaseStudyBridge().suspendPropertyTransaction({
          failure,
          supervisorNote: supervisorNote[id] ?? "",
        });
        if (result.ok) return { ok: true as const };
        return {
          ok: false as const,
          error: result.error || "تعذّر إيقاف المعاملة — حاول مرة أخرى",
        };
      },
      {
        busyKey: failureBusyKey(id, "suspend"),
        successToast: "تم تعليق المعاملة",
        errorToast: "تعذّر إيقاف المعاملة — حاول مرة أخرى",
      },
    );
  }

  function handleResolve(id: string) {
    const draft = resolveDraftFor(resolveDraft, id);
    if (!isResolveDraftComplete(draft)) return;
    const failure = rows.find((f) => f.id === id);
    void runOptimisticStatus(
      id,
      "resolved",
      () =>
        resolveFailure(id, {
          resolutionReason: draft.reason,
          continueInstructions: draft.instructions,
        }),
      {
        busyKey: failureBusyKey(id, "resolve"),
        successToast: "تم حل التعذّر",
        errorToast: "تعذّر حل التعذّر — حاول مرة أخرى",
        extra: {
          resolutionReason: draft.reason,
          continueInstructions: draft.instructions,
        },
        onOk: () => {
          setResolveOpen((o) => ({ ...o, [id]: false }));
          const redirect = resolvedFailureRedirect(failure);
          if (redirect) router.push(redirect);
        },
      },
    );
  }

  function toggleResolve(id: string) {
    setResolveOpen((o) => ({ ...o, [id]: !o[id] }));
    setEscalateOpen((o) => ({ ...o, [id]: false }));
  }

  function patchResolveDraft(id: string, patch: Partial<ResolveDraft>) {
    setResolveDraft((d) => patchResolveDraftMap(d, id, patch));
  }

  function setSupervisorNoteFor(id: string, value: string) {
    setSupervisorNote((n) => ({ ...n, [id]: value }));
  }

  const toggleExpanded = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  return {
    role,
    caseEditor,
    supervisor,
    highlightId,
    isDesktopViewport,
    rows,
    rowsPage,
    tab,
    setTab,
    tabCounts,
    search,
    setSearch,
    setPage,
    pager,
    isFetched,
    isError,
    error,
    refetch,
    stats,
    specialistByPo,
    expandedId,
    toggleExpanded,
    supervisorNote,
    setSupervisorNoteFor,
    resolveDraft,
    resolveOpen,
    escalateOpen,
    escalateNote,
    toggleEscalate,
    setEscalateNoteFor,
    busyKey,
    handleSubmit,
    handleUpgrade,
    finalFailure,
    setFinalFailureId,
    closeFinalFailure: () => setFinalFailureId(null),
    handleReturn,
    handleSuspend,
    handleResolve,
    toggleResolve,
    patchResolveDraft,
  };
}

/** The bag `useFailuresViewWorkflow` returns — region components take it whole. */
export type FailuresViewWorkflow = ReturnType<typeof useFailuresViewWorkflow>;
