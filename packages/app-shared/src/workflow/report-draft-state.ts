import { useSyncExternalStore } from "react";

/**
 * Where a property's valuation-report draft stands, as the queues show it. The draft lives in the
 * valuation service while the queue rows come from the case-study service, so the labels read a small
 * client cache that a batch read fills (`useReportDraftStates`).
 */
export type ReportDraftState = {
  status: "none" | "preparing" | "sent" | "approved";
  reportStage: "draft" | "deposit_issued" | "final_issued";
  /** The appraiser's progress ladder 0–100 as the server computed it; absent when the state came from a single draft read. */
  progressPct?: number;
};

export type AppraisalStageGroup = "draft_sent" | "approved" | "closed";

export type AppraisalStageLabel = {
  group: AppraisalStageGroup;
  label: string;
  className: string;
};

const states = new Map<string, ReportDraftState>();
const listeners = new Set<() => void>();
let version = 0;

export function getReportDraftState(propertyId: string | null | undefined): ReportDraftState | undefined {
  return propertyId ? states.get(propertyId) : undefined;
}

/** Stores fresh states; listeners hear about it only when something changed. */
export function putReportDraftStates(
  incoming: readonly {
    propertyId: string;
    status: ReportDraftState["status"];
    reportStage: ReportDraftState["reportStage"];
    progressPct?: number;
  }[],
): void {
  let changed = false;
  for (const s of incoming) {
    const prev = states.get(s.propertyId);
    // A single draft read carries no progress: keep the last ladder value the batch gave.
    const progressPct = s.progressPct ?? prev?.progressPct;
    if (prev?.status === s.status && prev.reportStage === s.reportStage && prev.progressPct === progressPct) continue;
    states.set(s.propertyId, { status: s.status, reportStage: s.reportStage, progressPct });
    changed = true;
  }
  if (!changed) return;
  version += 1;
  for (const l of listeners) l();
}

export function clearReportDraftStates(): void {
  if (states.size === 0) return;
  states.clear();
  version += 1;
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Re-renders the caller whenever the cache changes; the number is also a memo dependency. */
export function useReportDraftStateVersion(): number {
  return useSyncExternalStore(subscribe, () => version, () => 0);
}

/**
 * The finer label for an appraisal whose package was handed to the specialist: a draft the appraiser
 * has to approve, or an approved report waiting for the deposit code. Null: nothing finer than «handed over».
 */
export function appraisalStageLabel(
  draft: ReportDraftState | undefined,
): AppraisalStageLabel | null {
  if (!draft) return null;
  if (draft.reportStage === "final_issued") {
    return { group: "closed", label: "صدر التقرير النهائي", className: "b-done" };
  }
  if (draft.reportStage === "deposit_issued" || draft.status === "approved") {
    return { group: "approved", label: "معتمد — بانتظار رمز الإيداع", className: "b-gold" };
  }
  if (draft.status === "sent") {
    return { group: "draft_sent", label: "مسودة بانتظار اعتمادك", className: "b-gold" };
  }
  return null;
}

/** Hand-over to the specialist — the rung between the valuation work (≤ 65) and the specialist's draft (85). */
export const APPRAISER_HANDED_OVER_PCT = 75;

/**
 * The appraiser's progress for the study queue: the ladder the server computed (10 started → 30 market → 50 cost →
 * 65 opinion → 75 handed over → 85 draft sent → 92 approved → 100 final issued). A completed task is 100; the
 * hand-over rung comes from the task's package status, which only Case Study knows.
 */
export function appraiserProgressPct(input: {
  state: ReportDraftState | undefined;
  packageSubmitted: boolean;
  completed: boolean;
}): number {
  if (input.completed) return 100;
  const ladder = input.state?.progressPct ?? 0;
  return input.packageSubmitted ? Math.max(ladder, APPRAISER_HANDED_OVER_PCT) : ladder;
}
