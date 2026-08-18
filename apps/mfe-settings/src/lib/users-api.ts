import {
  createStaffUser,
  deleteStaffUser,
  fetchMyProfile,
  getApiBase,
  issueActivationTicket,
  listDistributionAssignees,
  listUsers,
  unlockStaffUser,
  updateStaffUser,
  type CreateStaffUserRequest,
  type CreateStaffUserResult,
  type DeleteStaffUserResult,
  type IssueActivationTicketResult,
  type UnlockStaffUserResult,
  type UpdateStaffUserRequest,
  type UpdateStaffUserResult,
  type UsersApiConfig,
} from "@platform/api-client";
import { getAuthSession } from "@platform/auth-client";
import type { StaffUser } from "@platform/app-shared/prototype/constants";
import { userListItemToStaff } from "@platform/app-shared/users/user-mappers";
import { hasRuntimeCapability } from "@platform/app-shared/prototype/runtime-access";

function apiConfig(): UsersApiConfig | null {
  const session = getAuthSession();
  if (!session?.token) return null;
  return { token: session.token, baseUrl: getApiBase() };
}

type FetchStaffUsersResult = {
  users: StaffUser[];
  /** Set only when the API call failed — not when the list is simply empty. */
  loadError: string | null;
};

type FetchStaffUsersOptions = {
  /** Prefer explicit flags — module capability cache may lag one frame after login. */
  canManageUsers?: boolean;
  canListDistributionAssignees?: boolean;
};

export async function fetchStaffUsers(
  options?: FetchStaffUsersOptions,
): Promise<FetchStaffUsersResult> {
  const config = apiConfig();
  if (!config) return { users: [], loadError: null };

  const canManageUsers =
    options?.canManageUsers ?? hasRuntimeCapability("manage-users");
  const canListAssignees =
    options?.canListDistributionAssignees ??
    (hasRuntimeCapability("manage-work-orders") ||
      hasRuntimeCapability("manage-operations"));

  const result = canManageUsers
    ? await listUsers(config)
    : canListAssignees
      ? await listDistributionAssignees(config)
      : { ok: true as const, users: [] };
  if (!result.ok) {
    const message =
      result.kind === "network"
        ? "تعذر تحميل قائمة المستخدمين. تحقق من أن الخادم يعمل."
        : "تعذر تحميل قائمة المستخدمين.";
    return { users: [], loadError: message };
  }

  return {
    users: result.users.map(userListItemToStaff),
    loadError: null,
  };
}

export async function fetchDistributionAssignees(): Promise<FetchStaffUsersResult> {
  const config = apiConfig();
  if (!config) return { users: [], loadError: null };

  const result = await listDistributionAssignees(config);
  if (!result.ok) {
    const message =
      result.kind === "network"
        ? "تعذر تحميل قائمة المسؤولين. تحقق من أن الخادم يعمل."
        : "تعذر تحميل قائمة المسؤولين.";
    return { users: [], loadError: message };
  }

  return {
    users: result.users.map(userListItemToStaff),
    loadError: null,
  };
}

export async function submitCreateStaffUser(
  body: CreateStaffUserRequest,
): Promise<CreateStaffUserResult> {
  const config = apiConfig();
  if (!config) return { ok: false, kind: "network" };
  return createStaffUser(config, body);
}

export async function submitUpdateStaffUser(
  userId: string,
  body: UpdateStaffUserRequest,
): Promise<UpdateStaffUserResult> {
  const config = apiConfig();
  if (!config) return { ok: false, kind: "network" };
  return updateStaffUser(config, userId, body);
}

export async function submitUnlockStaffUser(
  userId: string,
): Promise<UnlockStaffUserResult> {
  const config = apiConfig();
  if (!config) return { ok: false, kind: "network" };
  return unlockStaffUser(config, userId);
}

export async function requestActivationTicket(
  userId: string,
): Promise<IssueActivationTicketResult> {
  const config = apiConfig();
  if (!config) return { ok: false, kind: "network" };
  return issueActivationTicket(config, userId);
}

export async function submitDeleteStaffUser(
  userId: string,
): Promise<DeleteStaffUserResult> {
  const config = apiConfig();
  if (!config) return { ok: false, kind: "network" };
  return deleteStaffUser(config, userId);
}

/** Current signed-in user's staff profile (for header / self profile). */
export async function fetchCurrentStaffProfile(
  fallback?: Pick<StaffUser, "id" | "name" | "role" | "email"> &
    Partial<StaffUser>,
): Promise<StaffUser | null> {
  const config = apiConfig();
  if (!config) {
    if (!fallback) return null;
    return {
      type: "internal",
      ...fallback,
    };
  }

  const result = await fetchMyProfile(config);
  if (result.ok) return userListItemToStaff(result.user);

  if (!fallback) return null;
  return {
    type: "internal",
    ...fallback,
  };
}
