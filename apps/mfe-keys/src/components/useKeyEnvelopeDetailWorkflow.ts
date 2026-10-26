"use client";

/**
 * All non-rendering workflow behind `KeyEnvelopeDetailPage`: envelope + court
 * access load, tab and modal state, the two idempotent confirmations, and the
 * refresh that feeds the parent `onChanged`. The component consumes the
 * returned bag and keeps JSX plus event wiring only.
 */
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import { useToast } from "@platform/ui-kit";
import { useIdempotentAction } from "@platform/app-shared";
import { useDistributionAssigneesQuery } from "@settings/mfe/query/settings-queries";
import { getFieldInspectors } from "@case-study/mfe/lib/distribution-assignees";
import {
  confirmEnvelopeAssignment,
  confirmEnvelopeHandoff,
  loadKeyEnvelope,
  loadPropertyCourtAccess,
  setEnvelopeKeyLocation,
} from "../lib/keys-envelope-api";
import {
  assignmentStatusLabel,
  keyLocationLabel,
  type KeyAssignmentMatchStatus,
  type KeyEnvelopeAssignment,
  type KeyEnvelopeLinkedProperty,
  type KeyEnvelopeRow,
  type KeyLocation,
  type PropertyCourtAccessRow,
} from "../lib/keys-envelope-types";
import {
  sortAssignmentsByPending,
  upsertCourtAccessRow,
  type DetailTab,
} from "./key-envelope-detail-state";

export function useKeyEnvelopeDetailWorkflow({
  envelopeId,
  onBack,
  onChanged,
}: {
  envelopeId: string;
  onBack: () => void;
  onChanged: () => void;
}) {
  const { showToast } = useToast();
  const { data: staffResult } = useDistributionAssigneesQuery();
  const staffLoadError = staffResult?.loadError ?? null;
  const fieldInspectors = useMemo(
    () => getFieldInspectors(staffResult?.users ?? []),
    [staffResult?.users],
  );

  const [env, setEnv] = useState<KeyEnvelopeRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<DetailTab>("assign");
  const [busy, setBusy] = useState(false);
  const [matchTarget, setMatchTarget] = useState<KeyEnvelopeAssignment | null>(
    null,
  );
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [courtAccess, setCourtAccess] = useState<PropertyCourtAccessRow[]>([]);
  const [courtEditTarget, setCourtEditTarget] =
    useState<KeyEnvelopeLinkedProperty | null>(null);

  const pendingAssignment = useRef<{
    assignmentId: string;
    status: KeyAssignmentMatchStatus;
    notes?: string;
    keyLocation?: KeyLocation | null;
  } | null>(null);
  const pendingHandoffId = useRef<string | null>(null);
  // Decision 2026-10-20: the reviewer's key-place correction in flight, read by the idempotent action.
  const pendingKeyLocation = useRef<{
    assignmentId: string;
    keyLocation: KeyLocation;
    keyHolderUserId?: string | null;
    keyHolderLabel?: string | null;
  } | null>(null);

  const { execute: executeConfirmAssignment, loading: confirmingAssignment } =
    useIdempotentAction(
      useCallback(async (idempotencyKey: string) => {
        const pending = pendingAssignment.current;
        if (!env || !pending) throw new Error("لا يوجد إسناد للتأكيد");
        return confirmEnvelopeAssignment(
          env.id,
          pending.assignmentId,
          pending.status,
          pending.notes,
          idempotencyKey,
          pending.keyLocation,
        );
      }, [env]),
    );

  const { execute: executeSetKeyLocation, loading: settingKeyLocation } =
    useIdempotentAction(
      useCallback(async (idempotencyKey: string) => {
        const pending = pendingKeyLocation.current;
        if (!env || !pending) throw new Error("لا يوجد إسناد لتحديث مكان مفتاحه");
        return setEnvelopeKeyLocation(
          env.id,
          pending.assignmentId,
          {
            keyLocation: pending.keyLocation,
            keyHolderUserId: pending.keyHolderUserId ?? null,
            keyHolderLabel: pending.keyHolderLabel ?? null,
          },
          idempotencyKey,
        );
      }, [env]),
    );

  const { execute: executeConfirmHandoff, loading: confirmingHandoff } =
    useIdempotentAction(
      useCallback(async (idempotencyKey: string) => {
        const handoffId = pendingHandoffId.current;
        if (!env || !handoffId) throw new Error("لا توجد مناولة للتأكيد");
        return confirmEnvelopeHandoff(env.id, handoffId, idempotencyKey);
      }, [env]),
    );

  const commandBusy =
    busy || confirmingAssignment || confirmingHandoff || settingKeyLocation;

  const onLoadFailed = useEffectEvent((error: string) => {
    showToast(error, "error");
    onBack();
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setTab("assign");
      setMatchTarget(null);
      setHandoffOpen(false);
      setCourtAccess([]);
      setCourtEditTarget(null);
      const result = await loadKeyEnvelope(envelopeId);
      if (cancelled) return;
      setLoading(false);
      if (result.ok) {
        setEnv(result.data);
        const access = await loadPropertyCourtAccess(
          result.data.requestNumber,
        );
        if (!cancelled) setCourtAccess(access);
      } else {
        onLoadFailed(result.error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [envelopeId]);

  const sortedAssignments = useMemo(
    () => sortAssignmentsByPending(env),
    [env],
  );

  async function refresh(next?: KeyEnvelopeRow) {
    if (next) {
      if (!Array.isArray(next.assignments)) {
        onChanged();
        return;
      }
      setEnv(next);
      onChanged();
      return;
    }
    const result = await loadKeyEnvelope(envelopeId);
    if (result.ok) {
      setEnv(result.data);
      onChanged();
    }
  }

  /**
   * Saves a deed's key-trial result from the match dialog.
   *
   * How it works: stores the result (status, note, key place) in `pendingAssignment`, runs the
   * idempotent `confirmEnvelopeAssignment` action; on success closes the dialog, toasts the
   * result and either refreshes the envelope from the returned row or, when the write was
   * queued offline, only tells the parent something changed.
   *
   * Edge cases: decision 2026-10-20 — the key place goes with the result, so a trial recorded
   * offline in the field keeps where the key went; a second click while one runs is skipped.
   */
  async function handleConfirmAssignment(
    assignmentId: string,
    status: KeyAssignmentMatchStatus,
    notes?: string,
    keyLocation?: KeyLocation | null,
  ) {
    if (!env) return;
    const deed =
      env.assignments.find((a) => a.id === assignmentId)?.deedNumber ?? "";
    pendingAssignment.current = { assignmentId, status, notes, keyLocation };
    const outcome = await executeConfirmAssignment();
    if (outcome.status === "skipped") return;
    const result = outcome.value;
    if (!result.ok) {
      showToast(result.error, "error");
      return;
    }
    setMatchTarget(null);
    showToast(
      `سُجّلت نتيجة الصك ${deed} — ${assignmentStatusLabel(status)}.`,
      "success",
    );
    if (result.queued) {
      onChanged();
      return;
    }
    await refresh(result.data);
  }

  /**
   * The reviewer corrects where a deed's matching key is (decision 2026-10-20).
   *
   * How it works: stores the correction (assignment, place, holder id and name) in
   * `pendingKeyLocation`, then runs the idempotent `setEnvelopeKeyLocation` action, which reads
   * it; on success toasts «مفتاح الصك <deed>: <place>» and refreshes the envelope from the
   * returned row; on failure toasts the error.
   *
   * Edge cases: a second click while one is in flight is skipped by the idempotent action; a
   * failed call keeps its idempotency key so a retry cannot apply twice; no holder → both
   * holder fields sent as null.
   */
  async function handleSetKeyLocation(
    assignmentId: string,
    keyLocation: KeyLocation,
    holder?: { userId?: string | null; label?: string | null },
  ) {
    if (!env) return;
    const deed =
      env.assignments.find((a) => a.id === assignmentId)?.deedNumber ?? "";
    pendingKeyLocation.current = {
      assignmentId,
      keyLocation,
      keyHolderUserId: holder?.userId ?? null,
      keyHolderLabel: holder?.label ?? null,
    };
    const outcome = await executeSetKeyLocation();
    if (outcome.status === "skipped") return;
    const result = outcome.value;
    if (!result.ok) {
      showToast(result.error, "error");
      return;
    }
    showToast(
      `مفتاح الصك ${deed}: ${keyLocationLabel(keyLocation, holder?.label)}.`,
      "success",
    );
    await refresh(result.data);
  }

  async function handleConfirmHandoff(handoffId: string) {
    if (!env) return;
    pendingHandoffId.current = handoffId;
    const outcome = await executeConfirmHandoff();
    if (outcome.status === "skipped") return;
    const result = outcome.value;
    if (!result.ok) {
      showToast(result.error, "error");
      return;
    }
    showToast("تم تأكيد استلام المناولة.", "success");
    if (result.queued) {
      onChanged();
      return;
    }
    await refresh(result.data);
  }

  function handleCourtAccessSaved(row: PropertyCourtAccessRow) {
    setCourtAccess((prev) => upsertCourtAccessRow(prev, row));
    setCourtEditTarget(null);
  }

  async function handleHandoffDone(next: KeyEnvelopeRow) {
    setHandoffOpen(false);
    await refresh(next);
  }

  return {
    env,
    loading,
    tab,
    setTab,
    setBusy,
    commandBusy,
    matchTarget,
    setMatchTarget,
    handoffOpen,
    setHandoffOpen,
    courtAccess,
    courtEditTarget,
    setCourtEditTarget,
    fieldInspectors,
    staffLoadError,
    sortedAssignments,
    handleConfirmAssignment,
    handleSetKeyLocation,
    handleConfirmHandoff,
    handleCourtAccessSaved,
    handleHandoffDone,
  };
}
