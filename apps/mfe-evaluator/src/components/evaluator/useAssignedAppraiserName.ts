// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 1 (5b554f4e)
//  • Split New file — the assigned appraiser's display name (staff list, else the signed-in user when he is
//          the assignee), moved out of EvaluatorWindow unchanged.
// ──────────────────────────────────────────────────────────────────────────────────────────────

"use client";

import { useMemo } from "react";
import { getAuthSession } from "@platform/auth-client";
import { resolveAssigneeDisplayName } from "@platform/app-shared/fees/party-fee-meta";
import type { WorkflowTask } from "@platform/app-shared/workflow/task-types";
import { useStaffUsersQuery } from "@settings/mfe/query/settings-queries";

/** The appraiser the task is assigned to, by name — the staff list, else the signed-in user when it is him. */
export function useAssignedAppraiserName(
  task: Pick<WorkflowTask, "assigneeName" | "assigneeId">,
): string {
  const { data: staffResult } = useStaffUsersQuery();
  return useMemo(() => {
    const session = getAuthSession();
    const selfFallback =
      session?.user?.id &&
      task.assigneeId?.trim() &&
      session.user.id === task.assigneeId.trim()
        ? session.user.displayName
        : undefined;
    return resolveAssigneeDisplayName({
      assigneeName: task.assigneeName,
      assigneeId: task.assigneeId,
      staffUsers: staffResult?.users ?? [],
      fallback: selfFallback,
    });
  }, [task.assigneeName, task.assigneeId, staffResult?.users]);
}
