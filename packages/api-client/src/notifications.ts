import { getApiBase } from "./index";
import { ApiAuthError } from "./permissions";

export type NotificationsApiConfig = {
  baseUrl?: string;
  token: string;
};

export type UserNotificationDto = {
  id: string;
  title: string;
  body?: string | null;
  href?: string | null;
  tone?: string | null;
  category?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  actor?: string | null;
  sourceEvent?: string | null;
  createdAtUtc: string;
  read: boolean;
};

export type CreateUserNotificationRequest = {
  title: string;
  body?: string;
  href?: string;
  tone?: string;
  category?: string;
  entityType?: string;
  entityId?: string;
  actor?: string;
  sourceEvent?: string;
};

function headers(token: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

function baseUrl(config: NotificationsApiConfig): string {
  return config.baseUrl ?? getApiBase();
}

export async function listNotifications(
  config: NotificationsApiConfig,
): Promise<UserNotificationDto[]> {
  const res = await fetch(`${baseUrl(config)}/api/notifications`, {
    headers: headers(config.token),
  });
  if (res.status === 401) throw new ApiAuthError();
  if (!res.ok) throw new Error(`notifications ${res.status}`);
  return res.json() as Promise<UserNotificationDto[]>;
}

export async function createNotification(
  config: NotificationsApiConfig,
  request: CreateUserNotificationRequest,
): Promise<UserNotificationDto> {
  const res = await fetch(`${baseUrl(config)}/api/notifications`, {
    method: "POST",
    headers: headers(config.token),
    body: JSON.stringify(request),
  });
  if (res.status === 401) throw new ApiAuthError();
  if (!res.ok) throw new Error(`notifications create ${res.status}`);
  return res.json() as Promise<UserNotificationDto>;
}

export async function markNotificationRead(
  config: NotificationsApiConfig,
  id: string,
): Promise<void> {
  const res = await fetch(`${baseUrl(config)}/api/notifications/${id}/read`, {
    method: "PATCH",
    headers: headers(config.token),
  });
  if (res.status === 401) throw new ApiAuthError();
  if (res.status === 404) return;
  if (!res.ok) throw new Error(`notifications read ${res.status}`);
}

export async function markAllNotificationsRead(
  config: NotificationsApiConfig,
): Promise<void> {
  const res = await fetch(`${baseUrl(config)}/api/notifications/read-all`, {
    method: "POST",
    headers: headers(config.token),
  });
  if (res.status === 401) throw new ApiAuthError();
  if (!res.ok) throw new Error(`notifications read-all ${res.status}`);
}

export async function deleteNotification(
  config: NotificationsApiConfig,
  id: string,
): Promise<void> {
  const res = await fetch(`${baseUrl(config)}/api/notifications/${id}`, {
    method: "DELETE",
    headers: headers(config.token),
  });
  if (res.status === 401) throw new ApiAuthError();
  if (res.status === 404) return;
  if (!res.ok) throw new Error(`notifications delete ${res.status}`);
}

export async function clearNotifications(
  config: NotificationsApiConfig,
): Promise<void> {
  const res = await fetch(`${baseUrl(config)}/api/notifications`, {
    method: "DELETE",
    headers: headers(config.token),
  });
  if (res.status === 401) throw new ApiAuthError();
  if (!res.ok) throw new Error(`notifications clear ${res.status}`);
}

/** SSE stream — Authorization header via fetch (not EventSource). */
export async function subscribeNotificationStream(
  config: NotificationsApiConfig,
  onNotification: (dto: UserNotificationDto) => void,
  signal: AbortSignal,
): Promise<void> {
  const res = await fetch(`${baseUrl(config)}/api/notifications/stream`, {
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: "text/event-stream",
    },
    signal,
  });
  if (res.status === 401) throw new ApiAuthError();
  if (!res.ok || !res.body) throw new Error(`notifications stream ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";

    for (const chunk of chunks) {
      const dataLine = chunk
        .split("\n")
        .find((line) => line.startsWith("data: "));
      if (!dataLine) continue;

      try {
        onNotification(JSON.parse(dataLine.slice(6)) as UserNotificationDto);
      } catch {
        // ignore malformed frames
      }
    }
  }
}
