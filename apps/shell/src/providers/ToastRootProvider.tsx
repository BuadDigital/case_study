"use client";

import { ToastProvider } from "@platform/ui-kit";
import type { ReactNode } from "react";

export function ToastRootProvider({ children }: { children: ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
