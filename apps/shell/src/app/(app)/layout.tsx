"use client";

import { Suspense } from "react";
import { PrototypeAppGate } from "@/components/PrototypeAppGate";
import { PageAccessGate } from "@/components/PageAccessGate";
import { AppShell } from "@/components/views/AppShell";
import { PrototypeProvider } from "@platform/app-shared/contexts/PrototypeContext";
import { QueryProvider } from "@/providers/QueryProvider";

export default function AppSectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <QueryProvider>
      <Suspense fallback={null}>
          <PrototypeAppGate>
            <PrototypeProvider>
              <PageAccessGate>
                <AppShell>{children}</AppShell>
              </PageAccessGate>
            </PrototypeProvider>
          </PrototypeAppGate>
        </Suspense>
    </QueryProvider>
  );
}
