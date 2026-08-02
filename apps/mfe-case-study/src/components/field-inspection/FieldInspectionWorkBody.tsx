"use client";

import { useCallback, useEffect, useState, type ReactNode, type RefObject } from "react";
import { Button, FormRow, InlineLoadingSkeleton, Input, Label, Note, Select, Textarea, cn, formControlClassName, useToast } from "@platform/design-system";
import { RegField, RegTextarea} from "@platform/app-shared/registration/FormFields";
import type { PartyTaskPageDef } from "@platform/app-shared/prototype/party-task-pages";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import { JEDDAH_DEFAULT_LAT, JEDDAH_DEFAULT_LNG } from "@engineering-office/mfe/lib/jeddah-default-coords";
import { InspectorDefinedPhotosSection } from "./InspectorDefinedPhotosSection";
import { InspectorSubmitFooter } from "./InspectorSubmitFooter";
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
  approximatePropertyGeo,
  boundariesMarkedUnavailable,
  formatPropertyDeedDisplay,
  PROPERTY_BOUNDARY_ROWS,
  type PoPropertyIntake,
} from "../../lib/prototype/po-intake-data";
import {
  informalAccessGate,
  inspectorKeySubmitGate,
  declarationPhoneGate,
  hasAnyPartyPhone,
  isInformalSettlement,
  roleBypassesDocumentaryGates,
  roleCanSetLocationMapUrl,
} from "../../lib/prototype/documentary-workflow-gates";
import { updatePropertyLocationMapUrlInPo } from "../../lib/prototype/po-intake-storage";
import { usePoRecordQuery } from "../../query/case-study-queries";
import { useQueryClient } from "@tanstack/react-query";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import {
  INSPECTOR_AMENITY_OPTIONS,
  INSPECTOR_FEATURE_FIELDS,
  INSPECTOR_OBSERVATION_CATEGORIES,
  INSPECTOR_SERVICE_OPTIONS,
  inspectorFeatureRequiresPhoto,
  inspectorPhotoCoverageLabel,
  inspectorPhotoStampText,
  inspectorWorkspaceStatusLabel,
  isInspectorWorkspaceLocked,
  newObservationId,
  parseInspectorCount,
  type InspectorComponentPhotoKey,
  type InspectorBoundaryKey,
  type InspectorWorkspaceDraft,
} from "../../lib/prototype/inspector-workspace-data";
import { finalizeInspectorWorkspace } from "../../lib/prototype/finalize-field-inspection-submission";
import { getOrCreateInspectorWorkspace, saveInspectorWorkspaceDraft, updateInspectorWorkspace } from "../../lib/prototype/inspector-workspace-storage";
import { firstInspectorWorkspaceError, validateInspectorWorkspace, type InspectorWorkspaceFieldErrors } from "../../lib/prototype/inspector-workspace-validation";
import type { WorkflowTask } from "../../lib/prototype/tasks-storage";

const BOUNDARY_KEYS: InspectorBoundaryKey[] = [
  "north",
  "south",
  "east",
  "west",
];

const BOUNDARY_ROW_MAP: Record<
  InspectorBoundaryKey,
  (typeof PROPERTY_BOUNDARY_ROWS)[number]
> = {
  north: PROPERTY_BOUNDARY_ROWS[0],
  south: PROPERTY_BOUNDARY_ROWS[1],
  east: PROPERTY_BOUNDARY_ROWS[2],
  west: PROPERTY_BOUNDARY_ROWS[3],
};

const TABLE_TH =
  "border border-border bg-surface-2 px-2.5 py-[7px] text-[11px] font-bold text-text-2";
const TABLE_TD = "border border-border px-2.5 py-1.5 align-middle text-[12px]";

const EDIT_CONTROL_CLASS =
  "w-full appearance-none rounded-lg border border-border-md bg-surface px-[11px] py-[7px] text-[12.5px] text-text font-inherit";

/** Case Study.html `insBadge`. */
function InsBadge({
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

function MobileInspectOsmMap({
  latitude,
  longitude,
  property,
  heightClass = "h-[180px]",
}: {
  latitude: string;
  longitude: string;
  property?: PoPropertyIntake | null;
  heightClass?: string;
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
  if (lat == null || lng == null) {
    return (
      <div className="rounded-xl border border-dashed border-border-2 bg-surface px-3 py-8 text-center text-[12px] text-text-3">
        حدّد موقعك لعرض الخريطة
      </div>
    );
  }
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${(lng - 0.006).toFixed(5)}%2C${(lat - 0.004).toFixed(5)}%2C${(lng + 0.006).toFixed(5)}%2C${(lat + 0.004).toFixed(5)}&layer=mapnik&marker=${lat}%2C${lng}`;
  return (
    <div className={cn("relative overflow-hidden rounded-lg border border-border", heightClass)}>
      <iframe
        title="خريطة المعاينة"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        className="block h-full w-full border-0"
        src={src}
      />
    </div>
  );
}

function arabicStepLabel(step: number | string): string {
  const n = typeof step === "number" ? step : Number.parseInt(String(step), 10);
  const map = ["١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩", "١٠"];
  if (Number.isFinite(n) && n >= 1 && n <= 10) return map[n - 1]!;
  return String(step);
}

function InspectorCard({
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
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={cn(
              "shrink-0 text-text-3 transition-transform duration-200",
              open && "rotate-180",
            )}
            aria-hidden
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
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
    <section className="mb-3 rounded-[12px] border border-border bg-surface px-4 py-3.5 shadow-none">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h4 className="m-0 text-[13px] font-bold text-heading">{title}</h4>
        <span className="flex-1" />
        {badge}
      </div>
      {children}
    </section>
  );
}

export function FieldInspectionWorkBody({
  def,
  task,
  hostRef,
  submitting = false,
  beforeSubmitFooter,
  onRegisterFailure,
  layout = "desktop",
  hideSubmitFooter = false,
}: {
  def: PartyTaskPageDef;
  task: WorkflowTask;
  hostRef: RefObject<FieldInspectionWorkHostRef | null>;
  submitting?: boolean;
  beforeSubmitFooter?: ReactNode;
  onRegisterFailure?: () => void;
  layout?: "desktop" | "mobile";
  hideSubmitFooter?: boolean;
}) {
  void def;
  const mobile = layout === "mobile";
  const { role } = usePrototype();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const propertyId = task.propertyId ?? "";
  const { data: record } = usePoRecordQuery(task.poNumber);
  const property = record?.properties.find((p) => p.id === propertyId);
  const keyAvailability = useInspectorKeyAvailability(task);
  const [mapUrlDraft, setMapUrlDraft] = useState("");
  const [savingMapUrl, setSavingMapUrl] = useState(false);

  const [draft, setDraft] = useState<InspectorWorkspaceDraft | null>(null);
  const [fieldErrors, setFieldErrors] = useState<InspectorWorkspaceFieldErrors>(
    {},
  );
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!propertyId) return;
    let cancelled = false;
    void getOrCreateInspectorWorkspace({
      taskId: task.id,
      propertyId,
      poNumber: task.poNumber,
      propertyDisplayId:
        property != null
          ? formatPropertyDeedDisplay(property)
          : `خانة ${task.propertyOrdinal}`,
      property: property ?? null,
    }).then((next) => {
      if (!cancelled && next) setDraft(next);
    });
    return () => {
      cancelled = true;
    };
  }, [task.id, task.poNumber, task.propertyOrdinal, propertyId, property]);

  useEffect(() => {
    setMapUrlDraft(property?.locationMapUrl ?? "");
  }, [property?.locationMapUrl, propertyId]);

  const locked =
    task.status === "completed" ||
    (draft ? isInspectorWorkspaceLocked(draft.status) : false);
  const informalGate = informalAccessGate({
    role,
    planNumber: property?.planNumber,
    plotNumber: property?.plotNumber,
    locationMapUrl: property?.locationMapUrl,
  });
  const informalBlocksAccess =
    !informalGate.ready && !roleBypassesDocumentaryGates(role);
  const workLocked = locked || informalBlocksAccess;
  const boundariesUnavailable = property
    ? boundariesMarkedUnavailable(property.boundariesAvailability)
    : false;

  const persist = useCallback(
    (patch: Parameters<typeof updateInspectorWorkspace>[1]) => {
      if (!task.id || workLocked) return;
      void updateInspectorWorkspace(task.id, patch)
        .then((next) => {
          if (next) setDraft(next);
        })
        .catch((err: unknown) => {
          showToast(
            err instanceof Error ? err.message : "تعذّر حفظ المعاينة — حاول مرة أخرى",
            "error",
          );
        });
    },
    [task.id, workLocked, showToast],
  );

  const saveDraft = useCallback(async (): Promise<boolean> => {
    if (!draft || locked) return false;
    hostRef.current?.onSavingChange?.(true);
    try {
      const next = await saveInspectorWorkspaceDraft(draft);
      setDraft(next);
      setFormError(null);
      showToast("تم حفظ مسودة المعاينة.", "success");
      return true;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "تعذّر حفظ المسودة — حاول مرة أخرى";
      setFormError(message);
      showToast(message, "error");
      return false;
    } finally {
      hostRef.current?.onSavingChange?.(false);
    }
  }, [draft, locked, hostRef, showToast]);

  const submit = useCallback(async (): Promise<boolean> => {
    if (!draft || locked) return false;

    if (informalBlocksAccess && !informalGate.ready) {
      setFormError(informalGate.reason);
      showToast(informalGate.reason, "error");
      return false;
    }

    const keyGate = inspectorKeySubmitGate({
      role,
      vacantLand: draft.vacantLand,
      keyAvailable: keyAvailability.keyAvailable,
    });
    if (!keyGate.ready) {
      setFormError(keyGate.reason);
      showToast(keyGate.reason, "error");
      onRegisterFailure?.();
      return false;
    }

    const hasPhone = hasAnyPartyPhone(property?.contacts);
    const phoneGate = declarationPhoneGate({
      role,
      hasPhone,
      phoneWasPresentAtDeclaration: draft.declarationPhoneSatisfied,
    });
    if (draft.clientDeclarationSigned && !phoneGate.ready) {
      setFormError(phoneGate.reason);
      showToast(phoneGate.reason, "error");
      return false;
    }

    const errors = validateInspectorWorkspace(draft, {
      boundariesUnavailable,
    });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      const message = firstInspectorWorkspaceError(errors);
      setFormError(message);
      showToast(message ?? "يرجى تصحيح الحقول", "error");
      return false;
    }

    hostRef.current?.onSavingChange?.(true);
    setFormError(null);
    const patched = await updateInspectorWorkspace(task.id, {
      vacantLand: draft.vacantLand,
      keyAvailable: keyAvailability.keyAvailable,
      clientDeclarationSigned: draft.clientDeclarationSigned,
      declarationPhoneSatisfied:
        draft.declarationPhoneSatisfied ||
        (draft.clientDeclarationSigned && hasPhone),
    });
    if (patched) setDraft(patched);
    const result = await finalizeInspectorWorkspace(task.id);
    hostRef.current?.onSavingChange?.(false);

    if (result.ok) {
      setDraft(result.draft);
      hostRef.current?.onSubmitted?.();
      return true;
    }

    if (result.errors) {
      setFieldErrors(result.errors as InspectorWorkspaceFieldErrors);
    }
    setFormError(result.message);
    showToast(result.message, "error");
    return false;
  }, [
    draft,
    locked,
    hostRef,
    task.id,
    showToast,
    role,
    property,
    keyAvailability.keyAvailable,
    boundariesUnavailable,
    onRegisterFailure,
    informalBlocksAccess,
    informalGate.ready ? undefined : informalGate.reason,
  ]);

  async function saveLocationMapUrl() {
    if (!property || locked || savingMapUrl) return;
    if (!roleCanSetLocationMapUrl(role)) {
      showToast("لا صلاحية لحفظ رابط الموقع لهذا الدور.", "error");
      return;
    }
    setSavingMapUrl(true);
    try {
      const result = await updatePropertyLocationMapUrlInPo(
        task.poNumber,
        property.id,
        mapUrlDraft.trim(),
      );
      if (!result.ok) {
        showToast(result.error || "تعذّر حفظ رابط الموقع", "error");
        return;
      }
      await queryClient.invalidateQueries({
        queryKey: prototypeKeys.poRecord(task.poNumber),
      });
      showToast("تم حفظ رابط موقع الخريطة", "success");
    } finally {
      setSavingMapUrl(false);
    }
  }

  useEffect(() => {
    if (!hostRef.current) return;
    hostRef.current.submit = submit;
    hostRef.current.saveDraft = saveDraft;
    hostRef.current.focusNotes = () => {
      const field = document.getElementById("ins-asset-notes") as
        | HTMLTextAreaElement
        | null;
      if (!field) return;
      field.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => field.focus(), 120);
    };
  }, [hostRef, submit, saveDraft]);

  const captureDeviceGps = useCallback(() => {
    if (!navigator.geolocation) {
      showToast("المتصفح لا يدعم تحديد الموقع", "error");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        persist({
          mapLatitude: pos.coords.latitude.toFixed(5),
          mapLongitude: pos.coords.longitude.toFixed(5),
        });
        showToast("تم التقاط موقعك الحالي", "success");
      },
      () => {
        showToast("تعذّر التقاط الموقع — تأكد من صلاحية الموقع", "error");
      },
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  }, [persist, showToast]);

  const scrollToErrorTarget = useCallback((targetId: string) => {
    const target = document.getElementById(targetId);
    if (!target) return;

    let scrollContainer = target.parentElement;
    while (scrollContainer) {
      const overflowY = window.getComputedStyle(scrollContainer).overflowY;
      if (overflowY === "auto" || overflowY === "scroll") break;
      scrollContainer = scrollContainer.parentElement;
    }

    if (scrollContainer) {
      const targetRect = target.getBoundingClientRect();
      const containerRect = scrollContainer.getBoundingClientRect();
      const centeredOffset = Math.max(
        0,
        (containerRect.height - targetRect.height) / 2,
      );
      const top =
        scrollContainer.scrollTop +
        targetRect.top -
        containerRect.top -
        centeredOffset;

      scrollContainer.scrollTo({
        top: Math.max(0, top),
        behavior: "smooth",
      });
    }

    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      target instanceof HTMLButtonElement
    ) {
      target.focus({ preventScroll: true });
    }
  }, []);

  const errorLinks: {
    key: string;
    message: string;
    targetId: string;
  }[] = [];
  if (fieldErrors.inspectionDate) {
    errorLinks.push({
      key: "inspectionDate",
      message: fieldErrors.inspectionDate,
      targetId: "ins-date",
    });
  }
  if (fieldErrors.inspectionTime) {
    errorLinks.push({
      key: "inspectionTime",
      message: fieldErrors.inspectionTime,
      targetId: "ins-time",
    });
  }
  if (fieldErrors.mapLatitude) {
    errorLinks.push({
      key: "mapLatitude",
      message: fieldErrors.mapLatitude,
      targetId: "ins-map-section",
    });
  }
  if (fieldErrors.definedPhotos) {
    errorLinks.push({
      key: "definedPhotos",
      message: fieldErrors.definedPhotos,
      targetId: "ins-defined-photos",
    });
  }
  if (fieldErrors.observations) {
    errorLinks.push({
      key: "observations",
      message: fieldErrors.observations,
      targetId: "ins-observations",
    });
  }
  if (fieldErrors.inspectionConfirmed) {
    errorLinks.push({
      key: "inspectionConfirmed",
      message: fieldErrors.inspectionConfirmed,
      targetId: "ins-confirm",
    });
  }

  if (!draft) {
    return <InlineLoadingSkeleton />;
  }

  const liveDraft = draft;
  const photoStamp = inspectorPhotoStampText(liveDraft);
  const photoCoverage = inspectorPhotoCoverageLabel(liveDraft);
  const cardLayout = layout;

  return (
    <div className={cn(mobile ? "min-h-full bg-[var(--bg)] pb-2" : "pb-4")}>
      {/* Case Study.html pdInspectionHtml edit banner */}
      {!mobile && !locked ? (
        <div className="mb-3.5 flex flex-col gap-3 rounded-lg border border-[color-mix(in_srgb,var(--gold)_35%,transparent)] bg-[color-mix(in_srgb,var(--gold)_10%,transparent)] px-3.5 py-[11px] sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-2.5">
          <div className="text-xs leading-relaxed text-text-2">
            <strong className="text-gold-d">وضع الإدخال</strong> — تُدخل
            بيانات المعاينة الميدانية وتُرسل بعد اكتمالها.
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="primary"
              loading={submitting}
              disabled={submitting || workLocked}
              onClick={() => void hostRef.current?.submit?.()}
            >
              حفظ وإرسال
            </Button>
            {onRegisterFailure ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={submitting || workLocked}
                onClick={onRegisterFailure}
              >
                تسجيل تعذر
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={submitting || workLocked}
              onClick={() => void saveDraft()}
            >
              حفظ مسودة
            </Button>
          </div>
        </div>
      ) : null}

      {locked ? (
        <Note tone="success" className={cn("mb-4", mobile && "mx-4 mt-3")}>
          تم إرسال المعاينة — النموذج للقراءة فقط.
        </Note>
      ) : null}

      {informalBlocksAccess && !informalGate.ready ? (
        <Note tone="warn" className={cn("mb-4", mobile && "mx-4 mt-3")}>
          <strong>الوصول مقفول — منطقة عشوائية.</strong>{" "}
          {informalGate.reason} احفظ رابط الخريطة أدناه لفتح نموذج المعاينة.
        </Note>
      ) : null}

      {property &&
      isInformalSettlement(property.planNumber, property.plotNumber) &&
      roleCanSetLocationMapUrl(role) ? (
        <div
          className={cn(
            "mb-4 rounded-lg border border-border bg-surface-2 p-3",
            mobile && "mx-4",
          )}
        >
          <Label className="text-[11px] font-semibold text-text-2">
            رابط موقع الخريطة (عشوائي)
          </Label>
          <p className="mt-1 text-[10px] text-text-3">
            العقار بدون رقم مخطط وقطعة — أدخل رابط خريطة لفتح الوصول.
          </p>
          <Input
            className="mt-2"
            dir="ltr"
            value={mapUrlDraft}
            disabled={locked}
            placeholder="https://maps.google.com/..."
            onChange={(e) => setMapUrlDraft(e.target.value)}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2"
            loading={savingMapUrl}
            disabled={locked || savingMapUrl}
            onClick={() => void saveLocationMapUrl()}
          >
            حفظ رابط الموقع
          </Button>
        </div>
      ) : null}

      {draft.status === "reopened" && draft.returnNote?.trim() ? (
        <Note tone="warn" className={cn("mb-4", mobile && "mx-4 mt-3")}>
          <strong>{inspectorWorkspaceStatusLabel("reopened")}</strong> —{" "}
          {draft.returnNote.trim()}
        </Note>
      ) : null}

      {formError ? (
        <Note tone="warn" role="alert" className={cn("mb-4", mobile && "mx-4 mt-3")}>
          <div className="flex flex-col gap-2">
            <p className="m-0">{formError}</p>
            {errorLinks.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] text-text-2">
                  اضغط على الخطأ للانتقال مباشرة إلى مكانه:
                </span>
                <div className="flex flex-col gap-2">
                  {errorLinks.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      className="flex w-full items-start justify-between gap-3 rounded-xl border border-[#F5C2C7] bg-white px-3 py-2 text-right text-[11px] text-danger-text transition-colors hover:bg-[#FFF5F5]"
                      onClick={() => scrollToErrorTarget(item.targetId)}
                    >
                      <span className="min-w-0 flex-1 leading-5 break-words">
                        {item.message}
                      </span>
                      <span className="shrink-0 text-[10px] text-text-3">
                        فتح
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </Note>
      ) : null}

      <fieldset
        disabled={workLocked}
        className={cn(
          "m-0 min-w-0 border-0 p-0 [&_*]:min-w-0",
          workLocked &&
            "pointer-events-none select-none rounded-[10px] bg-[#F1F5F9] p-3 opacity-70 grayscale-[0.35]",
        )}
      >
        <div id="ins-map-section">
        <InspectorCard
          title="بيانات المعاينة"
          icon="ti-clipboard-check"
          badge={mobile ? undefined : <InsBadge label="إلزامي" tone="danger" />}
          layout={cardLayout}
          step={mobile ? 1 : undefined}
          subtitle={mobile ? "موقع GPS للعقار" : undefined}
          defaultOpen
        >
          {mobile ? (
            <div className="mb-2 text-[13px] font-bold text-heading">
              موقع العقار (GPS)
            </div>
          ) : (
            <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold text-text-2">
                موقع العقار على الخريطة (GPS)
              </span>
              <InsBadge label="مشترك" tone="purple" />
              <span className="text-[10.5px] text-text-3">
                — إثبات النزول الميداني
              </span>
            </div>
          )}
          {mobile ? (
            <button
              type="button"
              disabled={locked}
              className="mb-2.5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-[1.5px] border-ink bg-[color-mix(in_srgb,var(--ink)_7%,transparent)] font-inherit text-[14px] font-bold text-ink"
              onClick={captureDeviceGps}
            >
              <i className="ti ti-current-location text-base" aria-hidden />
              تحديد موقعي الحالي
            </button>
          ) : null}
          {!mobile ? (
            <div className="mb-2.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="min-w-0">
                <div className="mb-1 text-[11px] font-semibold text-text-2">
                  خط العرض
                </div>
                <Input
                  id="ins-lat"
                  dir="ltr"
                  className={EDIT_CONTROL_CLASS}
                  disabled={locked}
                  value={draft.mapLatitude}
                  placeholder={JEDDAH_DEFAULT_LAT}
                  onChange={(e) => persist({ mapLatitude: e.target.value })}
                />
              </div>
              <div className="min-w-0">
                <div className="mb-1 text-[11px] font-semibold text-text-2">
                  خط الطول
                </div>
                <Input
                  id="ins-lng"
                  dir="ltr"
                  className={EDIT_CONTROL_CLASS}
                  disabled={locked}
                  value={draft.mapLongitude}
                  placeholder={JEDDAH_DEFAULT_LNG}
                  onChange={(e) => persist({ mapLongitude: e.target.value })}
                />
              </div>
            </div>
          ) : null}
          {fieldErrors.mapLatitude ? (
            <p className="mb-3 text-[11px] text-danger-text" role="alert">
              {fieldErrors.mapLatitude}
            </p>
          ) : null}
          <MobileInspectOsmMap
            latitude={draft.mapLatitude}
            longitude={draft.mapLongitude}
            property={property}
            heightClass={mobile ? "h-[180px] rounded-xl" : "h-[200px]"}
          />
          {mobile ? (
            <div className="mt-1.5 text-center text-[12px] text-text-3" dir="ltr">
              {draft.mapLatitude && draft.mapLongitude
                ? `${draft.mapLatitude}, ${draft.mapLongitude}`
                : "—"}
            </div>
          ) : null}
        </InspectorCard>
        </div>

        <InspectorCard
          title={mobile ? "خصائص العقار" : "نموذج التحقق الميداني — خصائص العقار"}
          icon="ti-list-check"
          layout={cardLayout}
          step={mobile ? 2 : undefined}
          subtitle={mobile ? `${INSPECTOR_FEATURE_FIELDS.length} خاصية` : undefined}
          defaultOpen={!mobile}
        >
          {/* Desktop: table */}
          <div className={cn("overflow-x-auto", mobile && "hidden")}>
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr>
                  <th className={cn(TABLE_TH, "w-8 text-center")}>#</th>
                  <th className={cn(TABLE_TH, "text-right")}>الحقل</th>
                  <th className={cn(TABLE_TH, "w-[180px] text-center")}>القيمة</th>
                  <th className={cn(TABLE_TH, "w-[140px] text-center")}>صورة</th>
                </tr>
              </thead>
              <tbody>
                {INSPECTOR_FEATURE_FIELDS.map((field, index) => {
                  const value = draft.featureValues[field.key] ?? "";
                  const attachment = draft.featurePhotoAttachments[field.key];
                  const photoRef = `feature:${field.key}`;
                  return (
                    <tr key={field.key}>
                      <td className={cn(TABLE_TD, "text-center text-[11px] text-text-3")}>
                        {index + 1}
                      </td>
                      <td className={TABLE_TD}>
                        {field.label}
                        {field.shared ? (
                          <InsBadge label="مشترك" tone="purple" />
                        ) : null}
                      </td>
                      <td className={TABLE_TD}>
                        <Select
                          value={value}
                          onChange={(e) => {
                            const next = e.target.value;
                            persist({
                              featureValues: {
                                ...draft.featureValues,
                                [field.key]: next,
                              },
                              featurePhotoAttachments: {
                                ...draft.featurePhotoAttachments,
                                [field.key]:
                                  inspectorFeatureRequiresPhoto(field, next)
                                    ? draft.featurePhotoAttachments[field.key]
                                    : null,
                              },
                            });
                            if (!inspectorFeatureRequiresPhoto(field, next)) {
                              clearInspectorPhotoDataUrl(draft.taskId, photoRef);
                            }
                          }}
                          className={cn(formControlClassName, "text-xs")}
                        >
                          <option value="">— اختر —</option>
                          {field.options.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td className={cn(TABLE_TD, "text-center")}>
                        {inspectorFeatureRequiresPhoto(field, value) ? (
                          attachment?.fileName ? (
                            <InspectorStampedPhotoThumb
                              compact
                              stamp={photoStamp}
                              taskId={draft.taskId}
                              photoRef={photoRef}
                              attachment={attachment}
                              onClear={
                                locked
                                  ? undefined
                                  : () => {
                                      clearInspectorPhotoDataUrl(
                                        draft.taskId,
                                        photoRef,
                                      );
                                      persist({
                                        featurePhotoAttachments: {
                                          ...draft.featurePhotoAttachments,
                                          [field.key]: null,
                                        },
                                      });
                                    }
                              }
                            />
                          ) : (
                            <InspectorPhotoFilePicker
                              label="إرفاق صورة"
                              disabled={locked}
                              className="w-auto"
                              onFilesSelected={async (files) => {
                                const file = files[0];
                                if (!file) return false;
                                const result =
                                  await uploadInspectorPhotoFromFile(
                                    draft.taskId,
                                    photoRef,
                                    file,
                                    {
                                      draft: liveDraft,
                                      deedNumber: property?.deedNumber,
                                    },
                                  );
                                if (!result.ok) {
                                  showToast(result.error, "error");
                                  return false;
                                }
                                persist({
                                  featurePhotoAttachments: {
                                    ...draft.featurePhotoAttachments,
                                    [field.key]: result.attachment,
                                  },
                                });
                              }}
                            />
                          )
                        ) : (
                          <span className="text-xs text-text-3">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile: pills / suggest+search (HTML renderInspectMobile) */}
          <div className={cn("flex flex-col", !mobile && "hidden")}>
            {INSPECTOR_FEATURE_FIELDS.map((field, fi) => {
              const value = draft.featureValues[field.key] ?? "";
              const attachment = draft.featurePhotoAttachments[field.key];
              const photoRef = `feature:${field.key}`;
              const needsPhoto = inspectorFeatureRequiresPhoto(field, value);
              const usePills = featureUsesPills(field);

              function setFeatureValue(next: string) {
                persist({
                  featureValues: {
                    ...liveDraft.featureValues,
                    [field.key]: next,
                  },
                  featurePhotoAttachments: {
                    ...liveDraft.featurePhotoAttachments,
                    [field.key]: inspectorFeatureRequiresPhoto(field, next)
                      ? liveDraft.featurePhotoAttachments[field.key]
                      : null,
                  },
                });
                if (!inspectorFeatureRequiresPhoto(field, next)) {
                  clearInspectorPhotoDataUrl(liveDraft.taskId, photoRef);
                }
              }

              return (
                <div key={field.key} className="mb-4">
                  <MobileFieldLabel shared={field.shared}>
                    {field.label}
                  </MobileFieldLabel>
                  {usePills ? (
                    <MobilePills
                      options={field.options}
                      value={value}
                      disabled={locked}
                      onChange={setFeatureValue}
                    />
                  ) : (
                    <>
                      <MobileSuggestRow
                        fieldKey={field.key}
                        value={value}
                        disabled={locked}
                        onPick={setFeatureValue}
                      />
                      <MobileSearchSelect
                        options={field.options}
                        value={value}
                        disabled={locked}
                        onChange={setFeatureValue}
                      />
                    </>
                  )}
                  {needsPhoto ? (
                    <div className="mt-2.5">
                      {attachment?.fileName ? (
                        <InspectorStampedPhotoThumb
                          stamp={photoStamp}
                          taskId={draft.taskId}
                          photoRef={photoRef}
                          attachment={attachment}
                          onClear={
                            locked
                              ? undefined
                              : () => {
                                  clearInspectorPhotoDataUrl(
                                    draft.taskId,
                                    photoRef,
                                  );
                                  persist({
                                    featurePhotoAttachments: {
                                      ...draft.featurePhotoAttachments,
                                      [field.key]: null,
                                    },
                                  });
                                }
                          }
                        />
                      ) : (
                        <InspectorPhotoFilePicker
                          label="صورة إثبات مطلوبة — التقاط *"
                          disabled={locked}
                          className="[&_button]:min-h-12 [&_button]:rounded-xl [&_button]:border-[1.5px] [&_button]:border-dashed [&_button]:border-[var(--gold-d,#a4906f)] [&_button]:bg-[color-mix(in_srgb,var(--gold)_8%,transparent)] [&_button]:text-[13.5px] [&_button]:font-bold [&_button]:text-[var(--gold-d,#a4906f)]"
                          onFilesSelected={async (files) => {
                            const file = files[0];
                            if (!file) return false;
                            const result = await uploadInspectorPhotoFromFile(
                              draft.taskId,
                              photoRef,
                              file,
                              {
                                draft: liveDraft,
                                deedNumber: property?.deedNumber,
                              },
                            );
                            if (!result.ok) {
                              showToast(result.error, "error");
                              return false;
                            }
                            persist({
                              featurePhotoAttachments: {
                                ...draft.featurePhotoAttachments,
                                [field.key]: result.attachment,
                              },
                            });
                          }}
                        />
                      )}
                    </div>
                  ) : null}
                  {fi === 0 && value !== "أرض" ? (
                    <div className="mt-4">
                      <MobileFieldLabel shared>
                        عمر العقار (سنوات)
                      </MobileFieldLabel>
                      <MobileCountStepper
                        label="العمر"
                        value={draft.propertyAgeYears}
                        disabled={locked}
                        onChange={(v) => persist({ propertyAgeYears: v })}
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          {fieldErrors.featurePhotos ? (
            <p className="mt-2 text-[10px] text-danger-text" role="alert">
              {fieldErrors.featurePhotos}
            </p>
          ) : null}
        </InspectorCard>

        <InspectorCard
          title="الموقع والوصول"
          icon="ti-road"
          badge={mobile ? undefined : <InsBadge label="إدخال ميداني" tone="danger" />}
          layout={cardLayout}
          step={mobile ? 3 : undefined}
          subtitle={mobile ? "الشارع وطريقة الوصول" : undefined}
        >
          {mobile ? (
            <div className="grid gap-3.5">
              <div>
                <MobileFieldLabel>اسم الشارع</MobileFieldLabel>
                <Input
                  id="ins-street"
                  value={draft.streetName}
                  disabled={locked}
                  onChange={(e) => persist({ streetName: e.target.value })}
                  className={mobileControlClassName}
                />
              </div>
              <div>
                <MobileFieldLabel>أقرب شارع رئيسي</MobileFieldLabel>
                <Input
                  id="ins-main-street"
                  value={draft.mainStreetName}
                  disabled={locked}
                  onChange={(e) => persist({ mainStreetName: e.target.value })}
                  className={mobileControlClassName}
                />
              </div>
              <div>
                <MobileFieldLabel>عرض الشارع الرئيسي (م)</MobileFieldLabel>
                <Input
                  id="ins-street-width"
                  type="number"
                  value={draft.streetWidthM}
                  disabled={locked}
                  onChange={(e) => persist({ streetWidthM: e.target.value })}
                  className={mobileControlClassName}
                />
              </div>
              <div>
                <MobileFieldLabel>طريقة الوصول</MobileFieldLabel>
                <Textarea
                  id="ins-access"
                  rows={2}
                  value={draft.accessRouteDescription}
                  disabled={locked}
                  onChange={(e) =>
                    persist({ accessRouteDescription: e.target.value })
                  }
                  className={cn(mobileControlClassName, "min-h-[72px] resize-y")}
                />
              </div>
            </div>
          ) : (
            <>
              <FormRow className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                <RegField
                  id="ins-street"
                  label="اسم الشارع"
                  value={draft.streetName}
                  onChange={(v) => persist({ streetName: v })}
                />
                <RegField
                  id="ins-main-street"
                  label="أقرب شارع رئيسي"
                  value={draft.mainStreetName}
                  onChange={(v) => persist({ mainStreetName: v })}
                />
                <RegField
                  id="ins-street-width"
                  label="عرض الشارع (م)"
                  type="number"
                  value={draft.streetWidthM}
                  onChange={(v) => persist({ streetWidthM: v })}
                />
              </FormRow>
              <RegTextarea
                id="ins-access"
                label="طريقة الوصول للعقار"
                rows={3}
                className="mt-3"
                value={draft.accessRouteDescription}
                onChange={(v) => persist({ accessRouteDescription: v })}
              />
            </>
          )}
        </InspectorCard>

        <InspectorCard
          title="مكوّنات العقار"
          icon="ti-building-estate"
          badge={mobile ? undefined : <InsBadge label="إدخال ميداني" tone="danger" />}
          layout={cardLayout}
          step={mobile ? 4 : undefined}
          subtitle={mobile ? "الغرف والمرافق" : undefined}
        >
          <FormRow className={cn("grid-cols-1", !mobile && "sm:grid-cols-2 lg:grid-cols-3")}>
            {(
              [
                ["roomCount", "عدد الغرف", null],
                ["hallCount", "عدد الصالات", null],
                ["unitCount", "عدد الشقق", null],
                ["bathroomCount", "عدد دورات المياه", null],
                [
                  "showroomCount",
                  "عدد المعارض",
                  {
                    photoKey: "showroom" as InspectorComponentPhotoKey,
                    photoLabel: "إرفاق صورة للمعرض التجاري",
                  },
                ],
                [
                  "wellCount",
                  "عدد الآبار",
                  {
                    photoKey: "well" as InspectorComponentPhotoKey,
                    photoLabel: "إرفاق صورة البئر",
                  },
                ],
                ["towerCount", "عدد الأبراج", null],
                ["propertyAgeYears", "عمر العقار (سنوات)", null],
              ] as const
            )
              .filter(([key]) => !(mobile && key === "propertyAgeYears"))
              .map(([key, label, photoMeta]) => {
              if (key === "propertyAgeYears") {
                return (
                  <div key={key}>
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <label
                        htmlFor="ins-propertyAgeYears"
                        className="text-[11px] font-semibold text-text-2"
                      >
                        {label}
                      </label>
                      <InsBadge label="مشترك" tone="purple" />
                    </div>
                    <Input
                      id="ins-propertyAgeYears"
                      type="number"
                      value={draft.propertyAgeYears}
                      onChange={(e) =>
                        persist({ propertyAgeYears: e.target.value })
                      }
                      className="text-xs"
                    />
                  </div>
                );
              }

              const value = draft[key];
              const count = photoMeta ? parseInspectorCount(value) : 0;
              const attachment = photoMeta
                ? draft.componentPhotoAttachments[photoMeta.photoKey]
                : null;
              const photoRef = photoMeta
                ? `component:${photoMeta.photoKey}`
                : "";

              function setCount(next: string) {
                const patch: Partial<InspectorWorkspaceDraft> = {
                  [key]: next,
                };
                if (photoMeta && parseInspectorCount(next) === 0) {
                  clearInspectorPhotoDataUrl(liveDraft.taskId, photoRef);
                  patch.componentPhotoAttachments = {
                    ...liveDraft.componentPhotoAttachments,
                    [photoMeta.photoKey]: null,
                  };
                }
                persist(patch);
              }

              return (
                <div key={key}>
                  {mobile ? (
                    <MobileCountStepper
                      label={label}
                      value={value}
                      disabled={locked}
                      onChange={setCount}
                    />
                  ) : (
                    <RegField
                      id={`ins-${key}`}
                      label={label}
                      type="number"
                      value={value}
                      onChange={setCount}
                    />
                  )}
                  {photoMeta && count > 0 ? (
                    <div className="mt-1.5">
                      {attachment?.fileName ? (
                        <InspectorStampedPhotoThumb
                          compact
                          stamp={photoStamp}
                          taskId={draft.taskId}
                          photoRef={photoRef}
                          attachment={attachment}
                          onClear={
                            locked
                              ? undefined
                              : () => {
                                  clearInspectorPhotoDataUrl(
                                    draft.taskId,
                                    photoRef,
                                  );
                                  persist({
                                    componentPhotoAttachments: {
                                      ...draft.componentPhotoAttachments,
                                      [photoMeta.photoKey]: null,
                                    },
                                  });
                                }
                          }
                        />
                      ) : (
                        <InspectorPhotoFilePicker
                          label={photoMeta.photoLabel}
                          disabled={locked}
                          className="w-auto"
                          onFilesSelected={async (files) => {
                            const file = files[0];
                            if (!file) return false;
                            const result = await uploadInspectorPhotoFromFile(
                              draft.taskId,
                              photoRef,
                              file,
                              {
                                draft: liveDraft,
                                deedNumber: property?.deedNumber,
                              },
                            );
                            if (!result.ok) {
                              showToast(result.error, "error");
                              return false;
                            }
                            persist({
                              componentPhotoAttachments: {
                                ...draft.componentPhotoAttachments,
                                [photoMeta.photoKey]: result.attachment,
                              },
                            });
                          }}
                        />
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
            <div className={cn(mobile && "mt-4")}>
              {mobile ? (
                <>
                  <MobileFieldLabel>هل يوجد ملحق؟</MobileFieldLabel>
                  <MobilePills
                    options={["نعم", "لا"]}
                    value={draft.hasAnnex}
                    disabled={locked}
                    onChange={(next) =>
                      persist({
                        hasAnnex: next as InspectorWorkspaceDraft["hasAnnex"],
                      })
                    }
                  />
                </>
              ) : (
                <>
                  <label
                    htmlFor="ins-has-annex"
                    className="mb-1 block text-[11px] font-semibold text-text-2"
                  >
                    يوجد ملاحق؟
                  </label>
                  <Select
                    id="ins-has-annex"
                    value={draft.hasAnnex}
                    onChange={(e) =>
                      persist({
                        hasAnnex: e.target.value as InspectorWorkspaceDraft["hasAnnex"],
                      })
                    }
                    className={cn(formControlClassName, "text-xs")}
                  >
                    <option value="">— اختر —</option>
                    <option value="نعم">نعم</option>
                    <option value="لا">لا</option>
                  </Select>
                </>
              )}
            </div>
          </FormRow>
          {fieldErrors.componentPhotos ? (
            <p className="mt-2 text-[10px] text-danger-text" role="alert">
              {fieldErrors.componentPhotos}
            </p>
          ) : null}
        </InspectorCard>

        <InspectorCard
          title={mobile ? "مساحات المباني" : "مساحات المباني"}
          icon="ti-ruler-measure"
          badge={mobile ? undefined : <InsBadge label="إدخال ميداني" tone="danger" />}
          layout={cardLayout}
          step={mobile ? 5 : undefined}
          subtitle={mobile ? "م²" : undefined}
        >
          {mobile ? (
            <div className="grid gap-3.5">
              {(
                [
                  ["builtArea", "مساحة البناء (م²)"],
                  ["buildingFloors", "عدد أدوار المباني"],
                  ["basementTotal", "إجمالي مساحة القبو (م²)"],
                  ["annexTotal", "إجمالي مساحة اللاحق (م²)"],
                  ["buildingsTotal", "إجمالي مساحة المباني (م²)"],
                ] as const
              ).map(([key, label]) => (
                <div key={key}>
                  <MobileFieldLabel>{label}</MobileFieldLabel>
                  <Input
                    id={`ins-${key}`}
                    type="number"
                    value={draft[key]}
                    disabled={locked}
                    onChange={(e) => persist({ [key]: e.target.value })}
                    className={mobileControlClassName}
                  />
                </div>
              ))}
            </div>
          ) : (
            <FormRow className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {(
                [
                  ["builtArea", "مساحة البناء (م²)"],
                  ["buildingFloors", "عدد أدوار المباني"],
                  ["basementTotal", "إجمالي مساحة القبو (م²)"],
                  ["annexTotal", "إجمالي مساحة اللاحق (م²)"],
                  ["buildingsTotal", "إجمالي مساحة المباني (م²)"],
                ] as const
              ).map(([key, label]) => (
                <RegField
                  key={key}
                  id={`ins-${key}`}
                  label={label}
                  type="number"
                  value={draft[key]}
                  onChange={(v) => persist({ [key]: v })}
                />
              ))}
            </FormRow>
          )}
        </InspectorCard>

        {!boundariesUnavailable && property ? (
          <InspectorCard
            title="الحدود والأطوال"
            icon="ti-vector"
            badge={
              mobile ? undefined : (
                <InsBadge
                  label="للمطابقة — المصدر: الأخصائي (البورصة)"
                  tone="info"
                />
              )
            }
            layout={cardLayout}
            step={mobile ? 6 : undefined}
            subtitle={mobile ? "مطابقة الصك" : undefined}
          >
            {mobile ? null : (
              <p className="mb-3 text-[11px] text-text-3">
                الحدود والأطوال يُدخلها الأخصائي عند الاستعلام عن الصك من البورصة.
                دور المعاين هنا <strong>المطابقة واكتشاف الخطأ</strong> فقط — ويطابقها
                أيضاً المكتب الهندسي.
              </p>
            )}
            {BOUNDARY_KEYS.map((key) => {
              const row = BOUNDARY_ROW_MAP[key];
              const desc = property[row.descKey]?.trim() || "—";
              const len = property[row.lenKey]?.trim() || "—";
              const match = draft.boundaryMatches[key];
              if (mobile) {
                return (
                  <div
                    key={key}
                    className="border-b border-border py-3.5 last:border-b-0"
                  >
                    <div className="mb-2.5 flex items-start justify-between gap-2">
                      <span className="text-[14px] font-bold text-heading">
                        {row.label}
                      </span>
                      <span className="shrink-0 text-[13px] text-text-3">
                        {desc} · {len !== "—" ? `${len} م` : "—"}
                      </span>
                    </div>
                    <MobilePills
                      options={["مطابق", "عدم تطابق"]}
                      value={match.matches ? "مطابق" : "عدم تطابق"}
                      disabled={locked}
                      onChange={(next) =>
                        persist({
                          boundaryMatches: {
                            ...draft.boundaryMatches,
                            [key]: {
                              ...match,
                              matches: next === "مطابق",
                            },
                          },
                        })
                      }
                    />
                    {!match.matches ? (
                      <Input
                        placeholder="ملاحظة عدم التطابق"
                        value={match.mismatchNote}
                        disabled={locked}
                        onChange={(e) =>
                          persist({
                            boundaryMatches: {
                              ...draft.boundaryMatches,
                              [key]: {
                                ...match,
                                mismatchNote: e.target.value,
                              },
                            },
                          })
                        }
                        className={cn(mobileControlClassName, "mt-2")}
                      />
                    ) : null}
                  </div>
                );
              }
              return (
                <div
                  key={key}
                  className="grid grid-cols-1 items-start gap-3 border-b border-border py-2.5 last:border-b-0 md:grid-cols-[90px_1fr_90px_minmax(200px,250px)]"
                >
                  <span className="text-xs font-semibold text-text-2">
                    {row.label}
                  </span>
                  <span className="text-xs">{desc}</span>
                  <span className="text-xs font-semibold">
                    {len !== "—" ? `${len} م` : "—"}
                  </span>
                  <div>
                    <label className="flex min-h-9 cursor-pointer items-center gap-2.5">
                      <input
                        type="checkbox"
                        className="size-4"
                        checked={match.matches}
                        onChange={(e) =>
                          persist({
                            boundaryMatches: {
                              ...draft.boundaryMatches,
                              [key]: {
                                ...match,
                                matches: e.target.checked,
                              },
                            },
                          })
                        }
                      />
                      <span
                        className={cn(
                          "text-xs font-bold",
                          match.matches ? "text-teal-text" : "text-danger-text",
                        )}
                      >
                        {match.matches ? "مطابق" : "عدم تطابق"}
                      </span>
                    </label>
                    {!match.matches ? (
                      <Textarea
                        rows={2}
                        placeholder="ملاحظة عدم التطابق..."
                        value={match.mismatchNote}
                        onChange={(e) =>
                          persist({
                            boundaryMatches: {
                              ...draft.boundaryMatches,
                              [key]: {
                                ...match,
                                mismatchNote: e.target.value,
                              },
                            },
                          })
                        }
                        className={cn(formControlClassName, "mt-2 min-h-12 text-xs")}
                      />
                    ) : null}
                  </div>
                </div>
              );
            })}
          </InspectorCard>
        ) : null}

        <InspectorCard
          title={mobile ? "الخدمات والمرافق" : "الخدمات والمرافق المحيطة"}
          icon="ti-plug"
          badge={mobile ? undefined : <InsBadge label="اختيار متعدد" />}
          layout={cardLayout}
          step={mobile ? 7 : undefined}
          subtitle={mobile ? "اختيار متعدد" : undefined}
        >
          {mobile ? (
            <>
              <MobileFieldLabel>الخدمات المتوفرة</MobileFieldLabel>
              <MobileChips
                options={INSPECTOR_SERVICE_OPTIONS}
                selected={draft.services}
                disabled={locked}
                onChange={(services) => persist({ services })}
              />
              <div className="h-4" />
              <MobileFieldLabel>المرافق المحيطة</MobileFieldLabel>
              <MobileChips
                options={INSPECTOR_AMENITY_OPTIONS}
                selected={draft.amenities}
                disabled={locked}
                onChange={(amenities) => persist({ amenities })}
              />
            </>
          ) : (
            <>
              <p className="mb-2 text-[11px] font-semibold text-text-2">
                الخدمات المتوفرة
              </p>
              <MobileChips
                options={INSPECTOR_SERVICE_OPTIONS}
                selected={draft.services}
                disabled={locked}
                onChange={(services) => persist({ services })}
              />
              <p className="mb-2 mt-3.5 text-[11px] font-semibold text-text-2">
                المرافق المحيطة
              </p>
              <MobileChips
                options={INSPECTOR_AMENITY_OPTIONS}
                selected={draft.amenities}
                disabled={locked}
                onChange={(amenities) => persist({ amenities })}
              />
            </>
          )}
        </InspectorCard>

        <InspectorCard
          title="الوصف والملاحظات"
          icon="ti-notes"
          badge={mobile ? undefined : <InsBadge label="نص حر" />}
          layout={cardLayout}
          step={mobile ? 8 : undefined}
          subtitle={mobile ? "نص حر" : undefined}
        >
          {mobile ? (
            <div className="grid gap-3.5">
              <div>
                <MobileFieldLabel>وصف العقار</MobileFieldLabel>
                <Textarea
                  id="ins-desc"
                  rows={3}
                  value={draft.propertyDescription}
                  disabled={locked}
                  onChange={(e) =>
                    persist({ propertyDescription: e.target.value })
                  }
                  className={cn(mobileControlClassName, "min-h-[88px] resize-y")}
                />
              </div>
              <div>
                <MobileFieldLabel>إيجابيات وعيوب الحي</MobileFieldLabel>
                <Textarea
                  id="ins-pros-cons"
                  rows={3}
                  value={draft.districtProsCons}
                  disabled={locked}
                  onChange={(e) =>
                    persist({ districtProsCons: e.target.value })
                  }
                  className={cn(mobileControlClassName, "min-h-[88px] resize-y")}
                />
              </div>
            </div>
          ) : (
            <>
              <RegTextarea
                id="ins-desc"
                label="وصف العقار"
                rows={3}
                value={draft.propertyDescription}
                onChange={(v) => persist({ propertyDescription: v })}
              />
              <RegTextarea
                id="ins-pros-cons"
                label="الإيجابيات والعيوب الظاهرة على الحي"
                rows={3}
                className="mt-3"
                value={draft.districtProsCons}
                onChange={(v) => persist({ districtProsCons: v })}
              />
              <RegTextarea
                id="ins-asset-notes"
                label="ملاحظات على الأصل"
                rows={3}
                className="mt-3"
                value={draft.assetNotes}
                onChange={(v) => persist({ assetNotes: v })}
              />
            </>
          )}
        </InspectorCard>

        <div id="ins-defined-photos">
          <InspectorCard
            title={mobile ? "صور العقار" : "صور العقار الموثّقة"}
            icon="ti-photo"
            layout={cardLayout}
            step={mobile ? 9 : undefined}
            subtitle={mobile ? photoCoverage : undefined}
            badge={
              mobile ? undefined : (
                <InsBadge label={photoCoverage} tone="info" />
              )
            }
          >
            <InspectorDefinedPhotosSection
              draft={draft}
              disabled={locked}
              onPatch={(patch) => persist(patch)}
              bare
            />
          </InspectorCard>
          {fieldErrors.definedPhotos ? (
            <p className="-mt-2 mb-4 px-4 text-[10px] text-danger-text" role="alert">
              {fieldErrors.definedPhotos}
            </p>
          ) : null}
        </div>

        <div id="ins-observations">
        <InspectorCard
          title={mobile ? "الملاحظات المصوّرة" : "ملاحظات العقار الموثّقة بالصور"}
          icon="ti-camera-plus"
          badge={
            mobile ? undefined : (
              <InsBadge label="شرح + صورة لكل ملاحظة" tone="danger" />
            )
          }
          layout={cardLayout}
          step={mobile ? 10 : undefined}
          subtitle={mobile ? "شرح + صورة" : undefined}
        >
          {mobile ? null : (
            <p className="mb-3 text-[11px] leading-relaxed text-text-3">
              كل ملاحظة على العقار يجب أن تتضمّن{" "}
              <strong>شرحاً نصياً وصورة توثيقية بجانبها</strong>. أضِف ملاحظة
              منفصلة لكل عيب أو ميزة أو حالة تستدعي التوثيق — لا يُقبل إرسال
              المعاينة دون إرفاق صورة لكل ملاحظة.
            </p>
          )}
          {!mobile && draft.observations.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-text-3">
              لا توجد ملاحظات — اضغط «إضافة ملاحظة موثّقة».
            </p>
          ) : null}
          {draft.observations.map((obs) => {
            const obsPhotoRef = `observation:${obs.id}`;

            if (mobile) {
              return (
                <div
                  key={obs.id}
                  className="mb-2.5 flex gap-2.5 rounded-xl border border-border bg-surface-2 p-2.5"
                >
                  <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-[10px] border border-border bg-surface">
                    {obs.photo?.fileName ? (
                      <InspectorStampedPhotoThumb
                        stamp={photoStamp}
                        taskId={draft.taskId}
                        photoRef={obsPhotoRef}
                        attachment={obs.photo}
                        onClear={
                          locked
                            ? undefined
                            : () => {
                                clearInspectorPhotoDataUrl(
                                  draft.taskId,
                                  obsPhotoRef,
                                );
                                persist({
                                  observations: draft.observations.map((o) =>
                                    o.id === obs.id ? { ...o, photo: null } : o,
                                  ),
                                });
                              }
                        }
                      />
                    ) : (
                      <InspectorPhotoFilePicker
                        label="صورة"
                        disabled={locked}
                        className="size-full [&_button]:h-full [&_button]:min-h-0 [&_button]:border-0 [&_button]:bg-transparent [&_button]:px-0 [&_button]:py-0 [&_button]:text-[10px]"
                        onFilesSelected={async (files) => {
                          const file = files[0];
                          if (!file) return false;
                          const result = await uploadInspectorPhotoFromFile(
                            draft.taskId,
                            obsPhotoRef,
                            file,
                            {
                              draft: liveDraft,
                              deedNumber: property?.deedNumber,
                            },
                          );
                          if (!result.ok) {
                            showToast(result.error, "error");
                            return false;
                          }
                          persist({
                            observations: draft.observations.map((o) =>
                              o.id === obs.id
                                ? { ...o, photo: result.attachment }
                                : o,
                            ),
                          });
                        }}
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    {obs.category ? (
                      <span className="inline-block rounded-full bg-[var(--gold-soft,color-mix(in_srgb,var(--gold)_18%,transparent))] px-2.5 py-0.5 text-[11px] font-bold text-[var(--gold-d,#a4906f)]">
                        {obs.category}
                      </span>
                    ) : (
                      <div className="mb-1 flex flex-wrap gap-1.5">
                        {INSPECTOR_OBSERVATION_CATEGORIES.map((c) => (
                          <button
                            key={c}
                            type="button"
                            disabled={locked}
                            className="rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] font-semibold text-text-2"
                            onClick={() =>
                              persist({
                                observations: draft.observations.map((o) =>
                                  o.id === obs.id ? { ...o, category: c } : o,
                                ),
                              })
                            }
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    )}
                    <Textarea
                      rows={2}
                      placeholder="اشرح الملاحظة..."
                      value={obs.text}
                      disabled={locked}
                      onChange={(e) =>
                        persist({
                          observations: draft.observations.map((o) =>
                            o.id === obs.id ? { ...o, text: e.target.value } : o,
                          ),
                        })
                      }
                      className="mt-1.5 min-h-[52px] w-full resize-y border-0 bg-transparent p-0 text-[13px] leading-relaxed text-text-2 outline-none"
                    />
                    <button
                      type="button"
                      disabled={locked}
                      className="mt-1 text-[12px] font-semibold text-danger-text"
                      onClick={() =>
                        persist({
                          observations: draft.observations.filter(
                            (o) => o.id !== obs.id,
                          ),
                        })
                      }
                    >
                      حذف
                    </button>
                  </div>
                </div>
              );
            }

            return (
            <div
              key={obs.id}
              className="relative mb-2.5 flex flex-col items-stretch gap-3.5 rounded-lg border border-border bg-surface-2 p-3 sm:flex-row"
            >
              <div className="flex w-full shrink-0 flex-col items-center justify-center sm:w-[116px]">
                {obs.photo?.fileName ? (
                  <InspectorStampedPhotoThumb
                    stamp={photoStamp}
                    taskId={draft.taskId}
                    photoRef={obsPhotoRef}
                    attachment={obs.photo}
                    onClear={
                      locked
                        ? undefined
                        : () => {
                            clearInspectorPhotoDataUrl(
                              draft.taskId,
                              obsPhotoRef,
                            );
                            persist({
                              observations: draft.observations.map((o) =>
                                o.id === obs.id ? { ...o, photo: null } : o,
                              ),
                            });
                          }
                    }
                  />
                ) : (
                  <InspectorPhotoFilePicker
                    label="إرفاق صورة توثيقية"
                    disabled={locked}
                    className="h-[116px] flex-col border-2 py-2"
                    onFilesSelected={async (files) => {
                      const file = files[0];
                      if (!file) return false;
                      const result = await uploadInspectorPhotoFromFile(
                        draft.taskId,
                        obsPhotoRef,
                        file,
                        {
                          draft: liveDraft,
                          deedNumber: property?.deedNumber,
                        },
                      );
                      if (!result.ok) {
                        showToast(result.error, "error");
                        return false;
                      }
                      persist({
                        observations: draft.observations.map((o) =>
                          o.id === obs.id
                            ? { ...o, photo: result.attachment }
                            : o,
                        ),
                      });
                    }}
                  />
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-2 pe-8 sm:pe-0">
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold text-text-2">
                    نوع الملاحظة
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-[11px] transition-colors",
                        obs.category === ""
                          ? "border-primary bg-gold-soft text-primary"
                          : "border-border bg-surface text-text-2 hover:border-primary/40",
                      )}
                      onClick={() =>
                        persist({
                          observations: draft.observations.map((o) =>
                            o.id === obs.id ? { ...o, category: "" } : o,
                          ),
                        })
                      }
                    >
                      بدون تحديد
                    </button>
                    {INSPECTOR_OBSERVATION_CATEGORIES.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-[11px] transition-colors",
                          obs.category === c
                            ? "border-primary bg-gold-soft text-primary"
                            : "border-border bg-surface text-text-2 hover:border-primary/40",
                        )}
                        onClick={() =>
                          persist({
                            observations: draft.observations.map((o) =>
                              o.id === obs.id ? { ...o, category: c } : o,
                            ),
                          })
                        }
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
                <Textarea
                  rows={2}
                  placeholder="اشرح الملاحظة..."
                  value={obs.text}
                  onChange={(e) =>
                    persist({
                      observations: draft.observations.map((o) =>
                        o.id === obs.id ? { ...o, text: e.target.value } : o,
                      ),
                    })
                  }
                  className={cn(formControlClassName, "min-h-[62px] text-xs")}
                />
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-danger-text"
                    onClick={() =>
                      persist({
                        observations: draft.observations.filter(
                          (o) => o.id !== obs.id,
                        ),
                      })
                    }
                  >
                    حذف الملاحظة
                  </Button>
                </div>
              </div>
              <button
                type="button"
                className="absolute end-3 top-3 text-text-3 hover:text-danger-text sm:hidden"
                title="حذف"
                onClick={() =>
                  persist({
                    observations: draft.observations.filter(
                      (o) => o.id !== obs.id,
                    ),
                  })
                }
              >
                <i className="ti ti-trash" aria-hidden />
              </button>
            </div>
            );
          })}
          {mobile ? (
            <button
              type="button"
              disabled={locked}
              className="flex min-h-12 w-full items-center justify-center gap-1.5 rounded-xl border-[1.5px] border-dashed border-[var(--gold-d,#a4906f)] bg-[color-mix(in_srgb,var(--gold)_8%,transparent)] font-inherit text-[14px] font-bold text-[var(--gold-d,#a4906f)]"
              onClick={() =>
                persist({
                  observations: [
                    ...draft.observations,
                    {
                      id: newObservationId(),
                      category: "",
                      text: "",
                      photo: null,
                    },
                  ],
                })
              }
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
                <path d="M12 5v14M5 12h14" />
              </svg>
              إضافة ملاحظة موثّقة بالصورة
            </button>
          ) : (
            <Button
              type="button"
              variant="default"
              size="sm"
              className="mt-1"
              onClick={() =>
                persist({
                  observations: [
                    ...draft.observations,
                    {
                      id: newObservationId(),
                      category: "",
                      text: "",
                      photo: null,
                    },
                  ],
                })
              }
            >
              <i className="ti ti-plus" aria-hidden /> إضافة ملاحظة موثّقة
            </Button>
          )}
          <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-surface-2 p-3 text-xs leading-relaxed text-text-2">
            <input
              type="checkbox"
              className="mt-0.5"
              id="ins-vacant-land"
              checked={draft.vacantLand}
              onChange={(e) => persist({ vacantLand: e.target.checked })}
            />
            <span>هل الموقع أرض فضاء؟ (يُستثنى من شرط استلام المفتاح)</span>
          </label>
          {!draft.vacantLand && !keyAvailability.keyAvailable ? (
            <Note tone="warn" className="mt-3">
              المفتاح غير مُسلَّم بعد. لا يمكن إتمام المعاينة — إن كان المفتاح
              خطأ أو غير متوفر سجّل تعذراً مع ملاحظة توضيحية.
              {onRegisterFailure ? (
                <div className="mt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onRegisterFailure}
                  >
                    تسجيل تعذر المفتاح
                  </Button>
                </div>
              ) : null}
            </Note>
          ) : null}
          <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-surface-2 p-3 text-xs leading-relaxed text-text-2">
            <input
              type="checkbox"
              className="mt-0.5"
              id="ins-client-declaration"
              checked={draft.clientDeclarationSigned}
              onChange={(e) => {
                const signed = e.target.checked;
                const hasPhone = hasAnyPartyPhone(property?.contacts);
                if (signed && !hasPhone && !draft.declarationPhoneSatisfied) {
                  showToast(
                    "لا يمكن توقيع إقرار العميل بدون جوال لأحد الأطراف.",
                    "error",
                  );
                  return;
                }
                persist({
                  clientDeclarationSigned: signed,
                  declarationPhoneSatisfied:
                    draft.declarationPhoneSatisfied || (signed && hasPhone),
                });
              }}
            />
            <span>
              تم توقيع إقرار العميل / صحة الموقع (يتطلب جوال أحد الأطراف عند
              أول توقيع)
            </span>
          </label>
          <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-lg border border-amber bg-amber-light p-3 text-xs leading-relaxed text-text-2">
            <input
              type="checkbox"
              className="mt-0.5"
              id="ins-confirm"
              checked={draft.inspectionConfirmed}
              onChange={(e) =>
                persist({ inspectionConfirmed: e.target.checked })
              }
            />
            <span>
              أُقرّ بأنني قمت بالمعاينة الميدانية للموقع، وأن كل ملاحظة موثّقة
              بصورة من الطبيعة، وأتحمّل مسؤولية صحة البيانات.
            </span>
          </label>
          {fieldErrors.inspectionConfirmed ? (
            <p className="mt-1 text-[10px] text-danger-text" role="alert">
              {fieldErrors.inspectionConfirmed}
            </p>
          ) : null}
          {fieldErrors.observations ? (
            <p className="mt-1 text-[10px] text-danger-text" role="alert">
              {fieldErrors.observations}
            </p>
          ) : null}
        </InspectorCard>
        </div>

        {beforeSubmitFooter}

        {!hideSubmitFooter ? (
          <InspectorSubmitFooter
            disabled={workLocked}
            saving={submitting}
            locked={workLocked}
            onRegisterFailure={onRegisterFailure}
            onSaveDraft={() => void saveDraft()}
            onSubmit={() => void hostRef.current?.submit?.()}
          />
        ) : null}
      </fieldset>
    </div>
  );
}

function MobileCountStepper({
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
