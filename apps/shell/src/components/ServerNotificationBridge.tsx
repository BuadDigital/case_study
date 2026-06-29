"use client";

import { useEffect, useRef } from "react";
import {
  createNotification,
  listNotifications,
  subscribeNotificationStream,
  type UserNotificationDto,
} from "@platform/api-client/notifications";
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
  upsertNotificationFromServer,
  type AppNotification,
} from "@platform/app-shared/notifications/notification-store";

const POLL_FALLBACK_MS = 180_000;
const SSE_RETRY_MS = 5_000;
const LOCAL_SYNC_SUPPRESS_MS = 60_000;

/** Server inbox sync via SSE with polling fallback. */
export function ServerNotificationBridge() {
  const { token, authReady, isAuthenticated, role } = useAuth();
  const seenIdsRef = useRef<Set<string>>(new Set());
  const initialLoadRef = useRef(true);
  const localSyncSourceEventsRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (!isFeatureEnabled("notificationCenter")) return;
    if (!authReady || !isAuthenticated || !token) return;

    let cancelled = false;

    async function pull(notifyNew: boolean) {
      const authToken = token;
      if (!authToken) return;
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
      } catch {
        // offline or API unavailable — keep local inbox
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
      if (!authToken || cancelled) return;

      try {
        await subscribeNotificationStream(
          { token: authToken },
          handleServerDto,
          streamAbort.signal,
        );
      } catch {
        if (cancelled || streamAbort.signal.aborted) return;
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
  }, [authReady, isAuthenticated, token, role]);

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
        notificationToCreateRequest(item),
      ).catch(() => undefined);
    }

    window.addEventListener(NOTIFICATION_PUSHED_EVENT, onPushed);
    return () => window.removeEventListener(NOTIFICATION_PUSHED_EVENT, onPushed);
  }, [token]);

  return null;
}
