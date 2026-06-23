"use client";

import { useMemo } from "react";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import { getAuthSession } from "@platform/auth-client";
import { useStaffUsersQuery } from "@settings/mfe/query/settings-queries";
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
  const { role, rolePages, viewerEmail } = usePrototype();
  const { data: staffResult } = useStaffUsersQuery();
  const staffUsers = staffResult?.users ?? [];
  const statsFlags = useMemo(
    () => situationVisibilityForPages(rolePages),
    [rolePages],
  );

  const { data: poRows, isFetched: poRowsFetched } = usePoListRowsQuery();
  const { data: poRecords, isFetched: poRecordsFetched } = usePoRecordsQuery();
  const { data: tasks, isFetched: tasksFetched } = useWorkflowTasksQuery();

  return useMemo(
    () =>
      computeActiveTransactionsSituation({
        role,
        rolePages,
        customGrantedPages: [],
        viewerEmail: viewerEmail ?? getAuthSession()?.user.email,
        staffUsers,
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
      viewerEmail,
      staffUsers,
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
