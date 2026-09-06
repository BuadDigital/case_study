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
import { AppModal, Note, Spinner } from "@platform/ui-kit";
import {
  fetchPartyFeePricingById,
  fetchPartyFeePricingTables,
} from "@platform/api-client";
import type { StaffUser } from "@platform/app-shared/app-data/constants";
import { prototypeModulesApiConfig } from "@platform/app-shared/app-data/modules-api-config";
import { groupAssigneesForSelect } from "../lib/app-data/operations-task-assignees";
import type { PoIntakeRecord } from "../lib/app-data/po-intake-data";
import { createOperationsTaskRecord } from "../lib/app-data/operations-tasks-commands";
import {
  opsBtnGhost,
  opsBtnPrimary,
  opsFldFull,
  opsFormGrid,
} from "../lib/app-data/ops-tasks-tw";
import {
  CreateTaskAssigneeField,
  CreateTaskDescriptionField,
  CreateTaskTypeField,
  CreateTaskVisitFeeFields,
} from "./CreateOperationsTaskFields";
import {
  CreateTaskLetterPreview,
  CreateTaskLinkScopeFields,
  CreateTaskScheduleFields,
} from "./CreateOperationsTaskLinkFields";
import {
  allDeedOptions,
  assigneesForType,
  buildCreateOperationsTaskSubmission,
  createOperationsTaskReducer,
  createTaskPrefillKey,
  deedOptions,
  initialCreateOperationsTaskForm,
  letterPreviewRows,
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
  const [form, dispatch] = useReducer(
    createOperationsTaskReducer,
    prefill,
    initialCreateOperationsTaskForm,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { type, scope, poNumber, deed, selectedDeeds, assigneeId } = form;

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

  const poOptions = useMemo(() => poOptionsForType(poRecords, type), [poRecords, type]);
  const selectedPo = useMemo(
    () => selectedPoRecord(poOptions, poNumber),
    [poOptions, poNumber],
  );
  const deeds = useMemo(() => deedOptions(selectedPo), [selectedPo]);
  const multiDeedOptions = useMemo(() => allDeedOptions(poOptions), [poOptions]);
  const letterPreview = useMemo(
    () => letterPreviewRows({ type, scope, selectedDeeds, poNumber, deed }, poOptions),
    [type, scope, selectedDeeds, poNumber, deed, poOptions],
  );

  useEffect(() => {
    const next = resolveAssigneeSelection(assignees, assigneeId, staffLoading);
    if (next) dispatch({ type: "set-assignee", ...next });
  }, [assignees, assigneeId, staffLoading]);

  useEffect(() => {
    if (!needsVisitFee) {
      dispatch({ type: "set-visit-fee", value: "" });
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
  }, [needsVisitFee, assigneeId]);

  const handleSubmit = async () => {
    const submission = buildCreateOperationsTaskSubmission(form, {
      poOptions,
      needsVisitFee,
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
      subtitle="واجهة موحّدة للإنشاء والإسناد — «زيارة محكمة» يفعّل خطاب التفويض"
      onClose={onClose}
      wide
      maxWidthPx={720}
      look="ops-html"
      footer={
        <div className="flex w-full justify-end gap-2.5">
          <button type="button" className={opsBtnGhost} onClick={onClose} disabled={busy}>
            إلغاء
          </button>
          <button
            type="button"
            className={opsBtnPrimary}
            disabled={busy}
            aria-busy={busy || undefined}
            onClick={() => void handleSubmit()}
          >
            {busy ? <Spinner /> : (
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
            <span>{busy ? "جاري الإنشاء…" : "إنشاء المهمة"}</span>
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

        <CreateTaskTypeField form={form} dispatch={dispatch} />
        <CreateTaskAssigneeField
          form={form}
          dispatch={dispatch}
          assignees={assignees}
          assigneeGroups={assigneeGroups}
          staffUsers={staffUsers}
          staffLoading={staffLoading}
          staffLoadError={staffLoadError}
        />
        <CreateTaskVisitFeeFields
          form={form}
          dispatch={dispatch}
          needsVisitFee={needsVisitFee}
        />
        <CreateTaskDescriptionField form={form} dispatch={dispatch} />
        <CreateTaskLinkScopeFields
          form={form}
          dispatch={dispatch}
          poOptions={poOptions}
          selectedPo={selectedPo}
          deeds={deeds}
          multiDeedOptions={multiDeedOptions}
        />
        <CreateTaskScheduleFields form={form} dispatch={dispatch} />
        {type === "court_visit" ? <CreateTaskLetterPreview rows={letterPreview} /> : null}
      </div>
    </AppModal>
  );
}
