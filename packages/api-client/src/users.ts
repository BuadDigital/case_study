import type {
  OrganizationOverview,
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
