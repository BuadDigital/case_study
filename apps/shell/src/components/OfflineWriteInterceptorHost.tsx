"use client";

import { useEffect } from "react";
import { installOfflineWriteInterceptor } from "@platform/app-shared/offline/install-offline-write-interceptor";
import { isOfflineCapableRole } from "@platform/app-shared";
import { useAuth } from "@platform/app-shared/hooks/useAuth";

/**
 * Installs the single API write interceptor while an offline-capable role is signed in.
 */
export function OfflineWriteInterceptorHost() {
  const { role, isAuthenticated } = useAuth();
  const capable = isOfflineCapableRole(role);

  useEffect(() => {
    if (!capable || !isAuthenticated) return;
    return installOfflineWriteInterceptor();
  }, [capable, isAuthenticated]);

  return null;
}
