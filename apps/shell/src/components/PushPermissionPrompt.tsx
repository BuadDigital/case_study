"use client";

import { useEffect, useState } from "react";
import { getValidAuthSession } from "@platform/auth-client";
import { isFeatureEnabled } from "@platform/app-shared/feature-flags";
import { useAuth } from "@platform/app-shared/hooks/useAuth";
import {
  getPushConfig,
  registerPushSubscription,
} from "@platform/api-client/push";
import {
  getExistingSubscription,
  isIosSafari,
  isPushSupported,
  isStandaloneDisplay,
  pushPermission,
  subscribeToPush,
} from "@platform/app-shared/notifications/web-push";

const DISMISS_KEY = "ejada_push_prompt_dismissed";
const ENGAGED_KEY = "ejada_push_prompt_engaged";
const ENGAGE_MS = 45_000;

/**
 * Soft floating card that requests notification permission only from a button
 * click, after authentication and a short engagement delay. Sits above bottom
 * page chrome (map legend, safe area) instead of docking flush to the edge.
 */
export function PushPermissionPrompt() {
  const { authReady, isAuthenticated } = useAuth();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isFeatureEnabled("webPush")) return;
    if (!authReady || !isAuthenticated) return;
    if (!isPushSupported()) return;
    if (pushPermission() !== "default") return;
    if (isIosSafari() && !isStandaloneDisplay()) return;

    try {
      if (localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      /* ignore */
    }

    let cancelled = false;
    const show = async () => {
      const existing = await getExistingSubscription();
      if (cancelled || existing) return;
      const session = getValidAuthSession();
      if (!session?.token) return;
      const config = await getPushConfig({ token: session.token }).catch(() => null);
      if (!config?.ok || !config.data.enabled) return;
      setVisible(true);
    };

    let engaged = false;
    try {
      engaged = localStorage.getItem(ENGAGED_KEY) === "1";
    } catch {
      /* ignore */
    }

    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(ENGAGED_KEY, "1");
      } catch {
        /* ignore */
      }
      void show();
    }, engaged ? 1_500 : ENGAGE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [authReady, isAuthenticated]);

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-labelledby="push-prompt-title"
      aria-busy={busy || undefined}
      className="fixed inset-x-3 bottom-[max(4.75rem,calc(env(safe-area-inset-bottom)+4.25rem))] z-[var(--z-banner)] mx-auto flex max-w-md flex-col gap-3 rounded-[14px] border border-border bg-surface p-3.5 shadow-[0_12px_40px_-12px_rgba(16,43,78,0.45)] sm:inset-x-auto sm:end-4 sm:start-auto"
    >
      <div className="min-w-0">
        <p
          id="push-prompt-title"
          className="m-0 text-[13.5px] font-extrabold text-heading"
        >
          تفعيل الإشعارات
        </p>
        <p className="m-0 mt-1 text-[12px] leading-relaxed text-text-2">
          استقبل تنبيهات المهام حتى عند إغلاق التطبيق. يمكنك إيقافها لاحقاً من
          الملف الشخصي.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-[9px] border-none bg-ink px-4 text-[13px] font-bold text-white disabled:opacity-60"
          disabled={busy}
          onClick={() => {
            void (async () => {
              setBusy(true);
              try {
                const permission = await Notification.requestPermission();
                if (permission !== "granted") {
                  localStorage.setItem(DISMISS_KEY, "1");
                  setVisible(false);
                  return;
                }
                const session = getValidAuthSession();
                if (!session?.token) return;
                const config = await getPushConfig({ token: session.token });
                if (!config.ok || !config.data.publicKey) return;
                const sub = await subscribeToPush(config.data.publicKey);
                await registerPushSubscription(
                  { token: session.token },
                  {
                    endpoint: sub.endpoint,
                    p256dh: sub.keys.p256dh,
                    auth: sub.keys.auth,
                    userAgent: navigator.userAgent,
                  },
                );
                setVisible(false);
              } catch {
                localStorage.setItem(DISMISS_KEY, "1");
                setVisible(false);
              } finally {
                setBusy(false);
              }
            })();
          }}
        >
          {busy ? "جاري التفعيل…" : "تفعيل الإشعارات"}
        </button>
        <button
          type="button"
          className="inline-flex min-h-11 items-center justify-center rounded-[9px] border border-border-md bg-surface px-4 text-[13px] font-semibold text-text-2 disabled:opacity-60"
          disabled={busy}
          onClick={() => {
            try {
              localStorage.setItem(DISMISS_KEY, "1");
            } catch {
              /* ignore */
            }
            setVisible(false);
          }}
        >
          لاحقاً
        </button>
      </div>
    </div>
  );
}
