import {
  createCustomAssignedScreen,
  deleteCustomAssignedScreen,
  getApiBase,
  listAllCustomAssignedScreens,
  listAssignableUsersForCustomScreens,
  listMyCustomAssignedScreens,
  updateCustomAssignedScreen,
  type CustomAssignedScreensApiConfig,
} from "@platform/api-client";
import { getAuthSession } from "@platform/auth-client";
import type {
  CustomAssignedScreen,
  CustomAssignedScreenUser,
  SaveCustomAssignedScreenRequest,
} from "@platform/types";

export function customScreensApiConfig(): CustomAssignedScreensApiConfig | null {
  const session = getAuthSession();
  if (!session?.token) return null;
  return { token: session.token, baseUrl: getApiBase() };
}

export async function fetchMyCustomAssignedScreens(): Promise<
  CustomAssignedScreen[]
> {
  const config = customScreensApiConfig();
  if (!config) return [];
  const result = await listMyCustomAssignedScreens(config);
  return result.ok ? result.data : [];
}

export async function fetchAllCustomAssignedScreens(): Promise<{
  screens: CustomAssignedScreen[];
  error: string | null;
}> {
  const config = customScreensApiConfig();
  if (!config) return { screens: [], error: "يجب تسجيل الدخول أولاً" };
  const result = await listAllCustomAssignedScreens(config);
  if (!result.ok) {
    const message =
      result.kind === "forbidden"
        ? "هذه الصفحة متاحة لسليمان (المسؤول) فقط."
        : "تعذر تحميل الشاشات المخصصة.";
    return { screens: [], error: message };
  }
  return { screens: result.data, error: null };
}

export async function fetchAssignableUsersForCustomScreens(): Promise<{
  users: CustomAssignedScreenUser[];
  error: string | null;
}> {
  const config = customScreensApiConfig();
  if (!config) return { users: [], error: "يجب تسجيل الدخول أولاً" };
  const result = await listAssignableUsersForCustomScreens(config);
  if (!result.ok) {
    return { users: [], error: "تعذر تحميل قائمة المستخدمين." };
  }
  return { users: result.data, error: null };
}

export async function saveCustomAssignedScreen(
  request: SaveCustomAssignedScreenRequest,
  existingId?: string,
): Promise<{ ok: true; screen: CustomAssignedScreen } | { ok: false; error: string }> {
  const config = customScreensApiConfig();
  if (!config) return { ok: false, error: "يجب تسجيل الدخول أولاً" };

  const result = existingId
    ? await updateCustomAssignedScreen(config, existingId, request)
    : await createCustomAssignedScreen(config, request);

  if (!result.ok) {
    return { ok: false, error: "تعذر حفظ الشاشة. تحقق من البيانات وحاول مجدداً." };
  }
  return { ok: true, screen: result.data };
}

export async function removeCustomAssignedScreen(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const config = customScreensApiConfig();
  if (!config) return { ok: false, error: "يجب تسجيل الدخول أولاً" };
  const result = await deleteCustomAssignedScreen(config, id);
  if (!result.ok) return { ok: false, error: "تعذر حذف الشاشة." };
  return { ok: true };
}
