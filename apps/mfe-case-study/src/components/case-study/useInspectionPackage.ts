"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@platform/ui-kit";
import {
  isInspectorWorkspaceAccepted,
  type InspectorWorkspaceStatus,
} from "@platform/app-shared/app-data/inspector-workspace-data";
import { FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT } from "@platform/app-shared/events/app-events";
import { loadInspectorWorkspaceSnapshot } from "../../lib/app-data/inspector-workspace-reads";
import type { WorkflowTask } from "../../lib/app-data/tasks";

type InspectionPackageSnapshot = {
  /** The inspection task this snapshot was loaded for — another task's snapshot is not shown. */
  taskId: string;
  status: InspectorWorkspaceStatus | null;
  assetSubject: string;
  loaded: boolean;
  accepted: boolean;
};

/**
 * The inspector's package as the specialist's review needs it: its status, the asset subject, and
 * whether the specialist accepted it.
 *
 * How it works: loads the inspector's workspace for the task, again whenever the task changes, the
 * inspector's submission changes (`FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT`) or `reload` is called.
 * Edge cases: until the current task's package has loaded, the values are the empty ones (no status,
 * not loaded, not accepted) — a previous task's package is never shown; a failed load shows a toast.
 */
export function useInspectionPackage(inspectionTask: WorkflowTask | null) {
  const { showToast } = useToast();
  const [snapshot, setSnapshot] = useState<InspectionPackageSnapshot | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!inspectionTask) return;
    let cancelled = false;
    let requestVersion = 0;
    const load = () => {
      const version = ++requestVersion;
      void loadInspectorWorkspaceSnapshot(inspectionTask.id)
        .then((draft) => {
          if (cancelled || version !== requestVersion) return;
          setSnapshot({
            taskId: inspectionTask.id,
            status: draft?.status ?? null,
            assetSubject: draft?.featureValues.assetSubject ?? "",
            loaded: true,
            accepted: isInspectorWorkspaceAccepted(draft),
          });
        })
        .catch((error: unknown) => {
          if (cancelled || version !== requestVersion) return;
          setSnapshot({ taskId: inspectionTask.id, status: null, assetSubject: "", loaded: false, accepted: false });
          showToast(error instanceof Error ? error.message : "تعذّر تحميل بيانات المعاينة", "error");
        });
    };
    load();
    window.addEventListener(FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT, load);
    return () => {
      cancelled = true;
      window.removeEventListener(FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT, load);
    };
  }, [inspectionTask, reloadKey, showToast]);

  const reload = useCallback(() => setReloadKey((n) => n + 1), []);
  /** The specialist just accepted the package: shown at once, then reloaded from the server. */
  const markAccepted = useCallback(() => {
    setSnapshot((s) => (s ? { ...s, accepted: true } : s));
    setReloadKey((n) => n + 1);
  }, []);

  const current = inspectionTask && snapshot?.taskId === inspectionTask.id ? snapshot : null;
  return {
    status: current?.status ?? null,
    assetSubject: current?.assetSubject ?? "",
    loaded: current?.loaded ?? false,
    accepted: current?.accepted ?? false,
    /** Changes on every reload — the inspection tab is keyed on it so it reloads too. */
    reloadKey,
    reload,
    markAccepted,
  };
}
