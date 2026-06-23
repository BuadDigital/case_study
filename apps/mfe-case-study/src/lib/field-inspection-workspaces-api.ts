import {
  listFieldInspectionWorkspaces,
  type FieldInspectionWorkspaceListItemDto,
} from "@platform/api-client";
import { workOrdersApiConfig } from "./work-orders-api-config";

export async function loadFieldInspectionWorkspaces(): Promise<
  FieldInspectionWorkspaceListItemDto[]
> {
  const config = workOrdersApiConfig();
  if (!config) return [];

  const result = await listFieldInspectionWorkspaces(config);
  if (!result.ok) return [];
  return result.data;
}
