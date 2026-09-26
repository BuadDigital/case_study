"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { PanelSkeleton } from "@platform/ui-kit";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import { useOnlineStatus } from "@platform/app-shared/hooks/useOnlineStatus";
import { isOfflineCapableRole } from "@platform/app-shared/offline/offline-write";
import {
  isOfflineFormPath,
  offlineLandingPath,
} from "@platform/app-shared/offline/offline-routes";
import {
  canAccessPathname,
  defaultLandingPath,
  pageIdFromPathname,
} from "@platform/app-shared/app-data/page-access";

/**
 * Redirects to the user's first allowed page when they lack permission for the current
 * route. Offline, a field inspector / government reviewer is kept on the input-form
 * screens (spec §3.1) and sent to their first one from anywhere else.
 */
export function PageAccessGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const { role, rolePages, authReady } = useAppAccess();
  const online = useOnlineStatus();
  const offlineField = !online && isOfflineCapableRole(role);

  useEffect(() => {
    if (!authReady) return;

    const pageId = pageIdFromPathname(pathname);
    if (pageId === null) return;
    if (!canAccessPathname(pathname, rolePages)) {
      router.replace(defaultLandingPath(rolePages));
      return;
    }
    if (offlineField && !isOfflineFormPath(pathname)) {
      const landing = offlineLandingPath(rolePages);
      if (landing) router.replace(landing);
    }
  }, [authReady, offlineField, pathname, rolePages, router]);

  if (!authReady) {
    return <PanelSkeleton className="min-h-svh" />;
  }

  return <>{children}</>;
}
