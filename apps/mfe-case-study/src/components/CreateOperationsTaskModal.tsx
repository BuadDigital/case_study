"use client";

/**
 * «مهمة جديدة» — composition only. Form state lives in
 * `createOperationsTaskReducer` and the validation/payload in
 * `buildCreateOperationsTaskSubmission` (create-operations-task-state); the
 * field groups render from `CreateOperationsTaskFields` and
 * `CreateOperationsTaskLinkFields`. This file keeps the modal chrome, the
 * assignee auto-select and the visit-fee lookup.
 */
import { useEffect, useMemo, useReducer, useState } from "react";
import { AppModal, Note, Spinner, useToast } from "@platform/ui-kit";
import {
  fetchPartyFeePricingById,
  fetchPartyFeePricingTables,
} from "@platform/api-client";
import type { StaffUser } from "@platform/app-shared/app-data/constants";
import { prototypeModulesApiConfig } from "@platform/app-shared/app-data/modules-api-config";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import { groupAssigneesForSelect } from "../lib/app-data/operations-task-assignees";
import type { PoIntakeRecord } from "../lib/app-data/po-intake-data";
import { canRedistributeParties } from "../lib/app-data/po-roles";
import { createOperationsTaskRecord } from "../lib/app-data/operations-tasks-commands";
import { addEngineeringSurveyToTask } from "../lib/app-data/tasks-commands";
import {
  opsBtnGhost,
  opsBtnPrimary,
  opsFldFull,
  opsFormGrid,
  opsTfNote,
} from "../lib/app-data/ops-tasks-tw";
import { useWorkflowTasksQuery } from "../query/case-study-queries";
import {
  SURVEY_EXCEPTION_REASON_REQUIRED_AR,
  engineeringSurveyTarget,
} from "./create-engineering-survey-task";
import {
  CreateTaskAssigneeField,
  CreateTaskDescriptionField,
  CreateTaskSurveyReasonField,
  CreateTaskTypeField,
  CreateTaskVisitFeeFields,
} from "./CreateOperationsTaskFields";
import {
  CreateTaskLetterPreview,
  CreateTaskLinkScopeFields,
  CreateTaskScheduleFields,
} from "./CreateOperationsTaskLinkFields";
import {
  ENGINEERING_SURVEY_TASK_TYPE,
  taskTypesFor,
  allDeedOptions,
  assigneesForType,
  buildCreateOperationsTaskSubmission,
  createOperationsTaskReducer,
  createTaskLinkLocked,
  createTaskPrefillKey,
  deedOptions,
  initialCreateOperationsTaskForm,
  letterPreviewRows,
  allowsAgreedTaskFeeFor,
  needsVisitFeeFor,
  poOptionsForType,
  resolveAssigneeSelection,
  selectedAssigneeUser,
  selectedPoRecord,
  type CreateOperationsTaskPrefill,
} from "./create-operations-task-state";

export type { CreateOperationsTaskPrefill } from "./create-operations-task-state";

type Props = {
  open: boolean;
  poRecords: PoIntakeRecord[];
  staffUsers: StaffUser[];
  staffLoadError?: string | null;
  prefill?: CreateOperationsTaskPrefill | null;
  /** true while staff / distribution queries are loading */
  staffLoading?: boolean;
  onClose: () => void;
  onCreated: (taskId: string) => void;
};

export function CreateOperationsTaskModal({
  open,
  poRecords,
  staffUsers,
  staffLoadError = null,
  prefill,
  staffLoading = false,
  onClose,
  onCreated,
}: Props) {
  if (!open) return null;
  return (
    <CreateOperationsTaskForm
      key={createTaskPrefillKey(prefill)}
      poRecords={poRecords}
      staffUsers={staffUsers}
      staffLoadError={staffLoadError}
      prefill={prefill}
      staffLoading={staffLoading}
      onClose={onClose}
      onCreated={onCreated}
    />
  );
}

function CreateOperationsTaskForm({
  poRecords,
  staffUsers,
  staffLoadError = null,
  prefill,
  staffLoading = false,
  onClose,
  onCreated,
}: Omit<Props, "open">) {
  const { showToast } = useToast();
  const { access } = useAppAccess();
  // «رفع مساحي» is offered to who may add the office after the distribution — the server's own rule.
  const taskTypes = useMemo(() => taskTypesFor(canRedistributeParties(access)), [access]);
  const [form, dispatch] = useReducer(createOperationsTaskReducer, prefill, (p) =>
    initialCreateOperationsTaskForm(p, Date.now(), taskTypes),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { type, scope, poNumber, deed, selectedDeeds, assigneeId } = form;
  const isSurvey = type === ENGINEERING_SURVEY_TASK_TYPE;
  // Opened from a deed's page: the link is that deed, shown and not chosen (Omar 2026-11-12).
  const linkLocked = createTaskLinkLocked(prefill);
  const { data: workflowTasks = [] } = useWorkflowTasksQuery();

  const assignees = useMemo(
    () => assigneesForType(type, staffUsers),
    [type, staffUsers],
  );
  const assigneeGroups = useMemo(
    () => groupAssigneesForSelect(assignees, staffUsers),
    [assignees, staffUsers],
  );
  const assigneeUser = useMemo(
    () => selectedAssigneeUser(staffUsers, assigneeId),
    [staffUsers, assigneeId],
  );
  const needsVisitFee = needsVisitFeeFor(type, assigneeId, assigneeUser);
  const allowsAgreedTaskFee = allowsAgreedTaskFeeFor(
    type,
    assigneeId,
    assigneeUser,
  );

  const poOptions = useMemo(
    () => poOptionsForType(poRecords, type),
    [poRecords, type],
  );
  const selectedPo = useMemo(
    () => selectedPoRecord(poOptions, poNumber),
    [poOptions, poNumber],
  );
  const deeds = useMemo(() => deedOptions(selectedPo), [selectedPo]);
  const multiDeedOptions = useMemo(
    () => allDeedOptions(poOptions),
    [poOptions],
  );
  const letterPreview = useMemo(
    () =>
      letterPreviewRows(
        { type, scope, selectedDeeds, poNumber, deed },
        poOptions,
      ),
    [type, scope, selectedDeeds, poNumber, deed, poOptions],
  );

  // Where the survey goes and whether it may be added — the reason shows under the deed once chosen.
  const surveyTarget = useMemo(
    () =>
      isSurvey
        ? engineeringSurveyTarget({ poRecords, tasks: workflowTasks, poNumber, deed })
        : null,
    [isSurvey, poRecords, workflowTasks, poNumber, deed],
  );
  /** The chosen deed cannot take the office — the reason shows under it and the button is off. */
  const surveyBlocked = Boolean(deed.trim()) && surveyTarget !== null && !surveyTarget.ok;

  useEffect(() => {
    // The survey's office is always chosen by the user — it creates the office's task and its fee.
    const next = resolveAssigneeSelection(assignees, assigneeId, staffLoading, !isSurvey);
    if (next) dispatch({ type: "set-assignee", ...next });
  }, [assignees, assigneeId, staffLoading, isSurvey]);

  useEffect(() => {
    if (!needsVisitFee) {
      // A task that is not a court visit keeps its typed agreed fee; anything else starts empty.
      if (!allowsAgreedTaskFee) dispatch({ type: "set-visit-fee", value: "" });
      return;
    }

    let cancelled = false;
    const config = prototypeModulesApiConfig();
    if (!config) return;

    void (async () => {
      const tables = await fetchPartyFeePricingTables(config, "court-visit");
      if (!tables.ok || cancelled) return;
      const active = tables.data.find((t) => t.isActive) ?? tables.data[0];
      if (!active) return;
      const detail = await fetchPartyFeePricingById(config, active.id);
      if (!detail.ok || cancelled) return;
      const amount = detail.data.courtVisitFeeSar;
      if (typeof amount === "number" && amount > 0) {
        dispatch({ type: "set-visit-fee", value: String(amount) });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [needsVisitFee, allowsAgreedTaskFee, assigneeId]);

  /**
   * «رفع مساحي»: adds the office's survey task to the transaction (the command the distribution's
   * own child uses) instead of creating an operations task. Refusals are the server's words.
   */
  const submitSurvey = async () => {
    if (!assigneeId.trim()) {
      setError("اختر المكتب الهندسي");
      return;
    }
    if (!surveyTarget?.ok) {
      // Once a deed is chosen its reason already shows under it — not a second time at the top.
      setError(surveyBlocked ? null : (surveyTarget?.error ?? "اختر أمر العمل والصك"));
      return;
    }
    // Outside the survey rule the office is added by exception — never without its reason.
    const exceptionReason = surveyTarget.outsideRule ? form.surveyExceptionReason.trim() : "";
    if (surveyTarget.outsideRule && !exceptionReason) {
      setError(SURVEY_EXCEPTION_REASON_REQUIRED_AR);
      return;
    }
    setBusy(true);
    setError(null);
    const result = await addEngineeringSurveyToTask(
      surveyTarget.parentTaskId,
      { id: assigneeId.trim(), name: form.assigneeName.trim() },
      exceptionReason,
    );
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    showToast("أُضيف الرفع المساحي وأُبلغ المكتب", "success");
    onClose();
  };

  const handleSubmit = async () => {
    if (isSurvey) {
      await submitSurvey();
      return;
    }
    const submission = buildCreateOperationsTaskSubmission(form, {
      poOptions,
      needsVisitFee,
      allowsAgreedTaskFee,
      prefillTitle: prefill?.title,
    });
    if (!submission.ok) {
      setError(submission.error);
      return;
    }

    setBusy(true);
    setError(null);
    const result = await createOperationsTaskRecord(submission.body);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onCreated(result.task.id);
    onClose();
  };

  return (
    <AppModal
      open
      title="مهمة جديدة"
      subtitle="واجهة موحّدة للإنشاء والإسناد — «زيارة محكمة» يفعّل خطاب التكليف"
      onClose={onClose}
      wide
      maxWidthPx={720}
      look="ops-html"
      footer={
        <div className="flex w-full justify-end gap-2.5">
          <button
            type="button"
            className={opsBtnGhost}
            onClick={onClose}
            disabled={busy}
          >
            إلغاء
          </button>
          <button
            type="button"
            className={opsBtnPrimary}
            disabled={busy || surveyBlocked}
            aria-busy={busy || undefined}
            onClick={() => void handleSubmit()}
          >
            {busy ? (
              <Spinner />
            ) : (
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            )}
            <span>
              {isSurvey
                ? busy
                  ? "جاري الإضافة…"
                  : "إضافة رفع مساحي"
                : busy
                  ? "جاري الإنشاء…"
                  : "إنشاء المهمة"}
            </span>
          </button>
        </div>
      }
    >
      <div className={opsFormGrid}>
        {error ? (
          <div className={opsFldFull}>
            <Note tone="danger">{error}</Note>
          </div>
        ) : null}

        <CreateTaskTypeField form={form} dispatch={dispatch} types={taskTypes} />
        <CreateTaskAssigneeField
          form={form}
          dispatch={dispatch}
          assignees={assignees}
          assigneeGroups={assigneeGroups}
          staffUsers={staffUsers}
          staffLoading={staffLoading}
          staffLoadError={staffLoadError}
        />
        {isSurvey ? (
          // The office's survey task has its own page, fee table and due date — the form asks for
          // the deed only, and says what adding the office means for the study.
          <>
            <CreateTaskLinkScopeFields
              form={form}
              dispatch={dispatch}
              poOptions={poOptions}
              selectedPo={selectedPo}
              deeds={deeds}
              multiDeedOptions={multiDeedOptions}
              scopeLocked
              linkLocked={linkLocked}
            />
            {surveyBlocked && surveyTarget && !surveyTarget.ok ? (
              <div className={opsFldFull}>
                <Note tone="warn">{surveyTarget.error}</Note>
              </div>
            ) : null}
            {surveyTarget?.ok && surveyTarget.outsideRule ? (
              <>
                <div className={opsFldFull}>
                  <Note tone="warn">
                    {surveyTarget.outsideRule} يمكن إسناد المكتب الهندسي استثناءً بذكر السبب.
                  </Note>
                </div>
                <CreateTaskSurveyReasonField form={form} dispatch={dispatch} />
              </>
            ) : null}
            <div className={opsFldFull}>
              <div className={opsTfNote}>
                بعد الإضافة لا يصدر تقرير دراسة الحالة حتى يسلّم المكتب عمله ويُستلم، أو يتجاوز عنه
                دارس العقار من قسم «المكتب الهندسي». أتعاب المكتب من جدول التسعير عند استلام عمله.
              </div>
            </div>
          </>
        ) : (
          <>
            <CreateTaskVisitFeeFields
              form={form}
              dispatch={dispatch}
              needsVisitFee={needsVisitFee}
              allowsAgreedTaskFee={allowsAgreedTaskFee}
            />
            <CreateTaskDescriptionField form={form} dispatch={dispatch} />
            <CreateTaskLinkScopeFields
              form={form}
              dispatch={dispatch}
              poOptions={poOptions}
              selectedPo={selectedPo}
              deeds={deeds}
              multiDeedOptions={multiDeedOptions}
              linkLocked={linkLocked}
            />
            <CreateTaskScheduleFields form={form} dispatch={dispatch} />
            {type === "court_visit" ? (
              <CreateTaskLetterPreview rows={letterPreview} />
            ) : null}
          </>
        )}
      </div>
    </AppModal>
  );
}
