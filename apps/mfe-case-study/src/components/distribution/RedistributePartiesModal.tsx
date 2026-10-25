"use client";

import { useEffect, useMemo, useState } from "react";
import { useCommandMutation } from "@platform/app-shared";
import { RegSelect } from "@platform/app-shared/registration/FormFields";
import { useDistributionAssigneesQuery } from "@settings/mfe/query/settings-queries";
import {
  Button,
  ModalBody,
  ModalCard,
  ModalClose,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalTitle,
  Note,
  Textarea,
} from "@platform/ui-kit";
import {
  getCaseSpecialists,
  getEngineeringOffices,
  getFieldInspectors,
  getValuators,
  type DistributionAssignee,
} from "../../lib/app-data/distribution-parties";
import { buildAssigneeOpenLoadMap } from "../../lib/app-data/distribution-load";
import { assigneeLoadOptions } from "../../lib/app-data/distribution-assignee-options";
import {
  migrateDistribution,
  type TaskDistributionDraft,
  type WorkflowTask,
} from "../../lib/app-data/tasks";
import { useWorkflowTasksQuery } from "../../query/case-study-queries";
import type { StaffUser } from "@platform/app-shared/app-data/constants";

type RedistributeRoleKey =
  | "caseSpecialist"
  | "inspector"
  | "valuator"
  | "engineeringOffice";

type RoleOption = {
  key: RedistributeRoleKey;
  label: string;
  people: DistributionAssignee[];
  currentId: string;
  apply: (id: string) => Partial<TaskDistributionDraft>;
  /** Why this role cannot move right now (its task is finished or cancelled); null when it can. */
  lockedReason: string | null;
};

const PARTY_TASK_KIND: Record<
  Exclude<RedistributeRoleKey, "caseSpecialist">,
  WorkflowTask["kind"]
> = {
  inspector: "field-inspection",
  valuator: "property-appraisal",
  engineeringOffice: "engineering-survey",
};

/** Only an open party task can be handed to someone else — the server refuses the rest. */
function partyLockReason(
  children: WorkflowTask[],
  key: Exclude<RedistributeRoleKey, "caseSpecialist">,
  label: string,
): string | null {
  const child = children.find((t) => t.kind === PARTY_TASK_KIND[key]);
  if (!child || child.status === "open") return null;
  const state =
    child.status === "completed" ? "مكتملة" : child.status === "cancelled" ? "مُلغاة" : "متوقفة";
  return `مهمة ${label} ${state} — لا يمكن إعادة إسنادها.`;
}

/**
 * Reassign parties via role → person cascade (one role at a time).
 * Does not toggle party participation on/off.
 */
export function RedistributePartiesModal({
  open,
  task,
  onClose,
  onConfirm,
}: {
  open: boolean;
  task: WorkflowTask | null;
  onClose: () => void;
  /** `staffUsers` is the loaded directory — the caller resolves the new assignee's display name from it. */
  onConfirm: (
    distribution: TaskDistributionDraft,
    reason: string,
    idempotencyKey: string,
    staffUsers: StaffUser[],
  ) => void | Promise<void>;
}) {
  const { data: staffResult } = useDistributionAssigneesQuery();
  const { data: workflowTasks = [] } = useWorkflowTasksQuery();
  const staffUsers = useMemo(() => staffResult?.users ?? [], [staffResult]);
  const loadByAssignee = useMemo(
    () => buildAssigneeOpenLoadMap(workflowTasks),
    [workflowTasks],
  );

  // The parent mounts this modal only once a task is chosen, so the first render is already
  // "open": seed the draft right away — the change detection below only covers a later switch.
  const [distribution, setDistribution] = useState<TaskDistributionDraft | null>(
    () => (open && task ? migrateDistribution(task.distribution, staffUsers) : null),
  );
  const [selectedRole, setSelectedRole] = useState<RedistributeRoleKey | "">(
    "",
  );
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState(false);
  const [personError, setPersonError] = useState(false);

  const { run: runRedistribute, loading: busy } = useCommandMutation(
    async (
      args: { distribution: TaskDistributionDraft; reason: string },
      idempotencyKey: string,
    ) => {
      await onConfirm(args.distribution, args.reason, idempotencyKey, staffUsers);
    },
  );

  // Opening the modal (or switching task) seeds a fresh distribution draft.
  const openedFor = open ? (task?.id ?? "") : "";
  const [seededFor, setSeededFor] = useState(openedFor);
  if (seededFor !== openedFor) {
    setSeededFor(openedFor);
    if (open && task) {
      setDistribution(migrateDistribution(task.distribution, staffUsers));
      setSelectedRole("");
      setReason("");
      setReasonError(false);
      setPersonError(false);
    }
  }

  const children = useMemo(
    () => (task ? workflowTasks.filter((t) => t.parentTaskId === task.id) : []),
    [workflowTasks, task],
  );

  const roleOptions = useMemo((): RoleOption[] => {
    if (!distribution) return [];
    const roles: RoleOption[] = [];
    if (distribution.caseSpecialist || distribution.caseSpecialistId) {
      roles.push({
        key: "caseSpecialist",
        label: "أخصائي دراسة الحالة",
        people: getCaseSpecialists(staffUsers),
        currentId: distribution.caseSpecialistId,
        apply: (id) => ({ caseSpecialist: true, caseSpecialistId: id }),
        lockedReason: null,
      });
    }
    roles.push({
      key: "inspector",
      label: "المعاين الميداني",
      people: getFieldInspectors(staffUsers),
      currentId: distribution.inspectorId,
      apply: (id) => ({ valuationDepartment: true, inspectorId: id }),
      lockedReason: partyLockReason(children, "inspector", "المعاين الميداني"),
    });
    roles.push({
      key: "valuator",
      label: "المقيّم العقاري",
      people: getValuators(staffUsers),
      currentId: distribution.valuatorId,
      apply: (id) => ({ valuationDepartment: true, valuatorId: id }),
      lockedReason: partyLockReason(children, "valuator", "المقيّم العقاري"),
    });
    if (distribution.engineeringOffice) {
      roles.push({
        key: "engineeringOffice",
        label: "المكتب الهندسي",
        people: getEngineeringOffices(staffUsers),
        currentId: distribution.engineeringOfficeId,
        apply: (id) => ({ engineeringOfficeId: id }),
        lockedReason: partyLockReason(children, "engineeringOffice", "المكتب الهندسي"),
      });
    }
    return roles;
  }, [distribution, staffUsers, children]);

  const activeRole = useMemo(
    () => roleOptions.find((r) => r.key === selectedRole) ?? null,
    [roleOptions, selectedRole],
  );

  if (!open || !task || !distribution) return null;

  const patch = (patchValue: Partial<TaskDistributionDraft>) =>
    setDistribution((prev) => (prev ? { ...prev, ...patchValue } : prev));

  const hasAnyParty = roleOptions.length > 0;

  const submit = async () => {
    const trimmed = reason.trim();
    if (!trimmed) {
      setReasonError(true);
      return;
    }
    if (!activeRole) {
      setPersonError(true);
      return;
    }
    if (!activeRole.currentId.trim()) {
      setPersonError(true);
      return;
    }
    if (activeRole.lockedReason) return;
    try {
      const outcome = await runRedistribute({
        distribution,
        reason: trimmed,
      });
      if (outcome.status === "skipped") return;
      onClose();
    } catch {
      // Parent already toasted; keep key for retry.
    }
  };

  return (
    <ModalOverlay onClick={onClose}>
      <ModalCard onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalTitle>تعديل إسناد الأطراف</ModalTitle>
          <ModalClose onClick={onClose} aria-label="إغلاق">
            ×
          </ModalClose>
        </ModalHeader>
        <ModalBody>
          <p className="mb-3 text-xs text-text-2">
            {task.title} · {task.poNumber}
          </p>
          <Note tone="warn" className="mb-3">
            إعادة إسناد الأطراف صلاحية <strong>أخصائي دراسة الحالة ومشرف القسم
            ومسؤول التحول الرقمي</strong> — يُعدَّل المكلَّف على مهام الأطراف
            المفتوحة فقط، ولا يضيف أو يحذف أطرافاً، ويُقيَّد من قام بالتعديل وسببه في
            سجل التدقيق وجدول العقار الزمني.
          </Note>

          {!hasAnyParty ? (
            <Note
              tone="default"
              className="mb-3 border border-border bg-surface-2 text-[11px]"
            >
              لا توجد أطراف مُسندة على هذه المعاملة.
            </Note>
          ) : (
            <div className="flex flex-col gap-3">
              <RegSelect
                id="redist_role"
                label="الدور"
                required
                options={roleOptions.map((r) => ({
                  value: r.key,
                  label: r.lockedReason ? `${r.label} (لا يمكن تغييره)` : r.label,
                }))}
                value={selectedRole}
                placeholder="اختر الدور…"
                onChange={(v) => {
                  setSelectedRole(v as RedistributeRoleKey | "");
                  setPersonError(false);
                }}
              />
              {activeRole?.lockedReason ? (
                <Note tone="warn" className="text-[11.5px]">
                  {activeRole.lockedReason}
                </Note>
              ) : null}
              {activeRole ? (
                <RegSelect
                  id="redist_person"
                  label="المسؤول"
                  required
                  options={assigneeLoadOptions(activeRole.people, loadByAssignee)}
                  value={activeRole.currentId}
                  disabled={Boolean(activeRole.lockedReason)}
                  placeholder={`اختر ${activeRole.label}…`}
                  onChange={(v) => {
                    patch(activeRole.apply(v));
                    setPersonError(false);
                  }}
                  error={
                    personError && !activeRole.currentId.trim()
                      ? "اختر المسؤول من القائمة."
                      : undefined
                  }
                />
              ) : (
                <Note
                  tone="default"
                  className="border border-border bg-surface-2 text-[11px]"
                >
                  اختر الدور أولاً لعرض الأشخاص المتاحين له.
                </Note>
              )}
              {personError && !selectedRole ? (
                <p className="m-0 text-xs text-danger">اختر الدور ثم المسؤول.</p>
              ) : null}
            </div>
          )}

          <label className="mb-1 mt-3 block text-xs text-text-2">
            سبب إعادة الإسناد <span className="text-danger">*</span>
          </label>
          <Textarea
            className="text-sm"
            rows={3}
            value={reason}
            placeholder="اذكر سبب إعادة إسناد الأطراف على هذه المعاملة…"
            hasError={reasonError}
            onChange={(e) => {
              setReason(e.target.value);
              if (reasonError) setReasonError(false);
            }}
          />
          {reasonError ? (
            <p className="mt-2 text-xs text-danger">سبب إعادة الإسناد إلزامي.</p>
          ) : null}
        </ModalBody>
        <ModalFooter>
          <Button type="button" size="sm" variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
          <Button
            type="button"
            size="sm"
            variant="primary"
            disabled={busy || !hasAnyParty || Boolean(activeRole?.lockedReason)}
            loading={busy}
            onClick={() => void submit()}
          >
            حفظ الإسناد الجديد
          </Button>
        </ModalFooter>
      </ModalCard>
    </ModalOverlay>
  );
}
