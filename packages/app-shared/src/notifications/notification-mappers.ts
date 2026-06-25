import type { UserNotificationDto } from "@platform/api-client/notifications";
import type { AppNotification } from "./notification-store";

const VALID_TONES = new Set(["info", "success", "warn"]);
const VALID_CATEGORIES = new Set([
  "workflow",
  "financial",
  "failures",
  "system",
]);
const VALID_ENTITY_TYPES = new Set([
  "property",
  "task",
  "failure",
  "work-order",
]);

function asTone(value?: string | null): AppNotification["tone"] {
  if (value && VALID_TONES.has(value)) {
    return value as AppNotification["tone"];
  }
  return undefined;
}

function asCategory(value?: string | null): AppNotification["category"] {
  if (value && VALID_CATEGORIES.has(value)) {
    return value as AppNotification["category"];
  }
  return undefined;
}

function asEntityType(value?: string | null): AppNotification["entityType"] {
  if (value && VALID_ENTITY_TYPES.has(value)) {
    return value as AppNotification["entityType"];
  }
  return undefined;
}

export function notificationFromDto(dto: UserNotificationDto): AppNotification {
  return {
    id: dto.id,
    title: dto.title,
    body: dto.body ?? undefined,
    href: dto.href ?? undefined,
    tone: asTone(dto.tone),
    category: asCategory(dto.category),
    entityType: asEntityType(dto.entityType),
    entityId: dto.entityId ?? undefined,
    actor: dto.actor ?? undefined,
    sourceEvent: dto.sourceEvent ?? undefined,
    createdAt: dto.createdAtUtc,
    read: dto.read,
  };
}

export function notificationToCreateRequest(
  item: Pick<
    AppNotification,
    | "title"
    | "body"
    | "href"
    | "tone"
    | "category"
    | "entityType"
    | "entityId"
    | "actor"
    | "sourceEvent"
  >,
) {
  return {
    title: item.title,
    body: item.body,
    href: item.href,
    tone: item.tone,
    category: item.category,
    entityType: item.entityType,
    entityId: item.entityId,
    actor: item.actor,
    sourceEvent: item.sourceEvent,
  };
}
