"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppModal, Button, confirmAction, useToast } from "@platform/ui-kit";
import { formatArDateTime } from "@platform/app-shared/format/date";
import { formatPoDisplay } from "../../lib/app-data/po-intake-data";
import type { InspectorWorkspacePatchInput } from "../../lib/app-data/inspector-workspace-model";
import {
  copyPriorInspectionPatch,
  loadPriorInspections,
} from "../../lib/app-data/prior-inspection-copy";

/**
 * «نسخ من معاملة سابقة» on the inspector's location step: fills the draft from an earlier inspection
 * of the same deed, photos excluded.
 *
 * How it works: the server lists the inspections this task may copy (none → no button); picking one
 * asks before replacing the answers, then hands the copy to `onApply`, which saves it like any edit.
 *
 * Edge cases: a refused or failed copy changes nothing and says so. Offline there is no list, so
 * there is no button.
 */
export function InspectorCopyPriorButton({
  taskId,
  className,
  onApply,
}: {
  taskId: string;
  className?: string;
  onApply: (patch: InspectorWorkspacePatchInput) => void;
}) {
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [copying, setCopying] = useState(false);
  const { data: options = [] } = useQuery({
    queryKey: ["prior-inspections", taskId],
    queryFn: () => loadPriorInspections(taskId),
    staleTime: 5 * 60_000,
    retry: false,
  });

  if (options.length === 0) return null;

  async function copy(sourceTaskId: string, poLabel: string) {
    const confirmed = await confirmAction({
      title: "نسخ من معاملة سابقة",
      message: `تُستبدل إجاباتك الحالية بإجابات معاينة ${poLabel}. الصور لا تُنسخ، وتاريخ المعاينة وتثبيت الموقع والإقرار تبقى عليك في هذه الزيارة.`,
      confirmLabel: "نسخ",
    });
    if (!confirmed) return;
    setCopying(true);
    try {
      const patch = await copyPriorInspectionPatch(taskId, sourceTaskId);
      if (!patch) {
        showToast("تعذّر نسخ المعاينة السابقة", "error");
        return;
      }
      onApply(patch);
      setOpen(false);
      showToast("تم نسخ البيانات — التقط الصور وثبّت الموقع وراجع الإجابات", "success");
    } finally {
      setCopying(false);
    }
  }

  return (
    <div className={className}>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        نسخ من معاملة سابقة
      </Button>
      <AppModal open={open} title="نسخ من معاملة سابقة" onClose={() => setOpen(false)}>
        <p className="mb-3 mt-0 text-[12px] leading-relaxed text-text-3">
          معاينات سابقة لنفس الصك. تُنسخ كل البيانات ما عدا الصور.
        </p>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {options.map((option) => {
            const poLabel = formatPoDisplay(option.poNumber);
            return (
              <li key={option.sourceTaskId} className="m-0">
                <button
                  type="button"
                  disabled={copying}
                  onClick={() => void copy(option.sourceTaskId, poLabel)}
                  className="flex min-h-14 w-full cursor-pointer flex-col gap-1 rounded-[var(--radius-DEFAULT)] border border-border bg-surface-2 px-3.5 py-3 text-start font-inherit transition-colors hover:border-primary-light hover:bg-info-bg disabled:cursor-not-allowed disabled:opacity-55"
                >
                  <span className="text-[13px] font-semibold text-primary-light">{poLabel}</span>
                  <span className="text-[11px] text-text-3">
                    {[
                      option.inspectorName,
                      option.city,
                      option.district,
                      option.submittedAtUtc
                        ? formatArDateTime(option.submittedAtUtc, { year: "numeric", month: "numeric", day: "numeric" })
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </AppModal>
    </div>
  );
}
