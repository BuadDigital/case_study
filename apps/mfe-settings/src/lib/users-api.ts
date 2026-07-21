import {
  createStaffUser,
  deleteStaffUser,
  getApiBase,
  listDistributionAssignees,
  listUsers,
  type CreateStaffUserRequest,
  type CreateStaffUserResult,
  type DeleteStaffUserResult,
  type UsersApiConfig,
} from "@platform/api-client";
import { getAuthSession } from "@platform/auth-client";
import type { StaffUser } from "@platform/app-shared/prototype/constants";
import {
  contractTypeToStaffType,
  userListItemToStaff,
} from "@platform/app-shared/users/user-mappers";
import { hasRuntimeCapability } from "@platform/app-shared/prototype/runtime-access";

export { contractTypeToStaffType, userListItemToStaff };

function apiConfig(): UsersApiConfig | null {
  const session = getAuthSession();
  if (!session?.token) return null;
  return { token: session.token, baseUrl: getApiBase() };
}

export type FetchStaffUsersResult = {
  users: StaffUser[];
  /** Set only when the API call failed — not when the list is simply empty. */
  loadError: string | null;
};

export async function fetchStaffUsers(): Promise<FetchStaffUsersResult> {
  const config = apiConfig();
  if (!config) return { users: [], loadError: null };

  const result = hasRuntimeCapability("manage-users")
    ? await listUsers(config)
    : hasRuntimeCapability("manage-work-orders") ||
        hasRuntimeCapability("manage-operations")
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

export async function submitDeleteStaffUser(
  userId: string,
): Promise<DeleteStaffUserResult> {
  const config = apiConfig();
  if (!config) return { ok: false, kind: "network" };
  return deleteStaffUser(config, userId);
}
