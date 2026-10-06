"use client";

import type { CostInventoryDrift } from "./lib/cost-approach-state";
import {
  EvaluatorActionNotice,
  type EvaluatorNoticeAction,
} from "../EvaluatorActionNotice";

/** What the drift banner says, e.g. «2 بند جديد — 1 بند تغيّرت مساحته». Empty when nothing drifted. */
export function costInventoryDriftMessage(drift: CostInventoryDrift): string {
  const parts: string[] = [];
  if (drift.added.length > 0) parts.push(`${drift.added.length} بند جديد`);
  if (drift.changedArea.length > 0) {
    parts.push(`${drift.changedArea.length} بند تغيّرت مساحته`);
  }
  if (drift.removed.length > 0) parts.push(`${drift.removed.length} بند حُذف من الحصر`);
  return parts.length > 0 ? `جدول المكونات تغيّر: ${parts.join(" — ")}` : "";
}

/**
 * The specialist's components table moved after the cost draft was seeded. Two explicit actions;
 * neither ever touches an entered unit cost. Removed rows are only reported (delete them by hand).
 */
export function CostInventoryDriftBanner({
  drift,
  disabled = false,
  onAddNew,
  onUpdateAreas,
}: {
  drift: CostInventoryDrift | null;
  disabled?: boolean;
  onAddNew: () => void;
  onUpdateAreas: () => void;
}) {
  if (!drift?.hasDrift) return null;
  const actions: EvaluatorNoticeAction[] = [];
  if (drift.added.length > 0) {
    actions.push({
      label: "إضافة البنود الجديدة",
      onClick: onAddNew,
      disabled,
      primary: true,
    });
  }
  if (drift.changedArea.length > 0) {
    actions.push({ label: "تحديث المساحات", onClick: onUpdateAreas, disabled });
  }
  return (
    <EvaluatorActionNotice
      testId="cost-inventory-drift-banner"
      message={costInventoryDriftMessage(drift)}
      actions={actions}
    />
  );
}
