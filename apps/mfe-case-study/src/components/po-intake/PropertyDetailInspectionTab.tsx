"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, Fragment } from "react";
import { ReturnedForCorrectionNote } from "../ui/ReturnedForCorrectionNote";
import {
  AppModal,
  Button,
  InlineLoadingSkeleton,
  cn,
  useToast,
} from "@platform/ui-kit";
import { useIdempotentAction } from "@platform/app-shared";
import { DetailBadge, EmptyState } from "./PropertyDetailFields";
import {
  PROPERTY_BOUNDARY_ROWS,
  approximatePropertyGeo,
  boundariesMarkedUnavailable,
  formatDateAr,
  formatPropertyDeedDisplay,
  type PoPropertyIntake,
} from "../../lib/app-data/po-intake-data";
import {
  FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT,
  mergeInspectorWorkspacePatch,
} from "../../lib/app-data/inspector-workspace-model";
import { loadInspectorWorkspaceSnapshot } from "../../lib/app-data/inspector-workspace-reads";
import {
  getOrCreateInspectorWorkspace,
  saveInspectorWorkspaceDraft,
  updateInspectorWorkspace,
} from "../../lib/app-data/inspector-workspace-commands";
import {
  INSPECTOR_SERVICE_OPTIONS,
  INSPECTOR_AMENITY_OPTIONS,
  INSPECTOR_OBSERVATION_CATEGORIES,
  MOVABLES_DESCRIPTION_KEY,
  activeMapDiffersFromInspectorOriginal,
  ensureInspectorOriginalMapOnSubmit,
  inspectorFeatureRequiresPhoto,
  inspectorPhotoCoverageLabel,
  inspectorPhotoStampText,
  isCommercialShopInspectionContext,
  isInspectorWorkspaceLocked,
  isLandInspectionContext,
  isMovablesPresent,
  isShopHiddenInspectorComponentKey,
  listServiceAmenityPhotoSlots,
  mapPinPatchForActor,
  newObservationId,
  parseInspectorCount,
  patchInspectorFeatureValues,
  restoreInspectorOriginalMapPin,
  visibleInspectorFeatureFields,
  type InspectorBoundaryKey,
  type InspectorComponentPhotoKey,
  type InspectorPhotoAttachment,
  type InspectorSlotPhoto,
  type InspectorWorkspaceDraft,
} from "../../lib/app-data/inspector-workspace-data";
import {
  clearInspectorPhotoDataUrl,
  getInspectorPhotoDataUrl,
  prefetchInspectorPhoto,
  uploadInspectorPhotoFromFile,
} from "../../lib/app-data/inspector-photo-upload";
import {
  INSPECTOR_PHOTO_ACCEPT,
  filterInspectorPhotoFiles,
  useInspectorPhotoDropZone,
} from "../../lib/app-data/inspector-photo-drop";
import { FieldComparableCaptureSection } from "../field-inspection/FieldComparableCaptureSection";
import {
  InspectorWorkspaceSubmitFooter,
  InspectorWorkspaceWizard,
} from "../field-inspection/InspectorWorkspaceWizard";
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
} from "../../lib/app-data/inspector-workspace-validation";
import { finalizeInspectorWorkspace } from "../../lib/app-data/finalize-field-inspection-submission";
import type { PartyTaskPageDef } from "@platform/app-shared/app-data/party-task-pages";
import type { WorkflowTask } from "../../lib/app-data/tasks-storage";
import type { PropertyDetailPartyCard } from "../../lib/app-data/property-detail-parties";
import type { PropertyDetailDocumentEntry } from "../../lib/app-data/property-detail-documents";
import {
  EDIT_CONTROL_CLASS,
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
  /** Render after wizard; submit footer follows this block (case-study workspace). */
  submitFooterAfter,
  submitSuccessToast,
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
  submitFooterAfter?: ReactNode;
  /** Override success toast after حفظ وإرسال (e.g. specialist → appraiser handoff). */
  submitSuccessToast?: string;
}) {
  const { showToast } = useToast();
  const [draft, setDraft] = useState<InspectorWorkspaceDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<InspectorWorkspaceFieldErrors>(
    {},
  );
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

  const { execute: executeInspectorSubmit, loading: inspectorSubmitting } =
    useIdempotentAction(
      useCallback(
        async (idempotencyKey: string) => {
          if (!inspectionTask) {
            throw new Error("لا توجد مهمة معاينة");
          }
          return finalizeInspectorWorkspace(inspectionTask.id, idempotencyKey);
        },
        [inspectionTask],
      ),
    );

  const submitBusy = saving || inspectorSubmitting;

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
    if (!inspectionTask || !editMode) return;
    const taskId = inspectionTask.id;
    const onChange = () => {
      void loadInspectorWorkspaceSnapshot(taskId).then((loaded) => {
        if (!loaded) return;
        setDraft((prev) => {
          if (!prev) return loaded;
          const prevTs = Date.parse(prev.updatedAtUtc);
          const nextTs = Date.parse(loaded.updatedAtUtc);
          if (
            Number.isFinite(prevTs) &&
            Number.isFinite(nextTs) &&
            prevTs > nextTs
          ) {
            return prev;
          }
          return loaded;
        });
      });
    };
    window.addEventListener(FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT, onChange);
    return () => {
      window.removeEventListener(
        FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT,
        onChange,
      );
    };
  }, [inspectionTask, editMode]);

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

  const locked =
    Boolean(draft && isInspectorWorkspaceLocked(draft.status)) &&
    !serviceProofFromTransactionPhotos;
  const showEditFields = editMode && Boolean(draft) && !locked;
  const mapActor = serviceProofFromTransactionPhotos
    ? "specialist"
    : "inspector";

  function patchDraft(patch: Parameters<typeof updateInspectorWorkspace>[1]) {
    if (!inspectionTask || locked) return;
    setFieldErrors({});
    setFormError(null);
    // Update the controlled inputs immediately — network save is debounced.
    setDraft((prev) =>
      prev ? mergeInspectorWorkspacePatch(prev, patch) : prev,
    );
    void updateInspectorWorkspace(inspectionTask.id, patch, {
      allowWhenSubmitted: serviceProofFromTransactionPhotos,
    })
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
    if (!draft) return;
    const nextLat = lat.toFixed(5);
    const nextLng = lng.toFixed(5);
    const curLat = (draft.mapLatitude ?? "").trim();
    const curLng = (draft.mapLongitude ?? "").trim();
    if (!curLat || !curLng || !mapPinnedRef.current) {
      patchDraft(mapPinPatchForActor(draft, nextLat, nextLng, mapActor));
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
    if (!pendingMapMove || !draft) return;
    setMapBackup({
      lat: pendingMapMove.prevLat,
      lng: pendingMapMove.prevLng,
    });
    patchDraft(
      mapPinPatchForActor(
        draft,
        pendingMapMove.nextLat,
        pendingMapMove.nextLng,
        mapActor,
      ),
    );
    setPendingMapMove(null);
    setMapPinned(true);
  }

  function restoreInspectorMap() {
    if (!draft) return;
    const restored = restoreInspectorOriginalMapPin(draft);
    if (!restored) return;
    patchDraft(restored);
    setMapPinned(true);
    setMapPinEpoch((n) => n + 1);
    showToast("تم استعادة موقع المعاين", "success");
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
      const baseConfirmed: InspectorWorkspaceDraft = {
        ...draft,
        inspectionConfirmed: true,
      };
      const confirmed =
        mapActor === "inspector"
          ? ensureInspectorOriginalMapOnSubmit(baseConfirmed)
          : baseConfirmed;
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

      const outcome = await executeInspectorSubmit();
      if (outcome.status === "skipped") return;

      const result = outcome.value;
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
          : submitSuccessToast ?? "تم حفظ بيانات المعاينة وإرسالها.",
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

  if (!inspectionCard) {
    return (
      <EmptyState
        title="لم يُعيَّن معاين لهذا العقار"
        sub="سيظهر تقرير المعاينة هنا بعد التعيين من التوزيع."
      />
    );
  }

  if (loading) return <InlineLoadingSkeleton />;

  return (
    <div id="pdInspection" className="pt-5">
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
          saving={submitBusy}
          fieldErrors={fieldErrors}
          flat={!steps}
          hideSubmitFooter={Boolean(submitFooterAfter)}
          onPatch={(patch) => patchDraft(patch)}
          onSubmit={() => void handleSaveAndSubmit()}
          onCancel={() => void handleCancelEdit()}
          onMapMove={requestMapMove}
          mapPinned={mapPinned}
          mapActor={mapActor}
          canRestoreInspectorMap={
            mapActor === "specialist" &&
            Boolean(draft && activeMapDiffersFromInspectorOriginal(draft))
          }
          onRestoreInspectorMap={restoreInspectorMap}
          onPin={() => {
            if (!draft) return;
            const nextLat =
              draft.mapLatitude.trim() ||
              (mapGeo ? mapGeo.lat.toFixed(5) : "");
            const nextLng =
              draft.mapLongitude.trim() ||
              (mapGeo ? mapGeo.lng.toFixed(5) : "");
            if (nextLat && nextLng) {
              patchDraft(mapPinPatchForActor(draft, nextLat, nextLng, mapActor));
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

      {submitFooterAfter}

      {submitFooterAfter && showEditFields && draft ? (
        <InspectorWorkspaceSubmitFooter
          draft={draft}
          saving={submitBusy}
          onPatch={(patch) => patchDraft(patch)}
          onSubmit={() => void handleSaveAndSubmit()}
          onCancel={() => void handleCancelEdit()}
        />
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
