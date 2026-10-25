"use client";

/**
 * All non-rendering workflow behind `FieldInspectionWorkBody`: workspace load,
 * debounced field persistence, map-pin moves, draft save and submit. The
 * component consumes the returned bag and keeps JSX plus event wiring only.
 */
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { useLatestRef } from "@platform/app-shared/hooks/use-latest-ref";
import { useToast } from "@platform/ui-kit";
import { scheduleScrollToFormField } from "@platform/app-shared/form-ux";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import { useIdempotentAction } from "@platform/app-shared";
import { useInspectorKeyAvailability } from "./InspectorKeyStatusTab";
import { useInspectorWorkspaceLoad } from "./useInspectorWorkspaceLoad";
import { inspectorKeySubmitGate } from "../../lib/app-data/inspector-key-gate";
import { boundariesMarkedUnavailable } from "../../lib/app-data/po-intake-data";
import {
  declarationPhoneGate,
  hasAnyPartyPhone,
} from "../../lib/app-data/documentary-workflow-gates";
import { usePoRecordQuery } from "../../query/case-study-queries";
import { useFacadeOptions } from "../../query/use-facade-options";
import { type InspectorStepId } from "./InspectorStepNav";
import { useInspectorSaveState } from "./InspectorSaveChip";
import {
  isInspectorWorkspaceLocked,
  mapPinPatchForActor,
  type InspectorWorkspaceDraft,
} from "../../lib/app-data/inspector-workspace-data";
import { flushInspectorInventorySave } from "./inspector-inventory-flush";
import { finalizeInspectorWorkspace } from "../../lib/app-data/finalize-field-inspection-submission";
import { sendInspectorSubmission } from "./inspector-submit-send";
import {
  inspectorPatchKeys,
  mergeInspectorWorkspacePatch,
  resolveInspectorWorkspacePatch,
  setCache,
  type InspectorWorkspacePatchInput,
} from "../../lib/app-data/inspector-workspace-model";
import {
  OFFLINE_ATTACHMENT_MAP_EVENT,
  rewriteLocalAttachmentIds,
} from "@platform/offline-client";
import {
  saveInspectorWorkspaceDraft,
  updateInspectorWorkspace,
} from "../../lib/app-data/inspector-workspace-commands";
import {
  firstInspectorWorkspaceError,
  firstInspectorWorkspaceErrorTarget,
  inspectorWizardStepForErrorTarget,
  inspectorMustDecideDeedMatch,
  inspectorWorkspaceHasBlockingErrors,
  scheduleInspectorErrorScroll,
  validateInspectorWorkspace,
  type InspectorWorkspaceFieldErrors,
} from "../../lib/app-data/inspector-workspace-validation";
import type { WorkflowTask } from "../../lib/app-data/tasks";
import type { FieldInspectionWorkHostRef } from "./FieldInspectionWorkParts";
import {
  inspectorErrorLinks,
  newerInspectorDraft,
  SAVE_CHIP_SECTION_BY_FIELD,
} from "./field-inspection-work-state";

/** The bag the body and its section cards consume; sections `Pick` from it. */
export type FieldInspectionWorkflow = ReturnType<typeof useFieldInspectionWorkflow>;

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
  const draftRef = useRef<InspectorWorkspaceDraft | null>(null);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);
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
  const mapPinned = Boolean(draft?.mapPinned);
  const mapPinnedRef = useLatestRef(mapPinned);
  const sessionPinMigratedRef = useRef<string | null>(null);

  const onLoadError = useCallback(
    (message: string) => {
      showToast(message, "error");
      setFormError(message);
    },
    [showToast, setFormError],
  );
  useInspectorWorkspaceLoad({ task, propertyId, property, setDraft, onError: onLoadError });

  useEffect(() => {
    const onMap = (event: Event) => {
      const map = (event as CustomEvent<Record<string, string>>).detail;
      if (!map || Object.keys(map).length === 0) return;
      const idMap = new Map(Object.entries(map));
      setDraft((prev) => {
        if (!prev) return prev;
        const next = JSON.parse(
          rewriteLocalAttachmentIds(JSON.stringify(prev), idMap),
        ) as InspectorWorkspaceDraft;
        setCache(next);
        return next;
      });
    };
    window.addEventListener(OFFLINE_ATTACHMENT_MAP_EVENT, onMap);
    return () => window.removeEventListener(OFFLINE_ATTACHMENT_MAP_EVENT, onMap);
  }, []);

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
    (input: InspectorWorkspacePatchInput) => {
      if (!task.id || workLocked) return;
      setFieldErrors({});
      setFormError(null);
      // Design: each step-1 section shows its own مسودة/محفوظ chip.
      for (const key of inspectorPatchKeys(draftRef.current, input)) {
        const section = SAVE_CHIP_SECTION_BY_FIELD[key];
        if (section) markDirty(section);
      }
      // Update controlled inputs immediately — network save is debounced. Built from the latest draft, so two
      // photo uploads that finish close together both survive.
      setDraft((prev) =>
        prev
          ? mergeInspectorWorkspacePatch(prev, resolveInspectorWorkspacePatch(prev, input))
          : prev,
      );
      void updateInspectorWorkspace(task.id, input)
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
    [task.id, workLocked, showToast, markDirty, setDraft, setFieldErrors, setFormError],
  );

  // One-time migrate: old builds only stored pin in sessionStorage.
  useEffect(() => {
    if (!draft || !task.id || draft.mapPinned || workLocked) return;
    if (sessionPinMigratedRef.current === task.id) return;
    sessionPinMigratedRef.current = task.id;
    try {
      if (sessionStorage.getItem(`inspector-map-pinned:${task.id}`) !== "1") {
        return;
      }
    } catch {
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time migration of a sessionStorage pin into the saved draft; persist() saves it and updates the form together
    persist({ mapPinned: true });
  }, [draft, task.id, workLocked, persist]);

  const setMapPinned = useCallback(
    (pinned: boolean) => {
      if (!draft) return;
      if (pinned) {
        const lat = draft.mapLatitude.trim();
        const lng = draft.mapLongitude.trim();
        persist({
          ...(lat && lng
            ? mapPinPatchForActor(draft, lat, lng, "inspector")
            : {}),
          mapPinned: true,
        });
        return;
      }
      persist({ mapPinned: false });
    },
    [draft, persist],
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
    [draft, persist, setPendingMapMove, mapPinnedRef],
  );

  const saveDraft = useCallback(async (): Promise<boolean> => {
    if (!draft || locked) return false;
    hostRef.current?.onSavingChange?.(true);
    try {
      const next = await saveInspectorWorkspaceDraft(draft);
      setDraft((prev) => newerInspectorDraft(prev, next));
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
  }, [draft, locked, hostRef, showToast, setDraft, setFormError]);

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
    // The key status is sent with the inspection — never a guessed «no key» while it is unknown.
    const keyGate = inspectorKeySubmitGate(keyAvailability);
    if (!keyGate.ok) {
      setFormError(keyGate.reason);
      showToast(keyGate.reason, "error");
      return false;
    }

    // The inventory card keeps a debounced save; land it before the gates read the server.
    await flushInspectorInventorySave();

    const errors = validateInspectorWorkspace(draft, {
      boundariesUnavailable,
      classification: property?.classification,
      propertyType: property?.propertyType,
      requireDeedMatch: property ? inspectorMustDecideDeedMatch(property) : false,
      requireLandStructures: true,
    });
    setFieldErrors(errors);
    if (inspectorWorkspaceHasBlockingErrors(errors)) {
      const message = firstInspectorWorkspaceError(errors);
      setFormError(message);
      showToast(message ?? "يرجى تصحيح الحقول", "error");
      const targetId = firstInspectorWorkspaceErrorTarget(errors);
      if (targetId) setActiveStep(inspectorWizardStepForErrorTarget(targetId));
      scheduleInspectorErrorScroll(errors);
      return false;
    }

    // Everything the form can check itself has passed — a host with a sending dialog opens it now.
    hostRef.current?.onSubmitStarted?.();
    return sendInspectorSubmission({
      draft,
      taskId: task.id,
      keyAvailable: keyGate.keyAvailable,
      hasPhone,
      execute: executeInspectorSubmit,
      hostRef,
      setDraft,
      setFieldErrors,
      setFormError,
      setActiveStep,
      showToast,
    });
  }, [
    draft,
    locked,
    hostRef,
    task.id,
    showToast,
    role,
    property,
    keyAvailability,
    boundariesUnavailable,
    executeInspectorSubmit,
    setDraft,
    setFieldErrors,
    setFormError,
    setActiveStep,
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
    setActiveStep(inspectorWizardStepForErrorTarget(targetId));
    scheduleScrollToFormField(targetId, 80);
  }, [setActiveStep]);

  const errorLinks = inspectorErrorLinks(fieldErrors);

  function confirmPendingMapMove() {
    if (!pendingMapMove || !draft) return;
    setMapBackup({
      lat: pendingMapMove.prevLat,
      lng: pendingMapMove.prevLng,
    });
    persist({
      ...mapPinPatchForActor(
        draft,
        pendingMapMove.nextLat,
        pendingMapMove.nextLng,
        "inspector",
      ),
      mapPinned: true,
    });
    setPendingMapMove(null);
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
