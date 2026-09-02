"use client";

import { useCallback, useMemo } from "react";
import { revokeAuthSession } from "@platform/api-client";
import { clearAuthSession, getValidAuthSession } from "@platform/auth-client";
import { useAppAccess } from "../contexts/AppAccessContext";

export function useAuth() {
  const {
    role,
    authReady,
    viewerEmail,
    viewerDisplayName,
    capabilities,
    hasCapability,
    rolePages,
  } = useAppAccess();
  // Session ref is stable (raw-string cache in auth-client) so it works as a dependency.
  const session = getValidAuthSession();

  const logout = useCallback(() => {
    void (async () => {
      const current = getValidAuthSession();
      const refreshToken = current?.refreshToken;
      const userId = current?.user?.id;
      try {
        const { purgeOfflineData, closeOfflineDb } = await import(
          "@platform/offline-client"
        );
        if (userId) {
          await Promise.race([
            (async () => {
              await purgeOfflineData(userId, "logout");
              await closeOfflineDb();
            })(),
            new Promise<void>((resolve) => {
              window.setTimeout(resolve, 2000);
            }),
          ]);
        }
      } catch {
        /* ignore */
      }
      if (refreshToken) void revokeAuthSession(refreshToken);
      clearAuthSession();
      window.location.assign("/login");
    })();
  }, []);

  // Stable-identity value — a new object each render used to break any memo/dep on it
  // (rerender-split-combined-hooks).
  return useMemo(
    () => ({
      isAuthenticated: Boolean(session),
      authReady,
      user: session?.user ?? null,
      token: session?.token ?? null,
      expiresAtUtc: session?.expiresAtUtc ?? null,
      role,
      email: viewerEmail,
      displayName: viewerDisplayName,
      capabilities,
      hasCapability,
      rolePages,
      logout,
    }),
    [
      session,
      authReady,
      role,
      viewerEmail,
      viewerDisplayName,
      capabilities,
      hasCapability,
      rolePages,
      logout,
    ],
  );
}
