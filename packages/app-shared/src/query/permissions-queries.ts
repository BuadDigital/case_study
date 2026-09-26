import { useQuery } from "@tanstack/react-query";
import {
  ApiAuthError,
  fetchPermissions,
  type PermissionsDto,
} from "@platform/api-client";
import { getAuthSession, notifyAuthExpired } from "@platform/auth-client";
import { ensureFreshAuthSession } from "../auth/ensure-fresh-session";
import { isOfflineUsableSession } from "../auth/offline-session";
import {
  readOfflineAccess,
  rememberOfflineAccess,
} from "../offline/offline-access-cache";


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
        // Offline with a lapsed access token: a field user keeps their last role —
        // AuthSessionWatcher then runs the offline lease instead of logging out.
        const stored = getAuthSession();
        if (isOfflineUsableSession(stored)) {
          const cached = readOfflineAccess(stored.user.id);
          if (cached) return cached;
        }
        notifyAuthExpired();
        throw new ApiAuthError();
      }

      try {
        const permissions = await fetchPermissions({ token: session.token });
        rememberOfflineAccess(session.user.id, permissions);
        return permissions;
      } catch (error) {
        if (!(error instanceof ApiAuthError)) {
          // Server unreachable — fall back to the field user's last known access.
          const cached = readOfflineAccess(session.user.id);
          if (cached) return cached;
          throw error;
        }

        // The access token may have lapsed in flight; renew once before logging out.
        const renewed = await ensureFreshAuthSession({ force: true });
        if (renewed && renewed.token !== session.token) {
          const permissions = await fetchPermissions({ token: renewed.token });
          rememberOfflineAccess(renewed.user.id, permissions);
          return permissions;
        }

        notifyAuthExpired();
        throw error;
      }
    },
    staleTime: 60_000,
  });
}
