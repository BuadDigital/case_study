"use client";

import { ActionDialogHost, ToastProvider } from "@platform/ui-kit";
import type { ReactNode } from "react";

/** Root providers every screen needs: toasts, and the host of the product's own confirm / prompt / alert dialogs. */
export function ToastRootProvider({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      {children}
      <ActionDialogHost />
    </ToastProvider>
  );
}
