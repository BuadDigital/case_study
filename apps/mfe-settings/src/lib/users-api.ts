import {
  createCrmUser,
  createHrUser,
  createProcUser,
  deactivateUser,
  getApiBase,
  listDistributionAssignees,
  listUsers,
  type CreateUserResult,
  type UsersApiConfig,
} from "@platform/api-client";
import { getAuthSession } from "@platform/auth-client";
import type { RegistrationPayload, UserListItem } from "@platform/types";
import type { StaffUser } from "@platform/app-shared/prototype/constants";
import type { RegistrationSource } from "@platform/app-shared/prototype/registration-data";
import {
  contractTypeToStaffType,
  userListItemToStaff,
} from "@platform/app-shared/users/user-mappers";

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

  const result = await listUsers(config);
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

export async function submitRegistration(
  source: RegistrationSource,
  data: RegistrationPayload,
): Promise<CreateUserResult> {
  const config = apiConfig();
  if (!config) {
    return { ok: false, errors: { _form: "يجب تسجيل الدخول أولاً" } };
  }
  if (source === "hr") return createHrUser(config, data);
  if (source === "proc") return createProcUser(config, data);
  return createCrmUser(config, data);
}

export async function deactivateStaffUser(
  userId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const config = apiConfig();
  if (!config) {
    return { ok: false, message: "يجب تسجيل الدخول أولاً" };
  }
  const result = await deactivateUser(config, userId);
  if (!result.ok) {
    const message =
      result.kind === "forbidden"
        ? "لا تملك صلاحية تعطيل هذا المستخدم"
        : result.kind === "not_found"
          ? "المستخدم غير موجود"
          : "تعذّر تعطيل المستخدم";
    return { ok: false, message };
  }
  return { ok: true };
}
