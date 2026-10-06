"use client";

import { describeInspectorDataSync } from "../../lib/evaluator/inspector-data-changes";

/**
 * Says which inspector data is on screen: a «بيانات المعاين (مسودة)» tag while the package is not
 * submitted/accepted, and when it last synced from the inspector's device.
 */
export function InspectorDataSyncNote({
  workspace,
}: {
  workspace:
    | {
        status?: string | null;
        acceptedAtUtc?: string | null;
        updatedAtUtc?: string | null;
      }
    | null
    | undefined;
}) {
  const { draftLabel, syncedLabel } = describeInspectorDataSync(workspace);
  if (!draftLabel && !syncedLabel) return null;
  return (
    <div
      className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-text-3"
      data-testid="inspector-data-sync-note"
    >
      {draftLabel ? (
        <span className="rounded-full border border-border bg-warning-bg px-2 py-0.5 font-bold text-amber-text">
          {draftLabel}
        </span>
      ) : null}
      {syncedLabel ? <span>{syncedLabel}</span> : null}
    </div>
  );
}
