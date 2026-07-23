import type {
  UserListItem,
} from "@platform/types";
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

export async function listDistributionAssignees(
  config: UsersApiConfig,
): Promise<ListUsersResult> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/users/distribution-assignees`, {
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

export type CreateStaffUserRequest = {
  displayName: string;
  email: string;
  roleId: string;
  employeeNumber?: string;
  nationalId?: string;
};

export type CreateStaffUserResponse = {
  user: UserListItem;
  userName: string;
  temporaryPassword: string;
};

export type CreateStaffUserResult =
  | { ok: true; result: CreateStaffUserResponse }
  | { ok: false; kind: "network" | "server" | "validation"; errors?: Record<string, string> };

export async function createStaffUser(
  config: UsersApiConfig,
  body: CreateStaffUserRequest,
): Promise<CreateStaffUserResult> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/users`, {
      method: "POST",
      headers: headers(config.token),
      body: JSON.stringify(body),
    });
    if (res.status === 400) {
      const payload = (await res.json()) as { errors?: Record<string, string> };
      return {
        ok: false,
        kind: "validation",
        errors: payload.errors ?? {},
      };
    }
    if (!res.ok) return { ok: false, kind: "server" };
    const result = (await res.json()) as CreateStaffUserResponse;
    return { ok: true, result };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export type DeleteStaffUserResult =
  | { ok: true }
  | { ok: false; kind: "network" | "server" | "validation"; message?: string };

export async function deleteStaffUser(
  config: UsersApiConfig,
  userId: string,
): Promise<DeleteStaffUserResult> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/users/${encodeURIComponent(userId)}`, {
      method: "DELETE",
      headers: headers(config.token),
    });
    if (res.status === 400) {
      const payload = (await res.json()) as { errors?: Record<string, string> };
      return {
        ok: false,
        kind: "validation",
        message: payload.errors?._form ?? "تعذر حذف المستخدم.",
      };
    }
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true };
  } catch {
    return { ok: false, kind: "network" };
  }
}
