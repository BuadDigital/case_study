import type {
  CustomAssignedScreen,
  CustomAssignedScreenUser,
  DynamicScreenSubmission,
  SaveCustomAssignedScreenRequest,
  SaveDynamicScreenDefinitionRequest,
  SaveDynamicScreenSubmissionRequest,
} from "@platform/types";
import { getApiBase } from "./index";

export type CustomAssignedScreensApiConfig = {
  baseUrl?: string;
  token: string;
};

function headers(token: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export type CustomAssignedScreensResult<T> =
  | { ok: true; data: T }
  | { ok: false; kind: "auth" | "forbidden" | "network" | "server"; error?: string };

async function parseJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

async function readApiError(res: Response): Promise<string | undefined> {
  try {
    const body = (await res.json()) as {
      error?: string;
      message?: string;
      title?: string;
    };
    if (typeof body.error === "string" && body.error.trim()) return body.error;
    if (typeof body.message === "string" && body.message.trim()) return body.message;
    if (typeof body.title === "string" && body.title.trim()) return body.title;
  } catch {
    // ignore
  }
  return undefined;
}

export async function listMyCustomAssignedScreens(
  config: CustomAssignedScreensApiConfig,
): Promise<CustomAssignedScreensResult<CustomAssignedScreen[]>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/custom-assigned-screens/mine`, {
      headers: headers(config.token),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) return { ok: false, kind: "server" };
    const data = await parseJson<CustomAssignedScreen[]>(res);
    return { ok: true, data: Array.isArray(data) ? data : [] };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function listAllCustomAssignedScreens(
  config: CustomAssignedScreensApiConfig,
): Promise<CustomAssignedScreensResult<CustomAssignedScreen[]>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/custom-assigned-screens`, {
      headers: headers(config.token),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 403) return { ok: false, kind: "forbidden" };
    if (!res.ok) return { ok: false, kind: "server" };
    const data = await parseJson<CustomAssignedScreen[]>(res);
    return { ok: true, data: Array.isArray(data) ? data : [] };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function listAssignableUsersForCustomScreens(
  config: CustomAssignedScreensApiConfig,
): Promise<CustomAssignedScreensResult<CustomAssignedScreenUser[]>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/custom-assigned-screens/assignable-users`,
      {
        headers: headers(config.token),
      },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 403) return { ok: false, kind: "forbidden" };
    if (!res.ok) return { ok: false, kind: "server" };
    const data = await parseJson<CustomAssignedScreenUser[]>(res);
    return { ok: true, data: Array.isArray(data) ? data : [] };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function getCustomAssignedScreen(
  config: CustomAssignedScreensApiConfig,
  id: string,
): Promise<CustomAssignedScreensResult<CustomAssignedScreen>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/custom-assigned-screens/${id}`, {
      headers: headers(config.token),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 403) return { ok: false, kind: "forbidden" };
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: await parseJson<CustomAssignedScreen>(res) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function createCustomAssignedScreen(
  config: CustomAssignedScreensApiConfig,
  request: SaveCustomAssignedScreenRequest,
): Promise<CustomAssignedScreensResult<CustomAssignedScreen>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/custom-assigned-screens`, {
      method: "POST",
      headers: headers(config.token),
      body: JSON.stringify(request),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 403) return { ok: false, kind: "forbidden" };
    if (!res.ok) {
      return {
        ok: false,
        kind: "server",
        error: await readApiError(res),
      };
    }
    return { ok: true, data: await parseJson<CustomAssignedScreen>(res) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function updateCustomAssignedScreen(
  config: CustomAssignedScreensApiConfig,
  id: string,
  request: SaveCustomAssignedScreenRequest,
): Promise<CustomAssignedScreensResult<CustomAssignedScreen>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/custom-assigned-screens/${id}`, {
      method: "PUT",
      headers: headers(config.token),
      body: JSON.stringify(request),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 403) return { ok: false, kind: "forbidden" };
    if (!res.ok) {
      return {
        ok: false,
        kind: "server",
        error: await readApiError(res),
      };
    }
    return { ok: true, data: await parseJson<CustomAssignedScreen>(res) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function deleteCustomAssignedScreen(
  config: CustomAssignedScreensApiConfig,
  id: string,
): Promise<CustomAssignedScreensResult<null>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/custom-assigned-screens/${id}`, {
      method: "DELETE",
      headers: headers(config.token),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 403) return { ok: false, kind: "forbidden" };
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: null };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function saveDynamicScreenDefinition(
  config: CustomAssignedScreensApiConfig,
  id: string,
  request: SaveDynamicScreenDefinitionRequest,
): Promise<CustomAssignedScreensResult<CustomAssignedScreen>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/custom-assigned-screens/${id}/definition`, {
      method: "PUT",
      headers: headers(config.token),
      body: JSON.stringify(request),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 403) return { ok: false, kind: "forbidden" };
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: await parseJson<CustomAssignedScreen>(res) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function getMyDynamicScreenSubmission(
  config: CustomAssignedScreensApiConfig,
  screenId: string,
): Promise<CustomAssignedScreensResult<DynamicScreenSubmission>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/custom-assigned-screens/${screenId}/submission/mine`,
      { headers: headers(config.token) },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 403) return { ok: false, kind: "forbidden" };
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: await parseJson<DynamicScreenSubmission>(res) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function saveMyDynamicScreenSubmission(
  config: CustomAssignedScreensApiConfig,
  screenId: string,
  request: SaveDynamicScreenSubmissionRequest,
): Promise<CustomAssignedScreensResult<DynamicScreenSubmission>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/custom-assigned-screens/${screenId}/submission/mine`,
      {
        method: "PUT",
        headers: headers(config.token),
        body: JSON.stringify(request),
      },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 403) return { ok: false, kind: "forbidden" };
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: await parseJson<DynamicScreenSubmission>(res) };
  } catch {
    return { ok: false, kind: "network" };
  }
}
