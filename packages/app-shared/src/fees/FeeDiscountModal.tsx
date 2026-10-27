"use client";

/**
 * One discount dialog for every fee screen: the supervisor's direct discount on a fee row, the
 * specialist's proposal at acceptance (no fee row yet — `subject`, optional fee), and the
 * supervisor's amendment of a proposal (seeded from it, reason locked, a zero amount refused).
 */

import { fmtSar } from "../format/number";
import { useState } from "react";
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
} from "@platform/ui-kit";
import type { InspectorFeeRowDto } from "@platform/api-client";
import { DISCOUNT_REASONS } from "./party-fee-meta";

/** What the discount is taken from when there is no fee row yet (e.g. before acceptance). */
export type FeeDiscountSubject = {
  label: string;
  /** Null when the fee is not priced yet — the server checks the cap. */
  feeSar: number | null;
};

/**
 * The discount dialog.
 *
 * How it works:
 * - Opening it (or switching to another row/subject) seeds the amount and reason once — from
 *   `initialDiscountSar` / `initialReason` when given, else from the row's saved discount.
 * - The amount is clamped to [0, fee] when the fee is known; with no fee (proposal before the
 *   line exists) only the lower bound applies and the server enforces the cap.
 * - Save validates (required amount when `requireDiscount`, reason when the amount is positive),
 *   awaits `onSave`, and closes only when `onSave` does not return `false`.
 *
 * Edge cases and fixes:
 * - The accept-with-proposal flow can be refused by the server (e.g. above the fee); returning
 *   `false` keeps the dialog open with the typed values instead of losing them.
 * - When amending, the specialist's reason may not be one of the presets; it is added as an
 *   option so the locked select still shows it rather than «— اختر سبباً —».
 * - A zero amount with `requireDiscount` is refused here: a zero proposal means "no proposal",
 *   and a zero amendment means "waive", which has its own button.
 */
export function FeeDiscountModal({
  open,
  row,
  subject,
  title = "حسم من أتعاب الطرف",
  reasons = DISCOUNT_REASONS,
  initialDiscountSar,
  initialReason,
  reasonLocked = false,
  requireDiscount = false,
  note = "صلاحية الحسم للمشرف دون سقف · يُسجَّل في سجل التدقيق.",
  saveLabel = "حفظ",
  onClose,
  onSave,
}: {
  open: boolean;
  row: InspectorFeeRowDto | null;
  /** Used instead of {@link row} when the fee line does not exist yet. */
  subject?: FeeDiscountSubject | null;
  /** Override for the party type (e.g. engineering office pricing edits). */
  title?: string;
  /** Reason presets — defaults to the general discount reasons. */
  reasons?: readonly string[];
  /** Seeds instead of the row's saved discount (e.g. the specialist's proposal). */
  initialDiscountSar?: number;
  initialReason?: string | null;
  /** The reason is shown but not changed (the supervisor amends only the amount). */
  reasonLocked?: boolean;
  /** A zero discount is refused instead of saved (proposals and amendments). */
  requireDiscount?: boolean;
  /** Footnote under the net amount. */
  note?: string;
  saveLabel?: string;
  onClose: () => void;
  /** Resolving to false keeps the modal open (the save was refused). */
  onSave: (patch: {
    supervisorDiscountSar: number;
    discountReason: string;
  }) => void | boolean | Promise<void | boolean>;
}) {
  const [amount, setAmount] = useState("0");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const target = row
    ? { label: row.propertyLabel, feeSar: row.agreedFeeSar as number | null }
    : (subject ?? null);

  // Opening on another row seeds that row’s saved discount (or the given seed).
  const openedTarget = open ? (row ?? subject ?? null) : null;
  const [seededTarget, setSeededTarget] = useState(openedTarget);
  if (seededTarget !== openedTarget) {
    setSeededTarget(openedTarget);
    if (openedTarget) {
      setAmount(String(initialDiscountSar ?? row?.supervisorDiscountSar ?? 0));
      setReason(initialReason ?? row?.discountReason ?? "");
      setError(null);
      setBusy(false);
    }
  }

  const clampDiscount = (raw: string): number => {
    const value = Math.max(Number(raw) || 0, 0);
    return target?.feeSar != null ? Math.min(value, target.feeSar) : value;
  };

  const net = target?.feeSar == null ? null : target.feeSar - clampDiscount(amount);

  if (!open || !target) return null;

  const submit = async () => {
    const discount = clampDiscount(amount);
    if (requireDiscount && discount <= 0) {
      setError("أدخل مبلغ الحسم.");
      return;
    }
    if (discount > 0 && !reason.trim()) {
      setError("السبب إلزامي عند وجود حسم.");
      return;
    }
    setBusy(true);
    try {
      const saved = await onSave({
        supervisorDiscountSar: discount,
        discountReason: reason.trim(),
      });
      if (saved !== false) onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalOverlay onClick={onClose}>
      <ModalCard wide onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalTitle>{title}</ModalTitle>
          <ModalClose onClick={onClose} aria-label="إغلاق">
            ×
          </ModalClose>
        </ModalHeader>
        <ModalBody>
          <p className="mb-3 text-xs text-text-2">
            {target.label}
            {target.feeSar != null
              ? ` · الأتعاب ${fmtSar(target.feeSar, { digits: 3, trim: true })}`
              : ""}
          </p>
          <label className="mb-1 block text-xs text-text-2">
            قيمة الحسم (ر.س)
          </label>
          <Input
            type="number"
            min={0}
            max={target.feeSar ?? undefined}
            className="mb-3 text-sm"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              if (error) setError(null);
            }}
          />
          <label className="mb-1 block text-xs text-text-2">
            سبب الحسم <span className="text-danger">*</span>
          </label>
          <select
            className="mb-3 w-full rounded-md border border-border bg-surface px-2 py-2 text-sm disabled:opacity-70"
            value={reason}
            disabled={reasonLocked}
            onChange={(e) => {
              setReason(e.target.value);
              if (error) setError(null);
            }}
          >
            <option value="">— اختر سبباً —</option>
            {reason && !reasons.includes(reason) ? (
              <option value={reason}>{reason}</option>
            ) : null}
            {reasons.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          {error ? <p className="mb-2 text-xs text-danger">{error}</p> : null}
          {net != null ? (
            <div className="flex items-center justify-between rounded-md bg-[color-mix(in_srgb,var(--warning-bg)_55%,var(--surface))] px-3 py-2 text-sm">
              <span className="text-text-2">الصافي بعد الحسم</span>
              <strong>{fmtSar(net, { digits: 3, trim: true })}</strong>
            </div>
          ) : null}
          <p className="mt-3 text-[11px] text-text-3">{note}</p>
        </ModalBody>
        <ModalFooter>
          <Button type="button" size="sm" variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
          <Button
            type="button"
            size="sm"
            variant="primary"
            loading={busy}
            showActionToast={false}
            onClick={() => void submit()}
          >
            {saveLabel}
          </Button>
        </ModalFooter>
      </ModalCard>
    </ModalOverlay>
  );
}
