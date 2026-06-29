"use client";

import { useEffect } from "react";
import { useAuth } from "@platform/app-shared/hooks/useAuth";
import { appendAuditLogEntry } from "@platform/app-shared/audit/audit-log-store";
import { pushNotification } from "@platform/app-shared/notifications/notification-store";
import { shouldDeliverDomainNotification } from "@platform/app-shared/notifications/role-notification-policy";
import { DOMAIN_NOTIFICATION_RULES } from "@/lib/domain-notification-rules";

/** Bridges domain window events to notifications + audit log. */
export function DomainEventBridge() {
  const { displayName, role } = useAuth();

  useEffect(() => {
    const actor = displayName ?? "مستخدم";

    const cleanups = DOMAIN_NOTIFICATION_RULES.map((rule) => {
      function onDomainEvent() {
        if (!shouldDeliverDomainNotification(role, rule.event)) return;
        pushNotification({ ...rule.notification, actor });
        appendAuditLogEntry({
          actor,
          action: rule.auditAction,
          entity: rule.auditEntity,
        });
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
