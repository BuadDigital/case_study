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
      <PrototypeAppGate>
        <PrototypeProvider>
          <PageAccessGate>
            <Suspense fallback={null}>
              <AppShell>{children}</AppShell>
            </Suspense>
          </PageAccessGate>
        </PrototypeProvider>
      </PrototypeAppGate>
    </QueryProvider>
  );
}
