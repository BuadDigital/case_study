"use client";

/**
 * Enfaz work-order billing — the action strip: save + issue before an invoice
 * exists; the collect amount, collect and PDF buttons afterwards.
 */

import { Input, cn, opsBtnGhost, opsBtnPrimary, opsInsetPanel } from "@platform/ui-kit";
import {
  billingActionHint,
  collectAmountDiffers,
} from "../lib/finance-enfaz-po-billing-state";

export function FinanceEnfazBillingActions({
  issued,
  fullyCollected,
  canIssue,
  total,
  commandBusy,
  collectAmount,
  remaining,
  onCollectAmountChange,
  onSave,
  onIssue,
  onCollect,
  onDownloadPdf,
}: {
  issued: boolean;
  fullyCollected: boolean;
  /** `poReadyForBilling` — every line saved and complete. */
  canIssue: boolean;
  total: number;
  commandBusy: boolean;
  collectAmount: string;
  remaining: number;
  onCollectAmountChange: (value: string) => void;
  onSave: () => void;
  onIssue: () => void;
  onCollect: () => void;
  onDownloadPdf: () => void;
}) {
  const amount = Number(collectAmount) || 0;
  const mismatch = amount > 0 && collectAmountDiffers(amount, remaining);
  return (
    <div className={cn(opsInsetPanel, "flex flex-wrap items-center justify-between gap-2 px-3.5 py-3")}>
      <span className="text-xs text-text-2">
        {billingActionHint({ fullyCollected, issued, total })}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        {!issued ? (
          <>
            <button
              type="button"
              className={opsBtnGhost}
              disabled={commandBusy}
              onClick={onSave}
            >
              حفظ المطابقة
            </button>
            <button
              type="button"
              className={opsBtnPrimary}
              disabled={commandBusy || !canIssue || total <= 0}
              onClick={onIssue}
            >
              تسجيل الفاتورة
            </button>
          </>
        ) : (
          <>
            {!fullyCollected ? (
              <>
                <Input
                  type="number"
                  min={0}
                  className="h-8 w-28 text-xs"
                  value={collectAmount}
                  onChange={(e) => onCollectAmountChange(e.target.value)}
                  aria-label="مبلغ التحصيل"
                />
                {mismatch ? (
                  <span className="text-[11px] text-[#a5432e]">
                    تنبيه: يختلف عن المتبقي
                  </span>
                ) : null}
                <button
                  type="button"
                  className={opsBtnPrimary}
                  disabled={commandBusy}
                  onClick={onCollect}
                >
                  تسجيل تحصيل
                </button>
              </>
            ) : null}
            <button
              type="button"
              className={opsBtnGhost}
              disabled={commandBusy}
              onClick={onDownloadPdf}
            >
              تحميل PDF
            </button>
          </>
        )}
      </div>
    </div>
  );
}
