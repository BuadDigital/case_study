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
import {
  buildAssigneeOpenLoadMap,
  openLoadForAssignee,
  withOpenLoadLabel,
} from "../../lib/app-data/distribution-load";
import {
  migrateDistribution,
  type TaskDistributionDraft,
  type WorkflowTask,
} from "../../lib/app-data/tasks-storage";
import { useWorkflowTasksQuery } from "../../query/case-study-queries";

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
};

function toOptions(
  list: { id: string; name: string; subtitle?: string }[],
  loadByAssignee: Map<string, number>,
) {
  return list.map((a) => {
    const base = a.subtitle ? `${a.name} — ${a.subtitle}` : a.name;
    const count = openLoadForAssignee(loadByAssignee, a.id);
    return {
      value: a.id,
      label: withOpenLoadLabel(base, count),
    };
  });
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
  onConfirm: (
    distribution: TaskDistributionDraft,
    reason: string,
    idempotencyKey: string,
  ) => void | Promise<void>;
}) {
  const { data: staffResult } = useDistributionAssigneesQuery();
  const { data: workflowTasks = [] } = useWorkflowTasksQuery();
  const staffUsers = staffResult?.users ?? [];
  const loadByAssignee = useMemo(
    () => buildAssigneeOpenLoadMap(workflowTasks),
    [workflowTasks],
  );

  const [distribution, setDistribution] = useState<TaskDistributionDraft | null>(
    null,
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
      await onConfirm(args.distribution, args.reason, idempotencyKey);
    },
  );

  useEffect(() => {
    if (!open || !task) return;
    const next = migrateDistribution(task.distribution, staffUsers);
    setDistribution(next);
    setSelectedRole("");
    setReason("");
    setReasonError(false);
    setPersonError(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task?.id]);

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
      });
    }
    roles.push({
      key: "inspector",
      label: "المعاين الميداني",
      people: getFieldInspectors(staffUsers),
      currentId: distribution.inspectorId,
      apply: (id) => ({ valuationDepartment: true, inspectorId: id }),
    });
    roles.push({
      key: "valuator",
      label: "المقيم العقاري",
      people: getValuators(staffUsers),
      currentId: distribution.valuatorId,
      apply: (id) => ({ valuationDepartment: true, valuatorId: id }),
    });
    if (distribution.engineeringOffice) {
      roles.push({
        key: "engineeringOffice",
        label: "المكتب الهندسي",
        people: getEngineeringOffices(staffUsers),
        currentId: distribution.engineeringOfficeId,
        apply: (id) => ({ engineeringOfficeId: id }),
      });
    }
    return roles;
  }, [distribution, staffUsers]);

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
            إعادة إسناد الأطراف صلاحية <strong>مشرف القسم فأعلى</strong> —
            يُعدَّل المكلَّف على مهام الأطراف القائمة فقط (المفتوحة)، ولا
            يضيف أو يحذف أطرافاً جديدة.
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
                  label: r.label,
                }))}
                value={selectedRole}
                placeholder="اختر الدور…"
                onChange={(v) => {
                  setSelectedRole(v as RedistributeRoleKey | "");
                  setPersonError(false);
                }}
              />
              {activeRole ? (
                <RegSelect
                  id="redist_person"
                  label="المسؤول"
                  required
                  options={toOptions(activeRole.people, loadByAssignee)}
                  value={activeRole.currentId}
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
            disabled={busy || !hasAnyParty}
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
