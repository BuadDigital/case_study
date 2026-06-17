import { getApiBase } from "./index";
import type { PrototypeModulesApiConfig, PrototypeModulesResult } from "./prototype-modules";

export type PoIntakeDraftDto = {
  step: number;
  poNumber: string;
  assignmentType: string;
  promulgationDate: string;
  assignmentSpecialist: string;
  assignmentSpecialistEmail: string;
  expectedPropertyCount: number;
  updatedAtUtc?: string;
};

function headers(token: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

function baseUrl(config: PrototypeModulesApiConfig): string {
  return config.baseUrl ?? getApiBase();
}

export async function getPoIntakeDraft(
  config: PrototypeModulesApiConfig,
): Promise<PrototypeModulesResult<PoIntakeDraftDto | null>> {
  try {
    const res = await fetch(`${baseUrl(config)}/api/po-intake-draft/mine`, {
      headers: headers(config.token),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 403) return { ok: false, kind: "forbidden" };
    if (res.status === 404) return { ok: true, data: null };
    if (!res.ok) return { ok: false, kind: "server" };
    const data = (await res.json()) as {
      step?: number;
      poNumber?: string;
      assignmentType?: string;
      promulgationDate?: string;
      assignmentSpecialist?: string;
      assignmentSpecialistEmail?: string;
      expectedPropertyCount?: number;
      updatedAtUtc?: string;
    };
    return {
      ok: true,
      data: {
        step: data.step ?? 1,
        poNumber: data.poNumber ?? "",
        assignmentType: data.assignmentType ?? "",
        promulgationDate: data.promulgationDate ?? "",
        assignmentSpecialist: data.assignmentSpecialist ?? "",
        assignmentSpecialistEmail: data.assignmentSpecialistEmail ?? "",
        expectedPropertyCount:
          data.expectedPropertyCount && data.expectedPropertyCount > 0
            ? data.expectedPropertyCount
            : 1,
        updatedAtUtc: data.updatedAtUtc,
      },
    };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function savePoIntakeDraft(
  config: PrototypeModulesApiConfig,
  draft: PoIntakeDraftDto,
): Promise<PrototypeModulesResult<PoIntakeDraftDto>> {
  try {
    const res = await fetch(`${baseUrl(config)}/api/po-intake-draft`, {
      method: "PUT",
      headers: headers(config.token),
      body: JSON.stringify({
        step: draft.step,
        poNumber: draft.poNumber,
        assignmentType: draft.assignmentType,
        promulgationDate: draft.promulgationDate,
        assignmentSpecialist: draft.assignmentSpecialist,
        assignmentSpecialistEmail: draft.assignmentSpecialistEmail,
        expectedPropertyCount: draft.expectedPropertyCount,
      }),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 403) return { ok: false, kind: "forbidden" };
    if (!res.ok) return { ok: false, kind: "server" };
    const data = (await res.json()) as PoIntakeDraftDto;
    return { ok: true, data };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function deletePoIntakeDraft(
  config: PrototypeModulesApiConfig,
): Promise<PrototypeModulesResult<void>> {
  try {
    const res = await fetch(`${baseUrl(config)}/api/po-intake-draft/mine`, {
      method: "DELETE",
      headers: headers(config.token),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 403) return { ok: false, kind: "forbidden" };
    if (!res.ok && res.status !== 404) return { ok: false, kind: "server" };
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, kind: "network" };
  }
}
