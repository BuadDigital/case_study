"use client";

import { Suspense } from "react";
import { PrototypeAppGate } from "@/components/PrototypeAppGate";
import { AuthSessionWatcher } from "@/components/AuthSessionWatcher";
import { DomainEventBridge } from "@/components/DomainEventBridge";
import { EngineeringOfficeNotificationCleanup } from "@/components/EngineeringOfficeNotificationCleanup";
import { NotificationToastBridge } from "@/components/NotificationToastBridge";
import { ServerNotificationBridge } from "@/components/ServerNotificationBridge";
import { OfflineBanner } from "@/components/OfflineBanner";
import { PushPermissionPrompt } from "@/components/PushPermissionPrompt";
import { FieldOfflinePrefetch } from "@/components/FieldOfflinePrefetch";
import { OfflineWriteInterceptorHost } from "@/components/OfflineWriteInterceptorHost";
import { PlatformRuntimeBootstrap } from "@/components/PlatformRuntimeBootstrap";
import { PageAccessGate } from "@/components/PageAccessGate";
import { AppShell } from "@/components/views/AppShell";
import { AppAccessProvider } from "@platform/app-shared/contexts/AppAccessContext";
import { NotificationProvider } from "@platform/app-shared/notifications/NotificationProvider";
import { QueryProvider } from "@/providers/QueryProvider";
import { ErrorBoundary, PanelSkeleton } from "@platform/ui-kit";

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
            <AppAccessProvider>
              <PlatformRuntimeBootstrap />
              <AuthSessionWatcher />
              <DomainEventBridge />
              <EngineeringOfficeNotificationCleanup />
              <NotificationToastBridge />
              <ServerNotificationBridge />
              <FieldOfflinePrefetch />
              <OfflineWriteInterceptorHost />
              <PageAccessGate>
                <ErrorBoundary fallbackTitle="تعذّر تحميل التطبيق.">
                  <OfflineBanner />
                  <AppShell>{children}</AppShell>
                  <PushPermissionPrompt />
                </ErrorBoundary>
              </PageAccessGate>
            </AppAccessProvider>
          </PrototypeAppGate>
        </Suspense>
      </NotificationProvider>
    </QueryProvider>
  );
}
