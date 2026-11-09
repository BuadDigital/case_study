"use client";

/**
 * The inspector's two map helpers, shared by the phone location card (`InspectorLocationCard`)
 * and the desktop wizard (`InspectorWizardLocationStep`): «تحديد موقعي الحالي» (device GPS) and
 * «رجوع للموقع السابق» (undo the last confirmed pin move).
 */
import { cn, useToast } from "@platform/ui-kit";

/** What a map move did: saved at once, waiting for the «تأكيد تحريك الموقع» dialog, or nothing. */
export type InspectorMapMoveOutcome = "saved" | "pending" | "same";

/**
 * «تحديد موقعي الحالي»: reads the device position and hands it to the form's map-move handler.
 *
 * How it works: `navigator.geolocation.getCurrentPosition` with high accuracy (15 s timeout); the
 * point goes to `onCoords`, which either saves it or (on a pinned map) asks to confirm the move.
 * A «saved» outcome toasts «تم التقاط موقعك الحالي».
 *
 * Edge cases: a browser without geolocation or a refused permission toasts the reason and changes
 * nothing. Works offline (GPS needs no network). Moved out of `useFieldInspectionWorkflow`
 * 2026-11-04 so the desktop wizard has the same button (it had none).
 */
export function InspectorGpsButton({
  onCoords,
  disabled = false,
  mobile = false,
  className,
}: {
  onCoords: (lat: number, lng: number) => InspectorMapMoveOutcome | void;
  disabled?: boolean;
  mobile?: boolean;
  className?: string;
}) {
  const { showToast } = useToast();
  const capture = () => {
    if (!navigator.geolocation) {
      showToast("المتصفح لا يدعم تحديد الموقع", "error");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const outcome = onCoords(pos.coords.latitude, pos.coords.longitude);
        if (outcome === "saved") showToast("تم التقاط موقعك الحالي", "success");
      },
      () => {
        showToast("تعذّر التقاط الموقع — تأكد من صلاحية الموقع", "error");
      },
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  };
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        "flex w-full items-center justify-center gap-2 rounded-xl border-[1.5px] border-heading bg-[color-mix(in_srgb,var(--heading)_8%,transparent)] font-inherit font-bold text-heading disabled:opacity-50",
        mobile ? "min-h-12 text-[14px]" : "min-h-10 text-[13px]",
        className,
      )}
      onClick={capture}
    >
      <i className="ti ti-current-location text-base" aria-hidden />
      تحديد موقعي الحالي
    </button>
  );
}

/**
 * «رجوع للموقع السابق»: puts the pin back where it was before the last confirmed move.
 *
 * How it works: a plain button; the host keeps the previous point (`mapBackup`) and restores it in
 * `onUndo`.
 *
 * Edge cases: the host renders it only while a previous point is kept.
 */
export function InspectorMapUndoButton({ onUndo }: { onUndo: () => void }) {
  return (
    <button
      type="button"
      className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface font-inherit text-[13px] font-bold text-heading"
      onClick={onUndo}
    >
      <i className="ti ti-arrow-back-up text-base" aria-hidden />
      رجوع للموقع السابق
    </button>
  );
}
