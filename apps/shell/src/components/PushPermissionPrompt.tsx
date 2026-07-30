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
 * Soft in-app card that requests notification permission only from a button click,
 * after authentication and a short engagement delay.
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
    <div className="fixed inset-x-0 bottom-0 z-[65] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto flex max-w-lg flex-col gap-3 rounded-2xl border border-border-md bg-surface px-4 py-3 shadow-lg">
        <div>
          <p className="m-0 text-sm font-semibold text-text-1">تفعيل الإشعارات</p>
          <p className="m-0 mt-1 text-xs text-text-2">
            استقبل تنبيهات المهام حتى عند إغلاق التطبيق. يمكنك إيقافها لاحقاً من
            الملف الشخصي.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="min-h-11 flex-1 rounded-xl bg-brand px-4 text-sm font-semibold text-white disabled:opacity-60"
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
            تفعيل الإشعارات
          </button>
          <button
            type="button"
            className="min-h-11 rounded-xl border border-border-md px-4 text-sm text-text-2"
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
    </div>
  );
}
