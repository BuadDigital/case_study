"use client";

import { useCallback, useEffect, useMemo, useState, type RefObject } from "react";
import { FormGroup, FormRow, InlineLoadingSkeleton, Input, Label, Note, Select, useToast } from "@platform/design-system";
import {
  RegField,
  RegSelect,
  RegTextarea,
} from "@platform/app-shared/registration/FormFields";
import { RegistrationFormCard } from "@platform/app-shared/registration/RegistrationFormCard";
import type { PartyTaskPageDef } from "@platform/app-shared/prototype/party-task-pages";
import { usePoRecordQuery, useWorkflowTasksQuery } from "../../query/case-study-queries";
import { useStaffUsersQuery } from "@settings/mfe/query/settings-queries";
import { finalizeValuationCoordinationSubmission } from "../../lib/prototype/finalize-valuation-coordination-submission";
import {
  assigneeLabel,
  getFieldInspectors,
  getValuators,
} from "../../lib/prototype/distribution-parties";
import {
  isValuationCoordinationFormLocked,
  valuationCoordinationPriorityLabel,
  type ValuationCoordinationPriority,
  type ValuationCoordinationSubmission,
} from "../../lib/prototype/valuation-coordination-work-data";
import {
  getOrCreateValuationCoordinationDraft,
  updateValuationCoordinationDraft,
} from "../../lib/prototype/valuation-coordination-work-storage";
import {
  firstValuationCoordinationError,
  validateValuationCoordinationSubmission,
  type ValuationCoordinationFieldErrors,
} from "../../lib/prototype/valuation-coordination-work-validation";
import {
  migrateDistribution,
  type WorkflowTask,
} from "../../lib/prototype/tasks-storage";

export type ValuationCoordinationWorkHostRef = {
  submit?: () => Promise<boolean>;
  onSubmitted?: () => void;
  onSavingChange?: (saving: boolean) => void;
};

const CHECKBOX_OPT =
  "flex cursor-pointer items-start gap-2 text-sm text-text-2";

function distributionForTask(
  task: WorkflowTask,
  parent: WorkflowTask | undefined,
) {
  return migrateDistribution(task.distribution ?? parent?.distribution);
}

export function ValuationCoordinationWorkBody({
  def,
  task,
  hostRef,
}: {
  def: PartyTaskPageDef;
  task: WorkflowTask;
  hostRef: RefObject<ValuationCoordinationWorkHostRef | null>;
}) {
  void def;
  const { showToast } = useToast();
  const propertyId = task.propertyId ?? "";
  const { data: record } = usePoRecordQuery(task.poNumber);
  const { data: allTasks } = useWorkflowTasksQuery();
  const { data: staffResult } = useStaffUsersQuery();
  const staffUsers = staffResult?.users ?? [];

  const parentTask = useMemo(
    () =>
      task.parentTaskId
        ? allTasks?.find((t) => t.id === task.parentTaskId)
        : undefined,
    [allTasks, task.parentTaskId],
  );

  const distribution = useMemo(
    () => distributionForTask(task, parentTask),
    [task, parentTask],
  );

  const siblingInspectorTask = useMemo(
    () =>
      task.parentTaskId
        ? allTasks?.find(
            (t) =>
              t.parentTaskId === task.parentTaskId &&
              t.kind === "field-inspection",
          )
        : undefined,
    [allTasks, task.parentTaskId],
  );
  const siblingAppraiserTask = useMemo(
    () =>
      task.parentTaskId
        ? allTasks?.find(
            (t) =>
              t.parentTaskId === task.parentTaskId &&
              t.kind === "property-appraisal",
          )
        : undefined,
    [allTasks, task.parentTaskId],
  );

  const inspectorName = useMemo(
    () =>
      assigneeLabel(getFieldInspectors(staffUsers), distribution.inspectorId) ||
      siblingInspectorTask?.assigneeName?.trim() ||
      "",
    [distribution.inspectorId, siblingInspectorTask?.assigneeName, staffUsers],
  );
  const appraiserName = useMemo(
    () =>
      assigneeLabel(getValuators(staffUsers), distribution.valuatorId) ||
      siblingAppraiserTask?.assigneeName?.trim() ||
      "",
    [distribution.valuatorId, siblingAppraiserTask?.assigneeName, staffUsers],
  );

  const property = record?.properties.find((p) => p.id === propertyId);

  const [draft, setDraft] = useState<ValuationCoordinationSubmission | null>(
    null,
  );
  const [fieldErrors, setFieldErrors] =
    useState<ValuationCoordinationFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!propertyId) return;
    let cancelled = false;
    void getOrCreateValuationCoordinationDraft({
      taskId: task.id,
      propertyId,
      poNumber: task.poNumber,
      inspectorName,
      appraiserName,
    }).then((next) => {
      if (!cancelled) setDraft(next);
    });
    return () => {
      cancelled = true;
    };
  }, [
    task.id,
    task.poNumber,
    propertyId,
    inspectorName,
    appraiserName,
  ]);

  const locked = draft ? isValuationCoordinationFormLocked(draft.status) : false;
  const formDisabled = locked;

  const persist = useCallback(
    (patch: Parameters<typeof updateValuationCoordinationDraft>[1]) => {
      if (!task.id) return;
      void updateValuationCoordinationDraft(task.id, {
        ...patch,
        inspectorName,
        appraiserName,
      })
        .then((next) => {
          if (next) setDraft(next);
        })
        .catch((err: unknown) => {
          showToast(
            err instanceof Error ? err.message : "تعذّر حفظ التنسيق — حاول مرة أخرى",
            "error",
          );
        });
    },
    [task.id, inspectorName, appraiserName, showToast],
  );

  const submit = useCallback(async (): Promise<boolean> => {
    if (!draft || locked) return false;

    const withAssignees: ValuationCoordinationSubmission = {
      ...draft,
      inspectorName,
      appraiserName,
    };

    const errors = validateValuationCoordinationSubmission(withAssignees);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      const message = firstValuationCoordinationError(errors);
      setFormError(message);
      showToast(message, "error");
      return false;
    }

    hostRef.current?.onSavingChange?.(true);
    setFormError(null);
    const submitted = await finalizeValuationCoordinationSubmission(
      task.id,
      withAssignees,
    );
    hostRef.current?.onSavingChange?.(false);

    if (submitted) {
      setDraft(submitted.submission);
      if (submitted.warning) {
        showToast(submitted.warning, "error");
      }
      hostRef.current?.onSubmitted?.();
      return true;
    }
    const message = "تعذر تأكيد الاستلام — حاول مرة أخرى";
    setFormError(message);
    showToast(message, "error");
    return false;
  }, [draft, locked, hostRef, task.id, inspectorName, appraiserName, showToast]);

  useEffect(() => {
    if (!hostRef.current) return;
    hostRef.current.submit = submit;
  }, [hostRef, submit]);

  if (!draft) {
    return <InlineLoadingSkeleton />;
  }

  return (
    <>
      {locked ? (
        <Note tone="success">تم تأكيد الاستلام — النموذج للقراءة فقط.</Note>
      ) : null}

      {formError ? (
        <Note tone="warn" role="alert">
          {formError}
        </Note>
      ) : null}

      <fieldset disabled={formDisabled} className="contents">
        <RegistrationFormCard title="استلام المعاملة">
          <Note tone="info">
            {property
              ? `${property.city}${property.district ? ` · ${property.district}` : ""}`
              : "—"}
            {property?.court ? ` · ${property.court}` : ""}
          </Note>

          <FormRow className="grid-cols-1 sm:grid-cols-2">
            <RegField
              id="vc-receipt-date"
              label="تاريخ الاستلام"
              type="date"
              dir="ltr"
              value={draft.receiptDate}
              error={fieldErrors.receiptDate}
              onChange={(v) => {
                persist({ receiptDate: v });
                setFieldErrors((prev) => {
                  const next = { ...prev };
                  delete next.receiptDate;
                  return next;
                });
              }}
            />
            <RegSelect
              id="vc-priority"
              label="أولوية التنفيذ"
              value={draft.priority}
              options={[
                {
                  value: "normal",
                  label: valuationCoordinationPriorityLabel("normal"),
                },
                {
                  value: "urgent",
                  label: valuationCoordinationPriorityLabel("urgent"),
                },
              ]}
              onChange={(v) =>
                persist({
                  priority: v as ValuationCoordinationPriority,
                })
              }
            />
          </FormRow>

          <FormGroup className="mb-3 flex flex-col gap-1">
            <label className={CHECKBOX_OPT}>
              <input
                type="checkbox"
                className="mt-0.5"
                checked={draft.receiptConfirmed}
                onChange={(e) => {
                  persist({ receiptConfirmed: e.target.checked });
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.receiptConfirmed;
                    return next;
                  });
                }}
              />
              <span>أؤكد استلام المعاملة في قسم التقييم العقاري</span>
            </label>
            {fieldErrors.receiptConfirmed ? (
              <p className="mt-1 text-[10px] text-danger-text" role="alert">
                {fieldErrors.receiptConfirmed}
              </p>
            ) : null}
          </FormGroup>
        </RegistrationFormCard>

        <RegistrationFormCard title="إسناد الفريق">
          <FormRow className="grid-cols-1 sm:grid-cols-2">
            <FormGroup className="mb-3 flex flex-col gap-1">
              <Label
                htmlFor="vc-inspector"
                className="text-[11px] font-semibold text-text-2"
              >
                المعاين الميداني
              </Label>
              <Input
                id="vc-inspector"
                readOnly
                value={inspectorName || "—"}
                className="bg-surface-3 text-xs"
              />
              {fieldErrors.inspectorName ? (
                <p className="mt-1 text-[10px] text-danger-text" role="alert">
                  {fieldErrors.inspectorName}
                </p>
              ) : (
                <p className="mt-1 text-[10px] text-text-3">
                  من توزيع المعاملات — للقراءة فقط
                </p>
              )}
            </FormGroup>
            <FormGroup className="mb-3 flex flex-col gap-1">
              <Label
                htmlFor="vc-appraiser"
                className="text-[11px] font-semibold text-text-2"
              >
                المقيم العقاري
              </Label>
              <Input
                id="vc-appraiser"
                readOnly
                value={appraiserName || "—"}
                className="bg-surface-3 text-xs"
              />
              {fieldErrors.appraiserName ? (
                <p className="mt-1 text-[10px] text-danger-text" role="alert">
                  {fieldErrors.appraiserName}
                </p>
              ) : (
                <p className="mt-1 text-[10px] text-text-3">
                  من توزيع المعاملات — للقراءة فقط
                </p>
              )}
            </FormGroup>
          </FormRow>
        </RegistrationFormCard>

        <RegistrationFormCard title="تنسيق التنفيذ">
          <RegTextarea
            id="vc-note"
            label="ملاحظات الاستلام والتنسيق"
            rows={3}
            placeholder="تأكيد استلام المعاملة، موعد المعاينة المتوقع، وأي تنسيق مع دراسة الحالة…"
            value={draft.coordinationNotes}
            error={fieldErrors.coordinationNotes}
            onChange={(v) => {
              persist({ coordinationNotes: v });
              setFieldErrors((prev) => {
                const next = { ...prev };
                delete next.coordinationNotes;
                return next;
              });
            }}
          />

          <FormRow className="grid-cols-1 sm:grid-cols-2">
            <RegTextarea
              id="vc-inspector-instructions"
              label="تعليمات للمعاين"
              rows={2}
              placeholder="موعد الزيارة، نقطة التقاء، أو متطلبات الوصول…"
              value={draft.inspectorInstructions}
              onChange={(v) => persist({ inspectorInstructions: v })}
            />
            <RegTextarea
              id="vc-appraiser-instructions"
              label="تعليمات للمقيم"
              rows={2}
              placeholder="أسلوب التقييم، مستندات مطلوبة، أو موعد التسليم…"
              value={draft.appraiserInstructions}
              onChange={(v) => persist({ appraiserInstructions: v })}
            />
          </FormRow>
        </RegistrationFormCard>
      </fieldset>
    </>
  );
}
