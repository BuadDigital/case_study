"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode, Fragment } from "react";
import { ReturnedForCorrectionNote } from "../ui/ReturnedForCorrectionNote";
import {
  AppModal,
  Button,
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
  mergeInspectorWorkspacePatch,
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
import { InspectorWorkspaceWizard } from "../field-inspection/InspectorWorkspaceWizard";
import { InspectorPhotoFilePicker } from "../field-inspection/InspectorPhotoFilePicker";
import { InspectorStampedPhotoThumb } from "../field-inspection/InspectorStampedPhotoThumb";
import { InspectorMovablesDescriptionField } from "../field-inspection/InspectorMovablesDescriptionField";
import { photoLocationFlagLabel } from "@platform/app-shared/media/photo-location";
import {
  firstInspectorWorkspaceError,
  firstInspectorWorkspaceErrorTarget,
  inspectorInvalidControlClass,
  scrollToInspectorField,
  validateInspectorWorkspace,
  type InspectorWorkspaceFieldErrors,
} from "../../lib/prototype/inspector-workspace-validation";
import { finalizeInspectorWorkspace } from "../../lib/prototype/finalize-field-inspection-submission";
import type { PartyTaskPageDef } from "@platform/app-shared/prototype/party-task-pages";
import type { WorkflowTask } from "../../lib/prototype/tasks-storage";
import type { PropertyDetailPartyCard } from "../../lib/prototype/property-detail-parties";
import type { PropertyDetailDocumentEntry } from "../../lib/prototype/property-detail-documents";
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
  steps = false,
  caseStudyDef,
  includeRetiredFeatureKeys,
  serviceProofFromTransactionPhotos = false,
  transactionPhotos = [],
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
  /** Render the 3-step wizard (inspector workspace). */
  steps?: boolean;
  /** Enables case-study questions card when provided. */
  caseStudyDef?: PartyTaskPageDef;
  /** Show retired inspector fields (e.g. zoneStatus for case-study specialist). */
  includeRetiredFeatureKeys?: readonly string[];
  /** Case-study specialist: require كهرباء/ماء proof from transaction photos. */
  serviceProofFromTransactionPhotos?: boolean;
  transactionPhotos?: PropertyDetailDocumentEntry[];
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
    // Update the controlled inputs immediately — network save is debounced.
    setDraft((prev) =>
      prev ? mergeInspectorWorkspacePatch(prev, patch) : prev,
    );
    void updateInspectorWorkspace(inspectionTask.id, patch)
      .then((next) => {
        if (!next) return;
        setDraft((prev) => {
          if (!prev) return next;
          const prevTs = Date.parse(prev.updatedAtUtc);
          const nextTs = Date.parse(next.updatedAtUtc);
          if (
            Number.isFinite(prevTs) &&
            Number.isFinite(nextTs) &&
            prevTs > nextTs
          ) {
            return prev;
          }
          return next;
        });
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
        includeRetiredFeatureKeys,
        specialistProofServicesOnly: serviceProofFromTransactionPhotos,
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
      showToast(
        result.queued
          ? "محفوظة للمزامنة — ستُرسل عند عودة الاتصال"
          : "تم حفظ بيانات المعاينة وإرسالها.",
        result.queued ? "info" : "success",
      );
      if (!result.queued) {
        onSubmitted?.();
      }
      if (!lockEditMode && !result.queued) {
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

  const canReviewPackage =
    !editMode && Boolean(inspectionTask) && draft?.status === "submitted";
  const inspectionAccepted = isInspectorWorkspaceAccepted(draft);
  const canAccept = canReviewPackage && !inspectionAccepted;
  const canReturn = canReviewPackage && !inspectionAccepted;

  return (
    <div id="pdInspection" className="pt-5">
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
      ) : draft && inspectionTask ? (
        <InspectorWorkspaceWizard
          property={property}
          draft={draft}
          inspectionTask={inspectionTask}
          caseStudyDef={caseStudyDef}
          includeRetiredFeatureKeys={includeRetiredFeatureKeys}
          serviceProofFromTransactionPhotos={serviceProofFromTransactionPhotos}
          transactionPhotos={transactionPhotos}
          locked={locked || !showEditFields}
          saving={saving}
          fieldErrors={fieldErrors}
          flat={!steps}
          onPatch={(patch) => patchDraft(patch)}
          onSubmit={() => void handleSaveAndSubmit()}
          onCancel={() => void handleCancelEdit()}
          onMapMove={requestMapMove}
          mapPinned={mapPinned}
          onPin={() => {
            if (!draft.mapLatitude.trim() && mapGeo) {
              patchDraft({
                mapLatitude: mapGeo.lat.toFixed(5),
                mapLongitude: mapGeo.lng.toFixed(5),
              });
            }
            setMapPinned(true);
            showToast("تم تثبيت الموقع", "success");
          }}
          mapPinEpoch={mapPinEpoch}
        />
      ) : (
        <EmptyState
          title="لا توجد بيانات معاينة بعد"
          sub="يظهر التقرير التفصيلي بعد بدء المعاين بإدخال البيانات."
        />
      )}

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
