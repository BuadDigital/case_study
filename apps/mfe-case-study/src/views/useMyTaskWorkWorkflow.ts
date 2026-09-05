"use client";

/**
 * All non-rendering state behind `CaseStudyTaskWork`: the PO record load, the
 * property draft and its field errors, the distribution draft sync, the
 * step/screen decisions and the chrome titles. Commands live in
 * `useMyTaskWorkCommands`; the view and its regions consume the returned bag.
 */
import { useCallback, useEffect, useState } from "react";
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
  emptyProperty,
  type AssignmentType,
  type BourseDeedVitality,
  type PoPropertyIntake,
  type PropertyIdentifierType,
} from "../lib/app-data/po-intake-data";
import { findPriorDeedFull } from "../lib/app-data/po-intake-reads";
import {
  engineeringOfficeAvailable,
  engineeringOfficeUnavailableReason,
  migrateDistribution,
  patchTaskDistribution,
  type TaskDistributionDraft,
  type WorkflowTask,
} from "../lib/app-data/tasks-storage";
import { usePoRecordQuery } from "../query/case-study-queries";
import {
  canShowPrimarySave,
  DISTRIBUTION_SAVE_ERROR,
  resolveTaskWorkScreen,
  resolveTaskWorkSteps,
  taskWorkRoleFlags,
  taskWorkSaveLabel,
  taskWorkTitles,
  type TaskWorkLayout,
} from "./my-task-work-state";
import { useMyTaskWorkCommands } from "./useMyTaskWorkCommands";

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
  const exit = onClose ?? (() => router.push(myTasksPath()));
  const { role } = useAppAccess();
  const { showToast } = useToast();
  const { data: staffResult } = useStaffUsersQuery();
  const staffUsers = staffResult?.users ?? [];
  const [assignmentType, setAssignmentType] = useState<AssignmentType>("تنفيذ");
  const [property, setProperty] = useState<PoPropertyIntake>(emptyProperty);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deedVitality, setDeedVitality] = useState<BourseDeedVitality | null>(
    null,
  );
  const [obstructionReason, setObstructionReason] = useState("");
  const [obstructionReasonError, setObstructionReasonError] = useState<
    string | undefined
  >();
  const [hasPriorSurvey, setHasPriorSurvey] = useState(false);
  const [distribution, setDistribution] = useState<TaskDistributionDraft>(
    () => migrateDistribution(task.distribution),
  );
  const [failureModalOpen, setFailureModalOpen] = useState(false);
  const [phaseOverride, setPhaseOverride] = useState<WorkflowTask["phase"] | null>(
    null,
  );

  const { data: poRecord, isPending: poRecordLoading } = usePoRecordQuery(
    task.poNumber,
  );
  const loading = poRecordLoading && !poRecord;

  useEffect(() => {
    setDistribution(migrateDistribution(task.distribution));
  }, [task.id, task.distribution]);

  useEffect(() => {
    setPhaseOverride(null);
  }, [task.id, task.phase]);

  const effectivePhase = phaseOverride ?? task.phase;

  const { isSupervisor, isSpecialist, failureSpecialist } = taskWorkRoleFlags(role);
  const failureRaisedByRole =
    role === "section-supervisor"
      ? FAILURE_RAISER_SUPERVISOR
      : FAILURE_RAISER_SPECIALIST;

  useEffect(() => {
    setDeedVitality(null);
    setObstructionReason("");
    setObstructionReasonError(undefined);
  }, [task.id]);

  useEffect(() => {
    if (!poRecord) return;
    setAssignmentType(poRecord.assignmentType ?? task.assignmentType ?? "تنفيذ");
    if (task.propertyId) {
      const prop =
        poRecord.properties.find((p) => p.id === task.propertyId) ??
        emptyProperty();
      setProperty(prop);
      if (prop.deedNumber.trim()) {
        void findPriorDeedFull(prop.deedNumber.trim(), task.poNumber, prop.id).then(
          (prior) => setHasPriorSurvey(Boolean(prior)),
        ).catch(() => setHasPriorSurvey(false));
      } else {
        setHasPriorSurvey(false);
      }
    } else {
      setProperty(emptyProperty());
      setHasPriorSurvey(false);
    }
  }, [poRecord, task.propertyId, task.poNumber, task.assignmentType]);

  const linkedPropertyRemoved = Boolean(property.isRemoved);

  const patchProperty = useCallback(
    <K extends keyof PoPropertyIntake>(key: K, value: PoPropertyIntake[K]) => {
      setProperty((p) => {
        const next = { ...p, [key]: value };
        return next;
      });
      setFieldErrors((e) => {
        if (!e[String(key)]) return e;
        const next = { ...e };
        delete next[String(key)];
        return next;
      });
    },
    [],
  );

  const replaceProperty = useCallback((next: PoPropertyIntake) => {
    setProperty(next);
    setFieldErrors({});
  }, []);

  const onObstructionReasonChange = useCallback((value: string) => {
    setObstructionReason(value);
    setObstructionReasonError(undefined);
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
  }, [loading, task.phase, task.id, showEngineering, property.classification, property.identifierType, property.realEstateRegNumber]);

  const steps = resolveTaskWorkSteps(effectivePhase, layout, property.identifierType);

  const commands = useMyTaskWorkCommands({
    task,
    role,
    property,
    assignmentType,
    distribution,
    showEngineering,
    deedVitality,
    obstructionReason,
    linkedPropertyRemoved,
    staffUsers,
    steps,
    setFormError,
    setFieldErrors,
    setSaving,
    setPhaseOverride,
    setObstructionReasonError,
    setDistribution,
    onRefresh,
    onEnfathSaved,
  });

  const submitBusy =
    saving || commands.bourseCompleting || commands.confirmingDistribution;
  const showPrimarySave = canShowPrimarySave(task, steps.showCaseStudy, isSpecialist);
  const saveLabel = taskWorkSaveLabel(steps, deedVitality);
  const screen = resolveTaskWorkScreen({
    loading,
    linkedPropertyRemoved,
    task,
    showCaseStudy: steps.showCaseStudy,
    isSpecialist,
  });

  return {
    task,
    layout,
    exit,
    onRefresh,
    property,
    assignmentType,
    fieldErrors,
    formError,
    submitBusy,
    deedVitality,
    setDeedVitality,
    obstructionReason,
    onObstructionReasonChange,
    obstructionReasonError,
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
