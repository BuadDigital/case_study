"use client";

import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import {
  formatPropertyDeedDisplay,
  type PoPropertyIntake,
} from "../../lib/app-data/po-intake-data";
import { FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT } from "../../lib/app-data/inspector-workspace-model";
import { loadInspectorWorkspaceSnapshot } from "../../lib/app-data/inspector-workspace-reads";
import { getOrCreateInspectorWorkspace } from "../../lib/app-data/inspector-workspace-commands";
import type { InspectorWorkspaceDraft } from "../../lib/app-data/inspector-workspace-data";
import type { WorkflowTask } from "../../lib/app-data/tasks";

/**
 * Loads the inspection draft for `PropertyDetailInspectionTab`: the editable
 * workspace in input mode, the read-only snapshot (kept fresh on submission
 * events) otherwise.
 *
 * The tab sits in an <Activity>, so coming back to it re-runs this effect, and
 * a refetched task/property list hands it new objects for the same task. Only a
 * different task, mode or land context blanks the tab; otherwise the view
 * refreshes silently and input mode keeps the draft on screen — re-seeding it
 * from the server could drop edits whose debounced save is still pending.
 */
export function usePropertyDetailInspectionDraftLoad({
  inspectionTask,
  editMode,
  property,
  setDraft,
  setLoading,
}: {
  inspectionTask: WorkflowTask | null | undefined;
  editMode: boolean;
  property: PoPropertyIntake;
  setDraft: Dispatch<SetStateAction<InspectorWorkspaceDraft | null>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
}): void {
  const loadedRef = useRef<{ key: string; done: boolean } | null>(null);

  useEffect(() => {
    if (!inspectionTask) {
      loadedRef.current = null;
      setDraft(null);
      return;
    }
    let cancelled = false;
    // Input mode sanitises the draft by the property's land context — a change there reloads it.
    const key = `${inspectionTask.id}|${editMode}|${property.id}|${property.classification}|${property.propertyType}`;
    const shownAgain = loadedRef.current?.key === key && loadedRef.current.done;
    const current = shownAgain ? loadedRef.current! : { key, done: false };
    loadedRef.current = current;
    if (!shownAgain) setLoading(true);

    if (editMode) {
      if (shownAgain) return;
      const propertyDisplayId =
        formatPropertyDeedDisplay(property) ||
        `خانة ${inspectionTask.propertyOrdinal}`;
      void getOrCreateInspectorWorkspace({
        taskId: inspectionTask.id,
        propertyId: property.id,
        poNumber: inspectionTask.poNumber,
        propertyDisplayId,
        property,
      }).then((next) => {
        if (!cancelled) {
          setDraft(next);
          setLoading(false);
          current.done = true;
        }
      });
      return () => {
        cancelled = true;
      };
    }

    const load = () => {
      void loadInspectorWorkspaceSnapshot(inspectionTask.id).then((loaded) => {
        if (!cancelled) {
          setDraft(loaded);
          setLoading(false);
          current.done = true;
        }
      });
    };
    load();
    const onChange = () => load();
    window.addEventListener(FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT, onChange);
    return () => {
      cancelled = true;
      window.removeEventListener(
        FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT,
        onChange,
      );
    };
  }, [inspectionTask, editMode, property, setDraft, setLoading]);
}
