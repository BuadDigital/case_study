"use client";

import { Suspense, useEffect, type ComponentProps } from "react";
import { preloadableLazy, whenIdle } from "@platform/ui-kit";

const copyFromPriorModal = preloadableLazy(() =>
  import("../components/po-intake/CopyFromPriorTransactionModal").then(
    (m) => m.CopyFromPriorTransactionModal,
  ),
);
const CopyFromPriorModalLazy = copyFromPriorModal.Component;

/**
 * «نسخ من معاملة سابقة» opens from a row menu. Its code is fetched while the
 * queue sits idle, so the modal opens on the click instead of after a chunk
 * request and React's suspense reveal delay.
 */
export function CopyFromPriorTransactionModal(
  props: ComponentProps<typeof CopyFromPriorModalLazy>,
) {
  return (
    <Suspense fallback={null}>
      <CopyFromPriorModalLazy {...props} />
    </Suspense>
  );
}

export function usePreloadCopyFromPriorModal(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    return whenIdle(() => void copyFromPriorModal.preload());
  }, [enabled]);
}
