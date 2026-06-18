"use client";

import { Suspense } from "react";
import { PrototypeAppGate } from "@/components/PrototypeAppGate";
import { PageAccessGate } from "@/components/PageAccessGate";
import { AppShell } from "@/components/views/AppShell";
import { PrototypeProvider } from "@platform/app-shared/contexts/PrototypeContext";
import { QueryProvider } from "@/providers/QueryProvider";
import { ToastProvider } from "@platform/design-system";

export default function AppSectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <QueryProvider>
      <ToastProvider>
        <Suspense fallback={null}>
          <PrototypeAppGate>
            <PrototypeProvider>
              <PageAccessGate>
                <AppShell>{children}</AppShell>
              </PageAccessGate>
            </PrototypeProvider>
          </PrototypeAppGate>
        </Suspense>
      </ToastProvider>
    </QueryProvider>
  );
}
