import { createClientId } from "../lib/create-client-id";
import type {
  NotificationCategory,
  NotificationEntityType,
  NotificationTone,
} from "@platform/api-client/notifications";

export type { NotificationCategory, NotificationEntityType };

export type AppNotification = {
  id: string;
  title: string;
  body?: string;
  href?: string;
  tone?: NotificationTone;
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

const LEGACY_STORAGE_KEY = "ree-notifications";
const STORAGE_PREFIX = "ree-notifications:";
const STORAGE_VERSION = 1;
const MAX_ITEMS = 50;
const DEDUPE_WINDOW_MS = 30_000;
let activeUserId: string | null = null;

export const NOTIFICATIONS_CHANGED_EVENT = "ree-notifications-changed";
export const NOTIFICATION_PUSHED_EVENT = "ree-notification-pushed";
/** Toast only — does not sync to server (e.g. inbox pull from API). */
export const NOTIFICATION_TOAST_EVENT = "ree-notification-toast";

export function notificationStorageKey(userId: string | null = activeUserId): string {
  return `${STORAGE_PREFIX}${encodeURIComponent(userId?.trim() || "anonymous")}`;
}

/**
 * Switches the browser inbox namespace. Legacy unscoped data is migrated once to the
 * first authenticated user and then removed so it cannot leak to another login.
 */
export function setNotificationStorageUser(userId: string | null | undefined): void {
  const normalized = userId?.trim() || null;
  const nextKey = notificationStorageKey(normalized);

  if (normalized && localStorage.getItem(LEGACY_STORAGE_KEY)) {
    if (!localStorage.getItem(nextKey)) {
      localStorage.setItem(nextKey, localStorage.getItem(LEGACY_STORAGE_KEY)!);
    }
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  }

  if (activeUserId === normalized) return;
  activeUserId = normalized;
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
}

function isAppNotification(value: unknown): value is AppNotification {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { id?: unknown }).id === "string"
  );
}

function sanitizeItems(value: unknown): AppNotification[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isAppNotification);
}

function persist(items: AppNotification[], key = notificationStorageKey()) {
  localStorage.setItem(
    key,
    JSON.stringify({ v: STORAGE_VERSION, items: items.slice(0, MAX_ITEMS) }),
  );
}

function readAll(): AppNotification[] {
  if (typeof window === "undefined") return [];
  const key = notificationStorageKey();
  const raw = localStorage.getItem(key);
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  if (Array.isArray(parsed)) {
    const migrated = sanitizeItems(parsed);
    persist(migrated, key);
    return migrated;
  }

  if (
    typeof parsed === "object" &&
    parsed !== null &&
    (parsed as { v?: unknown }).v === STORAGE_VERSION
  ) {
    return sanitizeItems((parsed as { items?: unknown }).items);
  }

  localStorage.removeItem(key);
  return [];
}

function writeAll(items: AppNotification[], pushed?: AppNotification) {
  persist(items);
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
  if (pushed) {
    window.dispatchEvent(
      new CustomEvent(NOTIFICATION_PUSHED_EVENT, { detail: pushed }),
    );
  }
}

/** Replaces inbox from server without firing push toasts. */
export function replaceNotificationsFromServer(items: AppNotification[]): void {
  persist(items);
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
}

/** Merges one server notification into the local inbox. */
export function upsertNotificationFromServer(item: AppNotification): void {
  const items = readAll();
  const index = items.findIndex((n) => n.id === item.id);
  if (index >= 0) {
    const next = [...items];
    next[index] = item;
    persist(next);
  } else {
    persist([item, ...items]);
  }
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
}

export function listNotifications(): AppNotification[] {
  return readAll();
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
  localStorage.removeItem(notificationStorageKey());
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
}
