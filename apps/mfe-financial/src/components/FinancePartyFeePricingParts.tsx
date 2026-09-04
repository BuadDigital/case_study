"use client";

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
  cn,
  opsBtnGhost,
  opsBtnPrimary,
  opsFldControl,
} from "@platform/ui-kit";
import type { DistributionAssignee } from "@case-study/mfe/lib/distribution-assignees";

import { num } from "../lib/party-fee-pricing-state";

/**
 * Presentational pieces of the party fee pricing screen — the header icon, the
 * money input and the assignee picker modal.
 */

export function OpsIcon({ path, size = 20 }: { path: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={path} />
    </svg>
  );
}

export function MoneyInput({
  id,
  value,
  locked,
  onChange,
  className,
}: {
  id?: string;
  value: number;
  locked: boolean;
  onChange: (n: number) => void;
  className?: string;
}) {
  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      dir="ltr"
      readOnly={locked}
      disabled={locked}
      className={cn(
        opsFldControl,
        "text-start tabular-nums disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      value={value === 0 ? "" : String(value)}
      placeholder="0"
      onChange={(e) => onChange(num(e.target.value))}
    />
  );
}

/** Assignee picker — ticks the parties this pricing table applies to. */
export function PricingAssignModal({
  tableName,
  categoryLabel,
  categoryParties,
  assignSet,
  busy,
  onToggle,
  onClose,
  onSave,
}: {
  tableName: string;
  categoryLabel: string;
  categoryParties: DistributionAssignee[];
  assignSet: Set<string>;
  busy: boolean;
  onToggle: (id: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <ModalOverlay role="presentation" onClick={onClose}>
      <ModalCard
        role="dialog"
        aria-modal="true"
        aria-labelledby="pricing-assign-title"
        className="max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <ModalHeader>
          <div className="min-w-0 flex-1">
            <ModalTitle id="pricing-assign-title">
              من يخصّه «{tableName}»
            </ModalTitle>
            <p className="m-0 mt-1 text-[12px] text-text-3">
              {categoryLabel}
            </p>
          </div>
          <ModalClose onClick={onClose} />
        </ModalHeader>
        <ModalBody className="max-h-[50vh] space-y-1 overflow-y-auto">
          {categoryParties.length === 0 ? (
            <Note tone="warn">
              لا يوجد مستحقون لهذه الفئة (تحقق من معرّف التوزيع).
            </Note>
          ) : (
            categoryParties.map((party) => {
              const checked = assignSet.has(party.id);
              return (
                <label
                  key={party.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-3 transition-colors",
                    checked
                      ? "border-gold-2 bg-gold-soft"
                      : "border-border hover:bg-surface-2",
                  )}
                >
                  <input
                    type="checkbox"
                    className="size-4 accent-gold-d"
                    checked={checked}
                    onChange={() => onToggle(party.id)}
                  />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold text-text">
                      {party.name}
                    </span>
                    {party.subtitle ? (
                      <span className="mt-0.5 block text-[11px] text-text-3">
                        {party.subtitle}
                      </span>
                    ) : null}
                  </span>
                </label>
              );
            })
          )}
        </ModalBody>
        <ModalFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
          >
            إلغاء
          </Button>
          <Button
            type="button"
            variant="primary"
            loading={busy}
            showActionToast={false}
            onClick={onSave}
          >
            تم
          </Button>
        </ModalFooter>
      </ModalCard>
    </ModalOverlay>
  );
}
