"use client";

import { useMemo } from "react";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import { pageIdsFromCustomAssignedScreens } from "@platform/app-shared/prototype/custom-assigned-page-access";
import { useMyCustomAssignedScreensQuery } from "@settings/mfe/query/custom-screens-queries";
import {
  computeActiveTransactionsSituation,
  situationVisibilityForPages,
  type ActiveTransactionsSituationStats,
} from "@case-study/mfe";
import {
  usePoListRowsQuery,
  usePoRecordsQuery,
  useWorkflowTasksQuery,
} from "./case-study-queries";

export function useActiveTransactionsSituation(): ActiveTransactionsSituationStats {
  const { role, rolePages } = usePrototype();
  const { data: customAssignedScreens = [] } = useMyCustomAssignedScreensQuery();
  const customGrantedPages = useMemo(
    () => pageIdsFromCustomAssignedScreens(customAssignedScreens),
    [customAssignedScreens],
  );
  const effectivePages = useMemo(
    () => [...new Set([...rolePages, ...customGrantedPages])],
    [rolePages, customGrantedPages],
  );
  const statsFlags = useMemo(
    () => situationVisibilityForPages(effectivePages),
    [effectivePages],
  );

  const { data: poRows, isFetched: poRowsFetched } = usePoListRowsQuery();
  const { data: poRecords, isFetched: poRecordsFetched } = usePoRecordsQuery();
  const { data: tasks, isFetched: tasksFetched } = useWorkflowTasksQuery();

  return useMemo(
    () =>
      computeActiveTransactionsSituation({
        role,
        rolePages,
        customGrantedPages,
        poRows,
        poRecords,
        tasks,
        poRowsReady: !statsFlags.showPoMetrics || poRowsFetched,
        poRecordsReady: !statsFlags.showPoMetrics || poRecordsFetched,
        tasksReady: !statsFlags.showTransactionMetrics || tasksFetched,
      }),
    [
      role,
      rolePages,
      customGrantedPages,
      poRows,
      poRecords,
      tasks,
      poRowsFetched,
      poRecordsFetched,
      tasksFetched,
      statsFlags.showPoMetrics,
      statsFlags.showTransactionMetrics,
    ],
  );
}
