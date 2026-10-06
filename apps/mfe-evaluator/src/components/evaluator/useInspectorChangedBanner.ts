"use client";

/**
 * Keeps the appraiser's view of «did the inspector's data change since I looked?» honest:
 * - the first open (no `inspectorDataSeen` yet) stores the baseline silently;
 * - a fresh read of his submission (window focus / inspection changed) refreshes the server's
 *   fingerprint and changed groups — it NEVER acknowledges anything;
 * - only the explicit «اطّلعت» click saves the fingerprint he saw into his own draft payload.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { fetchPartySubmission } from "@platform/app-shared/app-data/party-submission-api";
import type { EvaluatorSubmission } from "../../lib/evaluator/evaluator-window-data";
import { updateEvaluatorDraft } from "../../lib/evaluator/evaluator-submission-commands";
import { dtoToSubmission } from "../../lib/evaluator/evaluator-submission-model";
import {
  inspectorChangedBannerState,
  mergeInspectorDataMeta,
  type InspectorChangedBannerState,
} from "../../lib/evaluator/inspector-data-changes";

/** Same event string as case-study `FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT`. */
const FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT = "field-inspection-submission-changed";
const REFRESH_MIN_GAP_MS = 20_000;

export function useInspectorChangedBanner({
  taskId,
  draft,
  locked,
  setDraft,
  onError,
}: {
  taskId: string;
  draft: EvaluatorSubmission;
  locked: boolean;
  setDraft: Dispatch<SetStateAction<EvaluatorSubmission>>;
  onError?: (message: string) => void;
}): {
  state: InspectorChangedBannerState;
  busy: boolean;
  acknowledge: () => Promise<void>;
} {
  const [busy, setBusy] = useState(false);
  const baselineSentRef = useRef<string | null>(null);
  const lastRefreshRef = useRef(0);

  const state = useMemo(
    () =>
      inspectorChangedBannerState({
        fingerprint: draft.inspectorDataFingerprint,
        seen: draft.inspectorDataSeen,
        changedGroups: draft.inspectorDataChangedGroups,
        locked,
      }),
    [
      draft.inspectorDataFingerprint,
      draft.inspectorDataSeen,
      draft.inspectorDataChangedGroups,
      locked,
    ],
  );

  const saveSeen = useCallback(
    async (fingerprint: string): Promise<boolean> => {
      const updated = await updateEvaluatorDraft(taskId, {
        inspectorDataSeen: fingerprint,
      });
      if (!updated) return false;
      setDraft((prev) =>
        mergeInspectorDataMeta(prev, {
          inspectorDataSeen: updated.inspectorDataSeen ?? fingerprint,
          inspectorDataFingerprint: updated.inspectorDataFingerprint,
          inspectorDataChangedGroups: updated.inspectorDataChangedGroups,
        }),
      );
      return true;
    },
    [taskId, setDraft],
  );

  // First open: the baseline is set silently — nothing to show, nothing to click.
  useEffect(() => {
    if (state.kind !== "baseline") return;
    if (baselineSentRef.current === state.fingerprint) return;
    baselineSentRef.current = state.fingerprint;
    void saveSeen(state.fingerprint).catch((err: unknown) => {
      console.warn("[evaluator] inspector-data baseline save failed:", err);
    });
  }, [state, saveSeen]);

  const acknowledge = useCallback(async () => {
    if (state.kind !== "changed") return;
    setBusy(true);
    try {
      const ok = await saveSeen(state.fingerprint);
      if (!ok) onError?.("تعذّر حفظ اطّلاعك على تغيّر بيانات المعاين — حاول مرة أخرى");
    } catch {
      onError?.("تعذّر حفظ اطّلاعك على تغيّر بيانات المعاين — حاول مرة أخرى");
    } finally {
      setBusy(false);
    }
  }, [state, saveSeen, onError]);

  // A plain read refreshes the server's view (fingerprint + changed groups); it never acknowledges.
  useEffect(() => {
    if (!taskId || locked) return;
    let disposed = false;
    const refresh = () => {
      const now = Date.now();
      if (now - lastRefreshRef.current < REFRESH_MIN_GAP_MS) return;
      lastRefreshRef.current = now;
      void fetchPartySubmission(taskId)
        .then((dto) => {
          const fresh = dtoToSubmission(dto);
          if (disposed || !fresh) return;
          setDraft((prev) =>
            mergeInspectorDataMeta(prev, {
              inspectorDataFingerprint: fresh.inspectorDataFingerprint,
              inspectorDataChangedGroups: fresh.inspectorDataChangedGroups ?? [],
            }),
          );
        })
        .catch(() => {
          /* best-effort refresh */
        });
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener(FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT, refresh);
    return () => {
      disposed = true;
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT, refresh);
    };
  }, [taskId, locked, setDraft]);

  return { state, busy, acknowledge };
}
