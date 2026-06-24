"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Input,
  ModalBody,
  ModalCard,
  ModalClose,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalTitle,
} from "@platform/design-system";
import type { InspectorFeeRowDto } from "@platform/api-client";
import { DISCOUNT_REASONS } from "./party-fee-meta";

export function FeeDiscountModal({
  open,
  row,
  onClose,
  onSave,
}: {
  open: boolean;
  row: InspectorFeeRowDto | null;
  onClose: () => void;
  onSave: (patch: {
    supervisorDiscountSar: number;
    discountReason: string;
  }) => void | Promise<void>;
}) {
  const [amount, setAmount] = useState("0");
  const [reason, setReason] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !row) return;
    setAmount(String(row.supervisorDiscountSar || 0));
    setReason(row.discountReason ?? "");
    setError(false);
    setBusy(false);
  }, [open, row]);

  const net = useMemo(() => {
    if (!row) return 0;
    const discount = Math.min(
      Math.max(Number(amount) || 0, 0),
      row.agreedFeeSar,
    );
    return row.agreedFeeSar - discount;
  }, [amount, row]);

  if (!open || !row) return null;

  const submit = async () => {
    const discount = Math.min(
      Math.max(Number(amount) || 0, 0),
      row.agreedFeeSar,
    );
    if (discount > 0 && !reason.trim()) {
      setError(true);
      return;
    }
    setBusy(true);
    try {
      await onSave({
        supervisorDiscountSar: discount,
        discountReason: reason.trim(),
      });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalOverlay onClick={onClose}>
      <ModalCard wide onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalTitle>حسم من أتعاب الطرف</ModalTitle>
          <ModalClose onClick={onClose} aria-label="إغلاق">
            ×
          </ModalClose>
        </ModalHeader>
        <ModalBody>
          <p className="mb-3 text-xs text-text-2">
            {row.propertyLabel} · الأتعاب {row.agreedFeeSar.toLocaleString("ar-SA")}{" "}
            ر.س
          </p>
          <label className="mb-1 block text-xs text-text-2">
            قيمة الحسم (ر.س)
          </label>
          <Input
            type="number"
            min={0}
            max={row.agreedFeeSar}
            className="mb-3 text-sm"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <label className="mb-1 block text-xs text-text-2">
            سبب الحسم <span className="text-danger">*</span>
          </label>
          <select
            className="mb-3 w-full rounded-md border border-border bg-surface px-2 py-2 text-sm"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (error) setError(false);
            }}
          >
            <option value="">— اختر سبباً —</option>
            {DISCOUNT_REASONS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          {error ? (
            <p className="mb-2 text-xs text-danger">السبب إلزامي عند وجود حسم.</p>
          ) : null}
          <div className="flex items-center justify-between rounded-md bg-[color-mix(in_srgb,var(--warning-bg)_55%,var(--surface))] px-3 py-2 text-sm">
            <span className="text-text-2">الصافي بعد الحسم</span>
            <strong>{net.toLocaleString("ar-SA")} ر.س</strong>
          </div>
          <p className="mt-3 text-[11px] text-text-3">
            صلاحية الحسم للمشرف دون سقف · يُسجَّل في سجل التدقيق.
          </p>
        </ModalBody>
        <ModalFooter>
          <Button type="button" size="sm" variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
          <Button
            type="button"
            size="sm"
            variant="primary"
            disabled={busy}
            onClick={() => void submit()}
          >
            حفظ
          </Button>
        </ModalFooter>
      </ModalCard>
    </ModalOverlay>
  );
}
