import { copyPriorInspection, listPriorInspections, type PriorInspectionOption } from "@platform/api-client";
import { mapPinPatchForActor } from "@platform/app-shared/app-data/inspector-workspace-data";
import {
  payloadToDraft,
  type InspectorWorkspacePatch,
  type InspectorWorkspacePatchInput,
} from "./inspector-workspace-model";
import { workOrdersApiConfig } from "@platform/app-shared/app-data/work-orders-api-config";

/** Earlier inspections of this deed the inspector may copy; none on any failure (the button then hides). */
export async function loadPriorInspections(taskId: string): Promise<PriorInspectionOption[]> {
  const config = workOrdersApiConfig();
  if (!config) return [];
  const result = await listPriorInspections(config, taskId);
  return result.ok ? result.data : [];
}

/**
 * The server's copy as a draft patch.
 *
 * How it works: reads the payload like a saved draft, keeps only the keys the server sent, and takes
 * the map point as the inspector's own pin. Built on the latest draft (function form).
 *
 * Edge cases: the photos of this draft stay — the copy has no photo key to replace them. The point
 * comes back unpinned: the inspector pins it on site, so a copied location never counts as visited.
 */
export function priorInspectionPatch(payload: Record<string, unknown>): InspectorWorkspacePatchInput {
  return (current) => {
    const read = payloadToDraft({
      taskId: current.taskId,
      kind: "field-inspection",
      status: "draft",
      payload,
      updatedAtUtc: "",
    });
    const patch = Object.fromEntries(
      Object.keys(payload)
        .filter((key) => key in read)
        .map((key) => [key, read[key as keyof typeof read]]),
    ) as InspectorWorkspacePatch;
    const point =
      read.mapLatitude.trim() && read.mapLongitude.trim()
        ? mapPinPatchForActor(current, read.mapLatitude, read.mapLongitude, "inspector")
        : {};
    return { ...patch, ...point, mapPinned: false };
  };
}

/** Asks the server for one listed inspection; null when it refused or could not be reached. */
export async function copyPriorInspectionPatch(
  taskId: string,
  sourceTaskId: string,
): Promise<InspectorWorkspacePatchInput | null> {
  const config = workOrdersApiConfig();
  if (!config) return null;
  const result = await copyPriorInspection(config, taskId, sourceTaskId);
  return result.ok ? priorInspectionPatch(result.data.payload) : null;
}
