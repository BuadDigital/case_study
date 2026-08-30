"use client";

/** Field-inspection work body parts — module-level components, moved verbatim (SRP). */

import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject, Fragment } from "react";
import { Button, FormRow, GoogleMapPin, InlineLoadingSkeleton, Input, Label, Note, Select, Textarea, cn, formControlClassName, useToast } from "@platform/ui-kit";
import { AppModal } from "../ui/AppModal";
import { ReturnedForCorrectionNote } from "../ui/ReturnedForCorrectionNote";
import { RegField, RegTextarea} from "@platform/app-shared/registration/FormFields";
import type { PartyTaskPageDef } from "@platform/app-shared/prototype/party-task-pages";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import { JEDDAH_DEFAULT_LAT, JEDDAH_DEFAULT_LNG } from "@engineering-office/mfe/lib/jeddah-default-coords";
import { BuildingInventorySection } from "./BuildingInventorySection";
import { InspectionLimitsSection } from "./InspectionLimitsSection";
import { FieldComparableCaptureSection } from "./FieldComparableCaptureSection";
import { InspectorDefinedPhotosSection } from "./InspectorDefinedPhotosSection";
import { InspectorSubmitFooter } from "./InspectorSubmitFooter";
import { InspectorMovablesDescriptionField } from "./InspectorMovablesDescriptionField";
import { InspectorPhotoFilePicker } from "./InspectorPhotoFilePicker";
import { InspectorStampedPhotoThumb } from "./InspectorStampedPhotoThumb";
import {
  MobileChips,
  MobileFieldLabel,
  MobilePills,
  MobileSearchSelect,
  MobileSuggestRow,
  featureUsesPills,
  mobileControlClassName,
} from "./InspectMobileControls";
import { useInspectorKeyAvailability } from "./InspectorKeyStatusTab";
import { clearInspectorPhotoDataUrl, uploadInspectorPhotoFromFile } from "../../lib/prototype/inspector-photo-upload";
import {
  INSPECTOR_PHOTO_ACCEPT,
  filterInspectorPhotoFiles,
  useInspectorPhotoDropZone,
} from "../../lib/prototype/inspector-photo-drop";
import {
  approximatePropertyGeo,
  boundariesMarkedUnavailable,
  formatPropertyDeedDisplay,
  PROPERTY_BOUNDARY_ROWS,
  type PoPropertyIntake,
} from "../../lib/prototype/po-intake-data";
import {
  declarationPhoneGate,
  hasAnyPartyPhone,
} from "../../lib/prototype/documentary-workflow-gates";
import { usePoRecordQuery } from "../../query/case-study-queries";
import {
  INSPECTOR_AMENITY_OPTIONS,
  INSPECTOR_OBSERVATION_CATEGORIES,
  INSPECTOR_SERVICE_OPTIONS,
  MOVABLES_DESCRIPTION_KEY,
  inspectorFeatureRequiresPhoto,
  inspectorPhotoCoverageLabel,
  inspectorPhotoStampText,
  isCommercialShopInspectionContext,
  isInspectorWorkspaceLocked,
  isLandInspectionContext,
  isMovablesPresent,
  isShopHiddenInspectorComponentKey,
  newObservationId,
  parseInspectorCount,
  patchInspectorFeatureValues,
  visibleInspectorFeatureFields,
  type InspectorComponentPhotoKey,
  type InspectorBoundaryKey,
  type InspectorWorkspaceDraft,
} from "../../lib/prototype/inspector-workspace-data";
import { finalizeInspectorWorkspace } from "../../lib/prototype/finalize-field-inspection-submission";
import { getOrCreateInspectorWorkspace, saveInspectorWorkspaceDraft, updateInspectorWorkspace } from "../../lib/prototype/inspector-workspace-storage";
import {
  firstInspectorWorkspaceError,
  firstInspectorWorkspaceErrorTarget,
  inspectorInvalidControlClass,
  scrollToInspectorField,
  validateInspectorWorkspace,
  type InspectorWorkspaceFieldErrors,
} from "../../lib/prototype/inspector-workspace-validation";
import type { WorkflowTask } from "../../lib/prototype/tasks-storage";

export const BOUNDARY_KEYS: InspectorBoundaryKey[] = [
  "north",
  "south",
  "east",
  "west",
];

export const BOUNDARY_ROW_MAP: Record<
  InspectorBoundaryKey,
  (typeof PROPERTY_BOUNDARY_ROWS)[number]
> = {
  north: PROPERTY_BOUNDARY_ROWS[0],
  south: PROPERTY_BOUNDARY_ROWS[1],
  east: PROPERTY_BOUNDARY_ROWS[2],
  west: PROPERTY_BOUNDARY_ROWS[3],
};

export const TABLE_TH =
  "border border-border bg-surface-2 px-2.5 py-[7px] text-[11px] font-bold text-text-2";
export const TABLE_TD = "border border-border px-2.5 py-1.5 align-middle text-[12px]";

export const EDIT_CONTROL_CLASS =
  "w-full appearance-none rounded-lg border border-border-md bg-surface px-[11px] py-[7px] text-[12.5px] text-text font-inherit";

/**
 * Desktop feature photo cell — always a real file picker on computer
 * (not camera-only). Empty: attach photo; attached: HTML-style "attached" + replace.
 */
export function DesktopFeaturePhotoCell({
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

  const openFilePicker = () => {
    if (disabled) return;
    inputRef.current?.click();
  };

  return (
    <span
      className={cn(
        "inline-flex flex-col items-center justify-center gap-1 rounded-md px-1 py-0.5",
        dragOver &&
          "bg-[color-mix(in_srgb,var(--primary)_8%,transparent)] ring-2 ring-primary/30",
      )}
      {...dropZoneProps}
    >
      {hasPhoto ? (
        <button
          type="button"
          disabled={disabled}
          title="استبدال الصورة — اسحب صورة جديدة أو اختر من الجهاز"
          className="inline-flex items-center gap-1 border-0 bg-transparent p-0 font-inherit text-[10.5px] text-[#1f6f6f] hover:underline disabled:cursor-default disabled:no-underline"
          onClick={openFilePicker}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
          {dragOver ? "أفلِت هنا" : "مرفقة"}
        </button>
      ) : (
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "inline-flex items-center justify-center gap-1 rounded-md border border-dashed border-border-md bg-surface px-2.5 py-1.5",
            "font-inherit text-[10.5px] font-semibold text-text-2",
            "hover:border-primary hover:text-primary",
            "disabled:cursor-not-allowed disabled:opacity-60",
            dragOver && "border-primary text-primary",
          )}
          onClick={openFilePicker}
        >
          <i className="ti ti-upload text-[13px]" aria-hidden />
          {dragOver ? "أفلِت الصورة" : "إرفاق صورة"}
        </button>
      )}
      {/* Desktop: no capture attribute — opens local file dialog on PC. */}
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

/** Case Study.html `insBadge`. */
export function InsBadge({
  label,
  tone = "def",
}: {
  label: string;
  tone?: "info" | "danger" | "purple" | "def";
}) {
  const colors =
    tone === "info"
      ? { fg: "#1f6f6f", base: "#2a8f8f" }
      : tone === "danger"
        ? { fg: "#b23b3b", base: "#d9694f" }
        : tone === "purple"
          ? { fg: "#6b46c1", base: "#8b5cf6" }
          : { fg: "var(--text-2)", base: "var(--border-2)" };
  return (
    <span
      className="inline-flex shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-bold"
      style={{
        color: colors.fg,
        background: `color-mix(in srgb, ${colors.base} 14%, transparent)`,
        borderColor: `color-mix(in srgb, ${colors.base} 30%, transparent)`,
      }}
    >
      {label}
    </span>
  );
}

export type FieldInspectionWorkHostRef = {
  submit?: () => Promise<boolean>;
  saveDraft?: () => Promise<boolean>;
  onSubmitted?: () => void;
  onSavingChange?: (saving: boolean) => void;
  focusNotes?: () => void;
};

export function MobileInspectMap({
  latitude,
  longitude,
  property,
  heightClass = "h-[180px]",
  interactive = false,
  onCoordsChange,
}: {
  latitude: string;
  longitude: string;
  property?: PoPropertyIntake | null;
  heightClass?: string;
  interactive?: boolean;
  onCoordsChange?: (lat: number, lng: number) => void;
}) {
  const latNum = Number.parseFloat(latitude);
  const lngNum = Number.parseFloat(longitude);
  const hasPin = Number.isFinite(latNum) && Number.isFinite(lngNum);
  const fallback =
    !hasPin && property
      ? approximatePropertyGeo(property)
      : null;
  const lat = hasPin ? latNum : fallback?.lat;
  const lng = hasPin ? lngNum : fallback?.lng;
  const picking = Boolean(interactive && onCoordsChange);
  if (lat == null || lng == null) {
    if (!picking) {
      return (
        <div className="rounded-xl border border-dashed border-border-2 bg-surface px-3 py-8 text-center text-[12px] text-text-3">
          حدّد موقعك لعرض الخريطة
        </div>
      );
    }
  }
  return (
    <div className="min-w-0">
      <div className={cn("relative overflow-hidden rounded-lg border border-border", heightClass)}>
        <GoogleMapPin
          lat={lat}
          lng={lng}
          title="خريطة المعاينة"
          interactive={picking}
          onCoordsChange={onCoordsChange}
        />
      </div>
      {picking ? (
        <p className="mb-0 mt-1.5 text-center text-[11px] text-text-3">
          اضغط على الخريطة أو اسحب الدبوس لتحديد موقع العقار
        </p>
      ) : null}
    </div>
  );
}

function arabicStepLabel(step: number | string): string {
  const n = typeof step === "number" ? step : Number.parseInt(String(step), 10);
  const map = ["١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩", "١٠"];
  if (Number.isFinite(n) && n >= 1 && n <= 10) return map[n - 1]!;
  return String(step);
}

export function InspectorCard({
  title,
  icon,
  badge,
  children,
  defaultOpen = false,
  layout = "desktop",
  step,
  subtitle,
}: {
  title: string;
  icon: string;
  badge?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  layout?: "desktop" | "mobile";
  step?: number | string;
  subtitle?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const mobile = layout === "mobile";

  if (mobile) {
    return (
      <div
        className="border-b-8 border-[var(--bg)] bg-transparent"
        data-registration-card
      >
        <button
          type="button"
          className="flex w-full items-center gap-3 border-none bg-surface px-4 py-4 text-start font-inherit"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {step != null ? (
            <span className="grid size-[30px] shrink-0 place-items-center rounded-full bg-ink text-[14px] font-extrabold text-[var(--gold-2,#c8b591)]">
              {arabicStepLabel(step)}
            </span>
          ) : (
            <i className={`ti ${icon} shrink-0 text-lg text-primary`} aria-hidden />
          )}
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-bold text-heading">{title}</span>
            {subtitle ? (
              <span className="mt-0.5 block text-[12px] text-text-3">{subtitle}</span>
            ) : null}
          </span>
          <span
            className={cn(
              "inline-flex shrink-0 text-text-3 transition-transform duration-200",
              open && "rotate-180",
            )}
            aria-hidden
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </span>
        </button>
        <div
          className={cn(
            "bg-[var(--bg)] px-4 pb-[18px] pt-0",
            !open && "hidden",
          )}
        >
          {children}
        </div>
      </div>
    );
  }

  return (
    <section className="mb-3 rounded-lg border border-border bg-surface px-4 py-3.5 shadow-none">
      <div className="mb-3 flex items-center gap-2">
        <h4 className="m-0 text-[13px] font-bold text-heading">{title}</h4>
        <span className="flex-1" />
        {badge}
      </div>
      {children}
    </section>
  );
}

export function MobileCountStepper({
  label,
  value,
  disabled,
  onChange,
}: {
  label?: string;
  value: string;
  disabled?: boolean;
  onChange: (next: string) => void;
}) {
  const n = Math.max(0, parseInspectorCount(value));
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border py-[11px]">
      {label ? (
        <span className="text-[14px] text-text-2">{label}</span>
      ) : (
        <span />
      )}
      <div className="flex items-center gap-3.5">
        <button
          type="button"
          disabled={disabled || n <= 0}
          className="grid size-11 place-items-center rounded-xl border-[1.5px] border-[var(--border-md,#ddd8cc)] bg-surface text-[22px] font-bold leading-none text-ink disabled:opacity-40"
          onClick={() => onChange(String(Math.max(0, n - 1)))}
        >
          −
        </button>
        <span className="min-w-7 text-center text-[17px] font-extrabold text-heading">
          {n}
        </span>
        <button
          type="button"
          disabled={disabled}
          className="grid size-11 place-items-center rounded-xl border-[1.5px] border-ink bg-ink text-[22px] font-bold leading-none text-white disabled:opacity-40"
          onClick={() => onChange(String(n + 1))}
        >
          +
        </button>
      </div>
    </div>
  );
}
