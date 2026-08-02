import { getAuthSession } from "@platform/auth-client";
import {
  installApiWriteInterceptor,
  type ApiWriteInterceptor,
  type ApiWriteRequest,
} from "@platform/api-client";
import {
  enqueueOutbox,
  persistDraftLocally,
  purgeOfflineData,
  type OfflineDraftRecord,
} from "@platform/offline-client";

type KeyEnvelopeOutboxWrite =
  | {
      type: "key-envelope-assignment-add";
      envelopeId: string;
      payload: Record<string, unknown>;
    }
  | {
      type: "key-envelope-assignment-confirm";
      envelopeId: string;
      payload: Record<string, unknown>;
    }
  | {
      type: "key-envelope-handoff-create";
      envelopeId: string;
      payload: Record<string, unknown>;
    }
  | {
      type: "key-envelope-handoff-confirm";
      envelopeId: string;
      payload: Record<string, unknown>;
    };

type ClassifiedWrite =
  | {
      type: "party-submission-save";
      taskId: string;
      payload: unknown;
      kind: OfflineDraftRecord["kind"];
    }
  | { type: "party-submission-submit"; taskId: string }
  | { type: "key-envelope-create"; body: unknown }
  | KeyEnvelopeOutboxWrite;

function requestUrl(request: ApiWriteRequest): string {
  if (typeof request.input === "string") return request.input;
  if (request.input instanceof URL) return request.input.href;
  return request.input.url;
}

function detectDraftKind(payload: unknown): OfflineDraftRecord["kind"] {
  if (!payload || typeof payload !== "object") return "government-review";
  const record = payload as Record<string, unknown>;
  if (
    record.slotPhotos != null ||
    record.freePhotos != null ||
    record.boundaryMatches != null ||
    record.mapLatitude != null
  ) {
    return "field-inspection";
  }
  return "government-review";
}

function parseBody(request: ApiWriteRequest): Record<string, unknown> {
  try {
    if (typeof request.init?.body === "string") {
      return JSON.parse(request.init.body) as Record<string, unknown>;
    }
  } catch {
    /* ignore */
  }
  return {};
}

async function classifyWrite(
  request: ApiWriteRequest,
): Promise<ClassifiedWrite | null> {
  const url = requestUrl(request);
  const path = url.replace(/^https?:\/\/[^/]+/i, "");

  const submitMatch = path.match(
    /\/api\/party-task-submissions\/([^/?#]+)\/submit\/?$/i,
  );
  if (submitMatch && request.method === "POST") {
    return {
      type: "party-submission-submit",
      taskId: decodeURIComponent(submitMatch[1]!),
    };
  }

  const saveMatch = path.match(
    /\/api\/party-task-submissions\/([^/?#]+)\/?$/i,
  );
  if (saveMatch && request.method === "PUT") {
    let payload: unknown = {};
    try {
      const text =
        typeof request.init?.body === "string" ? request.init.body : null;
      if (text) {
        const parsed = JSON.parse(text) as { payload?: unknown };
        payload = parsed.payload ?? parsed;
      }
    } catch {
      /* keep empty */
    }
    return {
      type: "party-submission-save",
      taskId: decodeURIComponent(saveMatch[1]!),
      payload,
      kind: detectDraftKind(payload),
    };
  }

  if (path.match(/\/api\/key-envelopes\/?$/i) && request.method === "POST") {
    return { type: "key-envelope-create", body: parseBody(request) };
  }

  const confirmAssignment = path.match(
    /\/api\/key-envelopes\/([^/?#]+)\/assignments\/([^/?#]+)\/confirm\/?$/i,
  );
  if (confirmAssignment && request.method === "POST") {
    return {
      type: "key-envelope-assignment-confirm",
      envelopeId: decodeURIComponent(confirmAssignment[1]!),
      payload: {
        ...parseBody(request),
        assignmentId: decodeURIComponent(confirmAssignment[2]!),
      },
    };
  }

  const addAssignment = path.match(
    /\/api\/key-envelopes\/([^/?#]+)\/assignments\/?$/i,
  );
  if (addAssignment && request.method === "POST") {
    return {
      type: "key-envelope-assignment-add",
      envelopeId: decodeURIComponent(addAssignment[1]!),
      payload: parseBody(request),
    };
  }

  const confirmHandoff = path.match(
    /\/api\/key-envelopes\/([^/?#]+)\/handoffs\/([^/?#]+)\/confirm\/?$/i,
  );
  if (confirmHandoff && request.method === "POST") {
    return {
      type: "key-envelope-handoff-confirm",
      envelopeId: decodeURIComponent(confirmHandoff[1]!),
      payload: { handoffId: decodeURIComponent(confirmHandoff[2]!) },
    };
  }

  const createHandoff = path.match(
    /\/api\/key-envelopes\/([^/?#]+)\/handoffs\/?$/i,
  );
  if (createHandoff && request.method === "POST") {
    return {
      type: "key-envelope-handoff-create",
      envelopeId: decodeURIComponent(createHandoff[1]!),
      payload: parseBody(request),
    };
  }

  return null;
}

async function enqueueClassified(
  userId: string,
  classified: ClassifiedWrite,
): Promise<void> {
  if (classified.type === "party-submission-save") {
    await persistDraftLocally({
      userId,
      taskId: classified.taskId,
      kind: classified.kind,
      payload: classified.payload,
    });
    return;
  }
  if (classified.type === "party-submission-submit") {
    await enqueueOutbox({
      userId,
      kind: "party-submission-submit",
      targetId: classified.taskId,
      payloadJson: JSON.stringify({ taskId: classified.taskId }),
    });
    return;
  }
  if (classified.type === "key-envelope-create") {
    const clientId = `local-pending:${crypto.randomUUID()}`;
    const body =
      classified.body && typeof classified.body === "object"
        ? { ...(classified.body as object), clientEnvelopeId: clientId }
        : { clientEnvelopeId: clientId };
    await enqueueOutbox({
      userId,
      kind: "key-envelope-create",
      targetId: clientId,
      payloadJson: JSON.stringify(body),
    });
    return;
  }
  await enqueueOutbox({
    userId,
    kind: classified.type,
    targetId: classified.envelopeId,
    payloadJson: JSON.stringify({
      envelopeId: classified.envelopeId,
      ...classified.payload,
    }),
  });
}

/**
 * Stage-2 single write interceptor (installed only for offline-capable roles).
 * When offline, enqueueable writes enter the outbox. Auth rejection purges local store.
 * Online failures stay with feature-level offline helpers to avoid double-enqueue.
 */
export function installOfflineWriteInterceptor(): () => void {
  const interceptor: ApiWriteInterceptor = async (request, next) => {
    const session = getAuthSession();
    const userId = session?.user?.id?.trim() || null;
    if (!userId) {
      return next();
    }

    const classified = await classifyWrite(request);
    const offline =
      typeof navigator !== "undefined" && navigator.onLine === false;

    if (offline && classified) {
      await enqueueClassified(userId, classified);
      throw new TypeError("Failed to fetch");
    }

    const response = await next();
    if ((response.status === 401 || response.status === 403) && userId) {
      await purgeOfflineData(userId, "auth-rejected");
    }
    return response;
  };

  return installApiWriteInterceptor(interceptor);
}
