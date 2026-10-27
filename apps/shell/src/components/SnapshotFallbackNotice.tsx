"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Button, Note } from "@platform/ui-kit";
import { useAuth } from "@platform/app-shared/hooks/useAuth";
import { useOnlineStatus } from "@platform/app-shared/hooks/useOnlineStatus";
import { useSnapshotFallbackActive } from "@platform/app-shared/hooks/use-snapshot-fallback";
import { isOfflineCapableRole } from "@platform/app-shared/offline/offline-write";
import { resetSnapshotFallback } from "@platform/app-shared/offline/snapshot-fallback";

/**
 * Online, but a list fell back to the copy saved on the device because the
 * server failed (po-intake / operations-tasks reads). Office roles only — field
 * roles never see connection messages (spec), same as `OfflineBanner`.
 * While offline `OfflineBanner` speaks instead.
 */
export function SnapshotFallbackNotice() {
  const active = useSnapshotFallbackActive();
  const online = useOnlineStatus();
  const { role } = useAuth();
  const queryClient = useQueryClient();

  if (!active || !online || isOfflineCapableRole(role)) return null;

  return (
    <div className="shrink-0 border-b border-[color-mix(in_srgb,var(--amber)_40%,var(--border))] bg-warning-bg px-4 py-2">
      <Note
        tone="warn"
        role="status"
        className="m-0 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-xs"
      >
        <span>
          تعذّر الوصول إلى الخادم — بعض القوائم تُعرض من نسخة محفوظة سابقاً وقد
          لا تكون محدّثة.
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          showActionToast={false}
          onClick={() => {
            // Forget the flags; reads that still fail raise them again.
            resetSnapshotFallback();
            void queryClient.invalidateQueries();
          }}
        >
          إعادة المحاولة
        </Button>
      </Note>
    </div>
  );
}
