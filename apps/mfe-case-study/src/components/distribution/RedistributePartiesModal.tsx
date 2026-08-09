"use client";

import { useEffect, useMemo, useState } from "react";
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
} from "@platform/design-system";
import {
  getCaseSpecialists,
  getEngineeringOffices,
  getFieldInspectors,
  getValuators,
  type DistributionAssignee,
} from "../../lib/prototype/distribution-parties";
import {
  migrateDistribution,
  type TaskDistributionDraft,
  type WorkflowTask,
} from "../../lib/prototype/tasks-storage";

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

function toOptions(list: { id: string; name: string; subtitle?: string }[]) {
  return list.map((a) => ({
    value: a.id,
    label: a.subtitle ? `${a.name} — ${a.subtitle}` : a.name,
  }));
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
  ) => void | Promise<void>;
}) {
  const { data: staffResult } = useDistributionAssigneesQuery();
  const staffUsers = staffResult?.users ?? [];

  const [distribution, setDistribution] = useState<TaskDistributionDraft | null>(
    null,
  );
  const [selectedRole, setSelectedRole] = useState<RedistributeRoleKey | "">(
    "",
  );
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState(false);
  const [personError, setPersonError] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !task) return;
    const next = migrateDistribution(task.distribution, staffUsers);
    setDistribution(next);
    setSelectedRole("");
    setReason("");
    setReasonError(false);
    setPersonError(false);
    setBusy(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task?.id]);

  const roleOptions = useMemo((): RoleOption[] => {
    if (!distribution) return [];
    const roles: RoleOption[] = [];
    if (distribution.caseSpecialist) {
      roles.push({
        key: "caseSpecialist",
        label: "أخصائي دراسة الحالة",
        people: getCaseSpecialists(staffUsers),
        currentId: distribution.caseSpecialistId,
        apply: (id) => ({ caseSpecialistId: id }),
      });
    }
    if (distribution.valuationDepartment) {
      roles.push({
        key: "inspector",
        label: "المعاين الميداني",
        people: getFieldInspectors(staffUsers),
        currentId: distribution.inspectorId,
        apply: (id) => ({ inspectorId: id }),
      });
      roles.push({
        key: "valuator",
        label: "المقيم العقاري",
        people: getValuators(staffUsers),
        currentId: distribution.valuatorId,
        apply: (id) => ({ valuatorId: id }),
      });
    }
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
    setBusy(true);
    try {
      await onConfirm(distribution, trimmed);
      onClose();
    } finally {
      setBusy(false);
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
                  options={toOptions(activeRole.people)}
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
