import { createClientId } from "../lib/create-client-id";

export type AppNotification = {
  id: string;
  title: string;
  body?: string;
  href?: string;
  tone?: "info" | "success" | "warn";
  createdAt: string;
  read: boolean;
};

const STORAGE_KEY = "ree-notifications";
const MAX_ITEMS = 50;
export const NOTIFICATIONS_CHANGED_EVENT = "ree-notifications-changed";

function readAll(): AppNotification[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as AppNotification[];
  } catch {
    return [];
  }
}

function writeAll(items: AppNotification[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
}

export function listNotifications(): AppNotification[] {
  return readAll();
}

export function unreadNotificationCount(): number {
  return readAll().filter((n) => !n.read).length;
}

export function pushNotification(
  input: Omit<AppNotification, "id" | "createdAt" | "read">,
): AppNotification {
  const item: AppNotification = {
    ...input,
    id: createClientId("notification"),
    createdAt: new Date().toISOString(),
    read: false,
  };
  writeAll([item, ...readAll()]);
  return item;
}

export function markNotificationRead(id: string): void {
  writeAll(
    readAll().map((n) => (n.id === id ? { ...n, read: true } : n)),
  );
}

export function markAllNotificationsRead(): void {
  writeAll(readAll().map((n) => ({ ...n, read: true })));
}

export function clearNotifications(): void {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
}
