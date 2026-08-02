"use client";

import { useEffect, useRef } from "react";
import {
  createNotification,
  listNotifications,
  subscribeNotificationStream,
  type UserNotificationDto,
} from "@platform/api-client/notifications";
import { ApiAuthError } from "@platform/api-client";
import { isFeatureEnabled } from "@platform/app-shared/feature-flags";
import { useAuth } from "@platform/app-shared/hooks/useAuth";
import {
  filterNotificationsForRole,
  shouldShowNotificationToast,
} from "@platform/app-shared/notifications/role-notification-policy";
import {
  notificationFromDto,
  notificationToCreateRequest,
} from "@platform/app-shared/notifications/notification-mappers";
import {
  NOTIFICATION_PUSHED_EVENT,
  NOTIFICATION_TOAST_EVENT,
  replaceNotificationsFromServer,
  setNotificationStorageUser,
  upsertNotificationFromServer,
  type AppNotification,
} from "@platform/app-shared/notifications/notification-store";

const POLL_FALLBACK_MS = 180_000;
const SSE_RETRY_MS = 5_000;
const LOCAL_SYNC_SUPPRESS_MS = 60_000;

function isNetworkFailure(err: unknown): boolean {
  return (
    err instanceof TypeError ||
    (err instanceof Error && /failed to fetch|networkerror|load failed/i.test(err.message))
  );
}

/** Server inbox sync via SSE with polling fallback. */
export function ServerNotificationBridge() {
  const { token, authReady, isAuthenticated, role, user } = useAuth();
  const seenIdsRef = useRef<Set<string>>(new Set());
  const initialLoadRef = useRef(true);
  const localSyncSourceEventsRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (!isFeatureEnabled("notificationCenter")) return;
    if (!authReady || !isAuthenticated || !token) return;

    setNotificationStorageUser(user?.id);
    seenIdsRef.current.clear();
    initialLoadRef.current = true;
    localSyncSourceEventsRef.current.clear();
    let cancelled = false;
    let stopSync = false;
    let warnedNetwork = false;

    async function pull(notifyNew: boolean) {
      const authToken = token;
      if (!authToken || stopSync) return;
      try {
        const dtos = await listNotifications({ token: authToken });
        if (cancelled) return;

        const items = filterNotificationsForRole(
          role,
          dtos.map(notificationFromDto),
        );
        const newUnread = items.filter(
          (item) => !item.read && !seenIdsRef.current.has(item.id),
        );

        replaceNotificationsFromServer(items);
        seenIdsRef.current = new Set(items.map((item) => item.id));

        if (notifyNew && !initialLoadRef.current) {
          for (const item of newUnread) {
            if (shouldSuppressEchoToast(item.sourceEvent)) continue;
            if (!shouldShowNotificationToast(role, item)) continue;
            window.dispatchEvent(
              new CustomEvent<AppNotification>(NOTIFICATION_TOAST_EVENT, {
                detail: item,
              }),
            );
          }
        }

        initialLoadRef.current = false;
        warnedNetwork = false;
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiAuthError) {
          stopSync = true;
          return;
        }
        if (isNetworkFailure(err)) {
          if (!warnedNetwork) {
            warnedNetwork = true;
            console.warn(
              "Notification inbox unreachable (API offline?); keeping local inbox",
            );
          }
          return;
        }
        console.warn("Notification inbox pull failed; keeping local inbox", err);
      }
    }

    function shouldSuppressEchoToast(sourceEvent?: string): boolean {
      if (!sourceEvent) return false;
      const at = localSyncSourceEventsRef.current.get(sourceEvent);
      if (!at) return false;
      if (Date.now() - at > LOCAL_SYNC_SUPPRESS_MS) {
        localSyncSourceEventsRef.current.delete(sourceEvent);
        return false;
      }
      return true;
    }

    function handleServerDto(dto: UserNotificationDto) {
      const item = notificationFromDto(dto);
      if (!shouldShowNotificationToast(role, item)) return;
      const isNew = !seenIdsRef.current.has(item.id);
      seenIdsRef.current.add(item.id);
      upsertNotificationFromServer(item);

      if (
        !initialLoadRef.current &&
        isNew &&
        !item.read &&
        !shouldSuppressEchoToast(item.sourceEvent)
      ) {
        window.dispatchEvent(
          new CustomEvent<AppNotification>(NOTIFICATION_TOAST_EVENT, {
            detail: item,
          }),
        );
      }
    }

    void pull(false);

    const pollTimer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void pull(true);
      }
    }, POLL_FALLBACK_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void pull(true);
      }
    };

    document.addEventListener("visibilitychange", onVisible);

    const streamAbort = new AbortController();
    let retryTimer: number | undefined;

    async function connectStream() {
      const authToken = token;
      if (!authToken || cancelled || stopSync) return;

      try {
        await subscribeNotificationStream(
          { token: authToken },
          handleServerDto,
          streamAbort.signal,
        );
      } catch (err) {
        if (cancelled || streamAbort.signal.aborted || stopSync) return;
        if (err instanceof ApiAuthError) {
          stopSync = true;
          return;
        }
        retryTimer = window.setTimeout(() => {
          void connectStream();
        }, SSE_RETRY_MS);
      }
    }

    void connectStream();

    return () => {
      cancelled = true;
      window.clearInterval(pollTimer);
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      streamAbort.abort();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [authReady, isAuthenticated, token, role, user?.id]);

  useEffect(() => {
    if (!token) return;

    function onPushed(event: Event) {
      const item = (event as CustomEvent<AppNotification>).detail;
      if (!item) return;
      if (item.sourceEvent) {
        localSyncSourceEventsRef.current.set(item.sourceEvent, Date.now());
      }
      void createNotification(
        { token: token! },
        {
          ...notificationToCreateRequest(item),
          sourceEvent: item.sourceEvent
            ? `local:${item.sourceEvent}`
            : "self-authored",
        },
      ).catch((err) => {
        console.warn("Failed to sync local notification to server", err);
      });
    }

    window.addEventListener(NOTIFICATION_PUSHED_EVENT, onPushed);
    return () => window.removeEventListener(NOTIFICATION_PUSHED_EVENT, onPushed);
  }, [token]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    function onMessage(event: MessageEvent) {
      const data = event.data as
        | { type?: string; payload?: UserNotificationDto; href?: string }
        | undefined;
      if (!data?.type) return;
      if (data.type === "PUSH_NOTIFICATION" && data.payload) {
        const item = notificationFromDto({
          id: String(data.payload.id ?? crypto.randomUUID()),
          title: data.payload.title ?? "إجادة",
          body: data.payload.body,
          href: data.payload.href,
          tone: data.payload.tone,
          category: data.payload.category,
          sourceEvent: data.payload.sourceEvent,
          createdAtUtc: new Date().toISOString(),
          read: false,
        });
        upsertNotificationFromServer(item);
        window.dispatchEvent(
          new CustomEvent<AppNotification>(NOTIFICATION_TOAST_EVENT, {
            detail: item,
          }),
        );
      }
      if (data.type === "PUSH_NAVIGATE" && data.href) {
        window.location.assign(data.href);
      }
    }

    navigator.serviceWorker.addEventListener("message", onMessage);
    void import("@/lib/web-push-client").then((mod) =>
      mod.reconcilePushSubscription(),
    );
    return () => {
      navigator.serviceWorker.removeEventListener("message", onMessage);
    };
  }, [token, role]);

  return null;
}
