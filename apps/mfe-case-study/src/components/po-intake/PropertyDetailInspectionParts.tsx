"use client";

/** Property-detail inspection-tab parts — module-level fields/cards/cells, moved verbatim (SRP). */

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  createContext,
  useContext,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { arabicStepLabel } from "../field-inspection/FieldInspectionWorkParts";
import { cn, useToast } from "@platform/ui-kit";
import { formatDateAr } from "../../lib/prototype/po-intake-data";
import type { InspectorWorkspacePatch } from "../../lib/prototype/inspector-workspace-storage";
import {
  parseInspectorCount,
  type InspectorComponentPhotoKey,
  type InspectorPhotoAttachment,
  type InspectorSlotPhoto,
  type InspectorWorkspaceDraft,
} from "../../lib/prototype/inspector-workspace-data";
import {
  clearInspectorPhotoDataUrl,
  getInspectorPhotoDataUrl,
  prefetchInspectorPhoto,
  uploadInspectorPhotoFromFile,
} from "../../lib/prototype/inspector-photo-upload";
import {
  INSPECTOR_PHOTO_ACCEPT,
  filterInspectorPhotoFiles,
  useInspectorPhotoDropZone,
} from "../../lib/prototype/inspector-photo-drop";
import { InspectorPhotoFilePicker } from "../field-inspection/InspectorPhotoFilePicker";
import { InspectorStampedPhotoThumb } from "../field-inspection/InspectorStampedPhotoThumb";
import { photoLocationFlagLabel } from "@platform/app-shared/media/photo-location";
import { inspectorInvalidControlClass } from "../../lib/prototype/inspector-workspace-validation";
import {
  formatDualCalendarDate,
  parseDualCalendarDate,
  type DualCalendarKind,
} from "../../lib/prototype/dual-calendar-date";
import { DualCalendarPickerPanel } from "../field-inspection/DualCalendarPickerPanel";

/** Shared control style for in-tab edit inputs — matches InsField typography. */
export { EDIT_CONTROL_CLASS, INS_LABEL_CLASS, INS_TH_CLASS, INS_TD_CLASS } from "../field-inspection/FieldInspectionWorkParts";
import { EDIT_CONTROL_CLASS } from "../field-inspection/FieldInspectionWorkParts";

export function formatAcceptedDate(iso: string): string {
  const day = iso.trim().slice(0, 10);
  return day ? formatDateAr(day) : iso.trim();
}

export function SharedBadge() {
  return (
    <span className="inline-flex shrink-0 rounded-md border border-[color-mix(in_srgb,#8b5cf6_30%,transparent)] bg-[color-mix(in_srgb,#8b5cf6_14%,transparent)] px-2 py-0.5 text-[10px] font-bold text-[#6b46c1]">
      مشترك
    </span>
  );
}

const InsFieldsGridCenteredContext = createContext(false);

function useInsFieldsGridCentered() {
  return useContext(InsFieldsGridCenteredContext);
}

function insFieldLabelRowClass(centered: boolean) {
  return cn("mb-1 flex flex-wrap items-center gap-1.5", centered && "justify-center");
}

function insFieldLabelClass(centered: boolean, invalid?: boolean) {
  return cn(
    "text-[11px] font-semibold",
    centered && "w-full text-center",
    invalid ? "text-danger" : "text-text-2",
  );
}

/** Case Study.html `insField` — plain label + value (no gold FieldBox). */
export function InsField({
  label,
  value,
  ltr,
  badge,
  className,
}: {
  label: string;
  value?: string;
  ltr?: boolean;
  badge?: ReactNode;
  className?: string;
}) {
  const gridCentered = useInsFieldsGridCentered();
  const trimmed = value?.trim() ?? "";
  return (
    <div className={cn("min-w-0", className)}>
      <div className={insFieldLabelRowClass(gridCentered)}>
        <span className={insFieldLabelClass(gridCentered)}>{label}</span>
        {badge}
      </div>
      <div
        className={cn(
          "py-0.5 text-[13px] font-semibold text-heading",
          ltr && "[direction:ltr] [unicode-bidi:isolate] text-center",
          !trimmed && "font-normal text-text-3",
        )}
      >
        {trimmed || "—"}
      </div>
    </div>
  );
}

/** Editable counterpart of `InsField` — used when the tab is in edit mode. */
export function InsEditField({
  id,
  label,
  value,
  onChange,
  ltr,
  badge,
  type = "text",
  inputMode,
  placeholder,
  className,
  invalid,
  errorMessage,
  disabled = false,
}: {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  ltr?: boolean;
  badge?: ReactNode;
  type?: string;
  inputMode?: "decimal" | "numeric" | "text" | "tel" | "email" | "url" | "search" | "none";
  placeholder?: string;
  className?: string;
  invalid?: boolean;
  errorMessage?: string;
  disabled?: boolean;
}) {
  const gridCentered = useInsFieldsGridCentered();
  const inputCenterClass =
    ltr || gridCentered ? "text-center [direction:ltr] [unicode-bidi:isolate]" : undefined;

  if (disabled) {
    return (
      <div className={cn("min-w-0", className)} id={id ? `${id}-wrap` : undefined}>
        <div className={insFieldLabelRowClass(gridCentered)}>
          <span className={insFieldLabelClass(gridCentered)}>{label}</span>
          {badge}
        </div>
        <input
          id={id}
          type={type}
          readOnly
          tabIndex={-1}
          aria-readonly="true"
          className={cn(
            EDIT_CONTROL_CLASS,
            inputCenterClass,
            "cursor-default font-semibold text-heading",
          )}
          value={value}
        />
      </div>
    );
  }
  return (
    <div className={cn("min-w-0", className)} id={id ? `${id}-wrap` : undefined}>
      <div className={insFieldLabelRowClass(gridCentered)}>
        <span className={insFieldLabelClass(gridCentered, invalid)}>
          {label}
        </span>
        {badge}
      </div>
      <input
        id={id}
        type={type}
        inputMode={inputMode}
        aria-invalid={invalid || undefined}
        className={cn(
          EDIT_CONTROL_CLASS,
          inputCenterClass,
          invalid && inspectorInvalidControlClass,
        )}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {invalid && errorMessage ? (
        <p className="mt-1 text-[11px] font-semibold text-danger" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}

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

const CALENDAR_PANEL_WIDTH = 288;
const CALENDAR_PANEL_EST_HEIGHT = 330;
const CALENDAR_VIEWPORT_MARGIN = 8;
const CALENDAR_PANEL_GAP = 4;

function computeDualCalendarPanelStyle(
  trigger: HTMLElement,
  panelWidth = CALENDAR_PANEL_WIDTH,
  panelHeight = CALENDAR_PANEL_EST_HEIGHT,
): CSSProperties {
  const rect = trigger.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let left = rect.right - panelWidth;
  left = Math.max(
    CALENDAR_VIEWPORT_MARGIN,
    Math.min(left, vw - panelWidth - CALENDAR_VIEWPORT_MARGIN),
  );

  let top = rect.bottom + CALENDAR_PANEL_GAP;
  if (top + panelHeight > vh - CALENDAR_VIEWPORT_MARGIN) {
    const above = rect.top - panelHeight - CALENDAR_PANEL_GAP;
    if (above >= CALENDAR_VIEWPORT_MARGIN) top = above;
  }

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

export function InsEditSelect({
  id,
  label,
  value,
  options,
  onChange,
  badge,
  placeholder = "— اختر —",
  className,
}: {
  id?: string;
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  badge?: ReactNode;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="mb-1 flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-semibold text-text-2">{label}</span>
        {badge}
      </div>
      <select
        id={id}
        className={EDIT_CONTROL_CLASS}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}

export function InsEditTextarea({
  id,
  label,
  value,
  onChange,
  rows = 3,
  className,
  disabled = false,
  invalid,
  errorMessage,
  placeholder,
  hint,
}: {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  className?: string;
  disabled?: boolean;
  invalid?: boolean;
  errorMessage?: string;
  placeholder?: string;
  hint?: string;
}) {
  if (disabled) {
    return <InsField label={label} value={value} className={className} />;
  }
  return (
    <div className={cn("min-w-0", className)} id={id ? `${id}-wrap` : undefined}>
      <div className="mb-1 flex flex-wrap items-center gap-1.5">
        <span
          className={cn(
            "text-[11px] font-semibold",
            invalid ? "text-danger" : "text-text-2",
          )}
        >
          {label}
        </span>
      </div>
      {hint ? (
        <p id={id ? `${id}-hint` : undefined} className="mb-1.5 text-[11px] text-text-3">
          {hint}
        </p>
      ) : null}
      <textarea
        id={id}
        rows={rows}
        placeholder={placeholder}
        aria-describedby={
          [hint && id ? `${id}-hint` : null, invalid && errorMessage && id ? `${id}-error` : null]
            .filter(Boolean)
            .join(" ") || undefined
        }
        className={cn(EDIT_CONTROL_CLASS, "resize-y", invalid && inspectorInvalidControlClass)}
        value={value}
        aria-invalid={invalid || undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {invalid && errorMessage ? (
        <p id={id ? `${id}-error` : undefined} className="mt-1 mb-0 text-[11px] text-danger-text">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}

export function InsFieldsGrid({
  min = 150,
  centered = false,
  children,
}: {
  min?: number;
  centered?: boolean;
  children: ReactNode;
}) {
  return (
    <InsFieldsGridCenteredContext.Provider value={centered}>
      <div
        className="grid gap-3"
        style={{
          gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`,
        }}
      >
        {children}
      </div>
    </InsFieldsGridCenteredContext.Provider>
  );
}

/** Case Study.html `insCard` — white card, title row, no heavy header strip. */
export function InsCard({
  title,
  badge,
  children,
  step,
  hidden = false,
}: {
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  /** Section number inside its wizard step. */
  step?: number;
  /** Belongs to a wizard step that is not the active one. */
  hidden?: boolean;
}) {
  if (hidden) return null;
  return (
    <section className="mb-3 rounded-[12px] border border-border bg-surface px-4 py-3.5 shadow-none">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {step != null ? (
          <span className="grid size-[30px] shrink-0 place-items-center rounded-full bg-ink text-[14px] font-extrabold text-[var(--gold-2,#c8b591)]">
            {arabicStepLabel(step)}
          </span>
        ) : null}
        <h4 className="m-0 text-[13px] font-bold text-heading">{title}</h4>
        <span className="flex-1" />
        {badge}
      </div>
      {children}
    </section>
  );
}

export function ChipRow({
  items,
  selected,
  onToggle,
}: {
  items: string[];
  selected: string[];
  onToggle?: (item: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-[7px]">
      {items.map((item) => {
        const on = selected.includes(item);
        const chipClass = cn(
          "inline-flex items-center gap-[5px] rounded-lg border px-[11px] py-[5px] text-[11.5px]",
          on
            ? "border-[color-mix(in_srgb,#1f6f6f_30%,transparent)] bg-[color-mix(in_srgb,#2a8f8f_12%,transparent)] text-[#1f6f6f]"
            : "border-border bg-surface-2 text-text-3",
        );
        const content = (
          <>
            {on ? (
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                aria-hidden
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            ) : null}
            {item}
          </>
        );
        if (onToggle) {
          return (
            <button
              key={item}
              type="button"
              className={chipClass}
              onClick={() => onToggle(item)}
            >
              {content}
            </button>
          );
        }
        return (
          <span key={item} className={chipClass}>
            {content}
          </span>
        );
      })}
    </div>
  );
}

export function PhotoTile({
  label,
  filled,
  none,
  taskId,
  photoRef,
  photo,
  locationFlag,
  distanceM,
}: {
  label: string;
  filled: boolean;
  none?: boolean;
  taskId?: string;
  photoRef?: string;
  photo?: InspectorSlotPhoto | null;
  locationFlag?: string | null;
  distanceM?: number | null;
}) {
  const [dataUrl, setDataUrl] = useState<string | undefined>(() =>
    taskId && photoRef ? getInspectorPhotoDataUrl(taskId, photoRef) : undefined,
  );

  useEffect(() => {
    if (!filled || !taskId || !photoRef || !photo) {
      setDataUrl(undefined);
      return;
    }
    const cached = getInspectorPhotoDataUrl(taskId, photoRef);
    if (cached) {
      setDataUrl(cached);
      return;
    }
    let cancelled = false;
    void prefetchInspectorPhoto(taskId, photoRef, photo)
      .then((url) => {
        if (!cancelled && url) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [filled, taskId, photoRef, photo]);

  const flagLabel = photoLocationFlagLabel(locationFlag);
  const flagTone =
    locationFlag === "outside_property"
      ? "bg-amber-600"
      : locationFlag === "location_unavailable"
        ? "bg-slate-600"
        : locationFlag === "match"
          ? "bg-emerald-700"
          : null;

  return (
    <div
      className={cn(
        "relative grid h-[100px] place-items-center overflow-hidden rounded-lg border border-border bg-surface-2 bg-cover bg-center",
        none && "border-dashed",
      )}
      style={dataUrl && filled ? { backgroundImage: `url(${dataUrl})` } : undefined}
      title={label}
    >
      {filled && !dataUrl ? (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--text-3, #8a8d96)"
          strokeWidth="1.5"
          aria-hidden
        >
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <circle cx="8.5" cy="9.5" r="1.5" />
          <path d="m4 17 5-5 4 4 3-2 4 4" />
        </svg>
      ) : null}
      {!filled ? (
        <span className="text-[10.5px] text-[#d9694f]">
          {none ? "غير متوفر" : "بانتظار الرفع"}
        </span>
      ) : null}
      {flagTone && flagLabel ? (
        <span
          className={`absolute inset-x-1 top-1 z-[1] rounded px-1 py-0.5 text-center text-[9px] font-semibold text-white ${flagTone}`}
          title={
            distanceM != null ? `${flagLabel} · ${distanceM} م` : flagLabel
          }
        >
          {flagLabel}
          {distanceM != null ? ` · ${Math.round(distanceM)}م` : ""}
        </span>
      ) : null}
      <span className="absolute inset-x-0 bottom-0 bg-[rgba(16,43,78,0.72)] px-1.5 py-[3px] text-center text-[9.5px] text-white">
        {label}
      </span>
    </div>
  );
}

/** Desktop file-picker cell for feature-table «photo» (PC friendly). */
export function EditableFeaturePhotoCell({
  needsPhoto,
  hasPhoto,
  disabled,
  onUpload,
}: {
  needsPhoto: boolean;
  hasPhoto: boolean;
  disabled?: boolean;
  onUpload: (file: File) => boolean | void | Promise<boolean | void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { runWithUploadToast } = useToast();
  const { dragOver, dropZoneProps } = useInspectorPhotoDropZone({
    disabled,
    onFiles: (files) => {
      const file = files[0];
      if (file) void runWithUploadToast(() => onUpload(file));
    },
  });

  if (!needsPhoto) {
    return <span className="text-text-3">—</span>;
  }

  return (
    <span
      className={cn(
        "inline-flex flex-col items-center gap-1 rounded-md px-1 py-0.5",
        dragOver &&
          "bg-[color-mix(in_srgb,var(--primary)_8%,transparent)] ring-2 ring-primary/30",
      )}
      {...dropZoneProps}
    >
      {hasPhoto ? (
        <button
          type="button"
          disabled={disabled}
          title="استبدال — اسحب صورة جديدة أو اختر من الجهاز"
          className="inline-flex items-center gap-1 border-0 bg-transparent p-0 font-inherit text-[10.5px] text-[#1f6f6f] hover:underline disabled:cursor-default"
          onClick={() => inputRef.current?.click()}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M20 6 9 17l-5-5" />
          </svg>
          {dragOver ? "أفلِت هنا" : "مرفقة"}
        </button>
      ) : (
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "inline-flex items-center gap-1 rounded-md border border-dashed border-border-md bg-surface px-2.5 py-1.5",
            "font-inherit text-[10.5px] font-semibold text-text-2 hover:border-primary hover:text-primary",
            "disabled:cursor-not-allowed disabled:opacity-60",
            dragOver && "border-primary text-primary",
          )}
          onClick={() => inputRef.current?.click()}
        >
          <i className="ti ti-upload text-[13px]" aria-hidden />
          {dragOver ? "أفلِت الصورة" : "إرفاق صورة"}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={INSPECTOR_PHOTO_ACCEPT}
        disabled={disabled}
        className="sr-only"
        onChange={(e) => {
          const file = filterInspectorPhotoFiles(e.target.files)[0];
          e.target.value = "";
          if (file) void runWithUploadToast(() => onUpload(file));
        }}
      />
    </span>
  );
}

/** Count field that requires a documentary photo when count > 0 (showroom / well). */
export function ComponentCountWithPhotoField({
  label,
  countValue,
  photoKey,
  photoLabel,
  attachment,
  taskId,
  stamp,
  deedNumber,
  draft,
  editMode,
  disabled,
  onPatch,
}: {
  label: string;
  countValue: string;
  photoKey: InspectorComponentPhotoKey;
  photoLabel: string;
  attachment: InspectorPhotoAttachment | null | undefined;
  taskId: string;
  stamp: string;
  deedNumber?: string | null;
  draft: InspectorWorkspaceDraft;
  editMode: boolean;
  disabled?: boolean;
  onPatch: (patch: InspectorWorkspacePatch) => void;
}) {
  const { showToast } = useToast();
  const count = parseInspectorCount(countValue);
  const photoRef = `component:${photoKey}`;
  const needsPhoto = count > 0;

  if (!editMode) {
    return (
      <div className="min-w-0">
        <InsField label={label} value={countValue} ltr />
        {needsPhoto ? (
          <div className="mt-1.5 text-[11px] text-text-2">
            {attachment?.fileName ? (
              <span className="inline-flex items-center gap-1 text-[#1f6f6f]">
                <i className="ti ti-circle-check" aria-hidden />
                صورة {photoKey === "showroom" ? "المعرض" : "البئر"} مرفقة
              </span>
            ) : (
              <span className="text-danger-text">صورة مطلوبة وغير مرفقة</span>
            )}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <InsEditField
        label={label}
        value={countValue}
        ltr
        type="number"
        onChange={(v) => {
          const nextCount = parseInspectorCount(v);
          const countKey =
            photoKey === "showroom" ? "showroomCount" : "wellCount";
          if (nextCount === 0) {
            clearInspectorPhotoDataUrl(taskId, photoRef);
            onPatch({
              [countKey]: v,
              componentPhotoAttachments: {
                ...draft.componentPhotoAttachments,
                [photoKey]: null,
              },
            });
            return;
          }
          onPatch({ [countKey]: v });
        }}
      />
      {needsPhoto ? (
        <div className="mt-1.5">
          {attachment?.fileName ? (
            <InspectorStampedPhotoThumb
              compact
              stamp={stamp}
              taskId={taskId}
              photoRef={photoRef}
              attachment={attachment}
              onClear={
                disabled
                  ? undefined
                  : () => {
                      clearInspectorPhotoDataUrl(taskId, photoRef);
                      onPatch({
                        componentPhotoAttachments: {
                          ...draft.componentPhotoAttachments,
                          [photoKey]: null,
                        },
                      });
                    }
              }
            />
          ) : (
            <InspectorPhotoFilePicker
              label={photoLabel}
              disabled={disabled}
              className="w-auto"
              onFilesSelected={async (files) => {
                const file = files[0];
                if (!file) return false;
                const result = await uploadInspectorPhotoFromFile(
                  taskId,
                  photoRef,
                  file,
                  { draft, deedNumber },
                );
                if (!result.ok) {
                  throw new Error(result.error);
                }
                onPatch({
                  componentPhotoAttachments: {
                    ...draft.componentPhotoAttachments,
                    [photoKey]: result.attachment,
                  },
                });
                return true;
              }}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Case Study.html `pdInspectionHtml` — inspector report with view + in-tab
 * edit (`ed`) modes. View mode is the read-only 10-card summary; edit mode
 * lets the case-study specialist correct the inspector's draft in place.
 */