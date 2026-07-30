import { getValidAuthSession } from "@platform/auth-client";
import {
  deletePushSubscription,
  getPushConfig,
  registerPushSubscription,
} from "@platform/api-client/push";
import {
  getExistingSubscription,
  isPushSupported,
  unsubscribeFromPush,
} from "@platform/app-shared/notifications/web-push";

function authConfig() {
  const session = getValidAuthSession();
  if (!session?.token) return null;
  return { token: session.token };
}

export async function unsubscribeAndUnregisterPush(): Promise<void> {
  if (!isPushSupported()) return;
  const config = authConfig();
  const endpoint =
    (await getExistingSubscription())?.endpoint ??
    (await unsubscribeFromPush().catch(() => null));
  if (endpoint && config) {
    await deletePushSubscription(config, endpoint).catch(() => null);
  } else {
    await unsubscribeFromPush().catch(() => null);
  }
}

export async function reconcilePushSubscription(): Promise<void> {
  if (!isPushSupported()) return;
  if (Notification.permission !== "granted") return;
  const config = authConfig();
  if (!config) return;
  const pushConfig = await getPushConfig(config).catch(() => null);
  if (!pushConfig?.ok || !pushConfig.data.enabled || !pushConfig.data.publicKey) {
    return;
  }
  const existing = await getExistingSubscription();
  if (!existing) return;
  const json = existing.toJSON();
  const keys = json.keys;
  if (!json.endpoint || !keys?.p256dh || !keys?.auth) return;
  await registerPushSubscription(config, {
    endpoint: json.endpoint,
    p256dh: keys.p256dh,
    auth: keys.auth,
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
  }).catch(() => null);
}
