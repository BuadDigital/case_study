"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DistributionPartiesForm } from "@case-study/mfe/components/distribution/DistributionPartiesForm";
import { RegistrationFormCard } from "@platform/app-shared/registration/RegistrationFormCard";
import { TaskWorkChrome } from "@case-study/mfe/components/primary-data/TaskWorkChrome";
import { PoEditShell } from "@case-study/mfe/components/po-intake/PoEditShell";
import { PoPropertyEnfathForm } from "@case-study/mfe/components/po-intake/PoPropertyEnfathForm";
import { PoPropertyBourseForm } from "@case-study/mfe/components/po-intake/PoPropertyBourseForm";
import {
  firstEnfathValidationMessage,
  mergePropertyEnfathValidation,
} from "@case-study/mfe/components/po-intake/po-property-enfath-validation";
import {
  firstBourseValidationMessage,
  validatePropertyBourseFields,
} from "@case-study/mfe/components/po-intake/po-property-bourse-validation";
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
import { poPropertyFailurePath } from "../lib/po-routes";
import {
  advanceTaskAfterBourse,
  advanceTaskAfterEnfath,
  completeChildTask,
  confirmTaskDistribution,
  defaultDistribution,
  distributionValidationError,
  engineeringOfficeAvailable,
  migrateDistribution,
  patchTaskDistribution,
  resolveTaskObstruction,
  taskDisplayPropertyLabel,
  taskKindLabel,
  type TaskDistributionDraft,
  type WorkflowTask,
} from "../lib/prototype/tasks-storage";
import {
  usePoRecordQuery,
  useWorkflowTasksQuery,
} from "@case-study/mfe/query/case-study-queries";
import { Button, InlineLoadingSkeleton, Note, cn, useToast } from "@platform/design-system";
import { useQueryClient } from "@tanstack/react-query";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";

const LOADING_TEXT = "text-xs text-text-3";

function useWorkflowTask(taskId: string): WorkflowTask | null {
  const { data: tasks } = useWorkflowTasksQuery();
  return useMemo(
    () => tasks?.find((t) => t.id === taskId) ?? null,
    [tasks, taskId],
  );
}

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
  const { showToast } = useToast();
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
  const { data: poRecord, isPending: poRecordLoading } = usePoRecordQuery(
    task.poNumber,
  );
  const loading = poRecordLoading && !poRecord;

  useEffect(() => {
    setDistribution(migrateDistribution(task.distribution));
  }, [task.id, task.distribution]);

  const isSupervisor = role === "section-supervisor" || role === "cdo";
  const isSpecialist = role === "case-specialist" || role === "cdo";

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
        );
      } else {
        setHasPriorSurvey(false);
      }
    } else {
      setProperty(emptyProperty());
      setHasPriorSurvey(false);
    }
  }, [poRecord, task.propertyId, task.poNumber, task.assignmentType]);

  const patchProperty = useCallback(
    <K extends keyof PoPropertyIntake>(key: K, value: PoPropertyIntake[K]) => {
      setProperty((p) => {
        const next = { ...p, [key]: value };
        if (key === "classification") next.propertyType = "";
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
      void patchTaskDistribution(task.id, next, task);
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
      : isBourseInquiryIdentifier(property.identifierType)
        ? { ...property, bourseDataCompleted: false }
        : property;

    setSaving(true);
    const result = task.propertyId
      ? await updatePropertyInPo(task.poNumber, task.propertyId, persisted)
      : await addPropertyToPo(task.poNumber, persisted, {
          assignToTaskId: task.id,
        });
    setSaving(false);

    if (!result.ok) {
      setFormError(result.error);
      if (result.errors) setFieldErrors(result.errors);
      showToast(result.error, "error");
      return;
    }

    if (result.ok) {
      const advanced = skipsBourseForIdentifier(property.identifierType)
        ? { ...result.data, bourseDataCompleted: true }
        : result.data;
      if (task.propertyId) {
        await advanceTaskAfterEnfath(task.id, advanced);
      }
      if (onEnfathSaved) {
        await onEnfathSaved(task.id, {
          identifierType: property.identifierType,
        });
      } else {
        onRefresh();
      }
      showToast("تم حفظ بيانات إنفاذ.", "success");
    }
  }

  async function saveBourse() {
    setFormError(null);

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
      setSaving(true);
      await submitBourseObstruction({
        poNumber: task.poNumber,
        propertyId: task.propertyId,
        deedNumber: property.deedNumber,
        reason: obstructionReason,
        specialist: ROLES[role]?.name ?? "أخصائي دراسة الحالة",
      });
      setSaving(false);
      void queryClient.invalidateQueries({ queryKey: prototypeKeys.failures() });
      void queryClient.invalidateQueries({
        queryKey: prototypeKeys.workflowTasks(),
      });
      onRefresh();
      showToast("تم إرسال التعذر للمشرف.", "success");
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

    setSaving(true);
    let prop = property;
    let propertyId = task.propertyId;

    if (!propertyId) {
      const insert = await addPropertyToPo(task.poNumber, property, {
        assignToTaskId: task.id,
      });
      if (!insert.ok) {
        setSaving(false);
        setFormError(insert.error);
        if (insert.errors) setFieldErrors(insert.errors);
        return;
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
        setSaving(false);
        setFormError(updated.error);
        if (updated.errors) setFieldErrors(updated.errors);
        return;
      }
      prop = updated.data;
      await advanceTaskAfterEnfath(task.id, updated.data);
    }

    const result = await completePropertyBourse(
      task.poNumber,
      propertyId!,
      { ...prop, deedStatus: "فعال" },
    );
    setSaving(false);

    if (!result.ok) {
      setFormError(result.error);
      if (result.errors) setFieldErrors(result.errors);
      showToast(result.error, "error");
      return;
    }

    await advanceTaskAfterBourse(task.id, result.data);
    onRefresh();
    showToast("تم حفظ بيانات البورصة.", "success");
  }

  async function confirmDistribution() {
    setFormError(null);
    const validation = distributionValidationError(
      distribution,
      showEngineering,
    );
    if (validation) {
      setFormError(validation);
      return;
    }

    await confirmTaskDistribution(
      task.id,
      distribution,
      formatPropertyDeedDisplay(property),
    );
    onRefresh();
    showToast("تم تأكيد التوزيع وإرسال المهام.", "success");
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
    task.phase === "enfath" && isBourseInquiryIdentifier(property.identifierType);
  /** Primary-data panel: استعلام بورصة fields live on «استعلام بورصة» tab only. */
  const bourseInquiryPanelOnly =
    layout === "panel" && bourseInquiryFastPath;
  const showEnfathStep =
    task.phase === "enfath" && (!bourseInquiryFastPath || bourseInquiryPanelOnly);
  const showBourseStep =
    (task.phase === "bourse" || bourseInquiryFastPath) && !bourseInquiryPanelOnly;
  const showDistribution = task.phase === "distribution";
  const showCaseStudy = task.phase === "case-study";
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
                void resolveTaskObstruction(task.id, task);
                onRefresh();
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
              onClick={() =>
                router.push(poPropertyFailurePath(task.poNumber, task.propertyId!))
              }
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
            propertyOrdinal={task.propertyOrdinal}
            assignmentType={assignmentType}
            fieldErrors={fieldErrors}
            onPatch={patchProperty}
            poNumber={task.poNumber}
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
              propertyOrdinal={task.propertyOrdinal}
              assignmentType={assignmentType}
              fieldErrors={fieldErrors}
              onPatch={patchProperty}
              poNumber={task.poNumber}
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
    </TaskWorkChrome>
  );
}

export function MyTaskWorkView({ taskId }: { taskId: string }) {
  const router = useRouter();
  const task = useWorkflowTask(taskId);
  const [, bump] = useState(0);
  const refresh = useCallback(() => bump((n) => n + 1), []);

  if (!task) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-bg">
        <Note tone="warn" className="m-6">
          لم تُعثر على المهمة.
          <div className="mt-3">
            <Button
              type="button"
              size="sm"
              variant="default"
              onClick={() => router.push(myTasksPath())}
            >
              رجوع للمعاملات النشطة
            </Button>
          </div>
        </Note>
      </div>
    );
  }

  if (task.kind !== "case-study-property") {
    return (
      <PoEditShell
        title={task.title}
        subtitle={`${taskKindLabel(task.kind)} · ${formatPoDisplay(task.poNumber)}`}
        onBack={() => router.push(myTasksPath())}
        onSave={() => {
          if (task.status !== "completed") void completeChildTask(task.id);
          router.push(myTasksPath());
        }}
        saveLabel={
          task.status === "completed" ? "رجوع للمهام" : "تأشير كمكتملة"
        }
      >
        <RegistrationFormCard title={task.title}>
          {task.status === "completed" ? (
            <Note tone="success">تم إنجاز هذه المهمة.</Note>
          ) : (
            <p className="m-0 text-[13px] text-text-2">
              أكمل الإجراء المطلوب ثم احفظ لتأشير المهمة كمكتملة.
            </p>
          )}
        </RegistrationFormCard>
      </PoEditShell>
    );
  }

  return <CaseStudyTaskWork task={task} onRefresh={refresh} />;
}
