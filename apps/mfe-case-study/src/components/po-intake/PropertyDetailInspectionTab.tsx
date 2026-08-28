"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode, Fragment } from "react";
import { ReturnedForCorrectionNote } from "../ui/ReturnedForCorrectionNote";
import {
  Button,
  GoogleMapPin,
  InlineLoadingSkeleton,
  Label,
  cn,
  formControlClassName,
  useToast,
} from "@platform/ui-kit";
import { DetailBadge, EmptyState } from "./PropertyDetailFields";
import {
  PROPERTY_BOUNDARY_ROWS,
  approximatePropertyGeo,
  boundariesMarkedUnavailable,
  formatDateAr,
  formatPropertyDeedDisplay,
  type PoPropertyIntake,
} from "../../lib/prototype/po-intake-data";
import {
  FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT,
  acceptInspectorWorkspace,
  getOrCreateInspectorWorkspace,
  loadInspectorWorkspaceSnapshot,
  reopenInspectorWorkspace,
  saveInspectorWorkspaceDraft,
  updateInspectorWorkspace,
} from "../../lib/prototype/inspector-workspace-storage";
import {
  INSPECTOR_SERVICE_OPTIONS,
  INSPECTOR_AMENITY_OPTIONS,
  INSPECTOR_OBSERVATION_CATEGORIES,
  MOVABLES_DESCRIPTION_KEY,
  inspectorFeatureRequiresPhoto,
  inspectorPhotoCoverageLabel,
  inspectorPhotoStampText,
  isCommercialShopInspectionContext,
  isInspectorWorkspaceAccepted,
  isInspectorWorkspaceLocked,
  isLandInspectionContext,
  isMovablesPresent,
  isShopHiddenInspectorComponentKey,
  listServiceAmenityPhotoSlots,
  newObservationId,
  parseInspectorCount,
  patchInspectorFeatureValues,
  visibleInspectorFeatureFields,
  type InspectorBoundaryKey,
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
import { FieldComparableCaptureSection } from "../field-inspection/FieldComparableCaptureSection";
import { InspectorDefinedPhotosSection } from "../field-inspection/InspectorDefinedPhotosSection";
import { InspectorPhotoFilePicker } from "../field-inspection/InspectorPhotoFilePicker";
import { InspectorStampedPhotoThumb } from "../field-inspection/InspectorStampedPhotoThumb";
import { InspectorMovablesDescriptionField } from "../field-inspection/InspectorMovablesDescriptionField";
import { photoLocationFlagLabel } from "@platform/app-shared/media/photo-location";
import { AppModal } from "../ui/AppModal";
import {
  firstInspectorWorkspaceError,
  firstInspectorWorkspaceErrorTarget,
  inspectorInvalidControlClass,
  scrollToInspectorField,
  validateInspectorWorkspace,
  type InspectorWorkspaceFieldErrors,
} from "../../lib/prototype/inspector-workspace-validation";
import { finalizeInspectorWorkspace } from "../../lib/prototype/finalize-field-inspection-submission";
import type { WorkflowTask } from "../../lib/prototype/tasks-storage";
import type { PropertyDetailPartyCard } from "../../lib/prototype/property-detail-parties";
import {
  EDIT_CONTROL_CLASS,
  formatAcceptedDate,
  SharedBadge,
  InsField,
  InsEditField,
  InsEditSelect,
  InsEditTextarea,
  InsFieldsGrid,
  InsCard,
  ChipRow,
  PhotoTile,
  EditableFeaturePhotoCell,
  ComponentCountWithPhotoField,
} from "./PropertyDetailInspectionParts";

export function PropertyDetailInspectionTab({
  property,
  inspectionTask,
  inspectionCard,
  editMode = false,
  onEditModeChange,
  lockEditMode = false,
  onSubmitted,
}: {
  property: PoPropertyIntake;
  inspectionTask: WorkflowTask | null;
  inspectionCard: PropertyDetailPartyCard | null;
  /** Case Study.html `ed` — in-tab input mode. */
  editMode?: boolean;
  onEditModeChange?: (edit: boolean) => void;
  /** Keep input mode (inspector workspace). Cancel exits via onEditModeChange(false). */
  lockEditMode?: boolean;
  onSubmitted?: () => void;
}) {
  const { showToast } = useToast();
  const [draft, setDraft] = useState<InspectorWorkspaceDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<InspectorWorkspaceFieldErrors>(
    {},
  );
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnNote, setReturnNote] = useState("");
  const [returnError, setReturnError] = useState<string | null>(null);
  const [returning, setReturning] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [mapPinned, setMapPinned] = useState(false);
  const mapPinnedRef = useRef(false);
  mapPinnedRef.current = mapPinned;
  const [mapBackup, setMapBackup] = useState<{
    lat: string;
    lng: string;
  } | null>(null);
  const [pendingMapMove, setPendingMapMove] = useState<{
    nextLat: string;
    nextLng: string;
    prevLat: string;
    prevLng: string;
  } | null>(null);
  const [mapPinEpoch, setMapPinEpoch] = useState(0);

  useEffect(() => {
    if (!inspectionTask) {
      setDraft(null);
      return;
    }
    let cancelled = false;
    setLoading(true);

    if (editMode) {
      const propertyDisplayId =
        formatPropertyDeedDisplay(property) ||
        `خانة ${inspectionTask.propertyOrdinal}`;
      void getOrCreateInspectorWorkspace({
        taskId: inspectionTask.id,
        propertyId: property.id,
        poNumber: inspectionTask.poNumber,
        propertyDisplayId,
        property,
      }).then((next) => {
        if (!cancelled) {
          setDraft(next);
          setLoading(false);
        }
      });
      return () => {
        cancelled = true;
      };
    }

    const load = () => {
      void loadInspectorWorkspaceSnapshot(inspectionTask.id).then((loaded) => {
        if (!cancelled) {
          setDraft(loaded);
          setLoading(false);
        }
      });
    };
    load();
    const onChange = () => load();
    window.addEventListener(FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT, onChange);
    return () => {
      cancelled = true;
      window.removeEventListener(
        FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT,
        onChange,
      );
    };
  }, [inspectionTask, editMode, property]);

  useEffect(() => {
    if (editMode) {
      setFormError(null);
      setFieldErrors({});
    }
  }, [editMode]);

  const mapGeo = useMemo(() => {
    const lat = Number(draft?.mapLatitude);
    const lng = Number(draft?.mapLongitude);
    if (Number.isFinite(lat) && Number.isFinite(lng) && lat && lng) {
      return { lat, lng };
    }
    return approximatePropertyGeo(property);
  }, [draft, property]);

  const locked = draft ? isInspectorWorkspaceLocked(draft.status) : false;
  const showEditFields = editMode && Boolean(draft) && !locked;

  function patchDraft(patch: Parameters<typeof updateInspectorWorkspace>[1]) {
    if (!inspectionTask || locked) return;
    setFieldErrors({});
    setFormError(null);
    void updateInspectorWorkspace(inspectionTask.id, patch)
      .then((next) => {
        if (next) setDraft(next);
      })
      .catch((err: unknown) => {
        showToast(
          err instanceof Error ? err.message : "تعذّر حفظ التعديل — حاول مرة أخرى",
          "error",
        );
      });
  }

  function requestMapMove(lat: number, lng: number) {
    const nextLat = lat.toFixed(5);
    const nextLng = lng.toFixed(5);
    const curLat = (draft?.mapLatitude ?? "").trim();
    const curLng = (draft?.mapLongitude ?? "").trim();
    if (!curLat || !curLng || !mapPinnedRef.current) {
      patchDraft({ mapLatitude: nextLat, mapLongitude: nextLng });
      return;
    }
    if (curLat === nextLat && curLng === nextLng) return;
    setPendingMapMove({
      nextLat,
      nextLng,
      prevLat: curLat,
      prevLng: curLng,
    });
  }

  function confirmPendingMapMove() {
    if (!pendingMapMove) return;
    setMapBackup({
      lat: pendingMapMove.prevLat,
      lng: pendingMapMove.prevLng,
    });
    patchDraft({
      mapLatitude: pendingMapMove.nextLat,
      mapLongitude: pendingMapMove.nextLng,
    });
    setPendingMapMove(null);
    setMapPinned(true);
  }

  function cancelPendingMapMove() {
    setPendingMapMove(null);
    setMapPinEpoch((n) => n + 1);
  }

  async function handleCancelEdit() {
    if (lockEditMode) {
      onEditModeChange?.(false);
      return;
    }
    if (inspectionTask) {
      setLoading(true);
      const snapshot = await loadInspectorWorkspaceSnapshot(inspectionTask.id);
      setDraft(snapshot);
      setLoading(false);
    }
    setFormError(null);
    setFieldErrors({});
    onEditModeChange?.(false);
  }

  async function handleSaveAndSubmit() {
    if (!inspectionTask || !draft) return;
    setSaving(true);
    setFormError(null);
    try {
      const confirmed: InspectorWorkspaceDraft = {
        ...draft,
        inspectionConfirmed: true,
      };
      const saved = await saveInspectorWorkspaceDraft(confirmed);
      setDraft(saved);

      const errors = validateInspectorWorkspace(saved, {
        boundariesUnavailable: boundariesMarkedUnavailable(
          property.boundariesAvailability,
        ),
        classification: property.classification,
        propertyType: property.propertyType,
      });
      // Confirmation is set above — don't block on it for this path.
      delete errors.inspectionConfirmed;
      if (Object.keys(errors).length > 0 || (errors.emptyFeatureKeys?.length ?? 0) > 0) {
        setFieldErrors(errors);
        const message =
          firstInspectorWorkspaceError(errors) ?? "يرجى مراجعة بيانات المعاينة";
        setFormError(message);
        showToast(message, "error");
        const targetId = firstInspectorWorkspaceErrorTarget(errors);
        if (targetId) {
          window.setTimeout(() => scrollToInspectorField(targetId), 60);
        }
        return;
      }

      const result = await finalizeInspectorWorkspace(inspectionTask.id);
      if (!result.ok) {
        if (result.errors) {
          setFieldErrors(result.errors as InspectorWorkspaceFieldErrors);
          const targetId = firstInspectorWorkspaceErrorTarget(
            result.errors as InspectorWorkspaceFieldErrors,
          );
          if (targetId) {
            window.setTimeout(() => scrollToInspectorField(targetId), 60);
          }
        }
        setFormError(result.message);
        showToast(result.message, "error");
        return;
      }

      setDraft(result.draft);
      setFieldErrors({});
      showToast("تم حفظ بيانات المعاينة وإرسالها.", "success");
      onSubmitted?.();
      if (!lockEditMode) {
        onEditModeChange?.(false);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "تعذّر حفظ بيانات المعاينة";
      setFormError(message);
      showToast(message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleReturnForCorrection() {
    if (!inspectionTask) return;
    const trimmed = returnNote.trim();
    if (!trimmed) {
      setReturnError("يجب إدخال سبب الإرجاع للتصحيح");
      return;
    }
    setReturning(true);
    setReturnError(null);
    const reopened = await reopenInspectorWorkspace(inspectionTask.id, trimmed);
    setReturning(false);
    if (!reopened.ok) {
      setReturnError(reopened.error);
      return;
    }
    setDraft(reopened.data);
    setReturnOpen(false);
    setReturnNote("");
    showToast("أُعيدت مهمة المعاينة للتصحيح", "success");
    onSubmitted?.();
  }

  async function handleAcceptInspection() {
    if (!inspectionTask) return;
    setAccepting(true);
    const accepted = await acceptInspectorWorkspace(inspectionTask.id);
    setAccepting(false);
    if (!accepted.ok) {
      showToast(accepted.error, "error");
      return;
    }
    setDraft(accepted.data);
    showToast("تم اعتماد بيانات المعاينة — تظهر في حزمة إنفاذ", "success");
    onSubmitted?.();
  }

  if (!inspectionCard) {
    return (
      <EmptyState
        title="لم يُعيَّن معاين لهذا العقار"
        sub="سيظهر تقرير المعاينة هنا بعد التعيين من التوزيع."
      />
    );
  }

  if (loading) return <InlineLoadingSkeleton />;

  const photoSlots = draft ? listServiceAmenityPhotoSlots(draft) : [];
  const isLandInspection = isLandInspectionContext({
    vacantLand: draft?.vacantLand,
    assetSubject: draft?.featureValues.assetSubject,
    classification: property.classification,
    propertyType: property.propertyType,
  });
  const isShopInspection = isCommercialShopInspectionContext({
    vacantLand: draft?.vacantLand,
    assetSubject: draft?.featureValues.assetSubject,
    classification: property.classification,
    propertyType: property.propertyType,
  });
  const showShopComp = (key: string) =>
    !isShopInspection || !isShopHiddenInspectorComponentKey(key);
  const featureFields = visibleInspectorFeatureFields(isLandInspection);
  const canReviewPackage =
    !editMode && Boolean(inspectionTask) && draft?.status === "submitted";
  const inspectionAccepted = isInspectorWorkspaceAccepted(draft);
  const canAccept = canReviewPackage && !inspectionAccepted;
  const canReturn = canReviewPackage && !inspectionAccepted;

  return (
    <div id="pdInspection">
      {!showEditFields && canReviewPackage && !returnOpen ? (
        <div className="mb-3.5 flex flex-wrap items-center justify-end gap-2">
          {inspectionAccepted ? (
            <div className="me-auto rounded-lg border border-[color-mix(in_srgb,var(--success)_35%,var(--border))] bg-[var(--success-bg)] px-3 py-1.5 text-[11.5px] font-semibold text-[var(--success)] max-lg:w-full">
              معتمد
              {draft?.acceptedByName?.trim()
                ? ` — ${draft.acceptedByName.trim()}`
                : ""}
              {draft?.acceptedAtUtc
                ? ` · ${formatAcceptedDate(draft.acceptedAtUtc)}`
                : ""}
            </div>
          ) : null}
          {canAccept ? (
            <Button
              type="button"
              size="sm"
              variant="primary"
              loading={accepting}
              showActionToast={false}
              className="max-lg:min-h-11 max-lg:flex-1"
              onClick={() => void handleAcceptInspection()}
            >
              اعتماد البيانات
            </Button>
          ) : null}
          {canReturn ? (
            <button
              type="button"
              className="rounded-lg border border-border-md bg-surface px-3.5 py-1.5 text-[11.5px] font-bold text-text-2 max-lg:min-h-11 max-lg:flex-1 max-lg:rounded-[12px] max-lg:text-[13px]"
              disabled={accepting}
              onClick={() => {
                setReturnOpen(true);
                setReturnError(null);
              }}
            >
              إعادة للتصحيح
            </button>
          ) : null}
          {inspectionAccepted ? (
            <button
              type="button"
              className="rounded-lg border border-border-md bg-surface px-3.5 py-1.5 text-[11.5px] font-bold text-text-2 max-lg:min-h-11 max-lg:w-full max-lg:rounded-[12px] max-lg:text-[13px]"
              disabled={accepting}
              onClick={() => {
                setReturnOpen(true);
                setReturnError(null);
              }}
            >
              إلغاء الاعتماد وإعادة للتصحيح
            </button>
          ) : null}
        </div>
      ) : null}

      {formError ? (
        <div
          className="mb-3 rounded-lg border border-danger border-e-[3px] border-e-danger bg-danger-bg px-3.5 py-2.5 text-xs leading-relaxed text-danger-text"
          role="alert"
        >
          <p className="m-0 font-semibold">{formError}</p>
          <p className="m-0 mt-1 text-[11px] opacity-90">
            تم توجيهك لأول حقل ناقص — الحقول باللون الأحمر مطلوبة.
          </p>
        </div>
      ) : null}

      {draft?.status === "reopened" && draft.returnNote?.trim() ? (
        <ReturnedForCorrectionNote note={draft.returnNote} className="mb-3" />
      ) : null}

      {!showEditFields && returnOpen ? (
        <div className="mb-3.5 rounded-lg border border-border bg-surface px-3.5 py-3">
          <Label htmlFor="pd-inspection-return-note" className="text-xs">
            سبب الإرجاع للتصحيح <span className="text-danger-text">*</span>
          </Label>
          <textarea
            id="pd-inspection-return-note"
            className={cn(formControlClassName, "mt-1 min-h-[72px] text-xs")}
            value={returnNote}
            onChange={(e) => setReturnNote(e.target.value)}
            placeholder="صف ما يجب تصحيحه في تقرير المعاين…"
          />
          {returnError ? (
            <p className="mt-1 mb-0 text-xs text-danger-text">{returnError}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="primary"
              loading={returning}
              showActionToast={false}
              onClick={() => void handleReturnForCorrection()}
            >
              تأكيد الإرجاع
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={returning}
              onClick={() => {
                setReturnOpen(false);
                setReturnError(null);
                setReturnNote("");
              }}
            >
              إلغاء
            </Button>
          </div>
        </div>
      ) : null}

      {!draft ? (
        <EmptyState
          title="لا توجد بيانات معاينة بعد"
          sub="يظهر التقرير التفصيلي بعد بدء المعاين بإدخال البيانات."
        />
      ) : (
        <>
          <InsCard
            title="بيانات المعاينة"
            badge={<DetailBadge tone="red">إلزامي</DetailBadge>}
          >
            <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold text-text-2">
                موقع العقار على الخريطة (GPS)
              </span>
              <SharedBadge />
              <span className="text-[10.5px] text-text-3">
                — إثبات النزول الميداني
              </span>
            </div>
            <div id="ins-map-section">
            <InsFieldsGrid>
              {showEditFields ? (
                <>
                  <InsEditField
                    id="ins-lat"
                    label="خط العرض"
                    value={draft.mapLatitude}
                    ltr
                    invalid={Boolean(fieldErrors.mapLatitude)}
                    errorMessage={fieldErrors.mapLatitude}
                    onChange={(v) => patchDraft({ mapLatitude: v })}
                  />
                  <InsEditField
                    id="ins-lng"
                    label="خط الطول"
                    value={draft.mapLongitude}
                    ltr
                    invalid={Boolean(fieldErrors.mapLatitude)}
                    onChange={(v) => patchDraft({ mapLongitude: v })}
                  />
                </>
              ) : (
                <>
                  <InsField
                    label="خط العرض"
                    value={draft.mapLatitude || (mapGeo ? String(mapGeo.lat) : "")}
                    ltr
                  />
                  <InsField
                    label="خط الطول"
                    value={draft.mapLongitude || (mapGeo ? String(mapGeo.lng) : "")}
                    ltr
                  />
                </>
              )}
            </InsFieldsGrid>
            </div>
            <div
              key={`${draft.mapLatitude},${draft.mapLongitude},${mapPinEpoch}`}
              className="relative mt-2.5 h-[200px] overflow-hidden rounded-lg border border-border"
            >
              {mapGeo || showEditFields ? (
                <GoogleMapPin
                  lat={mapGeo?.lat}
                  lng={mapGeo?.lng}
                  title="خريطة المعاينة"
                  interactive={showEditFields && !mapPinned}
                  onCoordsChange={
                    showEditFields && !mapPinned
                      ? (lat, lng) => requestMapMove(lat, lng)
                      : undefined
                  }
                />
              ) : (
                <div className="grid h-full place-items-center bg-surface-2 text-[12px] text-text-3">
                  لا تتوفر إحداثيات GPS بعد
                </div>
              )}
            </div>
            {showEditFields ? (
              <div className="mt-2.5 flex flex-col gap-2">
                {(draft.mapLatitude.trim() || mapGeo) && !mapPinned ? (
                  <button
                    type="button"
                    className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border-[1.5px] border-ink bg-[color-mix(in_srgb,var(--ink)_7%,transparent)] font-inherit text-[13px] font-bold text-ink"
                    onClick={() => {
                      if (
                        !draft.mapLatitude.trim() &&
                        mapGeo
                      ) {
                        patchDraft({
                          mapLatitude: mapGeo.lat.toFixed(5),
                          mapLongitude: mapGeo.lng.toFixed(5),
                        });
                      }
                      setMapPinned(true);
                      showToast("تم تثبيت الموقع", "success");
                    }}
                  >
                    <i className="ti ti-pin text-base" aria-hidden />
                    تثبيت الموقع
                  </button>
                ) : null}
                {mapPinned ? (
                  <div className="flex gap-2">
                    <div className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-[#B7E4C7] bg-[#F0FFF4] text-[13px] font-bold text-[#1B7A4A]">
                      <i className="ti ti-pin-filled text-base" aria-hidden />
                      الموقع مثبت
                    </div>
                    <button
                      type="button"
                      className="flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface px-3 font-inherit text-[13px] font-bold text-heading"
                      onClick={() => setMapPinned(false)}
                    >
                      تعديل
                    </button>
                  </div>
                ) : null}
                {mapBackup ? (
                  <button
                    type="button"
                    className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface font-inherit text-[13px] font-bold text-heading"
                    onClick={() => {
                      patchDraft({
                        mapLatitude: mapBackup.lat,
                        mapLongitude: mapBackup.lng,
                      });
                      setMapBackup(null);
                      setMapPinEpoch((n) => n + 1);
                    }}
                  >
                    <i className="ti ti-arrow-back-up text-base" aria-hidden />
                    رجوع للموقع السابق
                  </button>
                ) : null}
              </div>
            ) : null}
            <div className="mt-3" id="ins-date-time">
              <InsFieldsGrid>
                <InsField
                  label="تاريخ المعاينة"
                  value={draft.inspectionDate}
                  ltr
                />
                <InsField
                  label="وقت المعاينة"
                  value={draft.inspectionTime}
                  ltr
                />
              </InsFieldsGrid>
            </div>
          </InsCard>

          <InsCard title="نموذج التحقق الميداني — خصائص العقار">
            {fieldErrors.features || fieldErrors.featurePhotos ? (
              <p
                className="mb-2 rounded-lg border border-danger/30 bg-danger-bg px-3 py-2 text-[12px] font-semibold text-danger"
                role="alert"
              >
                {fieldErrors.features ?? fieldErrors.featurePhotos}
              </p>
            ) : null}
            <p className="mb-2 text-[11px] leading-relaxed text-text-3">
              عمود «صورة» لإثبات قيمة الحقل عند الحاجة. صور الخدمات/المرافق تُرفع من قسم «توثيق الخدمات والمرافق» أدناه.
            </p>
            <div className="overflow-x-auto" id="ins-features-section">
              <table className="w-full min-w-[520px] border-collapse text-[12px]">
                <thead>
                  <tr>
                    {(["#", "الحقل", "القيمة", "صورة"] as const).map((h, i) => (
                      <th
                        key={h}
                        className={cn(
                          "border border-border bg-surface-2 px-2.5 py-[7px] text-[11px] font-bold text-text-2",
                          i === 1 ? "text-start" : "text-center",
                        )}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {featureFields.map((field, index) => {
                    const rawVal = draft.featureValues[field.key]?.trim() ?? "";
                    const attachment = draft.featurePhotoAttachments[field.key];
                    const hasPhoto = Boolean(attachment?.fileName);
                    const photoRef = `feature:${field.key}`;
                    const needsPhoto = inspectorFeatureRequiresPhoto(
                      field,
                      rawVal,
                    );
                    const valueMissing = Boolean(
                      fieldErrors.emptyFeatureKeys?.includes(field.key),
                    );
                    const photoMissing =
                      fieldErrors.missingFeaturePhotoKey === field.key;
                    return (
                      <Fragment key={field.key}>
                      <tr
                        id={`ins-feature-${field.key}`}
                        className={cn(
                          (valueMissing || photoMissing) && "bg-danger-bg/50",
                        )}
                      >
                        <td className="border border-border px-2 py-1.5 text-center text-text-3">
                          {index + 1}
                        </td>
                        <td
                          className={cn(
                            "border border-border px-2.5 py-1.5",
                            (valueMissing || photoMissing) &&
                              "font-semibold text-danger",
                          )}
                        >
                          {field.label}
                          {field.shared ? (
                            <span className="ms-1 inline-block align-middle">
                              <SharedBadge />
                            </span>
                          ) : null}
                          {valueMissing ? (
                            <span className="ms-1.5 text-[10px] font-bold text-danger">
                              مطلوب
                            </span>
                          ) : null}
                          {photoMissing ? (
                            <span className="ms-1.5 text-[10px] font-bold text-danger">
                              صورة مطلوبة
                            </span>
                          ) : null}
                        </td>
                        <td className="border border-border px-2 py-1.5 text-center font-semibold text-heading">
                          {showEditFields ? (
                            <select
                              id={`ins-feature-select-${field.key}`}
                              aria-invalid={valueMissing || undefined}
                              className={cn(
                                EDIT_CONTROL_CLASS,
                                "text-center",
                                valueMissing && inspectorInvalidControlClass,
                              )}
                              value={rawVal}
                              onChange={(e) => {
                                const next = e.target.value;
                                patchDraft({
                                  featureValues: patchInspectorFeatureValues(
                                    draft.featureValues,
                                    field.key,
                                    next,
                                  ),
                                  featurePhotoAttachments: {
                                    ...draft.featurePhotoAttachments,
                                    [field.key]: inspectorFeatureRequiresPhoto(
                                      field,
                                      next,
                                    )
                                      ? draft.featurePhotoAttachments[field.key]
                                      : null,
                                  },
                                });
                                if (
                                  !inspectorFeatureRequiresPhoto(field, next)
                                ) {
                                  clearInspectorPhotoDataUrl(
                                    draft.taskId,
                                    photoRef,
                                  );
                                }
                              }}
                            >
                              <option value="">— اختر —</option>
                              {field.options.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          ) : (
                            rawVal || "—"
                          )}
                        </td>
                        <td
                          id={`ins-feature-photo-${field.key}`}
                          className={cn(
                            "border border-border px-2 py-1.5 text-center text-text-3",
                            photoMissing && "bg-danger-bg",
                          )}
                        >
                          {showEditFields ? (
                            <EditableFeaturePhotoCell
                              needsPhoto={needsPhoto}
                              hasPhoto={hasPhoto}
                              onUpload={async (file) => {
                                const result =
                                  await uploadInspectorPhotoFromFile(
                                    draft.taskId,
                                    photoRef,
                                    file,
                                    {
                                      draft,
                                      deedNumber: property.deedNumber,
                                    },
                                  );
                                if (!result.ok) {
                                  throw new Error(result.error);
                                }
                                patchDraft({
                                  featurePhotoAttachments: {
                                    ...draft.featurePhotoAttachments,
                                    [field.key]: result.attachment,
                                  },
                                });
                                return true;
                              }}
                            />
                          ) : hasPhoto ? (
                            <span className="inline-flex items-center gap-1 text-[10.5px] text-[#1f6f6f]">
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
                              مرفقة
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                      {field.key === "movables" && isMovablesPresent(draft.featureValues) ? (
                        <tr
                          className={cn(
                            fieldErrors.movablesDescription && "bg-danger-bg/50",
                          )}
                        >
                          <td className="border border-border" />
                          <td className="border border-border px-2.5 py-1.5" colSpan={3}>
                            {showEditFields ? (
                              <InspectorMovablesDescriptionField
                                value={
                                  draft.featureValues[MOVABLES_DESCRIPTION_KEY] ??
                                  ""
                                }
                                invalid={Boolean(fieldErrors.movablesDescription)}
                                onChange={(next) =>
                                  patchDraft({
                                    featureValues: {
                                      ...draft.featureValues,
                                      [MOVABLES_DESCRIPTION_KEY]: next,
                                    },
                                  })
                                }
                              />
                            ) : (
                              <p className="m-0 whitespace-pre-wrap text-[12.5px] text-heading">
                                <span className="block text-[10.5px] font-bold text-text-3">
                                  وصف المنقولات
                                </span>
                                {draft.featureValues[MOVABLES_DESCRIPTION_KEY]?.trim()
                                  || "—"}
                              </p>
                            )}
                          </td>
                        </tr>
                      ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-3">
              {!isLandInspection ? (
                <>
              {showEditFields ? (
                <InsEditField
                  label="عمر العقار (سنوات)"
                  value={draft.propertyAgeYears}
                  ltr
                  badge={<SharedBadge />}
                  className="max-w-[220px]"
                  onChange={(v) => patchDraft({ propertyAgeYears: v })}
                />
              ) : (
                <InsField
                  label="عمر العقار (سنوات)"
                  value={draft.propertyAgeYears}
                  ltr
                  badge={<SharedBadge />}
                />
              )}
                </>
              ) : null}
            </div>
          </InsCard>

          <InsCard
            title="الموقع والوصول"
            badge={<DetailBadge tone="red">إدخال ميداني</DetailBadge>}
          >
            <InsFieldsGrid>
              {showEditFields ? (
                <>
                  <InsEditField
                    label="اسم الشارع"
                    value={draft.streetName}
                    onChange={(v) => patchDraft({ streetName: v })}
                  />
                  <InsEditField
                    label="أقرب شارع رئيسي"
                    value={draft.mainStreetName}
                    onChange={(v) => patchDraft({ mainStreetName: v })}
                  />
                  <InsEditField
                    label="عرض الشارع الرئيسي (م)"
                    value={draft.streetWidthM}
                    ltr
                    inputMode="decimal"
                    onChange={(v) => patchDraft({ streetWidthM: v })}
                  />
                </>
              ) : (
                <>
                  <InsField label="اسم الشارع" value={draft.streetName} />
                  <InsField
                    label="أقرب شارع رئيسي"
                    value={draft.mainStreetName}
                  />
                  <InsField
                    label="عرض الشارع الرئيسي (م)"
                    value={draft.streetWidthM}
                    ltr
                  />
                </>
              )}
            </InsFieldsGrid>
            <div className="mt-3">
              {showEditFields ? (
                <InsEditTextarea
                  label="طريقة الوصول للعقار"
                  value={draft.accessRouteDescription}
                  onChange={(v) => patchDraft({ accessRouteDescription: v })}
                />
              ) : (
                <InsField
                  label="طريقة الوصول للعقار"
                  value={draft.accessRouteDescription}
                />
              )}
            </div>
          </InsCard>

          {!isLandInspection ? (
          <InsCard
            title="مكوّنات العقار"
            badge={<DetailBadge tone="red">إدخال ميداني</DetailBadge>}
          >
            <InsFieldsGrid min={130}>
              {showEditFields ? (
                <>
                  {showShopComp("roomCount") ? (
                  <InsEditField
                    label="عدد الغرف"
                    value={draft.roomCount}
                    ltr
                    onChange={(v) => patchDraft({ roomCount: v })}
                  />
                  ) : null}
                  {showShopComp("hallCount") ? (
                  <InsEditField
                    label="عدد الصالات"
                    value={draft.hallCount}
                    ltr
                    onChange={(v) => patchDraft({ hallCount: v })}
                  />
                  ) : null}
                  {showShopComp("unitCount") ? (
                  <InsEditField
                    label="عدد الشقق"
                    value={draft.unitCount}
                    ltr
                    onChange={(v) => patchDraft({ unitCount: v })}
                  />
                  ) : null}
                  <InsEditField
                    label="دورات المياه"
                    value={draft.bathroomCount}
                    ltr
                    onChange={(v) => patchDraft({ bathroomCount: v })}
                  />
                  <ComponentCountWithPhotoField
                    label="المعارض"
                    countValue={draft.showroomCount}
                    photoKey="showroom"
                    photoLabel="إرفاق صورة للمعرض التجاري"
                    attachment={draft.componentPhotoAttachments.showroom}
                    taskId={draft.taskId}
                    stamp={inspectorPhotoStampText(draft, property.deedNumber)}
                    deedNumber={property.deedNumber}
                    draft={draft}
                    editMode
                    disabled={locked}
                    onPatch={patchDraft}
                  />
                  {showShopComp("wellCount") ? (
                  <ComponentCountWithPhotoField
                    label="الآبار"
                    countValue={draft.wellCount}
                    photoKey="well"
                    photoLabel="إرفاق صورة البئر"
                    attachment={draft.componentPhotoAttachments.well}
                    taskId={draft.taskId}
                    stamp={inspectorPhotoStampText(draft, property.deedNumber)}
                    deedNumber={property.deedNumber}
                    draft={draft}
                    editMode
                    disabled={locked}
                    onPatch={patchDraft}
                  />
                  ) : null}
                  {showShopComp("towerCount") ? (
                  <InsEditField
                    label="الأبراج"
                    value={draft.towerCount}
                    ltr
                    onChange={(v) => patchDraft({ towerCount: v })}
                  />
                  ) : null}
                  {showShopComp("jacuzziCount") ? (
                  <InsEditField
                    label="جاكوزي"
                    value={draft.jacuzziCount}
                    ltr
                    onChange={(v) => patchDraft({ jacuzziCount: v })}
                  />
                  ) : null}
                  {showShopComp("diningCount") ? (
                  <InsEditField
                    label="غرف الطعام"
                    value={draft.diningCount}
                    ltr
                    onChange={(v) => patchDraft({ diningCount: v })}
                  />
                  ) : null}
                  {showShopComp("majlisCount") ? (
                  <InsEditField
                    label="المجالس"
                    value={draft.majlisCount}
                    ltr
                    onChange={(v) => patchDraft({ majlisCount: v })}
                  />
                  ) : null}
                  {showShopComp("maidRoomCount") ? (
                  <InsEditField
                    label="غرف الخدم"
                    value={draft.maidRoomCount}
                    ltr
                    onChange={(v) => patchDraft({ maidRoomCount: v })}
                  />
                  ) : null}
                  {showShopComp("guardRoomCount") ? (
                  <InsEditField
                    label="غرفة حارس"
                    value={draft.guardRoomCount}
                    ltr
                    onChange={(v) => patchDraft({ guardRoomCount: v })}
                  />
                  ) : null}
                  <InsEditField
                    label="مواقف"
                    value={draft.parkingCount}
                    ltr
                    onChange={(v) => patchDraft({ parkingCount: v })}
                  />
                  <InsEditField
                    label="مستودع"
                    value={draft.storeCount}
                    ltr
                    onChange={(v) => patchDraft({ storeCount: v })}
                  />
                  {showShopComp("playgroundCount") ? (
                  <InsEditField
                    label="ملاعب أطفال"
                    value={draft.playgroundCount}
                    ltr
                    onChange={(v) => patchDraft({ playgroundCount: v })}
                  />
                  ) : null}
                  {showShopComp("hasAnnex") ? (
                  <InsEditSelect
                    label="هل يوجد ملحق؟"
                    value={draft.hasAnnex}
                    options={["نعم", "لا"]}
                    onChange={(v) =>
                      patchDraft({
                        hasAnnex: v as InspectorWorkspaceDraft["hasAnnex"],
                        ...(v === "لا"
                          ? { annexUpperCount: "", annexGroundCount: "" }
                          : {}),
                      })
                    }
                  />
                  ) : null}
                  {showShopComp("hasAnnex") && draft.hasAnnex === "نعم" ? (
                    <>
                      <InsEditField
                        label="ملحق علوي (عدد)"
                        value={draft.annexUpperCount}
                        ltr
                        type="number"
                        onChange={(v) => patchDraft({ annexUpperCount: v })}
                      />
                      <InsEditField
                        label="ملحق أرضي (عدد)"
                        value={draft.annexGroundCount}
                        ltr
                        type="number"
                        onChange={(v) => patchDraft({ annexGroundCount: v })}
                      />
                    </>
                  ) : null}
                </>
              ) : (
                <>
                  {showShopComp("roomCount") ? (
                  <InsField label="عدد الغرف" value={draft.roomCount} ltr />
                  ) : null}
                  {showShopComp("hallCount") ? (
                  <InsField label="عدد الصالات" value={draft.hallCount} ltr />
                  ) : null}
                  {showShopComp("unitCount") ? (
                  <InsField label="عدد الشقق" value={draft.unitCount} ltr />
                  ) : null}
                  <InsField
                    label="دورات المياه"
                    value={draft.bathroomCount}
                    ltr
                  />
                  <ComponentCountWithPhotoField
                    label="المعارض"
                    countValue={draft.showroomCount}
                    photoKey="showroom"
                    photoLabel="إرفاق صورة للمعرض التجاري"
                    attachment={draft.componentPhotoAttachments.showroom}
                    taskId={draft.taskId}
                    stamp={inspectorPhotoStampText(draft, property.deedNumber)}
                    deedNumber={property.deedNumber}
                    draft={draft}
                    editMode={false}
                    onPatch={patchDraft}
                  />
                  {showShopComp("wellCount") ? (
                  <ComponentCountWithPhotoField
                    label="الآبار"
                    countValue={draft.wellCount}
                    photoKey="well"
                    photoLabel="إرفاق صورة البئر"
                    attachment={draft.componentPhotoAttachments.well}
                    taskId={draft.taskId}
                    stamp={inspectorPhotoStampText(draft, property.deedNumber)}
                    deedNumber={property.deedNumber}
                    draft={draft}
                    editMode={false}
                    onPatch={patchDraft}
                  />
                  ) : null}
                  {showShopComp("towerCount") ? (
                  <InsField label="الأبراج" value={draft.towerCount} ltr />
                  ) : null}
                  {showShopComp("jacuzziCount") ? (
                  <InsField label="جاكوزي" value={draft.jacuzziCount} ltr />
                  ) : null}
                  {showShopComp("diningCount") ? (
                  <InsField label="غرف الطعام" value={draft.diningCount} ltr />
                  ) : null}
                  {showShopComp("majlisCount") ? (
                  <InsField label="المجالس" value={draft.majlisCount} ltr />
                  ) : null}
                  {showShopComp("maidRoomCount") ? (
                  <InsField label="غرف الخدم" value={draft.maidRoomCount} ltr />
                  ) : null}
                  {showShopComp("guardRoomCount") ? (
                  <InsField label="غرفة حارس" value={draft.guardRoomCount} ltr />
                  ) : null}
                  <InsField label="مواقف" value={draft.parkingCount} ltr />
                  <InsField label="مستودع" value={draft.storeCount} ltr />
                  {showShopComp("playgroundCount") ? (
                  <InsField label="ملاعب أطفال" value={draft.playgroundCount} ltr />
                  ) : null}
                  {showShopComp("hasAnnex") ? (
                  <InsField label="هل يوجد ملحق؟" value={draft.hasAnnex} />
                  ) : null}
                  {showShopComp("hasAnnex") && draft.hasAnnex === "نعم" ? (
                    <>
                      <InsField
                        label="ملحق علوي (عدد)"
                        value={draft.annexUpperCount}
                        ltr
                      />
                      <InsField
                        label="ملحق أرضي (عدد)"
                        value={draft.annexGroundCount}
                        ltr
                      />
                    </>
                  ) : null}
                </>
              )}
            </InsFieldsGrid>
          </InsCard>
          ) : null}

          {!isLandInspection ? (
          <InsCard
            title="مساحات المباني"
            badge={<DetailBadge tone="red">إدخال ميداني</DetailBadge>}
          >
            <InsFieldsGrid min={140}>
              {showEditFields ? (
                <>
                  <InsEditField
                    label="مساحة البناء (م²)"
                    value={draft.builtArea}
                    ltr
                    onChange={(v) => patchDraft({ builtArea: v })}
                  />
                  <InsEditField
                    label="عدد أدوار المباني"
                    value={draft.buildingFloors}
                    ltr
                    onChange={(v) => patchDraft({ buildingFloors: v })}
                  />
                  <InsEditField
                    label="إجمالي مساحة القبو (م²)"
                    value={draft.basementTotal}
                    ltr
                    onChange={(v) => patchDraft({ basementTotal: v })}
                  />
                  <InsEditField
                    label="إجمالي مساحة الملاحق (م²)"
                    value={draft.annexTotal}
                    ltr
                    onChange={(v) => patchDraft({ annexTotal: v })}
                  />
                  <InsEditField
                    label="إجمالي مساحة المباني (م²)"
                    value={draft.buildingsTotal}
                    ltr
                    onChange={(v) => patchDraft({ buildingsTotal: v })}
                  />
                  <InsEditField
                    label="رقم رخصة البناء"
                    value={draft.buildLicenseNumber}
                    ltr
                    onChange={(v) => patchDraft({ buildLicenseNumber: v })}
                  />
                  <InsEditField
                    label="تاريخ رخصة البناء"
                    value={draft.buildLicenseDate}
                    ltr
                    onChange={(v) => patchDraft({ buildLicenseDate: v })}
                  />
                </>
              ) : (
                <>
                  <InsField
                    label="مساحة البناء (م²)"
                    value={draft.builtArea}
                    ltr
                  />
                  <InsField
                    label="عدد أدوار المباني"
                    value={draft.buildingFloors}
                    ltr
                  />
                  <InsField
                    label="إجمالي مساحة القبو (م²)"
                    value={draft.basementTotal}
                    ltr
                  />
                  <InsField
                    label="إجمالي مساحة الملاحق (م²)"
                    value={draft.annexTotal}
                    ltr
                  />
                  <InsField
                    label="إجمالي مساحة المباني (م²)"
                    value={draft.buildingsTotal}
                    ltr
                  />
                  <InsField
                    label="رقم رخصة البناء"
                    value={draft.buildLicenseNumber}
                    ltr
                  />
                  <InsField
                    label="تاريخ رخصة البناء"
                    value={draft.buildLicenseDate}
                    ltr
                  />
                </>
              )}
            </InsFieldsGrid>
          </InsCard>
          ) : null}

          {showEditFields ? (
            <FieldComparableCaptureSection
              latitude={draft.mapLatitude}
              longitude={draft.mapLongitude}
              city={property.city}
              district={property.district}
              propertyType={property.propertyType}
              poNumber={inspectionTask?.poNumber}
              propertyId={property.id}
              disabled={locked}
            />
          ) : null}

          {!boundariesMarkedUnavailable(property.boundariesAvailability) ? (
            <InsCard
              title="الحدود والأطوال"
              badge={
                <DetailBadge tone="teal">
                  للمطابقة — المصدر: الأخصائي (البورصة)
                </DetailBadge>
              }
            >
              <p className="mb-2 text-[11px] text-text-3">
                دور المعاين هنا مطابقة بيانات البورصة واكتشاف الخطأ — يؤكد
                المطابقة أو يعلّق بعدم المطابقة.
              </p>
              <div className="flex flex-col">
                {PROPERTY_BOUNDARY_ROWS.map((row) => {
                  const matchKey = row.descKey.replace(
                    "Boundary",
                    "",
                  ) as InspectorBoundaryKey;
                  const match = draft.boundaryMatches[matchKey];
                  const ok = match?.matches !== false;
                  return (
                    <div
                      key={row.descKey}
                      className="grid grid-cols-[90px_1fr_70px_auto] items-start gap-2.5 border-b border-border py-2 last:border-b-0"
                    >
                      <span className="text-xs font-semibold text-text-2">
                        {row.label}
                      </span>
                      <span className="text-xs text-text">
                        {property[row.descKey].trim() || "—"}
                      </span>
                      <span className="text-xs font-semibold [direction:ltr]">
                        {property[row.lenKey].trim()
                          ? `${property[row.lenKey].trim()} م`
                          : "—"}
                      </span>
                      <div className="min-w-[160px]">
                        {showEditFields ? (
                          <>
                            <div className="flex flex-wrap gap-1.5">
                              <button
                                type="button"
                                className={cn(
                                  "rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors",
                                  ok
                                    ? "border-[color-mix(in_srgb,#1f6f6f_35%,transparent)] bg-[color-mix(in_srgb,#2a8f8f_14%,transparent)] text-[#1f6f6f]"
                                    : "border-border bg-surface text-text-3",
                                )}
                                onClick={() =>
                                  patchDraft({
                                    boundaryMatches: {
                                      ...draft.boundaryMatches,
                                      [matchKey]: {
                                        ...match,
                                        matches: true,
                                      },
                                    },
                                  })
                                }
                              >
                                مطابق
                              </button>
                              <button
                                type="button"
                                className={cn(
                                  "rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors",
                                  !ok
                                    ? "border-[color-mix(in_srgb,#d9694f_35%,transparent)] bg-[color-mix(in_srgb,#d9694f_14%,transparent)] text-[#d9694f]"
                                    : "border-border bg-surface text-text-3",
                                )}
                                onClick={() =>
                                  patchDraft({
                                    boundaryMatches: {
                                      ...draft.boundaryMatches,
                                      [matchKey]: {
                                        ...match,
                                        matches: false,
                                      },
                                    },
                                  })
                                }
                              >
                                عدم تطابق
                              </button>
                            </div>
                            {!ok ? (
                              <input
                                type="text"
                                className={cn(EDIT_CONTROL_CLASS, "mt-1.5 text-[11px]")}
                                placeholder="ملاحظة عدم التطابق…"
                                value={match?.mismatchNote ?? ""}
                                onChange={(e) =>
                                  patchDraft({
                                    boundaryMatches: {
                                      ...draft.boundaryMatches,
                                      [matchKey]: {
                                        ...match,
                                        mismatchNote: e.target.value,
                                      },
                                    },
                                  })
                                }
                              />
                            ) : null}
                          </>
                        ) : (
                          <>
                            <span
                              className={cn(
                                "inline-flex items-center gap-[5px] text-[11.5px] font-bold",
                                ok ? "text-[#1f6f6f]" : "text-[#d9694f]",
                              )}
                            >
                              {ok ? "مطابق" : "عدم تطابق"}
                            </span>
                            {!ok && match?.mismatchNote.trim() ? (
                              <div className="mt-[3px] max-w-[220px] text-[10.5px] leading-snug text-[#d9694f]">
                                {match.mismatchNote}
                              </div>
                            ) : null}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </InsCard>
          ) : null}

          <InsCard
            title="الخدمات والمرافق المحيطة"
            badge={<DetailBadge tone="gray">اختيار متعدد</DetailBadge>}
          >
            <div className="mb-1.5 text-[11px] font-semibold text-text-2">
              الخدمات المتوفرة
            </div>
            <div className="mb-3.5">
              <ChipRow
                items={[...INSPECTOR_SERVICE_OPTIONS]}
                selected={draft.services}
                onToggle={
                  showEditFields
                    ? (item) =>
                        patchDraft({
                          services: draft.services.includes(item)
                            ? draft.services.filter((s) => s !== item)
                            : [...draft.services, item],
                        })
                    : undefined
                }
              />
            </div>
            <div className="mb-1.5 text-[11px] font-semibold text-text-2">
              المرافق المحيطة
            </div>
            <ChipRow
              items={[...INSPECTOR_AMENITY_OPTIONS]}
              selected={draft.amenities}
              onToggle={
                showEditFields
                  ? (item) =>
                      patchDraft({
                        amenities: draft.amenities.includes(item)
                          ? draft.amenities.filter((a) => a !== item)
                          : [...draft.amenities, item],
                      })
                  : undefined
              }
            />
          </InsCard>

          <InsCard
            title="الوصف والملاحظات"
            badge={<DetailBadge tone="gray">نص حر</DetailBadge>}
          >
            {showEditFields ? (
              <>
                <InsEditTextarea
                  label="وصف العقار"
                  value={draft.propertyDescription}
                  onChange={(v) => patchDraft({ propertyDescription: v })}
                />
                <div className="h-3" />
                <InsEditTextarea
                  label="الإيجابيات والعيوب الظاهرة على الحي"
                  value={draft.districtProsCons}
                  onChange={(v) => patchDraft({ districtProsCons: v })}
                />
                <div className="h-3" />
                <InsEditTextarea
                  label="ملاحظات على الأصل"
                  value={draft.assetNotes}
                  onChange={(v) => patchDraft({ assetNotes: v })}
                />
              </>
            ) : (
              <>
                <InsField label="وصف العقار" value={draft.propertyDescription} />
                <div className="h-3" />
                <InsField
                  label="الإيجابيات والعيوب الظاهرة على الحي"
                  value={draft.districtProsCons}
                />
                <div className="h-3" />
                <InsField label="ملاحظات على الأصل" value={draft.assetNotes} />
              </>
            )}
          </InsCard>

          <InsCard
            title="توثيق الخدمات والمرافق"
            badge={
              <DetailBadge tone="teal">
                {inspectorPhotoCoverageLabel(draft)}
              </DetailBadge>
            }
          >
            {showEditFields ? (
              <InspectorDefinedPhotosSection
                draft={draft}
                layout="desktop"
                onPatch={(patch) => patchDraft(patch)}
              />
            ) : photoSlots.length === 0 ? (
              <p className="m-0 text-[12px] text-text-3">
                لم تُختر خدمات أو مرافق للتوثيق.
              </p>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2">
                {photoSlots.map((def) => {
                  const slot = draft.definedPhotos[def.id];
                  const none = Boolean(slot?.none);
                  const firstPhoto = slot?.photos?.[0];
                  const showPhoto = !none && Boolean(firstPhoto);
                  return (
                    <PhotoTile
                      key={def.id}
                      label={def.label}
                      filled={showPhoto}
                      none={none}
                      taskId={draft.taskId}
                      photoRef={
                        firstPhoto
                          ? `slot:${def.id}:${firstPhoto.id}`
                          : undefined
                      }
                      photo={firstPhoto}
                      locationFlag={firstPhoto?.locationFlag}
                      distanceM={firstPhoto?.distanceM}
                    />
                  );
                })}
              </div>
            )}
          </InsCard>

          <InsCard
            title="ملاحظات العقار الموثّقة بالصور"
            badge={
              <DetailBadge tone="red">شرح + صورة لكل ملاحظة</DetailBadge>
            }
          >
            {draft.observations.length === 0 ? (
              <p className="m-0 text-[12px] text-text-3">
                لا توجد ملاحظات مصوّرة بعد.
              </p>
            ) : (
              <div className="grid gap-[9px]">
                {draft.observations.map((obs) => (
                  <div
                    key={obs.id}
                    className="flex items-stretch gap-2.5 rounded-lg border border-border bg-surface-2 p-[9px]"
                  >
                    <div className="grid w-[74px] shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-surface">
                      {showEditFields ? (
                        <InspectorPhotoFilePicker
                          label={obs.photo?.fileName ? "استبدال" : "صورة"}
                          className="h-full min-h-[74px] w-full [&_button]:h-full [&_button]:min-h-[74px] [&_button]:border-0 [&_button]:bg-transparent [&_button]:px-1 [&_button]:py-1 [&_button]:text-[10px]"
                          onFilesSelected={async (files) => {
                            const file = files[0];
                            if (!file) return false;
                            const obsPhotoRef = `observation:${obs.id}`;
                            const result = await uploadInspectorPhotoFromFile(
                              draft.taskId,
                              obsPhotoRef,
                              file,
                              {
                                draft,
                                deedNumber: property.deedNumber,
                              },
                            );
                            if (!result.ok) {
                              throw new Error(result.error);
                            }
                            patchDraft({
                              observations: draft.observations.map((o) =>
                                o.id === obs.id
                                  ? { ...o, photo: result.attachment }
                                  : o,
                              ),
                            });
                            return true;
                          }}
                        />
                      ) : obs.photo ? (
                        <InspectorStampedPhotoThumb
                          stamp={inspectorPhotoStampText(
                            draft,
                            property.deedNumber,
                          )}
                          compact
                          className="!block h-full w-full [&_button]:h-full [&_button]:min-h-[74px] [&_button]:w-full"
                          taskId={draft.taskId}
                          photoRef={`observation:${obs.id}`}
                          attachment={obs.photo}
                        />
                      ) : (
                        <svg
                          width="20"
                          height="20"
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
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      {showEditFields ? (
                        <div className="flex flex-col gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              className={cn(EDIT_CONTROL_CLASS, "max-w-[180px]")}
                              value={obs.category}
                              onChange={(e) =>
                                patchDraft({
                                  observations: draft.observations.map((o) =>
                                    o.id === obs.id
                                      ? { ...o, category: e.target.value }
                                      : o,
                                  ),
                                })
                              }
                            >
                              {INSPECTOR_OBSERVATION_CATEGORIES.map((c) => (
                                <option key={c} value={c}>
                                  {c}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              className="ms-auto text-[11px] font-bold text-danger-text"
                              onClick={() =>
                                patchDraft({
                                  observations: draft.observations.filter(
                                    (o) => o.id !== obs.id,
                                  ),
                                })
                              }
                            >
                              حذف
                            </button>
                          </div>
                          <input
                            type="text"
                            className={EDIT_CONTROL_CLASS}
                            placeholder="اشرح الملاحظة…"
                            value={obs.text}
                            onChange={(e) =>
                              patchDraft({
                                observations: draft.observations.map((o) =>
                                  o.id === obs.id
                                    ? { ...o, text: e.target.value }
                                    : o,
                                ),
                              })
                            }
                          />
                          {obs.photo?.fileName ? (
                            <p className="mb-0 text-[10.5px] text-text-3">
                              مرفق: {obs.photo.fileName}
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <>
                          <span className="rounded-full bg-[#f1ece2] px-2.5 py-0.5 text-[10.5px] font-bold text-[#8c7857]">
                            {obs.category || "ملاحظة"}
                          </span>
                          <p className="mt-1.5 mb-0 text-xs leading-relaxed text-pretty text-text-2">
                            {obs.text}
                          </p>
                          {obs.photo?.fileName ? (
                            <p className="mb-0 mt-1 text-[10.5px] text-text-3">
                              مرفق: {obs.photo.fileName}
                            </p>
                          ) : null}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {showEditFields ? (
              <Button
                type="button"
                variant="default"
                size="sm"
                className="mt-2.5"
                onClick={() =>
                  patchDraft({
                    observations: [
                      ...draft.observations,
                      {
                        id: newObservationId(),
                        category: INSPECTOR_OBSERVATION_CATEGORIES[0],
                        text: "",
                        photo: null,
                      },
                    ],
                  })
                }
              >
                إضافة ملاحظة موثّقة
              </Button>
            ) : null}
          </InsCard>
        </>
      )}

      {showEditFields ? (
        <div className="mt-3.5 flex flex-col gap-3 rounded-lg border border-[color-mix(in_srgb,var(--gold)_35%,transparent)] bg-[color-mix(in_srgb,var(--gold)_10%,transparent)] px-3.5 py-[11px] max-lg:gap-3.5 max-lg:rounded-[14px] max-lg:px-4 max-lg:py-3.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-2.5">
          <div className="text-xs leading-relaxed text-text-2 max-lg:text-[13px]">
            <strong className="text-gold-d">وضع الإدخال</strong> — تُدخل
            بيانات المعاينة الميدانية وتُرسل بعد اكتمالها.
          </div>
          <div className="flex shrink-0 flex-wrap gap-2 max-lg:w-full max-lg:flex-col">
            <Button
              type="button"
              size="sm"
              variant="primary"
              loading={saving}
              disabled={saving}
              className="max-lg:min-h-12 max-lg:w-full max-lg:rounded-[12px] max-lg:text-[14px] max-lg:font-bold"
              onClick={() => void handleSaveAndSubmit()}
            >
              حفظ وإرسال
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={saving}
              className="max-lg:min-h-11 max-lg:w-full max-lg:rounded-[12px] max-lg:text-[13px]"
              onClick={() => void handleCancelEdit()}
            >
              إلغاء
            </Button>
          </div>
        </div>
      ) : null}
      <AppModal
        open={Boolean(pendingMapMove)}
        title="تأكيد تحريك الموقع"
        onClose={cancelPendingMapMove}
        footer={
          <>
            <Button type="button" onClick={cancelPendingMapMove}>
              إلغاء
            </Button>
            <Button
              type="button"
              variant="primary"
              showActionToast={false}
              onClick={confirmPendingMapMove}
            >
              تثبيت الموقع الجديد
            </Button>
          </>
        }
      >
        <p className="m-0 text-[13px] leading-6 text-text-2">
          هل تريد اعتماد هذا الموقع بدل الموقع الحالي؟ يمكنك الرجوع للموقع السابق
          بعد التثبيت.
        </p>
      </AppModal>
    </div>
  );
}
