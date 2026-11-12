"use client";

import { useMemo } from "react";
import type { StaffUser } from "@platform/app-shared/app-data/constants";
import {
  useDistributionAssigneesQuery,
  useStaffUsersQuery,
} from "@settings/mfe/query/settings-queries";

/**
 * The people a new operations task may be given to — what «مهمة جديدة» lists as its assignees.
 *
 * How it works: the staff users joined to the distribution assignees (the parties' accounts), a
 * person listed once by id, staff first.
 * Edge cases: either list failing to load gives its error; loading until both answered. Moved out
 * of `useOperationsTasksData` (2026-11-12) so the coordinator's «إنشاء مهمة مرتبطة» opens the same
 * form with the same people.
 */
export function useOperationsTaskStaff(): {
  staffUsers: StaffUser[];
  staffLoadError: string | null;
  staffLoading: boolean;
} {
  const { data: staffResult, isPending: staffPending } = useStaffUsersQuery();
  const { data: distResult, isPending: distPending } = useDistributionAssigneesQuery();
  const staffUsers = useMemo(() => {
    const byId = new Map<string, StaffUser>();
    for (const u of staffResult?.users ?? []) byId.set(u.id, u);
    for (const u of distResult?.users ?? []) {
      if (!byId.has(u.id)) byId.set(u.id, u);
    }
    return [...byId.values()];
  }, [staffResult?.users, distResult?.users]);
  return {
    staffUsers,
    staffLoadError: staffResult?.loadError ?? distResult?.loadError ?? null,
    staffLoading: staffPending || distPending,
  };
}
