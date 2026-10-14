"use client";

import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import {
  formatPropertyDeedDisplay,
  type PoPropertyIntake,
} from "../../lib/app-data/po-intake-data";
import { getOrCreateInspectorWorkspace } from "../../lib/app-data/inspector-workspace-commands";
import type { InspectorWorkspaceDraft } from "../../lib/app-data/inspector-workspace-data";
import type { WorkflowTask } from "../../lib/app-data/tasks";
import { newerInspectorDraft } from "./field-inspection-work-state";

/**
 * Loads (or creates and repairs) the inspector workspace once per task and property. Keyed on the
 * property id, not the react-query object: a background refetch of the PO record must not re-run the
 * fetch / repair / save and overwrite what was typed inside the save debounce. The loaded draft never
 * replaces a newer edit already on screen.
 */
export function useInspectorWorkspaceLoad({
  task,
  propertyId,
  property,
  setDraft,
  onError,
}: {
  task: Pick<WorkflowTask, "id" | "poNumber" | "propertyOrdinal">;
  propertyId: string;
  property: PoPropertyIntake | undefined;
  setDraft: Dispatch<SetStateAction<InspectorWorkspaceDraft | null>>;
  onError: (message: string) => void;
}): void {
  // Read when the load runs; the deps below only carry the property's identity.
  const propertyRef = useRef(property);
  // Declared before the load effect, so it has run by the time the load reads the ref.
  useEffect(() => {
    propertyRef.current = property;
  });
  const loadedPropertyId = property?.id;

  useEffect(() => {
    if (!propertyId) return;
    let cancelled = false;
    const current = propertyRef.current;
    void getOrCreateInspectorWorkspace({
      taskId: task.id,
      propertyId,
      poNumber: task.poNumber,
      propertyDisplayId:
        current != null
          ? formatPropertyDeedDisplay(current)
          : `خانة ${task.propertyOrdinal}`,
      property: current ?? null,
    }).then(
      (next) => {
        if (cancelled || !next) return;
        setDraft((prev) =>
          prev && prev.taskId === next.taskId ? newerInspectorDraft(prev, next) : next,
        );
      },
      (err: unknown) => {
        if (cancelled) return;
        onError(err instanceof Error ? err.message : "تعذّر تحميل مسودة المعاينة");
      },
    );
    return () => {
      cancelled = true;
    };
  }, [task.id, task.poNumber, task.propertyOrdinal, propertyId, loadedPropertyId, setDraft, onError]);
}
