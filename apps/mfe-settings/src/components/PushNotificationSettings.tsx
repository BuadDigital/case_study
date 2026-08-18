"use client";

import { useEffect, useState } from "react";
import { getValidAuthSession } from "@platform/auth-client";
import { isFeatureEnabled } from "@platform/app-shared/feature-flags";
import {
  deletePushSubscription,
  getPushConfig,
  getPushPreference,
  listPushSubscriptions,
  registerPushSubscription,
  setPushPreference,
  type PushSubscriptionDto,
} from "@platform/api-client/push";
import {
  getExistingSubscription,
  isPushSupported,
  pushPermission,
  subscribeToPush,
  unsubscribeFromPush,
} from "@platform/app-shared/notifications/web-push";
import { Note, Spinner } from "@platform/ui-kit";

export function PushNotificationSettings() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [devices, setDevices] = useState<PushSubscriptionDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [serverEnabled, setServerEnabled] = useState(false);
  const permission = pushPermission();

  useEffect(() => {
    if (!isFeatureEnabled("webPush")) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const session = getValidAuthSession();
        if (!session?.token) return;
        const config = await getPushConfig({ token: session.token });
        if (!config.ok || !config.data.enabled) {
          if (!cancelled) setServerEnabled(false);
          return;
        }
        if (!cancelled) setServerEnabled(true);
        const [pref, list] = await Promise.all([
          getPushPreference({ token: session.token }),
          listPushSubscriptions({ token: session.token }),
        ]);
        if (cancelled) return;
        setEnabled(pref.pushEnabled);
        setDevices(list.filter((d) => !d.disabledAtUtc));
      } catch {
        if (!cancelled) setError("تعذّر تحميل إعدادات الإشعارات");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!isFeatureEnabled("webPush")) return null;
  if (loading) {
    return (
      <div className="mt-4 flex items-center gap-2 text-text-3">
        <Spinner />
        <span className="text-[13px]">جاري تحميل إعدادات الإشعارات…</span>
      </div>
    );
  }

  if (!isPushSupported()) {
    return (
      <Note tone="warn" className="mt-4">
        المتصفح لا يدعم إشعارات Push.
      </Note>
    );
  }

  if (!serverEnabled) {
    return (
      <Note tone="info" className="mt-4">
        إشعارات Push غير مفعّلة على الخادم حالياً.
      </Note>
    );
  }

  if (permission === "denied") {
    return (
      <Note tone="warn" className="mt-4">
        الإشعارات مرفوضة من إعدادات المتصفح. أعد تفعيلها من إعدادات الجهاز ثم
        حدّث الصفحة.
      </Note>
    );
  }

  return (
    <section className="mt-5 rounded-lg border border-border p-4">
      <h3 className="m-0 text-sm font-semibold text-text-1">إشعارات الدفع</h3>
      <p className="mt-1 text-xs text-text-2">
        استقبل تنبيهات المهام حتى عند إغلاق التطبيق.
      </p>
      {error ? (
        <Note tone="danger" className="mt-3">
          {error}
        </Note>
      ) : null}
      <label className="mt-3 flex min-h-11 items-center justify-between gap-3 text-sm">
        <span>تفعيل الإشعارات</span>
        <input
          type="checkbox"
          checked={enabled}
          disabled={busy}
          onChange={(event) => {
            void (async () => {
              setBusy(true);
              setError(null);
              try {
                const session = getValidAuthSession();
                if (!session?.token) return;
                const next = event.target.checked;
                if (next && permission === "default") {
                  const result = await Notification.requestPermission();
                  if (result !== "granted") {
                    setError("لم يتم منح إذن الإشعارات");
                    return;
                  }
                }
                if (next) {
                  const config = await getPushConfig({ token: session.token });
                  if (config.ok && config.data.publicKey) {
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
                  }
                }
                const pref = await setPushPreference(
                  { token: session.token },
                  next,
                );
                setEnabled(pref.pushEnabled);
                const list = await listPushSubscriptions({
                  token: session.token,
                });
                setDevices(list.filter((d) => !d.disabledAtUtc));
              } catch {
                setError("تعذّر تحديث إعداد الإشعارات");
              } finally {
                setBusy(false);
              }
            })();
          }}
        />
      </label>

      <div className="mt-4">
        <p className="m-0 text-xs font-semibold text-text-1">الأجهزة المسجّلة</p>
        {devices.length === 0 ? (
          <p className="mt-1 text-xs text-text-2">لا أجهزة مسجّلة</p>
        ) : (
          <ul className="mt-2 space-y-2 p-0 list-none">
            {devices.map((device) => (
              <li
                key={device.id}
                className="flex items-start justify-between gap-2 rounded-lg bg-surface-2 px-3 py-2 text-xs"
              >
                <div>
                  <div className="font-medium text-text-1">
                    {device.deviceLabel || "متصفح"}
                  </div>
                  <div className="text-text-3 break-all">{device.endpoint}</div>
                </div>
                <button
                  type="button"
                  className="shrink-0 text-danger"
                  disabled={busy}
                  onClick={() => {
                    void (async () => {
                      setBusy(true);
                      try {
                        const session = getValidAuthSession();
                        if (!session?.token) return;
                        await deletePushSubscription(
                          { token: session.token },
                          device.endpoint,
                        );
                        const existing = await getExistingSubscription();
                        if (existing?.endpoint === device.endpoint) {
                          await unsubscribeFromPush();
                        }
                        setDevices((prev) =>
                          prev.filter((d) => d.id !== device.id),
                        );
                      } catch {
                        setError("تعذّر إلغاء الجهاز");
                      } finally {
                        setBusy(false);
                      }
                    })();
                  }}
                >
                  إلغاء
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
