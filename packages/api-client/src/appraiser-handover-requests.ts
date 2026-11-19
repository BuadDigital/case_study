import { authHeaders, getApiBase } from "./api-base";
import { readCommand } from "./transactions";
import { repositoryFetch as fetch } from "./write-repository";
import type { ApiErr, ApiOk, WorkOrdersApiConfig } from "./work-orders";

/**
 * The appraiser's reassignment requests and peer transfers (Omar 2026-11-18): he asks whoever handed
 * him the transaction to reassign it, or transfers it to a colleague who accepts.
 */
export type AppraiserHandoverRequestDto = {
  id: string;
  kind: "reassign" | "peer";
  status: "pending" | "taken" | "done" | "declined" | "cancelled";
  appraisalTaskId: string;
  propertyId?: string | null;
  poNumber: string;
  reason: string;
  requestedByName: string;
  requestedByAssigneeId: string;
  requestedAtUtc: string;
  /** Reassign: study | review. */
  handlerSubRole?: string | null;
  /** Reassign: it reached the whole team. */
  escalated: boolean;
  takenByName?: string | null;
  takenAtUtc?: string | null;
  /** Peer: offer (his transaction to a colleague) | ask (a colleague's to him). */
  direction?: "offer" | "ask" | null;
  peerAssigneeId?: string | null;
  peerName?: string | null;
};

type CommandResult = Promise<ApiOk<AppraiserHandoverRequestDto> | (ApiErr & { message?: string })>;

const ROOT = "/api/appraiser-handover-requests";

/** The open requests the caller sees (an appraiser: his own and those waiting for him; staff: theirs to handle). */
export async function listAppraiserHandoverRequests(
  config: WorkOrdersApiConfig,
): Promise<ApiOk<AppraiserHandoverRequestDto[]> | (ApiErr & { message?: string })> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}${ROOT}`, { headers: authHeaders(config.token) });
    const result = await readCommand<AppraiserHandoverRequestDto[]>(res);
    if (!result.ok) return result;
    return { ok: true, data: Array.isArray(result.data) ? result.data : [] };
  } catch {
    return { ok: false, kind: "network" };
  }
}

/**
 * One POST to the requests endpoint: `path` under the root, the JSON body; the server's Arabic refusal
 * comes back as `message`.
 */
async function post(config: WorkOrdersApiConfig, path: string, body: unknown): CommandResult {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}${ROOT}${path}`, {
      method: "POST",
      headers: authHeaders(config.token, { json: true }),
      body: JSON.stringify(body ?? {}),
    });
    return await readCommand<AppraiserHandoverRequestDto>(res);
  } catch {
    return { ok: false, kind: "network" };
  }
}

export const requestAppraiserReassignment = (
  config: WorkOrdersApiConfig,
  body: { appraisalTaskId: string; reason: string },
) => post(config, "/reassign", body);

export const requestAppraiserPeerTransfer = (
  config: WorkOrdersApiConfig,
  body: {
    appraisalTaskId: string;
    direction: "offer" | "ask";
    peerAssigneeId: string;
    peerName?: string;
    reason?: string;
  },
) => post(config, "/peer", body);

export const acceptAppraiserPeerTransfer = (config: WorkOrdersApiConfig, id: string) =>
  post(config, `/${encodeURIComponent(id)}/accept`, {});

export const declineAppraiserPeerTransfer = (config: WorkOrdersApiConfig, id: string, note?: string) =>
  post(config, `/${encodeURIComponent(id)}/decline`, { note });

export const cancelAppraiserHandoverRequest = (config: WorkOrdersApiConfig, id: string, note?: string) =>
  post(config, `/${encodeURIComponent(id)}/cancel`, { note });

export const takeAppraiserReassignment = (config: WorkOrdersApiConfig, id: string) =>
  post(config, `/${encodeURIComponent(id)}/take`, {});

export const completeAppraiserReassignment = (
  config: WorkOrdersApiConfig,
  id: string,
  body: { newAssigneeId: string; newAssigneeName?: string },
) => post(config, `/${encodeURIComponent(id)}/complete`, body);
