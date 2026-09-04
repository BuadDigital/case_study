import { getApiBase } from "./api-base";
import { repositoryFetch as fetch } from "./write-repository";
import { ApiAuthError } from "./permissions";
import { fetchListPage, type PagedResultDto } from "./pagination";
import type { ApiErr, ApiOk } from "./work-orders";

export type NotificationsApiConfig = {
  baseUrl?: string;
  token: string;
};

export type NotificationTone = "info" | "success" | "warn";
export type NotificationWireTone = NotificationTone | "warning";
export type NotificationCategory =
  | "workflow"
  | "financial"
  | "failures"
  | "system";
export type NotificationEntityType =
  | "property"
  | "task"
  | "operations-task"
  | "failure"
  | "work-order";

export type UserNotificationDto = {
  id: string;
  title: string;
  body?: string | null;
  href?: string | null;
  /** `warning` is accepted only for rows/events written before the canonical `warn` contract. */
  tone?: NotificationWireTone | (string & {}) | null;
  category?: NotificationCategory | (string & {}) | null;
  entityType?: NotificationEntityType | (string & {}) | null;
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
  tone?: NotificationTone;
  category?: NotificationCategory;
  entityType?: NotificationEntityType;
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

/**
 * `GET /api/notifications` query — pagination-contract §6. The feed has one
 * meaningful order, so `sort` is `created` and any other value resolves to it.
 */
export type NotificationListQuery = {
  /** 1-based page; presence switches the endpoint to the paged envelope. */
  page?: number;
  pageSize?: number;
  sort?: "created";
  /** Default `desc` — newest first. */
  dir?: "asc" | "desc";
  /** Free text over `Title` and `Body`. */
  q?: string;
  category?: string;
  /** `true` → unread only; `false` → read only; omitted → both. */
  unread?: boolean;
};

/** The filter set without the page window. */
export type NotificationListFilters = Omit<
  NotificationListQuery,
  "page" | "pageSize"
>;

function notificationListParams(query?: NotificationListQuery) {
  return {
    page: query?.page,
    pageSize: query?.pageSize,
    sort: query?.sort,
    dir: query?.dir,
    q: query?.q,
    category: query?.category,
    unread: query?.unread,
  };
}

/**
 * One server page of the signed-in user's bell feed — pagination-contract §6.
 * The unpaged `listNotifications` stays on its own 50-row cap, and the SSE
 * stream is untouched.
 */
export async function listNotificationsPage(
  config: NotificationsApiConfig,
  query?: NotificationListQuery,
): Promise<ApiOk<PagedResultDto<UserNotificationDto>> | ApiErr> {
  return fetchListPage<UserNotificationDto>(
    { ...config, baseUrl: baseUrl(config) },
    "/api/notifications",
    notificationListParams(query),
  );
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

/**
 * The server writes a real event or a `: keepalive` comment at least every
 * 25s (see NotificationsController's StreamKeepAliveInterval). A middlebox
 * (corporate proxy, some load balancers, mobile NAT) can kill the underlying
 * TCP connection without the browser noticing — `reader.read()` then just
 * hangs forever, no error, no `done`. If nothing arrives for well beyond one
 * keepalive interval, treat the connection as dead so the caller's retry
 * loop can reconnect instead of the tab silently going stale.
 */
const STREAM_SILENCE_TIMEOUT_MS = 75_000;

function readWithTimeout(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  timeoutMs: number,
): Promise<ReadableStreamReadResult<Uint8Array>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("notifications stream silent — no data or keepalive received"));
    }, timeoutMs);
    reader.read().then(
      (result) => {
        clearTimeout(timer);
        resolve(result);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
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

  try {
    for (;;) {
      const { done, value } = await readWithTimeout(reader, STREAM_SILENCE_TIMEOUT_MS);
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
  } catch (err) {
    // Silence timeout or a real read error — the connection is unusable
    // either way, so cancel it explicitly (releases the dead socket) before
    // letting the caller's retry loop take over.
    await reader.cancel().catch(() => {});
    throw err;
  }
}
