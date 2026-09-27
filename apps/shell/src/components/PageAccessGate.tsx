"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button, PanelSkeleton } from "@platform/ui-kit";
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
  const { role, rolePages, authReady, permissionsFailed, retryPermissions } =
    useAppAccess();
  const online = useOnlineStatus();
  const offlineField = !online && isOfflineCapableRole(role);

  useEffect(() => {
    if (!authReady || permissionsFailed) return;

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
  }, [authReady, permissionsFailed, offlineField, pathname, rolePages, router]);

  if (!authReady) {
    return <PanelSkeleton className="min-h-svh" />;
  }

  if (permissionsFailed) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-[15px] font-bold text-heading">
          تعذّر تحميل صلاحيات الحساب
        </p>
        <p className="max-w-sm text-[13px] leading-relaxed text-text-3">
          لا يمكن فتح النظام قبل معرفة الدور. أعد المحاولة أو سجّل الدخول
          مرة أخرى.
        </p>
        <Button type="button" onClick={retryPermissions}>
          إعادة المحاولة
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
