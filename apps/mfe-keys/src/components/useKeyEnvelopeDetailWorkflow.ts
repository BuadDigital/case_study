"use client";

/**
 * All non-rendering workflow behind `KeyEnvelopeDetailPage`: envelope + court
 * access load, tab and modal state, the two idempotent confirmations, and the
 * refresh that feeds the parent `onChanged`. The component consumes the
 * returned bag and keeps JSX plus event wiring only.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@platform/ui-kit";
import { useIdempotentAction } from "@platform/app-shared";
import { useDistributionAssigneesQuery } from "@settings/mfe/query/settings-queries";
import { getFieldInspectors } from "@case-study/mfe/lib/distribution-assignees";
import {
  confirmEnvelopeAssignment,
  confirmEnvelopeHandoff,
  loadKeyEnvelope,
  loadPropertyCourtAccess,
} from "../lib/keys-envelope-api";
import {
  assignmentStatusLabel,
  type KeyAssignmentMatchStatus,
  type KeyEnvelopeAssignment,
  type KeyEnvelopeLinkedProperty,
  type KeyEnvelopeRow,
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
  } | null>(null);
  const pendingHandoffId = useRef<string | null>(null);

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

  const commandBusy = busy || confirmingAssignment || confirmingHandoff;

  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;

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
        showToastRef.current(result.error, "error");
        onBackRef.current();
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

  async function handleConfirmAssignment(
    assignmentId: string,
    status: KeyAssignmentMatchStatus,
    notes?: string,
  ) {
    if (!env) return;
    const deed =
      env.assignments.find((a) => a.id === assignmentId)?.deedNumber ?? "";
    pendingAssignment.current = { assignmentId, status, notes };
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
    handleConfirmHandoff,
    handleCourtAccessSaved,
    handleHandoffDone,
  };
}
