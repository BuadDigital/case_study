"use client";

import { useSyncExternalStore } from "react";
import {
  getAuthSession,
  isSessionExpired,
  subscribeAuthSession,
  type AuthSession,
} from "@platform/auth-client";

/** Live auth session from storage; null during SSR and when logged out. */
export function useAuthSession(): AuthSession | null {
  return useSyncExternalStore(
    subscribeAuthSession,
    getAuthSession,
    () => null,
  );
}

/** Live session only while the access token is still in date. */
export function useValidAuthSession(): AuthSession | null {
  const session = useAuthSession();
  if (!session || isSessionExpired(session)) return null;
  return session;
}
