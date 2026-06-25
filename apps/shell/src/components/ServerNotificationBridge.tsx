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

/** Server inbox sync via SSE with polling fallback. */
export function ServerNotificationBridge() {
  const { token, authReady, isAuthenticated } = useAuth();
  const seenIdsRef = useRef<Set<string>>(new Set());
  const initialLoadRef = useRef(true);

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

        const items = dtos.map(notificationFromDto);
        const newUnread = items.filter(
          (item) => !item.read && !seenIdsRef.current.has(item.id),
        );

        replaceNotificationsFromServer(items);
        seenIdsRef.current = new Set(items.map((item) => item.id));

        if (notifyNew && !initialLoadRef.current) {
          for (const item of newUnread) {
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

    function handleServerDto(dto: UserNotificationDto) {
      const item = notificationFromDto(dto);
      const isNew = !seenIdsRef.current.has(item.id);
      seenIdsRef.current.add(item.id);
      upsertNotificationFromServer(item);

      if (!initialLoadRef.current && isNew && !item.read) {
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
  }, [authReady, isAuthenticated, token]);

  useEffect(() => {
    if (!token) return;

    function onPushed(event: Event) {
      const item = (event as CustomEvent<AppNotification>).detail;
      if (!item) return;
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
