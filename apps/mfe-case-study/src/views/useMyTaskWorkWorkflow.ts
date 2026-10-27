"use client";

/**
 * All non-rendering state behind `CaseStudyTaskWork`: the PO record load, the
 * property draft and its field errors, the distribution draft sync, the
 * step/screen decisions and the chrome titles. Commands live in
 * `useMyTaskWorkCommands`; the view and its regions consume the returned bag.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useLatestRef } from "@platform/app-shared/hooks/use-latest-ref";
import { useRouter } from "next/navigation";
import { useToast } from "@platform/ui-kit";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import type { FieldErrors } from "@platform/app-shared/registration/registration-utils";
import { useStaffUsersQuery } from "@settings/mfe/query/settings-queries";
import {
  FAILURE_RAISER_SPECIALIST,
  FAILURE_RAISER_SUPERVISOR,
} from "@failures/mfe/lib/failure-party-roles";
import { myTasksPath } from "../lib/my-task-routes";
import {
  clientFieldPolicyFor,
  emptyProperty,
  type AssignmentType,
  type BourseDeedVitality,
  type PoPropertyIntake,
  type PropertyIdentifierType,
} from "../lib/app-data/po-intake-data";
import { findPriorDeedFull } from "../lib/app-data/po-intake-reads";
import { createDraftPropertyForSlot } from "../lib/app-data/po-intake-commands";
import {
  engineeringOfficeAvailable,
  engineeringOfficeUnavailableReason,
  migrateDistribution,
  patchTaskDistribution,
  type TaskDistributionDraft,
  type WorkflowTask,
} from "../lib/app-data/tasks";
import { usePoRecordQuery } from "../query/case-study-queries";
import {
  canShowPrimarySave,
  canWorkTaskStep,
  DEED_VITALITY_REQUIRED_ERROR,
  DISTRIBUTION_SAVE_ERROR,
  newPropertyDraftKey,
  resolveTaskWorkScreen,
  resolveTaskWorkSteps,
  taskWorkRoleFlags,
  taskWorkSaveLabel,
  taskWorkTitles,
  type TaskWorkLayout,
} from "./my-task-work-state";
import { useMyTaskWorkCommands } from "./useMyTaskWorkCommands";
import {
  cancelPropertyFieldAutosave,
  flushPropertyFieldAutosave,
  peekPropertyFieldAutosave,
  queuePropertyFieldAutosave,
} from "../lib/app-data/property-field-autosave";

export type CaseStudyTaskWorkProps = {
  task: WorkflowTask;
  onRefresh: () => void;
  layout?: TaskWorkLayout;
  onClose?: () => void;
  /** After successful Infath save (panel flow): advance or route by identifier type. */
  onEnfathSaved?: (
    taskId: string,
    meta: { identifierType: PropertyIdentifierType },
  ) => void | Promise<void>;
};

/** The bag the view and its regions consume; regions `Pick` from it. */
export type MyTaskWorkflow = ReturnType<typeof useMyTaskWorkWorkflow>;

export function useMyTaskWorkWorkflow({
  task,
  onRefresh,
  layout = "page",
  onClose,
  onEnfathSaved,
}: CaseStudyTaskWorkProps) {
  const router = useRouter();
  const { role } = useAppAccess();
  const { showToast } = useToast();
  const { data: staffResult } = useStaffUsersQuery();
  const staffUsers = staffResult?.users ?? [];
  const [assignmentType, setAssignmentType] = useState<AssignmentType>("تنفيذ");
  const [property, setProperty] = useState<PoPropertyIntake>(emptyProperty);
  const [propertyHydrated, setPropertyHydrated] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deedVitality, setDeedVitality] = useState<BourseDeedVitality | null>(
    null,
  );
  const [hasPriorSurvey, setHasPriorSurvey] = useState(false);
  const [distribution, setDistribution] = useState<TaskDistributionDraft>(
    () => migrateDistribution(task.distribution),
  );
  const [failureModalOpen, setFailureModalOpen] = useState(false);
  const [phaseOverride, setPhaseOverride] = useState<WorkflowTask["phase"] | null>(
    null,
  );
  /**
   * An empty slot gets its property on the server the moment it is
   * opened (a draft with its real id), so uploads never need a client-side id. The task list
   * learns the id on its next refresh; until then it lives here.
   */
  const [draftPropertyId, setDraftPropertyId] = useState<string | null>(null);
  const effectivePropertyId = task.propertyId ?? draftPropertyId;
  const hydratedPropertyKeyRef = useRef("");
  /** What is on screen right now — read inside effects without re-running them on every keystroke. */
  const propertyRef = useLatestRef(property);

  const { data: poRecord, isFetched } = usePoRecordQuery(task.poNumber);
  const loading = !propertyHydrated;

  // The panel serves another task without remounting, so the task-scoped state is
  // mirrored during render — no extra pass showing the previous task’s draft.
  const [prevTaskId, setPrevTaskId] = useState(task.id);
  const [prevDistribution, setPrevDistribution] = useState(task.distribution);
  const [prevPhase, setPrevPhase] = useState(task.phase);
  if (prevTaskId !== task.id || prevDistribution !== task.distribution) {
    setPrevDistribution(task.distribution);
    setDistribution(migrateDistribution(task.distribution));
  }
  if (prevTaskId !== task.id || prevPhase !== task.phase) {
    setPrevPhase(task.phase);
    setPhaseOverride(null);
  }
  if (prevTaskId !== task.id) {
    setPrevTaskId(task.id);
    setDeedVitality(null);
    setDraftPropertyId(null);
  }

  const effectivePhase = phaseOverride ?? task.phase;

  const roleFlags = taskWorkRoleFlags(role);
  const { isSupervisor, isSpecialist, failureSpecialist } = roleFlags;
  const failureRaisedByRole =
    role === "section-supervisor"
      ? FAILURE_RAISER_SUPERVISOR
      : FAILURE_RAISER_SPECIALIST;

  // Flush or cancel the previous صك autosave when the panel switches tasks.
  useEffect(() => {
    const po = task.poNumber;
    const propertyId = effectivePropertyId;
    return () => {
      if (propertyId) {
        void flushPropertyFieldAutosave(po, propertyId);
      }
    };
  }, [task.id, task.poNumber, effectivePropertyId]);

  useEffect(() => {
    if (!isFetched) return;
    const hydrateKey = `${task.id}|${task.propertyId ?? "new"}`;
    // Keep local edits for this صك — do not re-hydrate on unrelated PO refetches.
    if (hydratedPropertyKeyRef.current === hydrateKey) return;
    hydratedPropertyKeyRef.current = hydrateKey;

    setAssignmentType(poRecord?.assignmentType ?? task.assignmentType ?? "تنفيذ");
    if (task.propertyId) {
      const fromServer = poRecord?.properties.find((p) => p.id === task.propertyId);
      const local = peekPropertyFieldAutosave(
        task.poNumber,
        task.propertyId,
        fromServer?.updatedAtUtc,
      );
      // The id on screen must be the task's real property id — never a client-side one: every
      // upload is keyed by it. When the PO record has not caught up with a just-created draft,
      // keep what is on screen (the draft itself) or start an empty form under the real id.
      const onScreen = propertyRef.current;
      const prop =
        local ??
        fromServer ??
        (onScreen.id === task.propertyId ? onScreen : { ...emptyProperty(), id: task.propertyId });
      setProperty(prop);
      if (prop.deedNumber.trim()) {
        void findPriorDeedFull(prop.deedNumber.trim(), task.poNumber, prop.id)
          .then((prior) => setHasPriorSurvey(Boolean(prior)))
          .catch(() => setHasPriorSurvey(false));
      } else {
        setHasPriorSurvey(false);
      }
    } else if (draftPropertyId) {
      // The draft exists; the task list has not caught up with its id yet — keep the screen.
    } else {
      // An empty slot: create the property on the server first (real id from the first upload).
      // Only when that fails (offline, server down) does the old local-only draft remain, with
      // uploads switched off until the first حفظ creates the property.
      let active = true;
      setHasPriorSurvey(false);
      setPropertyHydrated(false);
      void createDraftPropertyForSlot(task.poNumber, task.id).then((created) => {
        if (!active) return;
        if (created.ok) {
          cancelPropertyFieldAutosave(task.poNumber, newPropertyDraftKey(task.id));
          setDraftPropertyId(created.data.id);
          setProperty(created.data);
          onRefresh();
        } else {
          const local = peekPropertyFieldAutosave(task.poNumber, newPropertyDraftKey(task.id));
          setProperty(local ?? emptyProperty());
          setFormError(created.error);
        }
        setPropertyHydrated(true);
      });
      return () => {
        active = false;
      };
    }
    setPropertyHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- draftPropertyId only gates the empty-slot branch
  }, [isFetched, poRecord, task.id, task.propertyId, task.poNumber, task.assignmentType]);

  const exit = useCallback(() => {
    if (effectivePropertyId) {
      void flushPropertyFieldAutosave(task.poNumber, effectivePropertyId);
    }
    if (onClose) onClose();
    else router.push(myTasksPath());
  }, [onClose, router, task.poNumber, effectivePropertyId]);

  const linkedPropertyRemoved = Boolean(property.isRemoved);

  const patchProperty = useCallback(
    <K extends keyof PoPropertyIntake>(key: K, value: PoPropertyIntake[K]) => {
      setProperty((p) => {
        const next = { ...p, [key]: value };
        queuePropertyFieldAutosave(
          task.poNumber,
          effectivePropertyId ?? newPropertyDraftKey(task.id),
          next,
          { persistable: Boolean(effectivePropertyId) },
        );
        return next;
      });
      setFieldErrors((e) => {
        if (!e[String(key)]) return e;
        const next = { ...e };
        delete next[String(key)];
        return next;
      });
    },
    [task.id, task.poNumber, effectivePropertyId],
  );

  const replaceProperty = useCallback(
    (next: PoPropertyIntake) => {
      setProperty(next);
      setFieldErrors({});
      queuePropertyFieldAutosave(
        task.poNumber,
        effectivePropertyId ?? newPropertyDraftKey(task.id),
        next,
        { persistable: Boolean(effectivePropertyId) },
      );
    },
    [task.id, task.poNumber, effectivePropertyId],
  );

  /** Picking «حالة الصك» clears its red mark and the matching top note. */
  const chooseDeedVitality = useCallback((value: BourseDeedVitality) => {
    setDeedVitality(value);
    setFieldErrors((e) => {
      if (!e.deedVitality) return e;
      const next = { ...e };
      delete next.deedVitality;
      return next;
    });
    setFormError((cur) => (cur === DEED_VITALITY_REQUIRED_ERROR ? null : cur));
  }, []);

  const showEngineering = engineeringOfficeAvailable(property, hasPriorSurvey);
  const engineeringHint = engineeringOfficeUnavailableReason(property, hasPriorSurvey);

  useEffect(() => {
    if (loading || task.phase !== "distribution" || showEngineering) return;
    if (distribution.engineeringOffice) {
      const next = migrateDistribution({
        ...distribution,
        engineeringOffice: false,
        engineeringOfficeId: "",
      });
      // eslint-disable-next-line react-hooks/set-state-in-effect -- drops an unavailable engineering office from the saved distribution — the form and the server patch change together
      setDistribution(next);
      void patchTaskDistribution(task.id, next, task).then((updated) => {
        if (!updated) {
          showToast(DISTRIBUTION_SAVE_ERROR, "error");
        }
      }).catch(() => {
        showToast(DISTRIBUTION_SAVE_ERROR, "error");
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync when engineering unavailable
  }, [loading, task.phase, task.id, showEngineering, property.classification, property.identifierType, property.realEstateRegNumber, property.planNumber, property.plotNumber]);

  const steps = resolveTaskWorkSteps(effectivePhase);
  const fieldPolicy = clientFieldPolicyFor({
    clientId: poRecord?.clientId ?? "",
    reportUserClientIds: poRecord?.reportUserClientIds,
  });

  const commands = useMyTaskWorkCommands({
    task,
    propertyId: effectivePropertyId,
    property,
    assignmentType,
    fieldPolicy,
    distribution,
    showEngineering,
    deedVitality,
    linkedPropertyRemoved,
    staffUsers,
    steps,
    setFormError,
    setFieldErrors,
    setSaving,
    setPhaseOverride,
    setDistribution,
    onRefresh,
    onEnfathSaved,
  });

  const submitBusy =
    saving || commands.bourseCompleting || commands.confirmingDistribution;
  const canWorkStep = canWorkTaskStep(steps, roleFlags);
  const showPrimarySave = canShowPrimarySave(task, steps.showCaseStudy, canWorkStep);
  const saveLabel = taskWorkSaveLabel(steps);
  const screen = resolveTaskWorkScreen({
    loading,
    linkedPropertyRemoved,
    task,
    showCaseStudy: steps.showCaseStudy,
    isSpecialist: canWorkStep,
  });

  return {
    task,
    layout,
    exit,
    onRefresh,
    property,
    /** Uploads need the property's real id; without it (draft creation failed) they are off. */
    uploadsDisabled: !effectivePropertyId,
    assignmentType,
    fieldPolicy,
    fieldErrors,
    formError,
    submitBusy,
    deedVitality,
    setDeedVitality: chooseDeedVitality,
    distribution,
    showEngineering,
    engineeringHint,
    failureModalOpen,
    setFailureModalOpen,
    failureRaisedByRole,
    failureSpecialist,
    isSupervisor,
    isSpecialist,
    steps,
    screen,
    showPrimarySave,
    saveLabel,
    patchProperty,
    replaceProperty,
    ...taskWorkTitles(task, property),
    ...commands,
  };
}
