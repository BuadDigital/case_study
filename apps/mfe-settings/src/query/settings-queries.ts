"use client";

import {
  useQuery,
  type QueryClient,
} from "@tanstack/react-query";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import { getAuthSession } from "@platform/auth-client";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import {
  loadCaseStudyInfoRolesConfig,
  type CaseStudyInfoRolesConfig,
} from "../lib/app-data/case-study-info-roles-storage";
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
  // List is authorized on the API via manage-work-orders | manage-operations.
  // Always attempt distribution-assignees when not a users-admin so we never
  // cache a silent empty list while capabilities are still hydrating.
  return useQuery({
    queryKey: [
      ...appDataKeys.staffUsers(),
      userId,
      canManageUsers ? "manage" : "assignees",
    ],
    queryFn: () =>
      fetchStaffUsers({
        canManageUsers,
        canListDistributionAssignees: true,
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
