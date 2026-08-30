"use client";

import { useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  createNotification,
  listNotifications,
  subscribeNotificationStream,
  type UserNotificationDto,
} from "@platform/api-client/notifications";
import { ApiAuthError } from "@platform/api-client";
import { isFeatureEnabled } from "@platform/app-shared/feature-flags";
import { useAuth } from "@platform/app-shared/hooks/useAuth";
import { useDocumentVisible } from "@platform/app-shared/hooks/use-document-visible";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
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

const SSE_RETRY_MS = 5_000;
const LOCAL_SYNC_SUPPRESS_MS = 60_000;

function isNetworkFailure(err: unknown): boolean {
  return (
    err instanceof TypeError ||
    (err instanceof Error && /failed to fetch|networkerror|load failed/i.test(err.message))
  );
}

/**
 * Server inbox sync — three independent delivery channels can each surface the
 * same notification (SSE stream, browser Web Push via the service worker, and
 * a tab-refocus catch-up pull), so `seenIdsRef` / `localSyncSourceEventsRef`
 * are shared at component scope and every channel must check them before
 * showing a toast — otherwise the same event shows up more than once.
 */
export function ServerNotificationBridge() {
  const { token, authReady, isAuthenticated, role, user } = useAuth();
  const queryClient = useQueryClient();
  const seenIdsRef = useRef<Set<string>>(new Set());
  const initialLoadRef = useRef(true);
  const localSyncSourceEventsRef = useRef<Map<string, number>>(new Map());
  const refreshDebounceRef = useRef<number | undefined>(undefined);
  const visible = useDocumentVisible();
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const wasVisibleRef = useRef(visible);
  const pullOnVisibleRef = useRef<() => void>(() => {});

  // Any server-pushed notification means something changed on the backend.
  // Invalidate only live queues / sidebar feeds — NOT prototypeKeys.all
  // (which also marks finance nav, inspector-fees badges, court visit fees,
  // property timelines, … and fights every page change with a mass refetch).
  const refreshTransactions = useCallback(() => {
    if (refreshDebounceRef.current !== undefined) {
      window.clearTimeout(refreshDebounceRef.current);
    }
    refreshDebounceRef.current = window.setTimeout(() => {
      refreshDebounceRef.current = undefined;
      void queryClient.invalidateQueries({
        queryKey: prototypeKeys.workflowTasks(),
      });
      void queryClient.invalidateQueries({
        queryKey: prototypeKeys.poListRows(),
      });
      void queryClient.invalidateQueries({
        queryKey: prototypeKeys.propertyListItems(),
      });
      void queryClient.invalidateQueries({
        queryKey: prototypeKeys.operationsTasks(),
      });
      void queryClient.invalidateQueries({
        queryKey: prototypeKeys.failures(),
      });
      void queryClient.invalidateQueries({
        queryKey: prototypeKeys.pendingBourseItems(),
      });
      void queryClient.invalidateQueries({
        queryKey: prototypeKeys.suspendedTransactions(),
      });
      void queryClient.invalidateQueries({
        queryKey: ["reporting", "dashboard"],
      });
    }, 250);
  }, [queryClient]);

  // A locally-pushed notification is synced to the server with a rewritten
  // sourceEvent (see the onPushed effect below); when that same notification
  // echoes back over SSE/push/pull, this suppresses the redundant toast.
  const shouldSuppressEchoToast = useCallback((sourceEvent?: string): boolean => {
    if (!sourceEvent) return false;
    const at = localSyncSourceEventsRef.current.get(sourceEvent);
    if (!at) return false;
    if (Date.now() - at > LOCAL_SYNC_SUPPRESS_MS) {
      localSyncSourceEventsRef.current.delete(sourceEvent);
      return false;
    }
    return true;
  }, []);

  // Shared id-based dedup: whichever channel (SSE, push, pull) sees a given
  // notification id first "wins" and is responsible for the toast/refresh;
  // every later delivery of the same id is a silent store update only.
  const markSeenIfNew = useCallback((id: string): boolean => {
    const isNew = !seenIdsRef.current.has(id);
    seenIdsRef.current.add(id);
    return isNew;
  }, []);

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

    let pullInFlight: Promise<void> | null = null;
    let pullPendingNotify = false;

    // Re-entrancy guard: a tab-refocus during an in-flight pull could overlap
    // with the next one. Both would then read the same stale seenIdsRef
    // snapshot (only updated after the fetch resolves) and both re-toast the
    // same "new" unread notifications. Coalesce instead of running
    // concurrently.
    function pull(notifyNew: boolean): Promise<void> {
      if (pullInFlight) {
        pullPendingNotify = pullPendingNotify || notifyNew;
        return pullInFlight;
      }
      pullInFlight = runPull(notifyNew).finally(() => {
        pullInFlight = null;
        if (pullPendingNotify) {
          const rerunNotify = pullPendingNotify;
          pullPendingNotify = false;
          void pull(rerunNotify);
        }
      });
      return pullInFlight;
    }

    async function runPull(notifyNew: boolean) {
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
          if (newUnread.length > 0) refreshTransactions();
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

    function handleServerDto(dto: UserNotificationDto) {
      const item = notificationFromDto(dto);
      // Always upsert into the inbox; toast policy only gates the popup.
      const isNew = markSeenIfNew(item.id);
      upsertNotificationFromServer(item);
      if (isNew) refreshTransactions();

      if (
        !initialLoadRef.current &&
        isNew &&
        !item.read &&
        shouldShowNotificationToast(role, item) &&
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

    // SSE is the primary live channel. A short visible-tab poll covers:
    // outbox/Rabbit lag, silent SSE drops, and RabbitMQ-disabled local runs
    // (backend comment: "clients retain polling fallback").
    const POLL_FALLBACK_MS = 12_000;
    const pollTimer = window.setInterval(() => {
      if (visibleRef.current) {
        void pull(true);
      }
    }, POLL_FALLBACK_MS);

    pullOnVisibleRef.current = () => void pull(true);

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
        // Resolved without throwing means the stream ended cleanly (e.g. a
        // backend deploy/restart closed the connection) — reconnect just
        // like a network failure would, or the tab goes stale silently.
      } catch (err) {
        if (cancelled || streamAbort.signal.aborted || stopSync) return;
        if (err instanceof ApiAuthError) {
          stopSync = true;
          return;
        }
      }

      if (cancelled || streamAbort.signal.aborted || stopSync) return;
      retryTimer = window.setTimeout(() => {
        void connectStream();
      }, SSE_RETRY_MS);
    }

    void connectStream();

    return () => {
      cancelled = true;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      window.clearInterval(pollTimer);
      if (refreshDebounceRef.current !== undefined) {
        window.clearTimeout(refreshDebounceRef.current);
        refreshDebounceRef.current = undefined;
      }
      streamAbort.abort();
      pullOnVisibleRef.current = () => {};
    };
  }, [
    authReady,
    isAuthenticated,
    token,
    role,
    user?.id,
    refreshTransactions,
    shouldSuppressEchoToast,
    markSeenIfNew,
  ]);

  // Hidden → visible only: pull on mount is done via pull(false) in the effect above,
  // so reading visibility state here would fire an extra pull with its toasts.
  useEffect(() => {
    const wasVisible = wasVisibleRef.current;
    wasVisibleRef.current = visible;
    if (visible && !wasVisible) pullOnVisibleRef.current();
  }, [visible]);

  useEffect(() => {
    if (!token) return;

    function onPushed(event: Event) {
      const item = (event as CustomEvent<AppNotification>).detail;
      if (!item) return;
      // Must match exactly what gets synced to the server below — the
      // SSE/push/pull echo of this same notification carries the *synced*
      // sourceEvent, not the original one, so suppression has to be keyed on
      // the same string or the echo re-fires a second toast for the action
      // just shown. Pushes without an original sourceEvent get a
      // per-notification id instead of a shared literal, so two unrelated
      // self-authored toasts fired within the suppression window don't mask
      // each other.
      const syncedSourceEvent = item.sourceEvent
        ? `local:${item.sourceEvent}`
        : `self-authored:${item.id}`;
      localSyncSourceEventsRef.current.set(syncedSourceEvent, Date.now());
      void createNotification(
        { token: token! },
        {
          ...notificationToCreateRequest(item),
          sourceEvent: syncedSourceEvent,
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
        // This channel used to show a toast unconditionally — a web-push
        // delivery arriving for the same notification the SSE stream (or a
        // local self-push) already surfaced showed as a duplicate/triple
        // toast. Same shared dedup as the other two channels.
        if (!shouldShowNotificationToast(role, item)) return;
        const isNew = markSeenIfNew(item.id);
        upsertNotificationFromServer(item);
        if (isNew) refreshTransactions();
        if (isNew && !item.read && !shouldSuppressEchoToast(item.sourceEvent)) {
          window.dispatchEvent(
            new CustomEvent<AppNotification>(NOTIFICATION_TOAST_EVENT, {
              detail: item,
            }),
          );
        }
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
  }, [token, role, refreshTransactions, shouldSuppressEchoToast, markSeenIfNew]);

  return null;
}
