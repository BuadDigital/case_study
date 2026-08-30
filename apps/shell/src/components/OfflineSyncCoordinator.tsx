"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  evaluateOfflineLease,
  isOfflineCapableRole,
  syncOfflineQueue,
} from "@platform/app-shared/offline/offline-write";
import { useAuth } from "@platform/app-shared/hooks/useAuth";
import { useOnlineStatus } from "@platform/app-shared/hooks/useOnlineStatus";
import { useDocumentVisible } from "@platform/app-shared/hooks/use-document-visible";
import {
  OFFLINE_PENDING_EVENT,
  OFFLINE_SYNC_EVENT,
  listOutboxItems,
  purgeOfflineData,
  requestBackgroundSync,
  type OfflineOutboxItem,
  type OfflineSyncState,
  getOfflineSyncState,
} from "@platform/offline-client";
import {
  listAttachments,
  savePartyTaskSubmission,
  submitPartyTaskSubmission,
  uploadAttachment,
  createKeyEnvelope,
  addKeyEnvelopeAssignment,
  confirmKeyEnvelopeAssignment,
  createKeyEnvelopeHandoff,
  confirmKeyEnvelopeHandoff,
  upsertFieldSyncStatus,
} from "@platform/api-client";
import { getValidAuthSession } from "@platform/auth-client";
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

function outboxKindLabel(kind: string): string {
  switch (kind) {
    case "attachment-upload":
      return "رفع مرفق";
    case "party-submission-save":
      return "حفظ مسودة";
    case "party-submission-submit":
      return "إرسال مهمة";
    case "key-envelope-create":
      return "تسجيل ظرف مفاتيح";
    case "key-envelope-assignment-add":
      return "إسناد ظرف";
    case "key-envelope-assignment-confirm":
      return "تأكيد إسناد";
    case "key-envelope-handoff-create":
      return "مناولة مفاتيح";
    case "key-envelope-handoff-confirm":
      return "تأكيد مناولة";
    default:
      return kind;
  }
}

function ageHours(iso: string): number {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return 0;
  return (Date.now() - t) / (60 * 60 * 1000);
}

async function reportFieldSyncHeartbeat(
  items: OfflineOutboxItem[],
  meta: { displayName?: string | null; roleId?: string | null },
): Promise<void> {
  const session = getValidAuthSession();
  if (!session?.token) return;
  const active = items.filter(
    (item) =>
      item.status === "pending" ||
      item.status === "uploading" ||
      item.status === "failed",
  );
  if (active.length === 0) {
    await upsertFieldSyncStatus(
      { token: session.token },
      {
        pendingCount: 0,
        kinds: [],
        displayName: meta.displayName,
        roleId: meta.roleId,
      },
    );
    return;
  }
  // Single pass: oldest timestamp (min) + unique kinds — no sort/extra arrays.
  let oldest: string | undefined;
  const kindSet = new Set<string>();
  for (const item of active) {
    if (oldest === undefined || item.createdAtUtc < oldest) {
      oldest = item.createdAtUtc;
    }
    kindSet.add(item.kind);
  }
  const kinds = [...kindSet];
  await upsertFieldSyncStatus(
    { token: session.token },
    {
      pendingCount: active.length,
      oldestPendingAtUtc: oldest ?? null,
      kinds,
      displayName: meta.displayName,
      roleId: meta.roleId,
    },
  );
  void requestBackgroundSync();
}

async function runSync(userId: string): Promise<void> {
  const modulesConfig = prototypeModulesApiConfig();
  const workOrdersConfig = workOrdersApiConfig();
  const result = await syncOfflineQueue({
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
        if (upload.kind === "auth" || upload.kind === "forbidden") {
          await purgeOfflineData(userId, "auth-rejected");
        }
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
      const saveResult = await savePartyTaskSubmission(
        workOrdersConfig,
        input.taskId,
        payload,
      );
      if (!saveResult.ok) {
        if (saveResult.kind === "auth" || saveResult.kind === "forbidden") {
          await purgeOfflineData(userId, "auth-rejected");
        }
        return {
          ok: false,
          error: "تعذّر حفظ المسودة",
          terminal:
            saveResult.kind === "auth" ||
            saveResult.kind === "forbidden" ||
            saveResult.kind === "validation",
        };
      }
      return { ok: true };
    },
    submitSubmission: async (input) => {
      if (!workOrdersConfig) {
        return { ok: false, error: "غير مصادق", terminal: true };
      }
      const submitResult = await submitPartyTaskSubmission(
        workOrdersConfig,
        input.taskId,
      );
      if (!submitResult.ok) {
        if (submitResult.kind === "auth" || submitResult.kind === "forbidden") {
          await purgeOfflineData(userId, "auth-rejected");
        }
        return {
          ok: false,
          error: "تعذّر إرسال المهمة",
          terminal:
            submitResult.kind === "auth" ||
            submitResult.kind === "forbidden" ||
            submitResult.kind === "validation",
        };
      }
      return { ok: true };
    },
    createKeyEnvelope: async (input) => {
      if (!modulesConfig) {
        return { ok: false, error: "غير مصادق", terminal: true };
      }
      let body: Parameters<typeof createKeyEnvelope>[1];
      try {
        const parsed = JSON.parse(input.bodyJson) as Record<string, unknown>;
        const { clientEnvelopeId: _clientId, ...rest } = parsed;
        body = rest as Parameters<typeof createKeyEnvelope>[1];
      } catch {
        return { ok: false, error: "بيانات ظرف غير صالحة", terminal: true };
      }
      const createResult = await createKeyEnvelope(modulesConfig, body);
      if (!createResult.ok) {
        if (createResult.kind === "auth" || createResult.kind === "forbidden") {
          await purgeOfflineData(userId, "auth-rejected");
        }
        return {
          ok: false,
          error: "تعذّر تسجيل الظرف",
          terminal:
            createResult.kind === "auth" || createResult.kind === "forbidden",
        };
      }
      return { ok: true, envelopeId: createResult.data.id };
    },
    addKeyEnvelopeAssignment: async (input) => {
      if (!modulesConfig) {
        return { ok: false, error: "غير مصادق", terminal: true };
      }
      let payload: { deedNumber?: string; propertyId?: string | null };
      try {
        payload = JSON.parse(input.payloadJson) as typeof payload;
      } catch {
        return { ok: false, error: "بيانات إسناد غير صالحة", terminal: true };
      }
      if (!payload.deedNumber?.trim()) {
        return { ok: false, error: "رقم الصك مطلوب", terminal: true };
      }
      const result = await addKeyEnvelopeAssignment(
        modulesConfig,
        input.envelopeId,
        {
          deedNumber: payload.deedNumber,
          propertyId: payload.propertyId ?? null,
        },
      );
      if (!result.ok) {
        if (result.kind === "auth" || result.kind === "forbidden") {
          await purgeOfflineData(userId, "auth-rejected");
        }
        return {
          ok: false,
          error: "تعذّر إضافة الإسناد",
          terminal: result.kind === "auth" || result.kind === "forbidden",
        };
      }
      return { ok: true };
    },
    confirmKeyEnvelopeAssignment: async (input) => {
      if (!modulesConfig) {
        return { ok: false, error: "غير مصادق", terminal: true };
      }
      let payload: {
        assignmentId?: string;
        status?: string;
        notes?: string | null;
      };
      try {
        payload = JSON.parse(input.payloadJson) as typeof payload;
      } catch {
        return { ok: false, error: "بيانات تأكيد غير صالحة", terminal: true };
      }
      if (!payload.assignmentId || !payload.status) {
        return { ok: false, error: "بيانات تأكيد ناقصة", terminal: true };
      }
      const result = await confirmKeyEnvelopeAssignment(
        modulesConfig,
        input.envelopeId,
        payload.assignmentId,
        { status: payload.status, notes: payload.notes ?? null },
      );
      if (!result.ok) {
        if (result.kind === "auth" || result.kind === "forbidden") {
          await purgeOfflineData(userId, "auth-rejected");
        }
        return {
          ok: false,
          error: "تعذّر تأكيد الإسناد",
          terminal: result.kind === "auth" || result.kind === "forbidden",
        };
      }
      return { ok: true };
    },
    createKeyEnvelopeHandoff: async (input) => {
      if (!modulesConfig) {
        return { ok: false, error: "غير مصادق", terminal: true };
      }
      let payload: Parameters<typeof createKeyEnvelopeHandoff>[2];
      try {
        const parsed = JSON.parse(input.payloadJson) as Record<string, unknown>;
        const { envelopeId: _e, ...rest } = parsed;
        payload = rest as Parameters<typeof createKeyEnvelopeHandoff>[2];
      } catch {
        return { ok: false, error: "بيانات مناولة غير صالحة", terminal: true };
      }
      const result = await createKeyEnvelopeHandoff(
        modulesConfig,
        input.envelopeId,
        payload,
      );
      if (!result.ok) {
        if (result.kind === "auth" || result.kind === "forbidden") {
          await purgeOfflineData(userId, "auth-rejected");
        }
        return {
          ok: false,
          error: "تعذّر تسجيل المناولة",
          terminal: result.kind === "auth" || result.kind === "forbidden",
        };
      }
      return { ok: true };
    },
    confirmKeyEnvelopeHandoff: async (input) => {
      if (!modulesConfig) {
        return { ok: false, error: "غير مصادق", terminal: true };
      }
      let payload: { handoffId?: string };
      try {
        payload = JSON.parse(input.payloadJson) as typeof payload;
      } catch {
        return { ok: false, error: "بيانات تأكيد غير صالحة", terminal: true };
      }
      if (!payload.handoffId) {
        return { ok: false, error: "معرّف المناولة مطلوب", terminal: true };
      }
      const result = await confirmKeyEnvelopeHandoff(
        modulesConfig,
        input.envelopeId,
        payload.handoffId,
      );
      if (!result.ok) {
        if (result.kind === "auth" || result.kind === "forbidden") {
          await purgeOfflineData(userId, "auth-rejected");
        }
        return {
          ok: false,
          error: "تعذّر تأكيد المناولة",
          terminal: result.kind === "auth" || result.kind === "forbidden",
        };
      }
      return { ok: true };
    },
  });
  void result;
}

/**
 * Coordinates offline lease, silent sync, Background Sync wake-ups,
 * supervisor heartbeat, and top-bar pending list for field roles.
 */
export function OfflineSyncCoordinator() {
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
  const [open, setOpen] = useState(false);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    if (!capable || !isAuthenticated || !user?.id) return;

    const refreshPending = () => {
      void listOutboxItems(user.id)
        .then((items) => {
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

    const userId = user?.id;
    if (!userId) return;
    void runSync(userId);
    const timer = window.setInterval(() => void runSync(userId), 30_000);
    return () => window.clearInterval(timer);
  }, [capable, isAuthenticated, online, user?.id]);

  // مخفي ← ظاهر فقط: التأثير أعلاه يزامن أصلاً عند التركيب/عودة الاتصال، فقراءة
  // الحالة اللحظية هنا كانت ستضاعف المزامنة.
  useEffect(() => {
    const wasVisible = wasVisibleRef.current;
    wasVisibleRef.current = visible;
    if (!visible || wasVisible) return;
    if (!capable || !isAuthenticated || !online) return;
    const userId = user?.id;
    if (!userId) return;
    void runSync(userId);
  }, [visible, capable, isAuthenticated, online, user?.id]);

  useEffect(() => {
    if (!capable || !isAuthenticated || !user?.id) return;
    const onSwMessage = (event: MessageEvent) => {
      if (event.data?.type !== "RUN_OFFLINE_SYNC") return;
      if (typeof navigator !== "undefined" && navigator.onLine === false) return;
      void runSync(user.id);
    };
    navigator.serviceWorker?.addEventListener("message", onSwMessage);
    return () => {
      navigator.serviceWorker?.removeEventListener("message", onSwMessage);
    };
  }, [capable, isAuthenticated, user?.id]);

  // نبضة كل دقيقة تقرأ الطابور بنفسها؛ إدراج pending/الاسم/الدور في الاعتماديات
  // كان يهدم المؤقت ويطلق POST إضافياً مع كل تغيّر في الطابور (advanced-use-latest).
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
    const timer = window.setInterval(report, 60_000);
    return () => window.clearInterval(timer);
  }, [capable, isAuthenticated, online, user?.id]);

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
    if (locked) return "جلسة offline مقفلة";
    if (syncState === "syncing") return "جاري المزامنة";
    if (syncState === "offline") {
      return pending > 0
        ? `دون اتصال — ${pending} في طابور الحفظ`
        : "دون اتصال";
    }
    if (syncState === "failed") return "فشلت المزامنة — إعادة محاولة";
    if (pending > 0) return `${pending} بانتظار المزامنة`;
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
                    <div className="font-medium text-text-1">
                      {outboxKindLabel(item.kind)}
                      {ageHours(item.createdAtUtc) >= 2 ? (
                        <span className="ms-1 text-amber-600">
                          · معلّق &gt; ساعتين
                        </span>
                      ) : null}
                    </div>
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
