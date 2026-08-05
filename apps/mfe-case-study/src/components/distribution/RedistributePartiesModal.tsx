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
  getEngineeringOffices,
  getFieldInspectors,
  getValuators,
} from "../../lib/prototype/distribution-parties";
import {
  migrateDistribution,
  type TaskDistributionDraft,
  type WorkflowTask,
} from "../../lib/prototype/tasks-storage";

function toOptions(list: { id: string; name: string; subtitle?: string }[]) {
  return list.map((a) => ({
    value: a.id,
    label: a.subtitle ? `${a.name} — ${a.subtitle}` : a.name,
  }));
}

/**
 * Thin post-confirm modal — edits the assignee on already-spawned party child
 * tasks for a case-study parent. Does not toggle party participation on/off
 * (that would require re-opening the full distribution flow).
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
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !task) return;
    setDistribution(migrateDistribution(task.distribution, staffUsers));
    setReason("");
    setReasonError(false);
    setBusy(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task?.id]);

  const fieldInspectors = useMemo(
    () => getFieldInspectors(staffUsers),
    [staffUsers],
  );
  const valuators = useMemo(() => getValuators(staffUsers), [staffUsers]);
  const engineeringOffices = useMemo(
    () => getEngineeringOffices(staffUsers),
    [staffUsers],
  );

  if (!open || !task || !distribution) return null;

  const patch = (patchValue: Partial<TaskDistributionDraft>) =>
    setDistribution((prev) => (prev ? { ...prev, ...patchValue } : prev));

  const hasAnyParty =
    distribution.valuationDepartment || distribution.engineeringOffice;

  const submit = async () => {
    const trimmed = reason.trim();
    if (!trimmed) {
      setReasonError(true);
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
            <Note tone="default" className="mb-3 border border-border bg-surface-2 text-[11px]">
              لا توجد أطراف مُسندة على هذه المعاملة.
            </Note>
          ) : (
            <div className="flex flex-col gap-3">
              {distribution.valuationDepartment ? (
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <RegSelect
                    id="redist_val_inspector"
                    label="المعاين الميداني"
                    options={toOptions(fieldInspectors)}
                    value={distribution.inspectorId}
                    placeholder="اختر المعاين…"
                    onChange={(v) => patch({ inspectorId: v })}
                  />
                  <RegSelect
                    id="redist_val_appraiser"
                    label="المقيم العقاري"
                    options={toOptions(valuators)}
                    value={distribution.valuatorId}
                    placeholder="اختر المقيم…"
                    onChange={(v) => patch({ valuatorId: v })}
                  />
                </div>
              ) : null}
              {distribution.engineeringOffice ? (
                <RegSelect
                  id="redist_engineering_office"
                  label="المكتب الهندسي"
                  options={toOptions(engineeringOffices)}
                  value={distribution.engineeringOfficeId}
                  placeholder="اختر المكتب الهندسي…"
                  onChange={(v) => patch({ engineeringOfficeId: v })}
                />
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
