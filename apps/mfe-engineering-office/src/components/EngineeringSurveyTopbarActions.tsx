"use client";

import { useSyncExternalStore } from "react";
import { Button } from "@platform/design-system";
import {
  getSurveyWorkTopbarState,
  subscribeSurveyWorkTopbar,
} from "@platform/app-shared/prototype/survey-work-topbar-bridge";

export function EngineeringSurveyTopbarActions() {
  const topbar = useSyncExternalStore(
    subscribeSurveyWorkTopbar,
    getSurveyWorkTopbarState,
    () => null,
  );

  if (!topbar) return null;

  return (
    <div
      className="flex shrink-0 flex-wrap items-center justify-end gap-2"
      aria-label="إجراءات الرفع المساحي"
    >
      <Button
        type="button"
        size="sm"
        variant="primary"
        loading={topbar.saving}
        disabled={topbar.saving}
        onClick={topbar.onSave}
      >
        {topbar.saveLabel}
      </Button>
    </div>
  );
}
