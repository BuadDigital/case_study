"use client";

import { ToastProvider } from "@platform/design-system";
import type { ReactNode } from "react";

export function ToastRootProvider({ children }: { children: ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
