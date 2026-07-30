"use client";

import { useEffect } from "react";
import { useAuth } from "@platform/app-shared/hooks/useAuth";
import { pushNotification } from "@platform/app-shared/notifications/notification-store";
import { shouldDeliverDomainNotification } from "@platform/app-shared/notifications/role-notification-policy";
import { DOMAIN_NOTIFICATION_RULES } from "@/lib/domain-notification-rules";

/** Bridges domain window events to transient client notifications. */
export function DomainEventBridge() {
  const { displayName, role } = useAuth();

  useEffect(() => {
    const actor = displayName ?? "مستخدم";

    const cleanups = DOMAIN_NOTIFICATION_RULES.map((rule) => {
      function onDomainEvent() {
        if (!shouldDeliverDomainNotification(role, rule.event)) return;
        pushNotification({ ...rule.notification, actor });
      }

      window.addEventListener(rule.event, onDomainEvent);
      return () => window.removeEventListener(rule.event, onDomainEvent);
    });

    return () => {
      for (const cleanup of cleanups) cleanup();
    };
  }, [displayName, role]);

  return null;
}
