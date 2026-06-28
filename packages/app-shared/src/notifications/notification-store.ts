import { createClientId } from "../lib/create-client-id";

export type NotificationCategory =
  | "workflow"
  | "financial"
  | "failures"
  | "system";

export type NotificationEntityType =
  | "property"
  | "task"
  | "failure"
  | "work-order";

export type AppNotification = {
  id: string;
  title: string;
  body?: string;
  href?: string;
  tone?: "info" | "success" | "warn";
  category?: NotificationCategory;
  entityType?: NotificationEntityType;
  entityId?: string;
  actor?: string;
  sourceEvent?: string;
  createdAt: string;
  read: boolean;
};

export type PushNotificationInput = Omit<
  AppNotification,
  "id" | "createdAt" | "read"
>;

const STORAGE_KEY = "ree-notifications";
const MAX_ITEMS = 50;
const DEDUPE_WINDOW_MS = 30_000;

export const NOTIFICATIONS_CHANGED_EVENT = "ree-notifications-changed";
export const NOTIFICATION_PUSHED_EVENT = "ree-notification-pushed";
/** Toast only — does not sync to server (e.g. inbox pull from API). */
export const NOTIFICATION_TOAST_EVENT = "ree-notification-toast";

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

function writeAll(items: AppNotification[], pushed?: AppNotification) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
  if (pushed) {
    window.dispatchEvent(
      new CustomEvent(NOTIFICATION_PUSHED_EVENT, { detail: pushed }),
    );
  }
}

/** Replaces inbox from server without firing push toasts. */
export function replaceNotificationsFromServer(items: AppNotification[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
}

/** Merges one server notification into the local inbox. */
export function upsertNotificationFromServer(item: AppNotification): void {
  const items = readAll();
  const index = items.findIndex((n) => n.id === item.id);
  if (index >= 0) {
    const next = [...items];
    next[index] = item;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next.slice(0, MAX_ITEMS)));
  } else {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([item, ...items].slice(0, MAX_ITEMS)),
    );
  }
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
}

export function listNotifications(): AppNotification[] {
  return readAll();
}

export function unreadNotificationCount(): number {
  return readAll().filter((n) => !n.read).length;
}

function dedupeIndex(
  items: AppNotification[],
  sourceEvent: string,
): number {
  const cutoff = Date.now() - DEDUPE_WINDOW_MS;
  return items.findIndex(
    (n) =>
      n.sourceEvent === sourceEvent &&
      !n.read &&
      Date.parse(n.createdAt) >= cutoff,
  );
}

export function pushNotification(input: PushNotificationInput): AppNotification {
  const existing = readAll();
  const now = new Date().toISOString();

  if (input.sourceEvent) {
    const index = dedupeIndex(existing, input.sourceEvent);
    if (index >= 0) {
      const updated: AppNotification = {
        ...existing[index],
        ...input,
        id: existing[index].id,
        createdAt: now,
        read: false,
      };
      const next = [...existing];
      next.splice(index, 1);
      writeAll([updated, ...next]);
      return updated;
    }
  }

  const item: AppNotification = {
    ...input,
    id: createClientId("notification"),
    createdAt: now,
    read: false,
  };
  writeAll([item, ...existing], item);
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

export function deleteNotification(id: string): void {
  writeAll(readAll().filter((n) => n.id !== id));
}

export function clearNotifications(): void {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
}
