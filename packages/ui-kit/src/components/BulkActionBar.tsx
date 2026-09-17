"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { cn } from "../lib/cn";
import { AppModal } from "./AppModal";
import { Button } from "./Button";

export type BulkAction = {
  id: string;
  label: string;
  onClick: () => void;
  icon?: ReactNode;
  disabled?: boolean;
};

export type BulkActionBarProps = {
  /** Number of selected rows. Render this component only once it's > 0. */
  count: number;
  /** 2–4 secondary actions, rendered as transparent white/30-border buttons. */
  actions?: BulkAction[];
  /** Delete action — always rendered last, and always confirmed in an `AppModal` before it fires. */
  onDelete?: () => void;
  deleteLabel?: string;
  /** Confirmation dialog body. @default "سيتم حذف N عنصر. لا يمكن التراجع عن هذا الإجراء." */
  deleteConfirmMessage?: ReactNode;
  /** Clears the selection — wired to both the × button and Escape. */
  onClear: () => void;
  className?: string;
};

/**
 * Replaces the toolbar once ≥1 row is selected (mark selected rows with
 * `Tr`'s `data-selected`) — navy fill, count first, then 2–4 transparent
 * actions, delete last and confirmed. × or Escape clears the selection. A
 * "select all" checkbox in the table header should only select the
 * currently *visible* page of rows, never the whole dataset.
 */
export function BulkActionBar({
  count,
  actions,
  onDelete,
  deleteLabel = "حذف",
  deleteConfirmMessage,
  onClear,
  className,
}: BulkActionBarProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClear();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClear]);

  return (
    <>
      <div
        className={cn(
          "flex flex-wrap items-center gap-2 rounded-[9px] bg-ink px-4 py-2.5 text-on-ink",
          className,
        )}
      >
        <span className="text-[13px] font-medium tabular-nums">
          {count.toLocaleString("en-US")} محدد
        </span>
        <div className="flex flex-1 flex-wrap items-center justify-end gap-1.5">
          {actions?.map((action) => (
            <button
              key={action.id}
              type="button"
              disabled={action.disabled}
              onClick={action.onClick}
              className="inline-flex h-8 items-center gap-1.5 rounded-[9px] border border-white/30 bg-transparent px-3 text-[12.5px] font-medium text-on-ink whitespace-nowrap outline-none transition-colors hover:enabled:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50 [&>svg]:h-3.5 [&>svg]:w-3.5"
            >
              {action.icon}
              {action.label}
            </button>
          ))}
          {onDelete ? (
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              className="inline-flex h-8 items-center rounded-[9px] border border-white/30 bg-transparent px-3 text-[12.5px] font-medium text-on-ink whitespace-nowrap outline-none transition-colors hover:bg-white/10"
            >
              {deleteLabel}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClear}
            aria-label="إلغاء التحديد"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] text-on-ink/80 outline-none transition-colors hover:bg-white/10 hover:text-on-ink"
          >
            ×
          </button>
        </div>
      </div>
      {onDelete ? (
        <AppModal
          open={confirmOpen}
          title="تأكيد الحذف"
          onClose={() => setConfirmOpen(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
                إلغاء
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  setConfirmOpen(false);
                  onDelete();
                }}
              >
                {deleteLabel}
              </Button>
            </>
          }
        >
          {deleteConfirmMessage ??
            `سيتم حذف ${count.toLocaleString("en-US")} عنصر. لا يمكن التراجع عن هذا الإجراء.`}
        </AppModal>
      ) : null}
    </>
  );
}
