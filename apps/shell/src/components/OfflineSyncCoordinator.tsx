"use client";

import { useEffect, useMemo, useState } from "react";
import {
  evaluateOfflineLease,
  isOfflineCapableRole,
  syncOfflineQueue,
} from "@platform/app-shared";
import { useAuth } from "@platform/app-shared/hooks/useAuth";
import { useOnlineStatus } from "@platform/app-shared/hooks/useOnlineStatus";
import {
  OFFLINE_PENDING_EVENT,
  OFFLINE_SYNC_EVENT,
  listOutboxItems,
  type OfflineOutboxItem,
  type OfflineSyncState,
  getOfflineSyncState,
} from "@platform/offline-client";
import {
  listAttachments,
  savePartyTaskSubmission,
  submitPartyTaskSubmission,
  uploadAttachment,
} from "@platform/api-client";
import { prototypeModulesApiConfig } from "@platform/app-shared/prototype/prototype-modules-api-config";
import { workOrdersApiConfig } from "@platform/app-shared/prototype/work-orders-api-config";

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

async function runSync(): Promise<void> {
  const modulesConfig = prototypeModulesApiConfig();
  const workOrdersConfig = workOrdersApiConfig();
  await syncOfflineQueue({
    uploadAttachment: async (input) => {
      if (!modulesConfig) {
        return { ok: false, error: "غير مصادق", terminal: true };
      }
      try {
        const existing = await listAttachments(
          modulesConfig,
          input.scope,
          input.scopeKey,
        );
        if (existing.ok && existing.data.length > 0) {
          const match =
            existing.data.find(
              (row) =>
                row.fileName === input.fileName &&
                row.sizeBytes === input.bytes.byteLength,
            ) ?? existing.data[0];
          if (match?.id) return { ok: true, attachmentId: match.id };
        }
      } catch {
        /* continue to upload */
      }
      const upload = await uploadAttachment(modulesConfig, {
        scope: input.scope,
        scopeKey: input.scopeKey,
        fileName: input.fileName,
        contentType: input.contentType,
        contentBase64: arrayBufferToBase64(input.bytes),
      });
      if (!upload.ok) {
        return {
          ok: false,
          error: "تعذّر رفع المرفق",
          terminal: upload.kind === "auth" || upload.kind === "forbidden",
        };
      }
      return { ok: true, attachmentId: upload.data.id };
    },
    saveSubmission: async (input) => {
      if (!workOrdersConfig) {
        return { ok: false, error: "غير مصادق", terminal: true };
      }
      let payload: Record<string, unknown> = {};
      try {
        payload = JSON.parse(input.payloadJson) as Record<string, unknown>;
      } catch {
        return { ok: false, error: "مسودة غير صالحة", terminal: true };
      }
      const result = await savePartyTaskSubmission(
        workOrdersConfig,
        input.taskId,
        payload,
      );
      if (!result.ok) {
        return {
          ok: false,
          error: "تعذّر حفظ المسودة",
          terminal:
            result.kind === "auth" ||
            result.kind === "forbidden" ||
            result.kind === "validation",
        };
      }
      return { ok: true };
    },
    submitSubmission: async (input) => {
      if (!workOrdersConfig) {
        return { ok: false, error: "غير مصادق", terminal: true };
      }
      const result = await submitPartyTaskSubmission(
        workOrdersConfig,
        input.taskId,
      );
      if (!result.ok) {
        return {
          ok: false,
          error: "تعذّر إرسال المهمة",
          terminal:
            result.kind === "auth" ||
            result.kind === "forbidden" ||
            result.kind === "validation",
        };
      }
      return { ok: true };
    },
  });
}

/**
 * Coordinates offline lease, silent sync, and top-bar pending list for
 * field-inspector / government-reviewer.
 */
export function OfflineSyncCoordinator() {
  const { role, user, isAuthenticated } = useAuth();
  const online = useOnlineStatus();
  const capable = isOfflineCapableRole(role);
  const [syncState, setSyncState] = useState<OfflineSyncState>("synced");
  const [pending, setPending] = useState(0);
  const [pendingItems, setPendingItems] = useState<OfflineOutboxItem[]>([]);
  const [open, setOpen] = useState(false);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    if (!capable || !isAuthenticated || !user?.id) return;

    const refreshPending = () => {
      void listOutboxItems(user.id).then((items) => {
        const active = items.filter(
          (item) =>
            item.status === "pending" ||
            item.status === "uploading" ||
            item.status === "failed",
        );
        setPending(active.length);
        setPendingItems(active);
        try {
          sessionStorage.setItem(
            "ejada_offline_pending_count",
            String(active.length),
          );
        } catch {
          /* ignore */
        }
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
      setSyncState("offline");
      void evaluateOfflineLease().then((lease) => {
        if (!lease) return;
        if (lease.warn1h) {
          window.dispatchEvent(
            new CustomEvent("ejada-toast", {
              detail: { message: "مضت ساعة دون اتصال — تبقى ساعتان قبل القفل" },
            }),
          );
        }
        if (lease.warn2h) {
          window.dispatchEvent(
            new CustomEvent("ejada-toast", {
              detail: { message: "مضت ساعتان دون اتصال — تبقى ساعة قبل القفل" },
            }),
          );
        }
        if (lease.locked) setLocked(true);
      });
      return;
    }

    void runSync();
    const timer = window.setInterval(() => void runSync(), 30_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void runSync();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [capable, isAuthenticated, online]);

  useEffect(() => {
    if (!capable) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (pending <= 0) return;
      event.preventDefault();
      event.returnValue = `هناك ${pending} عناصر لم تُرفع بعد. أبقِ النظام مفتوحاً حتى تكتمل.`;
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [capable, pending]);

  const label = useMemo(() => {
    if (locked) return "جلسة Offline مقفلة";
    if (syncState === "syncing") return "جاري المزامنة";
    if (syncState === "failed" || pending > 0) return "فشلت المزامنة — إعادة محاولة";
    if (syncState === "offline") return "دون اتصال";
    return "تمت المزامنة";
  }, [locked, pending, syncState]);

  if (!capable || !isAuthenticated) return null;

  return (
    <>
      {locked ? (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/50 p-4">
          <div className="max-w-md rounded-2xl bg-surface p-6 text-center shadow-xl">
            <h2 className="m-0 text-lg font-semibold text-text-1">
              انتهت جلسة العمل دون اتصال
            </h2>
            <p className="mt-2 text-sm text-text-2">
              القفل كامل بعد ثلاث ساعات. بياناتك محفوظة مشفّرة وستُزامن بعد
              تسجيل الدخول مجدداً.
            </p>
            <button
              type="button"
              className="mt-4 min-h-11 rounded-xl bg-brand px-4 text-sm font-semibold text-white"
              onClick={() => {
                window.location.href = "/login";
              }}
            >
              تسجيل الدخول
            </button>
          </div>
        </div>
      ) : null}

      <div className="relative">
        <button
          type="button"
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-text-2 hover:bg-surface-2"
          aria-label={label}
          title={label}
          onClick={() => setOpen((v) => !v)}
        >
          <span aria-hidden className="text-base">
            {syncState === "syncing"
              ? "🕓"
              : syncState === "failed" || pending > 0
                ? "⚠️"
                : "✅"}
          </span>
          {pending > 0 ? (
            <span className="absolute -top-0.5 -left-0.5 rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">
              {pending}
            </span>
          ) : null}
        </button>
        {open ? (
          <div className="absolute left-0 top-full z-50 mt-2 w-72 rounded-xl border border-border-md bg-surface p-3 shadow-lg">
            <p className="m-0 mb-2 text-xs font-semibold text-text-1">{label}</p>
            {pendingItems.length === 0 ? (
              <p className="m-0 text-xs text-text-2">لا عناصر معلّقة</p>
            ) : (
              <ul className="m-0 max-h-56 list-none space-y-2 overflow-auto p-0">
                {pendingItems.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-lg bg-surface-2 px-2 py-1.5 text-[11px] text-text-2"
                  >
                    <div className="font-medium text-text-1">{item.kind}</div>
                    <div>{item.targetId}</div>
                    {item.lastError ? <div>{item.lastError}</div> : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>
    </>
  );
}
