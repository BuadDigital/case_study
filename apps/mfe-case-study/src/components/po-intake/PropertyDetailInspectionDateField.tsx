"use client";

/** Inspection-tab Hijri/Gregorian date field with a portalled picker popup. */

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@platform/ui-kit";
import {
  formatDualCalendarDate,
  parseDualCalendarDate,
  type DualCalendarKind,
} from "../../lib/app-data/dual-calendar-date";
import { DualCalendarPickerPanel } from "../field-inspection/DualCalendarPickerPanel";
import { EDIT_CONTROL_CLASS } from "../field-inspection/FieldInspectionWorkParts";
import {
  InsField,
  insFieldLabelClass,
  insFieldLabelRowClass,
  useInsFieldsGridCentered,
} from "./PropertyDetailInspectionFields";
import {
  CALENDAR_PANEL_EST_HEIGHT,
  CALENDAR_PANEL_WIDTH,
  dualCalendarPanelPlacement,
} from "./property-detail-inspection-state";

function InsCalendarIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
      <path d="M8 3v3M16 3v3M3 9.5h18" />
    </svg>
  );
}

function computeDualCalendarPanelStyle(
  trigger: HTMLElement,
  panelWidth = CALENDAR_PANEL_WIDTH,
  panelHeight = CALENDAR_PANEL_EST_HEIGHT,
): CSSProperties {
  const { top, left } = dualCalendarPanelPlacement(
    trigger.getBoundingClientRect(),
    { width: window.innerWidth, height: window.innerHeight },
    panelWidth,
    panelHeight,
  );
  return {
    position: "fixed",
    top,
    left,
    zIndex: 1200,
  };
}

/** Building-permit and similar dates — Hijri / Gregorian picker inside calendar popup. */
export function InsDualCalendarDateField({
  id,
  label,
  value,
  onChange,
  disabled = false,
  className,
}: {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const gridCentered = useInsFieldsGridCentered();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const ignoreNextOutsideClickRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});
  const parsed = useMemo(() => parseDualCalendarDate(value), [value]);
  const [panelCalendar, setPanelCalendar] = useState<DualCalendarKind>(
    () => parsed?.kind ?? "gregorian",
  );

  useEffect(() => {
    if (parsed) setPanelCalendar(parsed.kind);
  }, [value, parsed]);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;

    const placePanel = () => {
      if (!triggerRef.current) return;
      const width = panelRef.current?.offsetWidth ?? CALENDAR_PANEL_WIDTH;
      const height = panelRef.current?.offsetHeight ?? CALENDAR_PANEL_EST_HEIGHT;
      setPanelStyle(computeDualCalendarPanelStyle(triggerRef.current, width, height));
    };

    placePanel();
    window.addEventListener("resize", placePanel);
    window.addEventListener("scroll", placePanel, { capture: true, passive: true });
    return () => {
      window.removeEventListener("resize", placePanel);
      window.removeEventListener("scroll", placePanel, { capture: true });
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onDocumentClick = (event: MouseEvent) => {
      if (ignoreNextOutsideClickRef.current) {
        ignoreNextOutsideClickRef.current = false;
        return;
      }
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    };

    document.addEventListener("click", onDocumentClick);
    return () => document.removeEventListener("click", onDocumentClick);
  }, [open]);

  if (disabled) {
    return (
      <InsField label={label} value={value} ltr className={className} />
    );
  }

  const displayText = parsed ? formatDualCalendarDate(parsed) : "";

  return (
    <div
      ref={rootRef}
      className={cn("relative min-w-0", className)}
      id={id ? `${id}-wrap` : undefined}
    >
      <div className={insFieldLabelRowClass(gridCentered)}>
        <span className={insFieldLabelClass(gridCentered)}>{label}</span>
      </div>
      <div className="relative">
        <button
          ref={triggerRef}
          id={id}
          type="button"
          className={cn(
            EDIT_CONTROL_CLASS,
            "flex cursor-pointer items-center justify-between gap-2 text-left [direction:ltr] [unicode-bidi:isolate]",
            gridCentered && "text-center",
          )}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={displayText ? `${label}: ${displayText}` : label}
          onClick={(event) => {
            event.stopPropagation();
            ignoreNextOutsideClickRef.current = true;
            setOpen((wasOpen) => !wasOpen);
          }}
        >
          <span className={cn("min-w-0 flex-1 truncate", !displayText && "font-normal text-text-3")}>
            {displayText || "mm/dd/yyyy"}
          </span>
          <InsCalendarIcon className="shrink-0 text-text-3" />
        </button>
        {open
          ? createPortal(
              <div ref={panelRef} style={panelStyle}>
                <DualCalendarPickerPanel
                  selected={parsed}
                  calendar={panelCalendar}
                  onCalendarChange={setPanelCalendar}
                  onSelect={(parts) => {
                    onChange(formatDualCalendarDate(parts));
                    setPanelCalendar(parts.kind);
                    setOpen(false);
                  }}
                />
              </div>,
              document.body,
            )
          : null}
      </div>
    </div>
  );
}
