"use client";

import { cn } from "@platform/ui-kit";
import { SITE_LOCATION_ACK_BUTTON_LABEL } from "../../lib/prototype/inspector-workspace-data";
import { INS_WIZARD_PIN_BUTTON_CLASS } from "./FieldInspectionWorkParts";

/** Placeholder — contact-officer site-accuracy letter flow will plug in here later. */
export function InspectorSiteLocationAckButton({
  disabled = false,
  onClick,
  className,
}: {
  disabled?: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      id="ins-site-location-ack"
      disabled={disabled}
      onClick={onClick}
      className={cn(INS_WIZARD_PIN_BUTTON_CLASS, "shrink-0", className)}
    >
      {SITE_LOCATION_ACK_BUTTON_LABEL}
    </button>
  );
}
