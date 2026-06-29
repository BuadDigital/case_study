"use client";

import { useEffect } from "react";
import { useAuth } from "@platform/app-shared/hooks/useAuth";
import {
  filterNotificationsForRole,
  isEngineeringOfficeRole,
} from "@platform/app-shared/notifications/role-notification-policy";
import {
  listNotifications,
  replaceNotificationsFromServer,
} from "@platform/app-shared/notifications/notification-store";

/** يزيل إشعارات غير الرفع المساحي من صندوق مكتب الهندسي. */
export function EngineeringOfficeNotificationCleanup() {
  const { role } = useAuth();

  useEffect(() => {
    if (!isEngineeringOfficeRole(role)) return;
    const items = listNotifications();
    const kept = filterNotificationsForRole(role, items);
    if (kept.length !== items.length) {
      replaceNotificationsFromServer(kept);
    }
  }, [role]);

  return null;
}
