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
        try {
          const { purgeOfflineData, closeOfflineDb } = await import(
            "@platform/offline-client"
          );
          if (session?.user?.id) {
            await purgeOfflineData(session.user.id, "logout");
            await closeOfflineDb();
          }
        } catch {
          /* ignore */
        }
        if (session?.refreshToken) void revokeAuthSession(session.refreshToken);
        clearAuthSession();
        window.location.href = "/login";
      })();
    },
  };
}
