import { useQuery } from "@tanstack/react-query";
import {
  ApiAuthError,
  fetchPermissions,
  type PermissionsDto,
} from "@platform/api-client";
import { notifyAuthExpired } from "@platform/auth-client";
import { ensureFreshAuthSession } from "../auth/ensure-fresh-session";


const permissionsKeys = {
  all: ["permissions"] as const,
  current: () => [...permissionsKeys.all, "current"] as const,
};

export function usePermissionsQuery(enabled = true) {
  return useQuery({
    queryKey: permissionsKeys.current(),
    // Caller passes hasSession; do not re-read storage here for `enabled` —
    // a stale render-time read can disable the query permanently on hard nav.
    enabled,
    queryFn: async (): Promise<PermissionsDto> => {
      const session = await ensureFreshAuthSession();
      if (!session) {
        notifyAuthExpired();
        throw new ApiAuthError();
      }

      try {
        return await fetchPermissions({ token: session.token });
      } catch (error) {
        if (!(error instanceof ApiAuthError)) throw error;

        // The access token may have lapsed in flight; renew once before logging out.
        const renewed = await ensureFreshAuthSession({ force: true });
        if (renewed && renewed.token !== session.token)
          return await fetchPermissions({ token: renewed.token });

        notifyAuthExpired();
        throw error;
      }
    },
    staleTime: 60_000,
  });
}
