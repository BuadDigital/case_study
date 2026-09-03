"use client";

/**
 * All non-rendering workflow behind `FieldInspectionWorkBody`: workspace load,
 * debounced field persistence, map-pin moves, draft save and submit. The
 * component consumes the returned bag and keeps JSX plus event wiring only.
 */
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { useToast } from "@platform/ui-kit";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import { useIdempotentAction } from "@platform/app-shared";
import { useInspectorKeyAvailability } from "./InspectorKeyStatusTab";
import {
  boundariesMarkedUnavailable,
  formatPropertyDeedDisplay,
} from "../../lib/app-data/po-intake-data";
import {
  declarationPhoneGate,
  hasAnyPartyPhone,
} from "../../lib/app-data/documentary-workflow-gates";
import { usePoRecordQuery } from "../../query/case-study-queries";
import { useFacadeOptions } from "../../query/use-facade-options";
import { type InspectorStepId } from "./InspectorStepNav";
import { useInspectorSaveState } from "./InspectorSaveChip";
import {
  ensureInspectorOriginalMapOnSubmit,
  isInspectorWorkspaceLocked,
  mapPinPatchForActor,
  type InspectorWorkspaceDraft,
} from "../../lib/app-data/inspector-workspace-data";
import { finalizeInspectorWorkspace } from "../../lib/app-data/finalize-field-inspection-submission";
import { mergeInspectorWorkspacePatch } from "../../lib/app-data/inspector-workspace-model";
import {
  getOrCreateInspectorWorkspace,
  saveInspectorWorkspaceDraft,
  updateInspectorWorkspace,
} from "../../lib/app-data/inspector-workspace-commands";
import {
  firstInspectorWorkspaceError,
  firstInspectorWorkspaceErrorTarget,
  scrollToInspectorField,
  validateInspectorWorkspace,
  type InspectorWorkspaceFieldErrors,
} from "../../lib/app-data/inspector-workspace-validation";
import type { WorkflowTask } from "../../lib/app-data/tasks-storage";
import type { FieldInspectionWorkHostRef } from "./FieldInspectionWorkParts";
import {
  inspectorErrorLinks,
  newerInspectorDraft,
  SAVE_CHIP_SECTION_BY_FIELD,
} from "./field-inspection-work-state";

export function useFieldInspectionWorkflow({
  task,
  hostRef,
}: {
  task: WorkflowTask;
  hostRef: RefObject<FieldInspectionWorkHostRef | null>;
}) {
  const { role } = useAppAccess();
  const { showToast } = useToast();
  const propertyId = task.propertyId ?? "";
  const { data: record } = usePoRecordQuery(task.poNumber);
  const property = record?.properties.find((p) => p.id === propertyId);
  const keyAvailability = useInspectorKeyAvailability(task);
  const facadeTypeOptions = useFacadeOptions() ?? [];
  const [activeStep, setActiveStep] = useState<InspectorStepId>(1);
  const { saveState, markDirty } = useInspectorSaveState({
    location: "empty" as const,
    access: "empty" as const,
    photos: "empty" as const,
  });

  const [draft, setDraft] = useState<InspectorWorkspaceDraft | null>(null);
  const [fieldErrors, setFieldErrors] = useState<InspectorWorkspaceFieldErrors>(
    {},
  );
  const [formError, setFormError] = useState<string | null>(null);
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
  const [mapPinned, setMapPinned] = useState(false);
  const mapPinnedRef = useRef(false);
  mapPinnedRef.current = mapPinned;

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
    if (!task.id) return;
    try {
      setMapPinned(sessionStorage.getItem(`inspector-map-pinned:${task.id}`) === "1");
    } catch {
      setMapPinned(false);
    }
  }, [task.id]);

  useEffect(() => {
    if (!task.id) return;
    try {
      sessionStorage.setItem(
        `inspector-map-pinned:${task.id}`,
        mapPinned ? "1" : "0",
      );
    } catch {
      /* ignore */
    }
  }, [task.id, mapPinned]);

  const locked =
    task.status === "completed" ||
    (draft ? isInspectorWorkspaceLocked(draft.status) : false);
  const workLocked = locked;
  const boundariesUnavailable = property
    ? boundariesMarkedUnavailable(property.boundariesAvailability)
    : false;

  const { execute: executeInspectorSubmit } = useIdempotentAction(
    useCallback(
      async (idempotencyKey: string) =>
        finalizeInspectorWorkspace(task.id, idempotencyKey),
      [task.id],
    ),
  );

  const persist = useCallback(
    (patch: Parameters<typeof updateInspectorWorkspace>[1]) => {
      if (!task.id || workLocked) return;
      setFieldErrors({});
      setFormError(null);
      // Design: each step-1 section shows its own مسودة/محفوظ chip.
      for (const key of Object.keys(patch)) {
        const section = SAVE_CHIP_SECTION_BY_FIELD[key];
        if (section) markDirty(section);
      }
      // Update controlled inputs immediately — network save is debounced.
      setDraft((prev) =>
        prev ? mergeInspectorWorkspacePatch(prev, patch) : prev,
      );
      void updateInspectorWorkspace(task.id, patch)
        .then((next) => {
          if (!next) return;
          setDraft((prev) => newerInspectorDraft(prev, next));
        })
        .catch((err: unknown) => {
          showToast(
            err instanceof Error ? err.message : "تعذّر حفظ المعاينة — حاول مرة أخرى",
            "error",
          );
        });
    },
    [task.id, workLocked, showToast, markDirty],
  );

  const requestMapMove = useCallback(
    (lat: number, lng: number): "saved" | "pending" | "same" => {
      if (!draft) return "same";
      const nextLat = lat.toFixed(5);
      const nextLng = lng.toFixed(5);
      const curLat = draft.mapLatitude.trim();
      const curLng = draft.mapLongitude.trim();
      if (!curLat || !curLng || !mapPinnedRef.current) {
        persist(mapPinPatchForActor(draft, nextLat, nextLng, "inspector"));
        return "saved";
      }
      if (curLat === nextLat && curLng === nextLng) return "same";
      setPendingMapMove({
        nextLat,
        nextLng,
        prevLat: curLat,
        prevLng: curLng,
      });
      return "pending";
    },
    [draft, persist],
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
      classification: property?.classification,
      propertyType: property?.propertyType,
    });
    setFieldErrors(errors);
    if (
      Object.keys(errors).length > 0 ||
      (errors.emptyFeatureKeys?.length ?? 0) > 0
    ) {
      const message = firstInspectorWorkspaceError(errors);
      setFormError(message);
      showToast(message ?? "يرجى تصحيح الحقول", "error");
      const targetId = firstInspectorWorkspaceErrorTarget(errors);
      if (targetId) {
        window.setTimeout(() => scrollToInspectorField(targetId), 60);
      }
      return false;
    }

    hostRef.current?.onSavingChange?.(true);
    setFormError(null);
    try {
      const toSave = ensureInspectorOriginalMapOnSubmit(draft);
      const saved = await saveInspectorWorkspaceDraft(toSave);
      setDraft(saved);
    } catch (err: unknown) {
      hostRef.current?.onSavingChange?.(false);
      const message =
        err instanceof Error ? err.message : "تعذّر حفظ المعاينة قبل الإرسال";
      setFormError(message);
      showToast(message, "error");
      return false;
    }
    const patched = await updateInspectorWorkspace(task.id, {
      vacantLand: draft.vacantLand,
      keyAvailable: keyAvailability.keyAvailable,
      clientDeclarationSigned: draft.clientDeclarationSigned,
      declarationPhoneSatisfied:
        draft.declarationPhoneSatisfied ||
        (draft.clientDeclarationSigned && hasPhone),
    });
    if (patched) setDraft(patched);
    const outcome = await executeInspectorSubmit();
    hostRef.current?.onSavingChange?.(false);

    if (outcome.status === "skipped") return false;

    const result = outcome.value;
    if (result.ok) {
      setDraft(result.draft);
      if (result.queued) {
        showToast("محفوظة للمزامنة — ستُرسل عند عودة الاتصال", "info");
      } else {
        showToast("تم حفظ بيانات المعاينة وإرسالها.", "success");
        hostRef.current?.onSubmitted?.();
      }
      return true;
    }

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
    executeInspectorSubmit,
  ]);

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
        const outcome = requestMapMove(pos.coords.latitude, pos.coords.longitude);
        if (outcome === "saved") {
          showToast("تم التقاط موقعك الحالي", "success");
        }
      },
      () => {
        showToast("تعذّر التقاط الموقع — تأكد من صلاحية الموقع", "error");
      },
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  }, [requestMapMove, showToast]);

  const scrollToErrorTarget = useCallback((targetId: string) => {
    scrollToInspectorField(targetId);
  }, []);

  const errorLinks = inspectorErrorLinks(fieldErrors);

  function confirmPendingMapMove() {
    if (!pendingMapMove || !draft) return;
    setMapBackup({
      lat: pendingMapMove.prevLat,
      lng: pendingMapMove.prevLng,
    });
    persist(
      mapPinPatchForActor(
        draft,
        pendingMapMove.nextLat,
        pendingMapMove.nextLng,
        "inspector",
      ),
    );
    setPendingMapMove(null);
    setMapPinned(true);
  }

  function cancelPendingMapMove() {
    setPendingMapMove(null);
    setMapPinEpoch((n) => n + 1);
  }

  function undoMapMove() {
    if (!mapBackup || !draft) return;
    persist(mapPinPatchForActor(draft, mapBackup.lat, mapBackup.lng, "inspector"));
    setMapBackup(null);
    setMapPinEpoch((n) => n + 1);
  }
  return {
    activeStep,
    boundariesUnavailable,
    cancelPendingMapMove,
    captureDeviceGps,
    confirmPendingMapMove,
    draft,
    errorLinks,
    facadeTypeOptions,
    fieldErrors,
    formError,
    keyAvailability,
    locked,
    mapBackup,
    mapPinEpoch,
    mapPinned,
    markDirty,
    pendingMapMove,
    persist,
    property,
    propertyId,
    requestMapMove,
    role,
    saveDraft,
    saveState,
    scrollToErrorTarget,
    setActiveStep,
    setMapPinned,
    showToast,
    submit,
    undoMapMove,
    workLocked,
  };
}
