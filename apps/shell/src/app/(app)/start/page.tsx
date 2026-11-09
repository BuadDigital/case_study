"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PanelSkeleton } from "@platform/ui-kit";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import { defaultLandingPath } from "@platform/app-shared/app-data/page-access";

/**
 * `/start` — the site's entry («/» redirects here): sends the signed-in user to his landing page.
 *
 * How it works: once the permissions are loaded, replaces the URL with `defaultLandingPath` — the
 * same page the login lands on, so «أعمالي» for whoever holds it (Omar 2026-11-09), the dashboard
 * for the CDO, the work queue for a party.
 * Edge cases / fixed 2026-11-09: «/» always opened «لوحة التحكم», whatever the role; a failed
 * permissions load is shown by `PageAccessGate` (this page stays a skeleton).
 */
export default function StartPage() {
  const router = useRouter();
  const { authReady, permissionsFailed, rolePages } = useAppAccess();
  useEffect(() => {
    if (!authReady || permissionsFailed) return;
    router.replace(defaultLandingPath(rolePages));
  }, [authReady, permissionsFailed, rolePages, router]);
  return <PanelSkeleton className="min-h-svh" />;
}
