"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DistributionPartiesForm } from "@case-study/mfe/components/distribution/DistributionPartiesForm";
import { RegistrationFormCard } from "@platform/app-shared/registration/RegistrationFormCard";
import { TaskWorkChrome } from "@case-study/mfe/components/primary-data/TaskWorkChrome";
import { PoPropertyEnfathForm } from "@case-study/mfe/components/po-intake/PoPropertyEnfathForm";
import { PoPropertyBourseForm } from "@case-study/mfe/components/po-intake/PoPropertyBourseForm";
import {
  firstEnfathValidationMessage,
  mergePropertyEnfathValidation,
} from "../lib/domain/po-intake/property-enfath-validation";
import {
  firstBourseValidationMessage,
  validatePropertyBourseFields,
} from "../lib/domain/po-intake/property-bourse-validation";
import {
  hasFieldErrors,
  type FieldErrors,
} from "@platform/app-shared/registration/registration-utils";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import { myTasksPath } from "../lib/my-task-routes";
import {
  classificationRequiresSurvey,
  emptyProperty,
  formatPoDisplay,
  formatPropertyDeedDisplay,
  isBourseInquiryIdentifier,
  skipsBourseForIdentifier,
  type AssignmentType,
  type BourseDeedVitality,
  type PoPropertyIntake,
  type PropertyIdentifierType,
} from "../lib/prototype/po-intake-data";
import { ROLES } from "@platform/app-shared/prototype/constants";
import {
  submitBourseObstruction,
  validateBourseObstructionReason,
} from "../lib/prototype/bourse-obstruction";
import {
  addPropertyToPo,
  completePropertyBourse,
  deedExistsInPo,
  findPriorDeedFull,
  updatePropertyInPo,
} from "../lib/prototype/po-intake-storage";
import {
  FAILURE_RAISER_SPECIALIST,
  FAILURE_RAISER_SUPERVISOR,
} from "@failures/mfe";
import { FailureRaiseModal } from "@case-study/mfe/components/failures/FailureRaiseModal";
import {
  advanceTaskAfterBourse,
  advanceTaskAfterEnfath,
  confirmTaskDistribution,
  defaultDistribution,
  distributionValidationError,
  engineeringOfficeAvailable,
  migrateDistribution,
  patchTaskDistribution,
  resolveTaskObstruction,
  taskDisplayPropertyLabel,
  type TaskDistributionDraft,
  type WorkflowTask,
} from "../lib/prototype/tasks-storage";
import {
  usePoRecordQuery,
} from "@case-study/mfe/query/case-study-queries";
import { Button, InlineLoadingSkeleton, Note, cn, useToast } from "@platform/design-system";
import { useQueryClient } from "@tanstack/react-query";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import { useStaffUsersQuery } from "@settings/mfe/query/settings-queries";

const LOADING_TEXT = "text-xs text-text-3";
const CONFIRM_DISTRIBUTION_ERROR = "تعذّر تأكيد التوزيع — تحقق من المرحلة وحاول مرة أخرى";

export function CaseStudyTaskWork({
  task,
  onRefresh,
  layout = "page",
  onClose,
  onEnfathSaved,
}: {
  task: WorkflowTask;
  onRefresh: () => void;
  layout?: "page" | "panel";
  onClose?: () => void;
  /** After successful إنفاذ save (panel flow): advance or route by identifier type. */
  onEnfathSaved?: (
    taskId: string,
    meta: { identifierType: PropertyIdentifierType },
  ) => void | Promise<void>;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const exit = onClose ?? (() => router.push(myTasksPath()));
  const { role } = usePrototype();
  const { showToast, runWithActionToast } = useToast();
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

  const isSupervisor = role === "section-supervisor" || role === "cdo";
  const isSpecialist = role === "case-specialist" || role === "cdo";
  const failureRaisedByRole =
    role === "section-supervisor"
      ? FAILURE_RAISER_SUPERVISOR
      : FAILURE_RAISER_SPECIALIST;
  const failureSpecialist = ROLES[role]?.name ?? "أخصائي";

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
        void findPriorDeedFull(prop.deedNumber.trim(), task.poNumber).then(
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

  const showEngineering = engineeringOfficeAvailable(property, hasPriorSurvey);
  const requiresSurvey = classificationRequiresSurvey(property.classification);

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
          showToast("تعذّر حفظ التوزيع — حاول مرة أخرى", "error");
        }
      }).catch(() => {
        showToast("تعذّر حفظ التوزيع — حاول مرة أخرى", "error");
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync when engineering unavailable
  }, [loading, task.phase, task.id, showEngineering, property.classification]);

  function engineeringUnavailableHint(): string | null {
    if (!requiresSurvey) {
      return "المكتب الهندسي غير متاح: تصنيف «وحدة داخل مبنى» لا يتطلب رفعاً مساحياً.";
    }
    if (hasPriorSurvey) return "يوجد رفع مساحي سابق لنفس الصك — لا حاجة لمكتب هندسي.";
    return null;
  }

  async function saveEnfath() {
    setFormError(null);
    if (linkedPropertyRemoved) {
      setFormError("هذه المعاملة مرتبطة بعقار محذوف — لا يمكن الحفظ.");
      return;
    }
    const errors = mergePropertyEnfathValidation(property, assignmentType);
    if (hasFieldErrors(errors)) {
      setFieldErrors(errors);
      setFormError(firstEnfathValidationMessage(errors));
      return;
    }
    if (
      property.deedNumber.trim() &&
      (await deedExistsInPo(
        task.poNumber,
        property.deedNumber.trim(),
        task.propertyId,
      ))
    ) {
      setFormError("رقم الصك مسجّل مسبقاً في هذا أمر العمل.");
      return;
    }

    const persisted = skipsBourseForIdentifier(property.identifierType)
      ? { ...property, bourseDataCompleted: true }
      : { ...property, bourseDataCompleted: false };

    await runWithActionToast("حفظ", async () => {
      setSaving(true);
      try {
        const result = task.propertyId
          ? await updatePropertyInPo(task.poNumber, task.propertyId, persisted)
          : await addPropertyToPo(task.poNumber, persisted, {
              assignToTaskId: task.id,
            });

        if (!result.ok) {
          setFormError(result.error);
          if (result.errors) setFieldErrors(result.errors);
          throw new Error(result.error);
        }

        const savedProperty = skipsBourseForIdentifier(property.identifierType)
          ? { ...result.data, bourseDataCompleted: true }
          : result.data;
        const updatedTask = await advanceTaskAfterEnfath(task.id, savedProperty);
        if (!updatedTask.ok) {
          setFormError(updatedTask.error);
          throw new Error(updatedTask.error);
        }
        setPhaseOverride(updatedTask.task.phase);
        if (onEnfathSaved) {
          await onEnfathSaved(task.id, {
            identifierType: property.identifierType,
          });
        } else {
          onRefresh();
        }
      } finally {
        setSaving(false);
      }
    }).catch(() => {
      /* error toast already shown by runWithActionToast */
    });
  }

  async function saveBourse() {
    setFormError(null);
    if (linkedPropertyRemoved) {
      setFormError("هذه المعاملة مرتبطة بعقار محذوف — لا يمكن الحفظ.");
      return;
    }

    if (!deedVitality) {
      setFormError("اختر حالة الصك: فعال أو غير فعال.");
      return;
    }

    if (deedVitality === "inactive") {
      const obstructionError = validateBourseObstructionReason(
        deedVitality,
        obstructionReason,
      );
      if (obstructionError) {
        setObstructionReasonError(obstructionError);
        setFormError(obstructionError);
        return;
      }
      if (!task.propertyId) {
        setFormError("لا يوجد عقار مرتبط بهذه المهمة.");
        return;
      }
      await runWithActionToast("إرسال للمشرف — إدارة التعذرات", async () => {
        setSaving(true);
        try {
          await submitBourseObstruction({
            poNumber: task.poNumber,
            propertyId: task.propertyId!,
            deedNumber: property.deedNumber,
            reason: obstructionReason,
            specialist: ROLES[role]?.name ?? "أخصائي دراسة الحالة",
          });
          void queryClient.invalidateQueries({
            queryKey: prototypeKeys.failures(),
          });
          void queryClient.invalidateQueries({
            queryKey: prototypeKeys.workflowTasks(),
          });
          onRefresh();
        } finally {
          setSaving(false);
        }
      });
      return;
    }

    const bourseInquiryFastPath =
      task.phase === "enfath" && isBourseInquiryIdentifier(property.identifierType);

    if (bourseInquiryFastPath) {
      const enfathErrors = mergePropertyEnfathValidation(property, assignmentType);
      if (hasFieldErrors(enfathErrors)) {
        setFieldErrors(enfathErrors);
        setFormError(firstEnfathValidationMessage(enfathErrors));
        return;
      }
      if (
        property.deedNumber.trim() &&
        (await deedExistsInPo(
          task.poNumber,
          property.deedNumber.trim(),
          task.propertyId,
        ))
      ) {
        setFormError("رقم الصك مسجّل مسبقاً في هذا أمر العمل.");
        return;
      }
    }

    const errors = validatePropertyBourseFields(property);
    if (hasFieldErrors(errors)) {
      setFieldErrors(errors);
      setFormError(firstBourseValidationMessage(errors));
      return;
    }

    if (!task.propertyId && !bourseInquiryFastPath) {
      setFormError("لا يوجد عقار مرتبط بهذه المهمة.");
      return;
    }

    await runWithActionToast("حفظ والانتقال للتوزيع", async () => {
      setSaving(true);
      try {
        let prop = property;
        let propertyId = task.propertyId;

        if (!propertyId) {
          const insert = await addPropertyToPo(task.poNumber, property, {
            assignToTaskId: task.id,
          });
            if (!insert.ok) {
            setFormError(insert.error);
            if (insert.errors) setFieldErrors(insert.errors);
            throw new Error(insert.error);
          }
          prop = insert.data;
          propertyId = insert.data.id;
        } else if (bourseInquiryFastPath) {
          const updated = await updatePropertyInPo(
            task.poNumber,
            propertyId,
            property,
          );
          if (!updated.ok) {
            setFormError(updated.error);
            if (updated.errors) setFieldErrors(updated.errors);
            throw new Error(updated.error);
          }
          prop = updated.data;
          const enfathAdvance = await advanceTaskAfterEnfath(task.id, updated.data);
          if (!enfathAdvance.ok) {
            setFormError(enfathAdvance.error);
            throw new Error(enfathAdvance.error);
          }
          setPhaseOverride(enfathAdvance.task.phase);
        }

        const result = await completePropertyBourse(
          task.poNumber,
          propertyId!,
          { ...prop, deedStatus: "فعال" },
        );

        if (!result.ok) {
          setFormError(result.error);
          if (result.errors) setFieldErrors(result.errors);
          throw new Error(result.error);
        }

        const advancedTask = await advanceTaskAfterBourse(task.id, result.data);
        if (!advancedTask.ok) {
          setFormError(advancedTask.error);
          throw new Error(advancedTask.error);
        }
        setPhaseOverride(advancedTask.task.phase);
        onRefresh();
      } finally {
        setSaving(false);
      }
    }).catch(() => {
      /* error toast already shown by runWithActionToast */
    });
  }

  async function confirmDistribution() {
    setFormError(null);
    const validation = distributionValidationError(
      distribution,
      showEngineering,
      {
        deedNumber: property.deedNumber,
        requestNumber: property.requestNumber,
        city: property.city,
        district: property.district,
        circuit: property.circuit,
        poNumber: task.poNumber,
        assignmentMandateNumber: property.assignmentMandateNumber,
        assignmentMandateDate: property.assignmentMandateDate,
      },
    );
    if (validation) {
      setFormError(validation);
      return;
    }

    await runWithActionToast("تأكيد التوزيع وإرسال المهام", async () => {
      setSaving(true);
      try {
        const result = await confirmTaskDistribution(
          task.id,
          distribution,
          formatPropertyDeedDisplay(property),
          staffUsers,
        );
        if (!result.parent) {
          const message = result.error ?? CONFIRM_DISTRIBUTION_ERROR;
          setFormError(message);
          throw new Error(message);
        }

        setPhaseOverride(result.parent.phase);
        void queryClient.invalidateQueries({
          queryKey: prototypeKeys.workflowTasks(),
        });
        onRefresh();
      } finally {
        setSaving(false);
      }
    }).catch(() => {
      /* error toast already shown by runWithActionToast */
    });
  }

  async function patchDistribution(patch: Partial<TaskDistributionDraft>) {
    const next = migrateDistribution({ ...distribution, ...patch });
    if (!showEngineering) {
      next.engineeringOffice = false;
      next.engineeringOfficeId = "";
    }
    setDistribution(next);
    await patchTaskDistribution(task.id, next, task);
    onRefresh();
  }

  const bourseInquiryFastPath =
    effectivePhase === "enfath" && isBourseInquiryIdentifier(property.identifierType);
  /** Primary-data panel: استعلام بورصة fields live on «استعلام بورصة» tab only. */
  const bourseInquiryPanelOnly =
    layout === "panel" && bourseInquiryFastPath;
  const showEnfathStep =
    effectivePhase === "enfath" && (!bourseInquiryFastPath || bourseInquiryPanelOnly);
  const showBourseStep =
    (effectivePhase === "bourse" || bourseInquiryFastPath) && !bourseInquiryPanelOnly;
  const showDistribution = effectivePhase === "distribution";
  const showCaseStudy = effectivePhase === "case-study";
  const bourseObstructionPath =
    showBourseStep && deedVitality === "inactive";
  const showPrimarySave =
    isSpecialist &&
    !showCaseStudy &&
    task.phase !== "obstruction" &&
    task.phase !== "done" &&
    task.status !== "completed";

  const saveLabel = showEnfathStep
    ? "حفظ"
    : showBourseStep
      ? bourseObstructionPath
        ? "إرسال للمشرف — إدارة التعذرات"
        : "حفظ والانتقال للتوزيع"
      : showDistribution
        ? "تأكيد التوزيع وإرسال المهام"
        : "حفظ";

  function handlePrimarySave() {
    if (showEnfathStep) void saveEnfath();
    else if (showBourseStep) void saveBourse();
    else if (showDistribution) confirmDistribution();
  }

  const deedTitle =
    property.deedNumber.trim() ||
    taskDisplayPropertyLabel(task) ||
    `خانة ${task.propertyOrdinal}`;

  const panelDeedBadge =
    property.deedNumber.trim() || `خانة ${task.propertyOrdinal}`;

  const workSubtitle = `أخصائي دراسة الحالة · ${formatPoDisplay(task.poNumber)}`;

  if (loading) {
    return (
      <TaskWorkChrome
        layout={layout}
        title="تنفيذ المهمة"
        onClose={exit}
        onSave={exit}
        saveLabel="رجوع"
        showFooter={false}
      >
        <InlineLoadingSkeleton className={LOADING_TEXT} />
      </TaskWorkChrome>
    );
  }

  if (linkedPropertyRemoved) {
    return (
      <TaskWorkChrome
        layout={layout}
        title={deedTitle}
        subtitle={workSubtitle}
        onClose={exit}
        onSave={exit}
        saveLabel="إغلاق"
        showFooter
      >
        <Note tone="warn" className="mb-3" role="alert">
          هذا العقار محذوف
          {property.removalReason.trim()
            ? ` — ${property.removalReason.trim()}`
            : ""}
          . لا يمكن متابعة المعاملة.
        </Note>
      </TaskWorkChrome>
    );
  }

  if (task.phase === "obstruction") {
    return (
      <TaskWorkChrome
        layout={layout}
        title={`تعذر — ${deedTitle}`}
        subtitle={workSubtitle}
        deedBadge={panelDeedBadge}
        onClose={exit}
        onSave={exit}
        saveLabel="رجوع"
        variant="detail"
        showFooter={false}
      >
      <RegistrationFormCard title="تعذر — بانتظار المشرف">
        <Note tone="warn" className="mb-3">
          {task.obstructionReason || "تم تسجيل تعذر على هذا العقار."}
        </Note>
        {isSupervisor ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="primary"
              onClick={() => {
                void (async () => {
                  const updated = await resolveTaskObstruction(task.id, task);
                  if (updated) {
                    showToast("تمت إعادة المهمة للأخصائي", "success");
                    onRefresh();
                    return;
                  }
                  showToast("تعذّر إعادة المهمة للأخصائي — حاول مرة أخرى", "error");
                })();
              }}
            >
              إعادة للأخصائي
            </Button>
            <Button type="button" variant="default" onClick={() => router.push("/failures")}>
              مراجعة التعذرات
            </Button>
          </div>
        ) : (
          <p className="m-0 text-[13px] text-text-3">
            المهمة لدى المشرف حتى يُبت في التعذر.
          </p>
        )}
      </RegistrationFormCard>
      </TaskWorkChrome>
    );
  }

  if (showCaseStudy) {
    return (
      <TaskWorkChrome
        layout={layout}
        title={`دراسة حالة — ${deedTitle}`}
        subtitle={workSubtitle}
        deedBadge={panelDeedBadge}
        onClose={exit}
        onSave={exit}
        saveLabel="رجوع للمهام"
        variant="detail"
        showFooter={false}
      >
        <RegistrationFormCard title="دراسة حالة العقار">
          <Note tone="success" className="mb-3">
            تم تأكيد التوزيع وإرسال المهام للأطراف. المعاملة في مرحلة دراسة
            الحالة.
          </Note>
          <DistributionPartiesForm
            distribution={migrateDistribution(task.distribution)}
            onPatch={() => {}}
            showEngineering={engineeringOfficeAvailable(
              property,
              hasPriorSurvey,
            )}
            engineeringHint={engineeringUnavailableHint()}
            readOnly
          />
        </RegistrationFormCard>
      </TaskWorkChrome>
    );
  }

  if (task.phase === "done" || task.status === "completed") {
    return (
      <TaskWorkChrome
        layout={layout}
        title={`مهمة مكتملة — ${deedTitle}`}
        subtitle={workSubtitle}
        deedBadge={panelDeedBadge}
        onClose={exit}
        onSave={exit}
        saveLabel="رجوع للمهام"
        variant="detail"
        showFooter={false}
      >
        <RegistrationFormCard title="المهمة مكتملة">
          <Note tone="success">
            اكتملت مهمة العقار. تم إرسال مهام فرعية للأطراف المختارين (إن وُجد).
          </Note>
        </RegistrationFormCard>
      </TaskWorkChrome>
    );
  }

  if (!isSpecialist) {
    return (
      <TaskWorkChrome
        layout={layout}
        title={deedTitle}
        subtitle={formatPoDisplay(task.poNumber)}
        deedBadge={panelDeedBadge}
        onClose={exit}
        onSave={exit}
        saveLabel="رجوع"
        variant="detail"
        showFooter={false}
      >
        <p className="w-full py-4 text-center text-xs text-text-3">
          هذه المهمة مخصصة لأخصائي دراسة الحالة.
        </p>
      </TaskWorkChrome>
    );
  }

  return (
    <TaskWorkChrome
      layout={layout}
      title={`تعديل عقار — ${deedTitle}`}
      subtitle={workSubtitle}
      deedBadge={panelDeedBadge}
      saving={saving}
      onClose={exit}
      onSave={showPrimarySave ? handlePrimarySave : exit}
      saveLabel={showPrimarySave ? saveLabel : "رجوع للمهام"}
      footerExtra={
        <>
          {task.propertyId && (showBourseStep || showDistribution) ? (
            <Button
              type="button"
              variant="dangerOutline"
              size="sm"
              onClick={() => setFailureModalOpen(true)}
            >
              تسجيل تعذر
            </Button>
          ) : null}
        </>
      }
    >
      {formError ? (
        <Note tone="warn" className="mb-3" role="alert">
          {formError}
        </Note>
      ) : null}

      {showEnfathStep ? (
        <RegistrationFormCard
          title={layout === "panel" ? undefined : "بيانات إنفاذ (الصك)"}
          subtitle={
            layout === "panel" ? undefined : "البيانات الواردة من منصة إنفاذ"
          }
        >
          <PoPropertyEnfathForm
            property={property}
            assignmentType={assignmentType}
            fieldErrors={fieldErrors}
            onPatch={patchProperty}
            poNumber={task.poNumber}
            excludePoNumber={task.poNumber}
            fieldsMode={
              bourseInquiryFastPath ? "bourse-inquiry-primary" : "all"
            }
            showStageNote={layout !== "panel"}
            hideBoursePathStatus={bourseInquiryPanelOnly}
          />
        </RegistrationFormCard>
      ) : null}

      {showBourseStep ? (
        <RegistrationFormCard
          title="بيانات البورصة"
          subtitle={
            bourseInquiryFastPath
              ? "استعلام البورصة — أكمل المعرف ثم بيانات البورصة"
              : "يمكن تعديلها هنا أو من استعلام البورصة"
          }
        >
          {bourseInquiryFastPath ? (
            <PoPropertyEnfathForm
              property={property}
              assignmentType={assignmentType}
              fieldErrors={fieldErrors}
              onPatch={patchProperty}
              poNumber={task.poNumber}
              excludePoNumber={task.poNumber}
              fieldsMode="bourse-inquiry-primary"
            />
          ) : null}
          {bourseInquiryFastPath ? (
            <hr className="my-4 border-0 border-t border-border" aria-hidden />
          ) : null}
          <PoPropertyBourseForm
            property={property}
            fieldErrors={fieldErrors}
            onPatch={patchProperty}
            showDeedVitalityFlow
            deedVitality={deedVitality}
            onDeedVitalityChange={setDeedVitality}
            obstructionReason={obstructionReason}
            onObstructionReasonChange={(v) => {
              setObstructionReason(v);
              setObstructionReasonError(undefined);
            }}
            obstructionReasonError={obstructionReasonError}
          />
        </RegistrationFormCard>
      ) : null}

      {showDistribution ? (
        <RegistrationFormCard
          title={layout === "panel" ? undefined : "توزيع المعاملة على الأطراف"}
          subtitle={
            layout === "panel"
              ? undefined
              : "فعّل الطرف ثم اختر المسؤول — يمكن الإسناد لأكثر من طرف معاً"
          }
        >
          <DistributionPartiesForm
            distribution={distribution}
            onPatch={patchDistribution}
            showEngineering={showEngineering}
            engineeringHint={engineeringUnavailableHint()}
          />
        </RegistrationFormCard>
      ) : null}

      {task.propertyId ? (
        <FailureRaiseModal
          open={failureModalOpen}
          onClose={() => setFailureModalOpen(false)}
          poNumber={task.poNumber}
          propertyId={task.propertyId}
          deedNumber={property.deedNumber?.trim() ?? ""}
          specialist={failureSpecialist}
          raisedByRole={failureRaisedByRole}
          onSubmitted={() => {
            onRefresh();
            if (layout === "panel") exit();
          }}
        />
      ) : null}
    </TaskWorkChrome>
  );
}
