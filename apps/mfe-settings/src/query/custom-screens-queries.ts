"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import { isSuperAdmin } from "@platform/app-shared/prototype/prototype-role-access";
import {
  fetchAllCustomAssignedScreens,
  fetchAssignableUsersForCustomScreens,
  fetchMyCustomAssignedScreens,
} from "../lib/custom-screens-api";

const STALE_MS = 30_000;
const GC_MS = 10 * 60_000;
const queryDefaults = { staleTime: STALE_MS, gcTime: GC_MS };

export function useMyCustomAssignedScreensQuery() {
  const { authReady } = usePrototype();
  return useQuery({
    queryKey: prototypeKeys.customAssignedScreensMine(),
    queryFn: fetchMyCustomAssignedScreens,
    enabled: authReady,
    ...queryDefaults,
  });
}

export function useCustomAssignedScreensManageQuery() {
  const { role, authReady } = usePrototype();
  const enabled = authReady && isSuperAdmin(role);
  return useQuery({
    queryKey: prototypeKeys.customAssignedScreensManage(),
    queryFn: async () => {
      const result = await fetchAllCustomAssignedScreens();
      return result;
    },
    enabled,
    ...queryDefaults,
  });
}

export function useAssignableUsersForCustomScreensQuery() {
  const { role, authReady } = usePrototype();
  const enabled = authReady && isSuperAdmin(role);
  return useQuery({
    queryKey: prototypeKeys.customAssignedScreensUsers(),
    queryFn: async () => {
      const result = await fetchAssignableUsersForCustomScreens();
      return result;
    },
    enabled,
    ...queryDefaults,
  });
}

export function invalidateCustomAssignedScreensQueries(
  queryClient: ReturnType<typeof useQueryClient>,
): void {
  void queryClient.invalidateQueries({
    queryKey: prototypeKeys.customAssignedScreensMine(),
  });
  void queryClient.invalidateQueries({
    queryKey: prototypeKeys.customAssignedScreensManage(),
  });
}
