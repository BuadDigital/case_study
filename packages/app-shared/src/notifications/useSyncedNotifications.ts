"use client";

import { useCallback, useMemo } from "react";
import {
  clearNotifications as clearNotificationsApi,
  deleteNotification as deleteNotificationApi,
  markAllNotificationsRead as markAllNotificationsReadApi,
  markNotificationRead as markNotificationReadApi,
} from "@platform/api-client/notifications";
import { useAuth } from "../hooks/useAuth";
import { useNotifications } from "./NotificationProvider";
import {
  clearNotifications,
  deleteNotification,
  markAllNotificationsRead,
  markNotificationRead,
} from "./notification-store";

function warnNotificationSync(action: string, err: unknown): void {
  console.warn(`Notification sync failed (${action})`, err);
}

function isGuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id,
  );
}

/** Notifications with optional server sync when authenticated. */
export function useSyncedNotifications() {
  const base = useNotifications();
  const { token } = useAuth();

  const syncMarkRead = useCallback(
    (id: string) => {
      markNotificationRead(id);
      if (token && isGuid(id)) {
        void markNotificationReadApi({ token }, id).catch((err) =>
          warnNotificationSync("markRead", err),
        );
      }
    },
    [token],
  );

  const syncMarkAllRead = useCallback(() => {
    markAllNotificationsRead();
    if (token) {
      void markAllNotificationsReadApi({ token }).catch((err) =>
        warnNotificationSync("markAllRead", err),
      );
    }
  }, [token]);

  const syncRemove = useCallback(
    (id: string) => {
      deleteNotification(id);
      if (token && isGuid(id)) {
        void deleteNotificationApi({ token }, id).catch((err) =>
          warnNotificationSync("delete", err),
        );
      }
    },
    [token],
  );

  const syncClear = useCallback(() => {
    clearNotifications();
    if (token) {
      void clearNotificationsApi({ token }).catch((err) =>
        warnNotificationSync("clear", err),
      );
    }
  }, [token]);

  return useMemo(
    () => ({
      ...base,
      markRead: syncMarkRead,
      markAllRead: syncMarkAllRead,
      remove: syncRemove,
      clear: syncClear,
    }),
    [base, syncClear, syncMarkAllRead, syncMarkRead, syncRemove],
  );
}
