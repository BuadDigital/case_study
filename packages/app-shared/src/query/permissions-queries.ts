import { useQuery } from "@tanstack/react-query";
import {
  ApiAuthError,
  fetchPermissions,
  type PermissionsDto,
} from "@platform/api-client";
import { getValidAuthSession, notifyAuthExpired } from "@platform/auth-client";

export { ApiAuthError };

export const permissionsKeys = {
  all: ["permissions"] as const,
  current: () => [...permissionsKeys.all, "current"] as const,
};

export function usePermissionsQuery(enabled = true) {
  const session = getValidAuthSession();
  return useQuery({
    queryKey: permissionsKeys.current(),
    enabled: enabled && Boolean(session?.token),
    queryFn: async (): Promise<PermissionsDto> => {
      try {
        return await fetchPermissions({
          token: session!.token,
        });
      } catch (error) {
        if (error instanceof ApiAuthError) notifyAuthExpired();
        throw error;
      }
    },
    staleTime: 60_000,
  });
}
