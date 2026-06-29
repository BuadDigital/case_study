"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DistributionPartiesForm } from "./DistributionPartiesForm";
import { RegistrationFormCard } from "@platform/app-shared/registration/RegistrationFormCard";
import { TaskWorkChrome } from "../primary-data/TaskWorkChrome";
import { FailureRaiseModal } from "../failures/FailureRaiseModal";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import { ROLES } from "@platform/app-shared/prototype/constants";
import {
  FAILURE_RAISER_SPECIALIST,
  FAILURE_RAISER_SUPERVISOR,
} from "@failures/mfe";
import {
  classificationRequiresSurvey,
  emptyProperty,
  formatPoDisplay,
  formatPropertyDeedDisplay,
  type PoPropertyIntake,
} from "../../lib/prototype/po-intake-data";
import { findPriorDeedFull } from "../../lib/prototype/po-intake-storage";
import {
  confirmTaskDistribution,
  defaultDistribution,
  distributionValidationError,
  engineeringOfficeAvailable,
  migrateDistribution,
  patchTaskDistribution,
  taskDisplayPropertyLabel,
  type TaskDistributionDraft,
  type WorkflowTask,
} from "../../lib/prototype/tasks-storage";
import { usePoRecordQuery } from "../../query/case-study-queries";
import { Button, InlineLoadingSkeleton, Note, useToast } from "@platform/design-system";
import { useStaffUsersQuery } from "@settings/mfe/query/settings-queries";

const LOADING_TEXT = "text-xs text-text-3";

export function DistributionTaskWork({
  task,
  onRefresh,
  onClose,
}: {
  task: WorkflowTask;
  onRefresh: () => void;
  onClose: () => void;
}) {
  const { role } = usePrototype();
  const { runWithActionToast } = useToast();
  const { data: staffResult } = useStaffUsersQuery();
  const staffUsers = staffResult?.users ?? [];
  const [property, setProperty] = useState<PoPropertyIntake>(emptyProperty);
  const [hasPriorSurvey, setHasPriorSurvey] = useState(false);
  const [distribution, setDistribution] = useState<TaskDistributionDraft>(() =>
    migrateDistribution(task.distribution ?? defaultDistribution()),
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [failureModalOpen, setFailureModalOpen] = useState(false);

  const { data: poRecord, isPending: poRecordLoading } = usePoRecordQuery(
    task.poNumber,
  );
  const loading = poRecordLoading && !poRecord;

  const isSpecialist = role === "case-specialist" || role === "cdo";
  const failureRaisedByRole =
    role === "section-supervisor"
      ? FAILURE_RAISER_SUPERVISOR
      : FAILURE_RAISER_SPECIALIST;
  const failureSpecialist = ROLES[role]?.name ?? "أخصائي";

  useEffect(() => {
    setDistribution(migrateDistribution(task.distribution ?? defaultDistribution()));
  }, [task.id, task.distribution]);

  useEffect(() => {
    if (!poRecord || !task.propertyId) {
      setProperty(emptyProperty());
      setHasPriorSurvey(false);
      return;
    }
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
  }, [poRecord, task.propertyId, task.poNumber]);

  const showEngineering = engineeringOfficeAvailable(property, hasPriorSurvey);
  const requiresSurvey = classificationRequiresSurvey(property.classification);

  useEffect(() => {
    if (loading || showEngineering) return;
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
  }, [loading, task.id, showEngineering, property.classification]);

  const engineeringUnavailableHint = useCallback((): string | null => {
    if (!requiresSurvey) {
      return "المكتب الهندسي غير متاح: تصنيف «وحدة داخل مبنى» لا يتطلب رفعاً مساحياً.";
    }
    if (hasPriorSurvey) {
      return "يوجد رفع مساحي سابق لنفس الصك — لا حاجة لمكتب هندسي.";
    }
    return null;
  }, [hasPriorSurvey, requiresSurvey]);

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

  async function confirmDistribution() {
    setFormError(null);
    const validation = distributionValidationError(distribution, showEngineering);
    if (validation) {
      setFormError(validation);
      return;
    }

    await runWithActionToast("تأكيد التوزيع وإرسال المهام", async () => {
      setSaving(true);
      try {
        await confirmTaskDistribution(
          task.id,
          distribution,
          formatPropertyDeedDisplay(property),
          staffUsers,
        );
        onRefresh();
        onClose();
      } finally {
        setSaving(false);
      }
    });
  }

  const deedTitle = useMemo(
    () =>
      property.deedNumber.trim() ||
      taskDisplayPropertyLabel(task) ||
      `خانة ${task.propertyOrdinal}`,
    [property.deedNumber, task],
  );

  if (loading) {
    return (
      <TaskWorkChrome
        layout="panel"
        title="توزيع المعاملة"
        onClose={onClose}
        onSave={onClose}
        saveLabel="رجوع"
        showFooter={false}
      >
        <InlineLoadingSkeleton className={LOADING_TEXT} />
      </TaskWorkChrome>
    );
  }

  if (!isSpecialist) {
    return (
      <TaskWorkChrome
        layout="panel"
        title="توزيع المعاملة"
        onClose={onClose}
        onSave={onClose}
        saveLabel="رجوع"
        showFooter={false}
      >
        <p className="w-full py-4 text-center text-xs text-text-3">
          هذه المهمة مخصصة لأخصائي دراسة الحالة.
        </p>
      </TaskWorkChrome>
    );
  }

  if (task.phase !== "distribution") {
    return (
      <TaskWorkChrome
        layout="panel"
        title="توزيع المعاملة"
        onClose={onClose}
        onSave={onClose}
        saveLabel="رجوع"
        showFooter={false}
      >
        <Note tone="info">
          هذه المعاملة ليست في مرحلة التوزيع حالياً ({deedTitle} ·{" "}
          {formatPoDisplay(task.poNumber)}).
        </Note>
      </TaskWorkChrome>
    );
  }

  return (
    <TaskWorkChrome
      layout="panel"
      title={`توزيع المعاملة — ${deedTitle}`}
      saving={saving}
      onClose={onClose}
      onSave={() => void confirmDistribution()}
      saveLabel="تأكيد التوزيع وإرسال المهام"
      footerExtra={
        task.propertyId ? (
          <Button
            type="button"
            variant="dangerOutline"
            size="sm"
            onClick={() => setFailureModalOpen(true)}
          >
            تسجيل تعذر
          </Button>
        ) : null
      }
    >
      {formError ? (
        <Note tone="warn" className="mb-3" role="alert">
          {formError}
        </Note>
      ) : null}

      <RegistrationFormCard
        title="توزيع المعاملة على الأطراف"
        subtitle="فعّل الطرف ثم اختر المسؤول — يمكن الإسناد لأكثر من طرف معاً"
      >
        <DistributionPartiesForm
          distribution={distribution}
          onPatch={patchDistribution}
          showEngineering={showEngineering}
          engineeringHint={engineeringUnavailableHint()}
        />
      </RegistrationFormCard>

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
            onClose();
          }}
        />
      ) : null}
    </TaskWorkChrome>
  );
}
