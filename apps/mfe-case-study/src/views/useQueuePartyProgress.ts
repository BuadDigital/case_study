"use client";

/**
 * Party completion per parent task for the case-study queue table. One
 * `GET /api/case-study-reports/batch` for the listed parents (TanStack, keyed on
 * the sorted parent id set), then a pure fold per row to a `pct` per party. A
 * fresh `tasks` array identity only re-folds in memory; the party-form-changed
 * window event invalidates the batch. Owned by `useActiveTransactionQueueData`.
 */
import { useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import {
  appraiserProgressPct,
  getReportDraftState,
  useReportDraftStateVersion,
} from "@platform/app-shared/workflow/report-draft-state";
import { useReportDraftStates } from "@platform/app-shared/workflow/use-report-draft-states";
import type { CaseStudyInfoPartyId } from "@settings/mfe/lib/app-data/case-study-info-roles-data";
import {
  computePartyCaseStudyProgress,
  partyCaseStudyAnswersFromBatch,
} from "../lib/app-data/case-study-party-progress";
import type { CaseStudyReportDraftsByParent } from "../lib/app-data/case-study-report-reads";
import { PARTY_CASE_STUDY_REPORT_CHANGED_EVENT } from "../lib/app-data/case-study-report-model";
import type { WorkflowTask } from "../lib/app-data/tasks";
import { useCaseStudyReportBatchQuery } from "../query/case-study-queries";
import type { PartyProgressByTask } from "./active-transaction-queue-tables-state";

type InfoRolesMatrix = Parameters<typeof computePartyCaseStudyProgress>[0];

/* Stable empty ref — a fresh `new Map()` per render invalidated every consumer memo. */
const EMPTY_PROGRESS: PartyProgressByTask = new Map();

/** Pure fold of one batch onto per-parent party completion. */
export function foldPartyProgressForQueue(
  listed: readonly WorkflowTask[],
  tasks: WorkflowTask[],
  infoRolesMatrix: InfoRolesMatrix,
  drafts: CaseStudyReportDraftsByParent,
): PartyProgressByTask {
  const result: PartyProgressByTask = new Map();
  for (const parent of listed) {
    const answers = partyCaseStudyAnswersFromBatch(
      parent,
      tasks,
      drafts.get(parent.id.toLowerCase()),
    );
    const rows = computePartyCaseStudyProgress(infoRolesMatrix, answers, {
      includeSpecialistAnswers: false,
    });
    const progress: Partial<Record<CaseStudyInfoPartyId, number>> = {};
    for (const row of rows) progress[row.partyId] = row.pct;
    // The appraiser's bar is his valuation ladder, not the share of study questions he answered.
    const appraisal = tasks.find(
      (t) => t.kind === "property-appraisal" && t.parentTaskId === parent.id && t.status !== "cancelled",
    );
    if (appraisal) {
      progress.val = appraiserProgressPct({
        state: getReportDraftState(appraisal.propertyId ?? parent.propertyId),
        packageSubmitted: appraisal.appraisalPackageStatus === "submitted",
        completed: appraisal.status === "completed",
      });
    }
    result.set(parent.id, progress);
  }
  return result;
}

export function useQueuePartyProgress({
  enabled,
  listed,
  listedTaskIdsKey,
  tasks,
  infoRolesMatrix,
}: {
  /** Only the case-study layout shows the party columns. */
  enabled: boolean;
  listed: WorkflowTask[];
  /** Stable id key for `listed` — the batch query key, so a fresh array never refetches. */
  listedTaskIdsKey: string;
  tasks: WorkflowTask[] | undefined;
  infoRolesMatrix: InfoRolesMatrix;
}): PartyProgressByTask {
  const queryClient = useQueryClient();
  // Where each listed property's valuation stands (valuation service, one batch read).
  useReportDraftStates(
    listed.map((t) => t.propertyId),
    enabled,
  );
  const draftStateVersion = useReportDraftStateVersion();
  const { data: drafts } = useCaseStudyReportBatchQuery(listedTaskIdsKey, {
    enabled: enabled && Boolean(tasks),
    live: true,
  });

  useEffect(() => {
    const refresh = () => {
      void queryClient.invalidateQueries({
        queryKey: appDataKeys.caseStudyReportBatches(),
      });
    };
    window.addEventListener(PARTY_CASE_STUDY_REPORT_CHANGED_EVENT, refresh);
    return () =>
      window.removeEventListener(PARTY_CASE_STUDY_REPORT_CHANGED_EVENT, refresh);
  }, [queryClient]);

  return useMemo(() => {
    if (!enabled || !tasks || !drafts) return EMPTY_PROGRESS;
    return foldPartyProgressForQueue(listed, tasks, infoRolesMatrix, drafts);
    // draftStateVersion: the appraiser's rung is read from the shared draft-state cache.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, listed, tasks, infoRolesMatrix, drafts, draftStateVersion]);
}
