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
      if (session?.refreshToken) void revokeAuthSession(session.refreshToken);
      clearAuthSession();
      window.location.href = "/login";
    },
  };
}
