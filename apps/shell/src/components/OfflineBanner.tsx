"use client";

import { Note } from "@platform/design-system";
import { useOnlineStatus } from "@platform/app-shared/hooks/useOnlineStatus";
import { isFeatureEnabled } from "@platform/app-shared/feature-flags";

export function OfflineBanner() {
  const online = useOnlineStatus();
  if (!isFeatureEnabled("offlineBanner") || online) return null;

  return (
    <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-2">
      <Note tone="warn" className="m-0 text-center text-xs">
        لا يوجد اتصال بالإنترنت — قد لا تُحفظ التغييرات حتى يعود الاتصال.
      </Note>
    </div>
  );
}
