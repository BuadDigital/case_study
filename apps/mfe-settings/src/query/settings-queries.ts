"use client";

import {
  useQuery,
  type QueryClient,
} from "@tanstack/react-query";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import { getAuthSession } from "@platform/auth-client";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import { canListDistributionAssignees } from "@platform/app-shared/app-data/runtime-access";
import type { CaseStudyInfoRolesConfig } from "../lib/app-data/case-study-info-roles-model";
import { loadCaseStudyInfoRolesConfig } from "../lib/app-data/case-study-info-roles-reads";
import {
  fetchDistributionAssignees,
  fetchStaffUsers,
} from "../lib/users-api";

const STALE_MS = 60_000;
const GC_MS = 10 * 60_000;
const queryDefaults = { staleTime: STALE_MS, gcTime: GC_MS };

export function useCaseStudyInfoRolesQuery() {
  return useQuery({
    queryKey: appDataKeys.caseStudyInfoRoles(),
    queryFn: loadCaseStudyInfoRolesConfig,
    ...queryDefaults,
  });
}

export function useStaffUsersQuery() {
  const { authReady, capabilities } = useAppAccess();
  const userId = getAuthSession()?.user.id ?? "anonymous";
  const canManageUsers = capabilities.includes("manage-users");
  // authReady means capabilities are resolved, so the assignee gate is final —
  // finance has neither list and must not ask (the API answers 403).
  const canListAssignees = canListDistributionAssignees(capabilities);
  return useQuery({
    queryKey: [
      ...appDataKeys.staffUsers(),
      userId,
      canManageUsers ? "manage" : canListAssignees ? "assignees" : "none",
    ],
    queryFn: () =>
      fetchStaffUsers({
        canManageUsers,
        canListDistributionAssignees: canListAssignees,
      }),
    enabled: authReady,
    ...queryDefaults,
  });
}

export function useDistributionAssigneesQuery() {
  const { authReady } = useAppAccess();
  const userId = getAuthSession()?.user.id ?? "anonymous";
  return useQuery({
    queryKey: [...appDataKeys.distributionAssignees(), userId],
    queryFn: fetchDistributionAssignees,
    enabled: authReady,
    ...queryDefaults,
  });
}

export function setCaseStudyInfoRolesCache(
  queryClient: QueryClient,
  config: CaseStudyInfoRolesConfig,
) {
  queryClient.setQueryData(appDataKeys.caseStudyInfoRoles(), config);
}
