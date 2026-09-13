"use client";

import { cn } from "@platform/ui-kit";
import { SITE_LOCATION_ACK_BUTTON_LABEL } from "../../lib/app-data/inspector-workspace-data";
import { INS_WIZARD_PIN_BUTTON_CLASS } from "./FieldInspectionWorkParts";

/** Opens the branded «إقرار صحة الموقع» letter (print gated on تثبيت الموقع). */
export function InspectorSiteLocationAckButton({
  disabled = false,
  title,
  onClick,
  className,
}: {
  disabled?: boolean;
  title?: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      id="ins-site-location-ack"
      disabled={disabled}
      title={title}
      aria-disabled={disabled || undefined}
      onClick={onClick}
      className={cn(
        INS_WIZARD_PIN_BUTTON_CLASS,
        "shrink-0 disabled:cursor-not-allowed disabled:opacity-45",
        className,
      )}
    >
      {SITE_LOCATION_ACK_BUTTON_LABEL}
    </button>
  );
}
