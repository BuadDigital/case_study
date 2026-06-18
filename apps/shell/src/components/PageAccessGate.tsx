"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useMyCustomAssignedScreensQuery } from "@settings/mfe/query/custom-screens-queries";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import { canAccessPage } from "@platform/app-shared/prototype/custom-assigned-page-access";
import { pageIdFromPathname } from "@platform/app-shared/prototype/page-access";

/**
 * Redirects to dashboard when the signed-in user lacks permission for the current route.
 * Role-based pages from the API plus pages linked via CDO custom screen assignments.
 */
export function PageAccessGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const { rolePages, authReady } = usePrototype();
  const { data: customAssignedScreens = [], isSuccess: customScreensReady } =
    useMyCustomAssignedScreensQuery();

  useEffect(() => {
    if (!authReady || !customScreensReady) return;

    const pageId = pageIdFromPathname(pathname);
    if (pageId === null) return;
    if (!canAccessPage(pageId, rolePages, customAssignedScreens)) {
      router.replace("/dashboard");
    }
  }, [
    authReady,
    customScreensReady,
    pathname,
    rolePages,
    customAssignedScreens,
    router,
  ]);

  return <>{children}</>;
}
