import {
  getCustomAssignedScreen,
  saveDynamicScreenDefinition,
  getMyDynamicScreenSubmission,
  saveMyDynamicScreenSubmission,
  type CustomAssignedScreensApiConfig,
} from "@platform/api-client";
import type {
  CustomAssignedScreen,
  DynamicScreenSubmission,
  SaveDynamicScreenDefinitionRequest,
  SaveDynamicScreenSubmissionRequest,
} from "@platform/types";

export async function fetchCustomScreenForBuilder(
  config: CustomAssignedScreensApiConfig,
  screenId: string,
): Promise<CustomAssignedScreen | null> {
  const result = await getCustomAssignedScreen(config, screenId);
  return result.ok ? result.data : null;
}

export async function persistDynamicScreenDefinition(
  config: CustomAssignedScreensApiConfig,
  screenId: string,
  request: SaveDynamicScreenDefinitionRequest,
): Promise<{ ok: true; screen: CustomAssignedScreen } | { ok: false; error: string }> {
  const result = await saveDynamicScreenDefinition(config, screenId, request);
  if (!result.ok) {
    const message =
      result.kind === "forbidden"
        ? "صلاحية غير كافية — سجّل الدخول بحساب CDO أو Admin."
        : result.kind === "auth"
          ? "انتهت الجلسة — سجّل الدخول مجدداً."
          : "تعذر حفظ تعريف الشاشة على الخادم.";
    return { ok: false, error: message };
  }
  return { ok: true, screen: result.data };
}

export async function fetchMyScreenSubmission(
  config: CustomAssignedScreensApiConfig,
  screenId: string,
): Promise<DynamicScreenSubmission | null> {
  const result = await getMyDynamicScreenSubmission(config, screenId);
  return result.ok ? result.data : null;
}

export async function persistMyScreenSubmission(
  config: CustomAssignedScreensApiConfig,
  screenId: string,
  request: SaveDynamicScreenSubmissionRequest,
): Promise<{ ok: true; submission: DynamicScreenSubmission } | { ok: false }> {
  const result = await saveMyDynamicScreenSubmission(config, screenId, request);
  if (!result.ok) return { ok: false };
  return { ok: true, submission: result.data };
}
