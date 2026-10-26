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
  InsReadField,
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

/**
 * A date field for building-permit and similar dates: a text box you can type or paste into, plus a calendar popup.
 *
 * How it works: while the box is focused it shows `text` (what the user is typing); otherwise it shows the saved
 * value formatted as `dd/mm/yyyy م` (Gregorian) or `dd/mm/yyyy هـ` (Hijri). Every change is read with
 * `parseDualCalendarDate`; as soon as the text is a complete valid date, `onChange` receives it in the formatted
 * shape. The calendar icon opens the picker (Gregorian / Hijri tabs); picking a day calls `onChange` and closes it.
 *
 * Edge cases: Arabic digits and `/`, `-`, `.` separators are accepted; day comes first, so `06/15/2018` is not a
 * date; text that is not yet complete never changes the saved value, and on blur the box goes back to the saved
 * value. Emptying the box and leaving it clears the date. The field used to be a button that only opened the
 * calendar, so a copied date could not be pasted. `disabled` renders a read-only value.
 */
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
  const triggerRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState("");
  const [editing, setEditing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const ignoreNextOutsideClickRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});
  const parsed = useMemo(() => parseDualCalendarDate(value), [value]);
  const [panelCalendar, setPanelCalendar] = useState<DualCalendarKind>(
    () => parsed?.kind ?? "gregorian",
  );

  // A typed value decides which calendar the panel opens on.
  const [parsedForValue, setParsedForValue] = useState(value);
  if (parsedForValue !== value) {
    setParsedForValue(value);
    if (parsed) setPanelCalendar(parsed.kind);
  }

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
      // A year/day button re-renders away before this listener runs — a detached target is never "outside".
      if (!target.isConnected) return;
      if (rootRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    };

    document.addEventListener("click", onDocumentClick);
    return () => document.removeEventListener("click", onDocumentClick);
  }, [open]);

  if (disabled) {
    return (
      <InsReadField
        id={id}
        label={label}
        value={parsed ? formatDualCalendarDate(parsed) : value}
        ltr
        className={className}
      />
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
      <div className="relative" ref={triggerRef}>
        {/* Typed or pasted text is read as day/month/year (م) or with «هـ» for Hijri; the picker stays on the icon. */}
        <input
          id={id}
          type="text"
          dir="ltr"
          inputMode="numeric"
          autoComplete="off"
          className={cn(
            EDIT_CONTROL_CLASS,
            "pe-10 text-left [unicode-bidi:isolate]",
            gridCentered && "text-center",
          )}
          placeholder="dd/mm/yyyy"
          aria-label={displayText ? `${label}: ${displayText}` : label}
          value={editing ? text : displayText}
          onFocus={() => {
            setText(displayText);
            setEditing(true);
          }}
          onChange={(event) => {
            setText(event.target.value);
            const typed = parseDualCalendarDate(event.target.value);
            if (typed) onChange(formatDualCalendarDate(typed));
          }}
          onBlur={() => {
            setEditing(false);
            if (!text.trim() && value) onChange("");
          }}
        />
        <button
          type="button"
          className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 cursor-pointer place-items-center rounded-md border-0 bg-transparent p-0"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={`فتح التقويم — ${label}`}
          onClick={(event) => {
            event.stopPropagation();
            ignoreNextOutsideClickRef.current = true;
            setOpen((wasOpen) => !wasOpen);
          }}
        >
          <InsCalendarIcon className="shrink-0 text-text-3" />
        </button>
        {open
          ? createPortal(
              // w-max: the first measurement runs before the fixed style lands — a block wrapper reads the full body width and clamps the panel to the far edge.
              <div ref={panelRef} className="w-max" style={panelStyle}>
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
