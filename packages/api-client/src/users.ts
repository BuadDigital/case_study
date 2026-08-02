import type {
  UserListItem,
} from "@platform/types";
import { getApiBase } from "./index";
import { repositoryFetch as fetch } from "./write-repository";

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
  mobile: string;
  city: string;
  roleId: string;
  department?: string;
  inspectorType?: "employee" | "contractor";
  hasCompensation?: boolean;
  feeValueSar?: number;
  iban?: string;
  taxNumber?: string;
  commercialRegistration?: string;
  joinedAt?: string;
  avatarUrl?: string;
  nationalId: string;
};

export type CreateStaffUserResponse = {
  user: UserListItem;
  userName: string;
  /** Accounts are created without a password; the holder sets one via an activation ticket. */
  activationRequired: boolean;
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

/**
 * Partial update. Omit a key to leave the stored value untouched; send an empty string to
 * clear an optional field. Name, email, mobile, city, role and national id can be replaced
 * but never cleared.
 */
export type UpdateStaffUserRequest = {
  displayName?: string;
  email?: string;
  mobile?: string;
  city?: string;
  roleId?: string;
  department?: string;
  nationalId?: string;
  avatarUrl?: string;
  inspectorType?: "employee" | "contractor" | "";
  hasCompensation?: boolean;
  feeValueSar?: number;
  iban?: string;
  taxNumber?: string;
  commercialRegistration?: string;
  joinedAt?: string;
  status?: "Active" | "Disabled";
};

export type UpdateStaffUserResult =
  | { ok: true; user: UserListItem }
  | { ok: false; kind: "network" | "server" | "validation"; errors?: Record<string, string> };

export async function updateStaffUser(
  config: UsersApiConfig,
  userId: string,
  body: UpdateStaffUserRequest,
): Promise<UpdateStaffUserResult> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/users/${encodeURIComponent(userId)}`, {
      method: "PATCH",
      headers: headers(config.token),
      body: JSON.stringify(body),
    });
    if (res.status === 400) {
      const payload = (await res.json()) as { errors?: Record<string, string> };
      return { ok: false, kind: "validation", errors: payload.errors ?? {} };
    }
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, user: (await res.json()) as UserListItem };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export type UnlockStaffUserResult =
  | { ok: true }
  | { ok: false; kind: "network" | "server" | "validation"; message?: string };

export async function unlockStaffUser(
  config: UsersApiConfig,
  userId: string,
): Promise<UnlockStaffUserResult> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/users/${encodeURIComponent(userId)}/unlock`,
      { method: "POST", headers: headers(config.token) },
    );
    if (res.status === 400) {
      const payload = (await res.json()) as { errors?: Record<string, string> };
      return {
        ok: false,
        kind: "validation",
        message: payload.errors?._form ?? "تعذر فك قفل الحساب.",
      };
    }
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export type ActivationTicket = {
  userName: string;
  token: string;
  expiresAtUtc: string;
};

export type IssueActivationTicketResult =
  | { ok: true; ticket: ActivationTicket }
  | { ok: false; kind: "network" | "server"; message?: string };

/**
 * Mints a single-use ticket the administrator hands to the account holder.
 * The ticket is never persisted client-side — treat it as a one-shot secret.
 */
export async function issueActivationTicket(
  config: UsersApiConfig,
  userId: string,
): Promise<IssueActivationTicketResult> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/users/${encodeURIComponent(userId)}/activation-ticket`,
      { method: "POST", headers: headers(config.token) },
    );
    if (!res.ok) {
      const payload = (await res.json().catch(() => null)) as
        | { errors?: Record<string, string> }
        | null;
      return {
        ok: false,
        kind: "server",
        message: payload?.errors?._form,
      };
    }
    return { ok: true, ticket: (await res.json()) as ActivationTicket };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export type ActivateAccountResult =
  | { ok: true }
  | { ok: false; kind: "network" | "server"; message?: string };

export async function activateAccount(
  baseUrl: string | undefined,
  body: { userName: string; token: string; newPassword: string },
): Promise<ActivateAccountResult> {
  const base = baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/auth/activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const payload = (await res.json().catch(() => null)) as
        | { message?: string; detail?: string }
        | null;
      return {
        ok: false,
        kind: "server",
        message: payload?.message ?? payload?.detail,
      };
    }
    return { ok: true };
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