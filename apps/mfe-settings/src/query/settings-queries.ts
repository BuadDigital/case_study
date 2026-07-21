"use client";

import {
  useQuery,
  type QueryClient,
} from "@tanstack/react-query";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import { getAuthSession } from "@platform/auth-client";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import { loadCourtsCatalog } from "../lib/prototype/courts-storage";
import {
  loadCaseStudyInfoRolesConfig,
  type CaseStudyInfoRolesConfig,
} from "../lib/prototype/case-study-info-roles-storage";
import {
  fetchDistributionAssignees,
  fetchStaffUsers,
} from "../lib/users-api";

const STALE_MS = 60_000;
const GC_MS = 10 * 60_000;
const queryDefaults = { staleTime: STALE_MS, gcTime: GC_MS };

export function useCourtsCatalogQuery() {
  return useQuery({
    queryKey: prototypeKeys.courtsCatalog(),
    queryFn: loadCourtsCatalog,
    ...queryDefaults,
  });
}

export function useCaseStudyInfoRolesQuery() {
  return useQuery({
    queryKey: prototypeKeys.caseStudyInfoRoles(),
    queryFn: loadCaseStudyInfoRolesConfig,
    ...queryDefaults,
  });
}

export function useStaffUsersQuery() {
  const { authReady, capabilities } = usePrototype();
  const userId = getAuthSession()?.user.id ?? "anonymous";
  return useQuery({
    queryKey: [...prototypeKeys.staffUsers(), userId, capabilities.join(",")],
    queryFn: fetchStaffUsers,
    enabled: authReady,
    ...queryDefaults,
  });
}

export function useDistributionAssigneesQuery() {
  const { authReady } = usePrototype();
  const userId = getAuthSession()?.user.id ?? "anonymous";
  return useQuery({
    queryKey: [...prototypeKeys.distributionAssignees(), userId],
    queryFn: fetchDistributionAssignees,
    enabled: authReady,
    ...queryDefaults,
  });
}

export function setCaseStudyInfoRolesCache(
  queryClient: QueryClient,
  config: CaseStudyInfoRolesConfig,
) {
  queryClient.setQueryData(prototypeKeys.caseStudyInfoRoles(), config);
}
