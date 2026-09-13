/**
 * Seed the engineering survey map from the sibling field-inspection pin, and
 * detect when the office pin diverges beyond the shared 500 m match radius.
 */
import {
  hasInspectorOriginalMapPin,
  type InspectorWorkspaceDraft,
} from "@platform/app-shared/app-data/inspector-workspace-data";
import { jeddahDefaultCoords } from "@platform/app-shared/domain/jeddah-default-coords";
import {
  parsePlacedMapPin,
  pinDistanceMeters,
  pinsExceedMatchMeters,
} from "@platform/app-shared/media/photo-location";
import { loadInspectorWorkspaceSnapshot } from "@case-study/mfe/lib/app-data/inspector-workspace-reads";
import type { WorkflowTask } from "@case-study/mfe/lib/app-data/tasks-storage";
import { findSiblingInspectionTask } from "@case-study/mfe/lib/app-data/documentary-workflow-gates";
import type { EngineeringSurveySubmission } from "./engineering-survey-data";

export const LOCATION_PIN_MISMATCH_NOTE_PREFIX =
  "اختلاف موقع المعاين عن المكتب الهندسي";

export type MapPin = { lat: number; lng: number };

export function isEngineeringDefaultPin(
  latitude: string,
  longitude: string,
): boolean {
  const defaults = jeddahDefaultCoords();
  return (
    latitude.trim() === defaults.latitude &&
    longitude.trim() === defaults.longitude
  );
}

/** Inspector original pin when the field inspector actually placed one. */
export function inspectorOriginalPinOf(
  draft: Pick<
    InspectorWorkspaceDraft,
    | "inspectorMapLatitude"
    | "inspectorMapLongitude"
    | "mapLatitude"
    | "mapLongitude"
  > | null,
): MapPin | null {
  if (!draft || !hasInspectorOriginalMapPin(draft)) return null;
  return (
    parsePlacedMapPin(
      draft.inspectorMapLatitude,
      draft.inspectorMapLongitude,
    ) ?? parsePlacedMapPin(draft.mapLatitude, draft.mapLongitude)
  );
}

export function engineeringActivePinOf(
  submission: Pick<
    EngineeringSurveySubmission,
    "latitude" | "longitude"
  > | null,
): MapPin | null {
  if (!submission) return null;
  return parsePlacedMapPin(submission.latitude, submission.longitude);
}

export function engineeringInspectorReferencePinOf(
  submission: Pick<
    EngineeringSurveySubmission,
    "inspectorReferenceLatitude" | "inspectorReferenceLongitude"
  > | null,
): MapPin | null {
  if (!submission) return null;
  return parsePlacedMapPin(
    submission.inspectorReferenceLatitude,
    submission.inspectorReferenceLongitude,
  );
}

export function resolveSiblingInspectionTaskId(
  surveyTask: WorkflowTask,
  tasks: WorkflowTask[],
): string | null {
  const fromDto = surveyTask.fieldInspectionTaskId?.trim();
  if (fromDto) return fromDto;
  return findSiblingInspectionTask(surveyTask, tasks)?.id ?? null;
}

export async function loadInspectorPinForSurveyTask(
  surveyTask: WorkflowTask,
  tasks: WorkflowTask[],
): Promise<MapPin | null> {
  const inspectionTaskId = resolveSiblingInspectionTaskId(surveyTask, tasks);
  if (!inspectionTaskId) return null;
  const draft = await loadInspectorWorkspaceSnapshot(inspectionTaskId);
  return inspectorOriginalPinOf(draft);
}

/** Apply inspector pin as map seed + stored reference when still on Jeddah defaults. */
export function withInspectorPinSeed(
  submission: EngineeringSurveySubmission,
  pin: MapPin | null,
): EngineeringSurveySubmission {
  if (!pin) return submission;
  const lat = pin.lat.toFixed(5);
  const lng = pin.lng.toFixed(5);
  const hasReference = Boolean(
    submission.inspectorReferenceLatitude?.trim() &&
      submission.inspectorReferenceLongitude?.trim(),
  );
  const stillDefault = isEngineeringDefaultPin(
    submission.latitude,
    submission.longitude,
  );
  return {
    ...submission,
    inspectorReferenceLatitude: hasReference
      ? submission.inspectorReferenceLatitude
      : lat,
    inspectorReferenceLongitude: hasReference
      ? submission.inspectorReferenceLongitude
      : lng,
    latitude: stillDefault ? lat : submission.latitude,
    longitude: stillDefault ? lng : submission.longitude,
  };
}

export function engineeringPinMismatchesInspector(
  submission: Pick<
    EngineeringSurveySubmission,
    | "latitude"
    | "longitude"
    | "inspectorReferenceLatitude"
    | "inspectorReferenceLongitude"
  >,
): { mismatch: true; distanceM: number; inspector: MapPin; office: MapPin } | {
  mismatch: false;
} {
  const inspector = engineeringInspectorReferencePinOf(submission);
  const office = engineeringActivePinOf(submission);
  if (!inspector || !office) return { mismatch: false };
  if (!pinsExceedMatchMeters(inspector, office)) return { mismatch: false };
  return {
    mismatch: true,
    distanceM: pinDistanceMeters(inspector, office),
    inspector,
    office,
  };
}

export function locationPinMismatchInternalNote(input: {
  distanceM: number;
  inspector: MapPin;
  office: MapPin;
}): string {
  return (
    `${LOCATION_PIN_MISMATCH_NOTE_PREFIX} ` +
    `(≈${Math.round(input.distanceM)} م). ` +
    `المعاين: ${input.inspector.lat.toFixed(5)}, ${input.inspector.lng.toFixed(5)}. ` +
    `المكتب: ${input.office.lat.toFixed(5)}, ${input.office.lng.toFixed(5)}.`
  );
}
