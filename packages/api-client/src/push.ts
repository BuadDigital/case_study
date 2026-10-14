import { authHeaders, getApiBase } from "./api-base";
import { repositoryFetch as fetch } from "./write-repository";
import { ApiAuthError } from "./permissions";

type PushApiConfig = {
  baseUrl?: string;
  token: string;
};

type PushConfigDto = {
  enabled: boolean;
  publicKey?: string | null;
};

export type PushSubscriptionDto = {
  id: string;
  endpoint: string;
  userAgent?: string | null;
  deviceLabel?: string | null;
  createdAtUtc: string;
  lastSeenAtUtc: string;
  disabledAtUtc?: string | null;
};

type RegisterPushSubscriptionRequest = {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
  deviceLabel?: string;
};

type PushPreferenceDto = {
  pushEnabled: boolean;
};

function baseUrl(config?: PushApiConfig): string {
  return config?.baseUrl ?? getApiBase();
}

export async function getPushConfig(
  config?: PushApiConfig,
): Promise<{ ok: true; data: PushConfigDto } | { ok: false }> {
  const res = await fetch(`${baseUrl(config)}/api/push/config`, {
    headers: authHeaders(config?.token || undefined),
  });
  if (!res.ok) return { ok: false };
  return { ok: true, data: (await res.json()) as PushConfigDto };
}

export async function listPushSubscriptions(
  config: PushApiConfig,
): Promise<PushSubscriptionDto[]> {
  const res = await fetch(`${baseUrl(config)}/api/push/subscriptions`, {
    headers: authHeaders(config.token || undefined),
  });
  if (res.status === 401) throw new ApiAuthError();
  if (!res.ok) throw new Error(`push subscriptions ${res.status}`);
  return res.json() as Promise<PushSubscriptionDto[]>;
}

export async function registerPushSubscription(
  config: PushApiConfig,
  request: RegisterPushSubscriptionRequest,
): Promise<PushSubscriptionDto> {
  const res = await fetch(`${baseUrl(config)}/api/push/subscriptions`, {
    method: "POST",
    headers: authHeaders(config.token || undefined),
    body: JSON.stringify(request),
  });
  if (res.status === 401) throw new ApiAuthError();
  if (!res.ok) throw new Error(`register push ${res.status}`);
  return res.json() as Promise<PushSubscriptionDto>;
}

export async function deletePushSubscription(
  config: PushApiConfig,
  endpoint: string,
): Promise<void> {
  const res = await fetch(`${baseUrl(config)}/api/push/subscriptions`, {
    method: "DELETE",
    headers: authHeaders(config.token || undefined),
    body: JSON.stringify({ endpoint }),
  });
  if (res.status === 401) throw new ApiAuthError();
  if (!res.ok && res.status !== 404) throw new Error(`delete push ${res.status}`);
}

export async function getPushPreference(
  config: PushApiConfig,
): Promise<PushPreferenceDto> {
  const res = await fetch(`${baseUrl(config)}/api/push/preferences`, {
    headers: authHeaders(config.token || undefined),
  });
  if (res.status === 401) throw new ApiAuthError();
  if (!res.ok) throw new Error(`push preference ${res.status}`);
  return res.json() as Promise<PushPreferenceDto>;
}

export async function setPushPreference(
  config: PushApiConfig,
  pushEnabled: boolean,
): Promise<PushPreferenceDto> {
  const res = await fetch(`${baseUrl(config)}/api/push/preferences`, {
    method: "PUT",
    headers: authHeaders(config.token || undefined),
    body: JSON.stringify({ pushEnabled }),
  });
  if (res.status === 401) throw new ApiAuthError();
  if (!res.ok) throw new Error(`set push preference ${res.status}`);
  return res.json() as Promise<PushPreferenceDto>;
}
