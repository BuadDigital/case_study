"use client";

import { useEffect, useState } from "react";
import { Note } from "@platform/ui-kit";
import { useOnlineStatus } from "@platform/app-shared/hooks/useOnlineStatus";
import { isFeatureEnabled } from "@platform/app-shared/feature-flags";
import { isOfflineCapableRole } from "@platform/app-shared";
import { useAuth } from "@platform/app-shared/hooks/useAuth";
import { OFFLINE_PENDING_EVENT } from "@platform/offline-client";

/**
 * Offline banner:
 * - Non-field roles: warn that changes may not save.
 * - Field / government-reviewer: show pending save-queue count while offline.
 */
export function OfflineBanner() {
  const online = useOnlineStatus();
  const { role } = useAuth();
  const [pending, setPending] = useState(0);
  const capable = isOfflineCapableRole(role);

  useEffect(() => {
    if (!capable) return;
    const read = () => {
      try {
        const raw = sessionStorage.getItem("ejada_offline_pending_count");
        setPending(raw ? Number(raw) || 0 : 0);
      } catch {
        setPending(0);
      }
    };
    read();
    const onPending = () => read();
    window.addEventListener(OFFLINE_PENDING_EVENT, onPending);
    return () => window.removeEventListener(OFFLINE_PENDING_EVENT, onPending);
  }, [capable]);

  if (!isFeatureEnabled("offlineBanner") || online) return null;

  if (capable) {
    return (
      <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-2">
        <Note tone="warn" className="m-0 text-center text-xs">
          {pending > 0
            ? `دون اتصال — ${pending} عنصر في طابور الحفظ؛ ستُزامن تلقائياً عند عودة الشبكة.`
            : "دون اتصال — الحفظ يذهب إلى الطابور المحلي المشفّر حتى تعود الشبكة."}
        </Note>
      </div>
    );
  }

  return (
    <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-2">
      <Note tone="warn" className="m-0 text-center text-xs">
        لا يوجد اتصال بالإنترنت — قد لا تُحفظ التغييرات حتى يعود الاتصال.
      </Note>
    </div>
  );
}
