"use client";

import { useEffect, useState } from "react";
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
import type { WorkflowTask } from "../../lib/prototype/tasks-storage";

/** إعادة فتح معاملة مكتملة من قائمة «جميع المعاملات» — صلاحية مشرف القسم فأعلى. */
export function ReopenCompletedTransactionModal({
  open,
  task,
  onClose,
  onConfirm,
}: {
  open: boolean;
  task: WorkflowTask | null;
  onClose: () => void;
  onConfirm: (reason: string) => void | Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setReason("");
    setError(false);
    setBusy(false);
  }, [open]);

  if (!open || !task) return null;

  const submit = async () => {
    const trimmed = reason.trim();
    if (!trimmed) {
      setError(true);
      return;
    }
    setBusy(true);
    try {
      await onConfirm(trimmed);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalOverlay onClick={onClose}>
      <ModalCard onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalTitle>إعادة فتح المعاملة</ModalTitle>
          <ModalClose onClick={onClose} aria-label="إغلاق">
            ×
          </ModalClose>
        </ModalHeader>
        <ModalBody>
          <p className="mb-3 text-xs text-text-2">
            {task.title} · {task.poNumber}
          </p>
          <Note tone="warn">
            إعادة فتح معاملة مكتملة صلاحية <strong>مشرف القسم فأعلى</strong> —
            تُعيد المعاملة لمرحلة العمل النشطة ويُسجَّل الإجراء والسبب في سجل
            الأحداث ولا يمكن التراجع عنه.
          </Note>
          <label className="mb-1 block text-xs text-text-2">
            سبب إعادة الفتح <span className="text-danger">*</span>
          </label>
          <Textarea
            className="text-sm"
            rows={3}
            value={reason}
            placeholder="اذكر سبب إعادة فتح هذه المعاملة المكتملة…"
            hasError={error}
            onChange={(e) => {
              setReason(e.target.value);
              if (error) setError(false);
            }}
          />
          {error ? (
            <p className="mt-2 text-xs text-danger">سبب إعادة الفتح إلزامي.</p>
          ) : null}
        </ModalBody>
        <ModalFooter>
          <Button type="button" size="sm" variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
          <Button
            type="button"
            size="sm"
            variant="danger"
            disabled={busy}
            loading={busy}
            onClick={() => void submit()}
          >
            تأكيد إعادة الفتح
          </Button>
        </ModalFooter>
      </ModalCard>
    </ModalOverlay>
  );
}
