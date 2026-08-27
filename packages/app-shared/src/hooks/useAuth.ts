"use client";

import { revokeAuthSession } from "@platform/api-client";
import { clearAuthSession, getValidAuthSession } from "@platform/auth-client";
import { usePrototype } from "../contexts/PrototypeContext";

export function useAuth() {
  const {
    role,
    authReady,
    viewerEmail,
    viewerDisplayName,
    capabilities,
    hasCapability,
    rolePages,
  } = usePrototype();
  const session = getValidAuthSession();

  return {
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
    logout() {
      void (async () => {
        const refreshToken = session?.refreshToken;
        const userId = session?.user?.id;
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
    },
  };
}
