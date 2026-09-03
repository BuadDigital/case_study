"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import { useOptionalToast } from "@platform/ui-kit";

/** Invalidate prototype data + soft-refresh the Next.js RSC tree (PWA-friendly). */
export function useAppDataRefresh() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const toast = useOptionalToast();
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  const refresh = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setBusy(true);
      try {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: appDataKeys.all }),
          queryClient.refetchQueries({
            queryKey: appDataKeys.all,
            type: "active",
          }),
        ]);
        router.refresh();
        if (!opts?.silent) {
          toast?.showToast("تم تحديث البيانات", "success");
        }
      } catch {
        if (!opts?.silent) {
          toast?.showToast("تعذّر التحديث — حاول مرة أخرى", "error");
        }
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
    },
    [queryClient, router, toast],
  );

  return { refresh, busy };
}
