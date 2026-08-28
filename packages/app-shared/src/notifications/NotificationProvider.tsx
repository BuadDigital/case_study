"use client";

import {
  createContext,
  use,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import {
  clearNotifications,
  deleteNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  NOTIFICATIONS_CHANGED_EVENT,
  notificationStorageKey,
  pushNotification,
  setNotificationStorageUser,
  type AppNotification,
} from "./notification-store";
import { useValidAuthSession } from "../auth/use-auth-session";

type NotificationContextValue = {
  items: AppNotification[];
  unreadCount: number;
  push: typeof pushNotification;
  markRead: (id: string) => void;
  remove: (id: string) => void;
  markAllRead: () => void;
  clear: () => void;
  refresh: () => void;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const session = useValidAuthSession();

  const refresh = useCallback(() => {
    setItems(listNotifications());
  }, []);

  useLayoutEffect(() => {
    setItems([]);
    setNotificationStorageUser(session?.user.id);
    refresh();
  }, [refresh, session?.user.id]);

  useEffect(() => {
    const onChange = () => refresh();
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, onChange);
    const onStorage = (event: StorageEvent) => {
      if (event.key === notificationStorageKey()) refresh();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, [refresh]);

  const value = useMemo<NotificationContextValue>(
    () => ({
      items,
      // من الذاكرة مباشرة — كانت تعيد قراءة/تحليل المخزن كاملاً مع كل تغيّر (js-cache-storage).
      unreadCount: items.filter((n) => !n.read).length,
      push: pushNotification,
      markRead: markNotificationRead,
      remove: deleteNotification,
      markAllRead: markAllNotificationsRead,
      clear: clearNotifications,
      refresh,
    }),
    [items, refresh],
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = use(NotificationContext);
  if (!ctx) {
    throw new Error("useNotifications must be used within NotificationProvider");
  }
  return ctx;
}
