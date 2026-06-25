"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
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
  pushNotification,
  unreadNotificationCount,
  type AppNotification,
} from "./notification-store";

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

  const refresh = useCallback(() => {
    setItems(listNotifications());
  }, []);

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, onChange);
  }, [refresh]);

  const value = useMemo<NotificationContextValue>(
    () => ({
      items,
      unreadCount: unreadNotificationCount(),
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
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error("useNotifications must be used within NotificationProvider");
  }
  return ctx;
}
