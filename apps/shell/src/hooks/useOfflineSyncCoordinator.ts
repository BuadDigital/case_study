"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  evaluateOfflineLease,
  isOfflineCapableRole,
} from "@platform/app-shared/offline/offline-write";
import { useAuth } from "@platform/app-shared/hooks/useAuth";
import { useOnlineStatus } from "@platform/app-shared/hooks/useOnlineStatus";
import { useDocumentVisible } from "@platform/app-shared/hooks/use-document-visible";
import {
  OFFLINE_PENDING_EVENT,
  OFFLINE_SYNC_EVENT,
  listOutboxItems,
  requestBackgroundSync,
  type OfflineOutboxItem,
  type OfflineSyncState,
  getOfflineSyncState,
} from "@platform/offline-client";
import { upsertFieldSyncStatus } from "@platform/api-client";
import { getValidAuthSession } from "@platform/auth-client";
import { replayOfflineQueue } from "@/lib/offline-sync-replay";
import {
  FIELD_SYNC_HEARTBEAT_INTERVAL_MS,
  OFFLINE_PENDING_COUNT_SESSION_KEY,
  OFFLINE_SYNC_INTERVAL_MS,
  activeOutboxItems,
  buildFieldSyncHeartbeat,
  offlineLeaseToasts,
  pendingUnloadWarning,
  syncStatusLabel,
  type FieldSyncHeartbeatMeta,
} from "@/components/offline-sync-state";

async function reportFieldSyncHeartbeat(
  items: OfflineOutboxItem[],
  meta: FieldSyncHeartbeatMeta,
): Promise<void> {
  const session = getValidAuthSession();
  if (!session?.token) return;
  const report = buildFieldSyncHeartbeat(items, meta);
  await upsertFieldSyncStatus({ token: session.token }, report);
  if (report.pendingCount > 0) void requestBackgroundSync();
}

export type OfflineSyncCoordinatorState = {
  /** False when the role never works offline or the session is gone — render nothing. */
  active: boolean;
  syncState: OfflineSyncState;
  pending: number;
  pendingItems: OfflineOutboxItem[];
  locked: boolean;
  label: string;
};

/**
 * Offline lease, silent sync, Background Sync wake-ups, supervisor heartbeat
 * and the pending list for field roles. Pure decisions live in
 * `offline-sync-state`; the API replay in `lib/offline-sync-replay`.
 */
export function useOfflineSyncCoordinator(): OfflineSyncCoordinatorState {
  const { role, user, isAuthenticated, displayName } = useAuth();
  const online = useOnlineStatus();
  const visible = useDocumentVisible();
  const capable = isOfflineCapableRole(role);
  const wasVisibleRef = useRef(visible);
  const heartbeatMetaRef = useRef({ displayName, role, user });
  heartbeatMetaRef.current = { displayName, role, user };
  const [syncState, setSyncState] = useState<OfflineSyncState>("synced");
  const [pending, setPending] = useState(0);
  const [pendingItems, setPendingItems] = useState<OfflineOutboxItem[]>([]);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    if (!capable || !isAuthenticated || !user?.id) return;

    const refreshPending = () => {
      void listOutboxItems(user.id)
        .then((items) => {
          const active = activeOutboxItems(items);
          setPending(active.length);
          setPendingItems(active);
          try {
            sessionStorage.setItem(
              OFFLINE_PENDING_COUNT_SESSION_KEY,
              String(active.length),
            );
          } catch {
            /* ignore */
          }
        })
        .catch(() => {
          /* IDB closing during HMR/logout — next event will refresh */
        });
    };

    refreshPending();
    const onPending = () => refreshPending();
    const onSync = (event: Event) => {
      const detail = (event as CustomEvent<{ state: OfflineSyncState }>).detail;
      if (detail?.state) setSyncState(detail.state);
      else setSyncState(getOfflineSyncState());
    };
    window.addEventListener(OFFLINE_PENDING_EVENT, onPending);
    window.addEventListener(OFFLINE_SYNC_EVENT, onSync);
    return () => {
      window.removeEventListener(OFFLINE_PENDING_EVENT, onPending);
      window.removeEventListener(OFFLINE_SYNC_EVENT, onSync);
    };
  }, [capable, isAuthenticated, user?.id]);

  useEffect(() => {
    if (!capable || !isAuthenticated) return;
    if (!online) {
      // Microtask keeps the effect body free of synchronous setState.
      queueMicrotask(() => setSyncState("offline"));
      void evaluateOfflineLease().then((lease) => {
        if (!lease) return;
        for (const message of offlineLeaseToasts(lease)) {
          window.dispatchEvent(
            new CustomEvent("ejada-toast", { detail: { message } }),
          );
        }
        if (lease.locked) setLocked(true);
      });
      return;
    }

    const userId = user?.id;
    if (!userId) return;
    void replayOfflineQueue(userId);
    const timer = window.setInterval(
      () => void replayOfflineQueue(userId),
      OFFLINE_SYNC_INTERVAL_MS,
    );
    return () => window.clearInterval(timer);
  }, [capable, isAuthenticated, online, user?.id]);

  // Hidden → visible only: the effect above already syncs on mount/reconnect, so reading
  // visibility state here would double the sync.
  useEffect(() => {
    const wasVisible = wasVisibleRef.current;
    wasVisibleRef.current = visible;
    if (!visible || wasVisible) return;
    if (!capable || !isAuthenticated || !online) return;
    const userId = user?.id;
    if (!userId) return;
    void replayOfflineQueue(userId);
  }, [visible, capable, isAuthenticated, online, user?.id]);

  useEffect(() => {
    if (!capable || !isAuthenticated || !user?.id) return;
    const onSwMessage = (event: MessageEvent) => {
      if (event.data?.type !== "RUN_OFFLINE_SYNC") return;
      if (typeof navigator !== "undefined" && navigator.onLine === false) return;
      void replayOfflineQueue(user.id);
    };
    navigator.serviceWorker?.addEventListener("message", onSwMessage);
    return () => {
      navigator.serviceWorker?.removeEventListener("message", onSwMessage);
    };
  }, [capable, isAuthenticated, user?.id]);

  // Minute pulse reads the queue itself; putting pending/name/role in deps
  // tore down the timer and fired an extra POST on every queue change (advanced-use-latest).
  useEffect(() => {
    const userId = user?.id;
    if (!capable || !isAuthenticated || !online || !userId) return;
    const report = () => {
      void listOutboxItems(userId)
        .then((items) => {
          const meta = heartbeatMetaRef.current;
          void reportFieldSyncHeartbeat(items, {
            displayName: meta.displayName ?? meta.user?.displayName,
            roleId: meta.role,
          });
        })
        .catch(() => {
          /* ignore transient IDB close */
        });
    };
    report();
    const timer = window.setInterval(report, FIELD_SYNC_HEARTBEAT_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [capable, isAuthenticated, online, user?.id]);

  useEffect(() => {
    if (!capable) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (pending <= 0) return;
      event.preventDefault();
      event.returnValue = pendingUnloadWarning(pending);
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [capable, pending]);

  const label = useMemo(
    () => syncStatusLabel({ locked, syncState, pending }),
    [locked, pending, syncState],
  );

  return {
    active: capable && isAuthenticated,
    syncState,
    pending,
    pendingItems,
    locked,
    label,
  };
}
