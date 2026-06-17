import { useQuery } from "@tanstack/react-query";
import { fetchPermissions, type PermissionsDto } from "@platform/api-client";
import { getAuthSession } from "@platform/auth-client";

export const permissionsKeys = {
  all: ["permissions"] as const,
  current: () => [...permissionsKeys.all, "current"] as const,
};

export function usePermissionsQuery(enabled = true) {
  const session = getAuthSession();
  return useQuery({
    queryKey: permissionsKeys.current(),
    enabled: enabled && Boolean(session?.token),
    queryFn: async (): Promise<PermissionsDto> =>
      fetchPermissions({ token: session!.token }),
    staleTime: 60_000,
  });
}
