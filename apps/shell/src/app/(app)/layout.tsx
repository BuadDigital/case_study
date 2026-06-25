"use client";

import { Suspense } from "react";
import { PrototypeAppGate } from "@/components/PrototypeAppGate";
import { AuthSessionWatcher } from "@/components/AuthSessionWatcher";
import { DomainEventBridge } from "@/components/DomainEventBridge";
import { NotificationToastBridge } from "@/components/NotificationToastBridge";
import { ServerNotificationBridge } from "@/components/ServerNotificationBridge";
import { OfflineBanner } from "@/components/OfflineBanner";
import { PageAccessGate } from "@/components/PageAccessGate";
import { AppShell } from "@/components/views/AppShell";
import { PrototypeProvider } from "@platform/app-shared/contexts/PrototypeContext";
import { NotificationProvider } from "@platform/app-shared/notifications/NotificationProvider";
import { QueryProvider } from "@/providers/QueryProvider";
import { ErrorBoundary, PanelSkeleton } from "@platform/design-system";

export default function AppSectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <QueryProvider>
      <NotificationProvider>
        <Suspense fallback={<PanelSkeleton className="min-h-svh" />}>
          <PrototypeAppGate>
            <PrototypeProvider>
              <AuthSessionWatcher />
              <DomainEventBridge />
              <NotificationToastBridge />
              <ServerNotificationBridge />
              <PageAccessGate>
                <ErrorBoundary fallbackTitle="تعذّر تحميل التطبيق.">
                  <OfflineBanner />
                  <AppShell>{children}</AppShell>
                </ErrorBoundary>
              </PageAccessGate>
            </PrototypeProvider>
          </PrototypeAppGate>
        </Suspense>
      </NotificationProvider>
    </QueryProvider>
  );
}
