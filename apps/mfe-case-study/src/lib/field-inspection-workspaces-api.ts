import {
  listFieldInspectionWorkspaces,
  type FieldInspectionWorkspaceListItemDto,
} from "@platform/api-client";
import {
  requireWorkOrdersApiConfig,
  unwrapApiResult,
} from "./work-orders-api-config";

export async function loadFieldInspectionWorkspaces(): Promise<
  FieldInspectionWorkspaceListItemDto[]
> {
  const config = requireWorkOrdersApiConfig();
  const result = await listFieldInspectionWorkspaces(config);
  return unwrapApiResult(result, "تعذّر تحميل مساحات المعاينة الميدانية");
}
