import type {
  CreateUserResponse,
  FieldErrorsResponse,
  OrganizationOverview,
  RegistrationPayload,
  UserListItem,
} from "@platform/types";
import { normalizeFieldErrors } from "./field-errors";
import { getApiBase } from "./index";

export type UsersApiConfig = {
  baseUrl?: string;
  token: string;
};

function headers(token: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export type ListUsersResult =
  | { ok: true; users: UserListItem[] }
  | { ok: false; kind: "network" | "server" };

export async function listUsers(
  config: UsersApiConfig,
): Promise<ListUsersResult> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/users`, {
      headers: headers(config.token),
    });
    if (!res.ok) {
      return { ok: false, kind: "server" };
    }
    const users = (await res.json()) as UserListItem[];
    return { ok: true, users: Array.isArray(users) ? users : [] };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export type CreateUserResult =
  | { ok: true; user: UserListItem }
  | { ok: false; errors: Record<string, string> };

async function createUser(
  config: UsersApiConfig,
  path: "hr" | "proc" | "crm",
  payload: RegistrationPayload,
): Promise<CreateUserResult> {
  const base = config.baseUrl ?? getApiBase();
  const res = await fetch(`${base}/api/users/${path}`, {
    method: "POST",
    headers: headers(config.token),
    body: JSON.stringify(payload),
  });
  if (res.status === 400) {
    const body = (await res.json()) as FieldErrorsResponse & {
      errors?: Record<string, string | string[]>;
    };
    return { ok: false, errors: normalizeFieldErrors(body.errors) };
  }
  if (!res.ok) throw new Error(`createUser/${path} failed: ${res.status}`);
  const body = (await res.json()) as CreateUserResponse;
  return { ok: true, user: body.user };
}

export function createHrUser(
  config: UsersApiConfig,
  payload: RegistrationPayload,
) {
  return createUser(config, "hr", payload);
}

export function createProcUser(
  config: UsersApiConfig,
  payload: RegistrationPayload,
) {
  return createUser(config, "proc", payload);
}

export function createCrmUser(
  config: UsersApiConfig,
  payload: RegistrationPayload,
) {
  return createUser(config, "crm", payload);
}

export type OrganizationOverviewResult =
  | { ok: true; overview: OrganizationOverview }
  | { ok: false; kind: "network" | "server" };

export async function fetchOrganizationOverview(
  config: UsersApiConfig,
): Promise<OrganizationOverviewResult> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/users/organization`, {
      headers: headers(config.token),
    });
    if (!res.ok) return { ok: false, kind: "server" };
    const overview = (await res.json()) as OrganizationOverview;
    return { ok: true, overview };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export type UpdateUserResult =
  | { ok: true; user: UserListItem }
  | { ok: false; kind: "network" | "server" | "not_found" | "forbidden" };

export async function updateUser(
  config: UsersApiConfig,
  id: string,
  body: {
    displayName?: string;
    jobTitle?: string;
    status?: UserListItem["status"];
  },
): Promise<UpdateUserResult> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/users/${id}`, {
      method: "PATCH",
      headers: headers(config.token),
      body: JSON.stringify(body),
    });
    if (res.status === 403) return { ok: false, kind: "forbidden" };
    if (res.status === 404) return { ok: false, kind: "not_found" };
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, user: (await res.json()) as UserListItem };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function deactivateUser(
  config: UsersApiConfig,
  id: string,
): Promise<UpdateUserResult> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/users/${id}/deactivate`, {
      method: "PATCH",
      headers: headers(config.token),
    });
    if (res.status === 403) return { ok: false, kind: "forbidden" };
    if (res.status === 404) return { ok: false, kind: "not_found" };
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, user: (await res.json()) as UserListItem };
  } catch {
    return { ok: false, kind: "network" };
  }
}
