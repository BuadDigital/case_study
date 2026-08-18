"use client";

/**
 * HTML-aligned modal: توثيق الصرف (مهامي → فتح الإجراء).
 * سند صرف + مرجع تحويل + إيصال على نفس الصفحة.
 */

import { useEffect, useState } from "react";
import type { PartyBillingStatementDto } from "@platform/api-client";
import {
  openPartyBillingAttachment,
  runClosePartyBillingStatement,
  uploadPartyBillingTransferReceipt,
} from "@platform/app-shared/prototype/party-billing-statements-api";
import {
  ModalBody,
  ModalCard,
  ModalClose,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalTitle,
  cn,
  useToast,
} from "@platform/ui-kit";
import { statementDisplayTotal } from "../lib/finance-cost-parties";
import { finGhost, finNote, finPrimary } from "../lib/finance-tw";

function formatSar(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export function FinanceDisbursementCloseModal({
  statement,
  open,
  onClose,
  onDone,
}: {
  statement: PartyBillingStatementDto | null;
  open: boolean;
  onClose: () => void;
  onDone: () => void | Promise<void>;
}) {
  const { showToast } = useToast();
  const [voucher, setVoucher] = useState("");
  const [transferRef, setTransferRef] = useState("");
  const [paidAt, setPaidAt] = useState("");
  const [receiptRef, setReceiptRef] = useState("");
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [receiptName, setReceiptName] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setVoucher("");
    setTransferRef("");
    setPaidAt("");
    setReceiptRef("");
    setReceiptId(null);
    setReceiptName("");
    setErr("");
    setBusy(false);
    setUploading(false);
  }, [open, statement?.id]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy && !uploading) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, uploading, onClose]);

  if (!open || !statement) return null;

  const total = statementDisplayTotal(statement);

  async function handleReceiptFile(file: File | undefined) {
    if (!statement || !file) return;
    setUploading(true);
    setErr("");
    try {
      const up = await uploadPartyBillingTransferReceipt(statement.id, file);
      if (!up.ok) {
        setErr(up.error);
        showToast(up.error, "error");
        return;
      }
      setReceiptId(up.id);
      setReceiptName(up.fileName);
    } finally {
      setUploading(false);
    }
  }

  async function handleClosePaid() {
    if (!statement) return;
    const v = voucher.trim();
    const t = transferRef.trim();
    if (!v) {
      setErr("رقم سند الصرف مطلوب");
      return;
    }
    if (!t) {
      setErr("مرجع التحويل مطلوب");
      return;
    }
    if (!receiptId) {
      setErr("إيصال التحويل (مرفق) مطلوب");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const paidAtUtc = paidAt
        ? new Date(`${paidAt}T12:00:00`).toISOString()
        : undefined;
      const result = await runClosePartyBillingStatement(statement.id, {
        disbursementVoucher: v,
        transferReference: t,
        transferReceiptAttachmentId: receiptId,
        transferReceiptRef: receiptRef.trim() || undefined,
        paidAtUtc,
      });
      if (!result.ok) {
        setErr(result.error);
        showToast(result.error, "error");
        return;
      }
      showToast(`أُقفل ${result.statement.referenceNumber} كمدفوع`, "success");
      await onDone();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function viewReceipt() {
    if (!receiptId) return;
    const r = await openPartyBillingAttachment(receiptId, "إيصال-التحويل");
    if (!r.ok) showToast(r.error, "error");
  }

  return (
    <ModalOverlay
      role="presentation"
      className="items-start bg-[rgba(16,43,78,0.42)] pt-[6vh] backdrop-blur-[2px] !z-[200]"
      onClick={() => {
        if (!busy && !uploading) onClose();
      }}
    >
      <ModalCard
        wide
        role="dialog"
        aria-modal="true"
        aria-labelledby="disburse-close-title"
        className="max-w-[640px] rounded-2xl border border-border shadow-[0_24px_60px_-18px_rgba(16,43,78,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        <ModalHeader className="justify-between gap-3 px-[22px] py-4">
          <div className="min-w-0 text-start">
            <ModalTitle
              id="disburse-close-title"
              className="text-start text-base font-extrabold text-[#102B4E]"
            >
              توثيق الصرف — {statement.referenceNumber}
            </ModalTitle>
          </div>
          <ModalClose
            disabled={busy || uploading}
            onClick={onClose}
            aria-label="إغلاق"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] border-none bg-surface-2 text-[15px] text-text-2 hover:bg-[#faf6ee] hover:text-heading"
          >
            ✕
          </ModalClose>
        </ModalHeader>

        <ModalBody className="max-h-[76vh] px-[22px] py-5">
          {err ? (
            <div
              className="mb-4 rounded-[10px] border border-[color-mix(in_srgb,#d9694f_30%,transparent)] bg-[color-mix(in_srgb,#d9694f_12%,transparent)] px-[13px] py-2.5 text-[12.5px] font-semibold leading-[1.7] text-[#a32d2d]"
              role="alert"
            >
              {err}
            </div>
          ) : null}

          <p className={cn(finNote, "mb-4 text-center")}>
            بعد إقرار المطابقة — أوامر الصرف تُقفل من البرنامج المحاسبي: سند +
            مرجع تحويل + إيصال.
          </p>

          <div className="mb-4 overflow-hidden rounded-[10px] border border-border bg-surface">
            <div className="grid grid-cols-1 gap-0 sm:grid-cols-3">
              <div className="border-b border-border px-3.5 py-3 sm:border-e sm:border-b-0">
                <div className="mb-1 text-[11px] text-text-3">المرجع</div>
                <div className="text-[13px] font-bold text-heading" dir="ltr">
                  {statement.referenceNumber}
                </div>
              </div>
              <div className="border-b border-border px-3.5 py-3 sm:border-e sm:border-b-0">
                <div className="mb-1 text-[11px] text-text-3">المستحق</div>
                <div className="text-[13px] font-bold text-heading">
                  {statement.payeeTypeLabel || "مستحق"}
                </div>
              </div>
              <div className="px-3.5 py-3">
                <div className="mb-1 text-[11px] text-text-3">المبلغ ر.س</div>
                <div className="text-[13px] font-bold text-heading" dir="ltr">
                  {formatSar(total)}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="disburse-voucher"
                className="mb-1.5 block text-xs font-semibold text-text-2"
              >
                رقم سند الصرف / الفاتورة{" "}
                <span className="text-[#c0553d]">*</span>
              </label>
              <input
                id="disburse-voucher"
                dir="ltr"
                disabled={busy}
                value={voucher}
                onChange={(e) => {
                  setVoucher(e.target.value);
                  setErr("");
                }}
                placeholder="من البرنامج المحاسبي"
                className="w-full rounded-[9px] border border-[#ddd8cc] bg-surface-2 px-3 py-2.5 text-[13px] text-text outline-none placeholder:text-text-3 focus:border-gold focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--gold)_22%,transparent)] disabled:opacity-60"
              />
            </div>
            <div>
              <label
                htmlFor="disburse-transfer"
                className="mb-1.5 block text-xs font-semibold text-text-2"
              >
                مرجع التحويل <span className="text-[#c0553d]">*</span>
              </label>
              <input
                id="disburse-transfer"
                dir="ltr"
                disabled={busy}
                value={transferRef}
                onChange={(e) => {
                  setTransferRef(e.target.value);
                  setErr("");
                }}
                placeholder="رقم التحويل البنكي"
                className="w-full rounded-[9px] border border-[#ddd8cc] bg-surface-2 px-3 py-2.5 text-[13px] text-text outline-none placeholder:text-text-3 focus:border-gold focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--gold)_22%,transparent)] disabled:opacity-60"
              />
            </div>
          </div>

          <div className="mt-3">
            <label
              htmlFor="disburse-paid-at"
              className="mb-1.5 block text-xs font-semibold text-text-2"
            >
              تاريخ الصرف
            </label>
            <input
              id="disburse-paid-at"
              type="date"
              disabled={busy}
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
              className="w-full max-w-[220px] rounded-[9px] border border-[#ddd8cc] bg-surface-2 px-3 py-2.5 text-[13px] text-text outline-none focus:border-gold disabled:opacity-60"
            />
          </div>

          <div className="mt-3">
            <label
              htmlFor="disburse-receipt"
              className="mb-1.5 block text-xs font-semibold text-text-2"
            >
              إيصال التحويل <span className="text-[#c0553d]">*</span>
            </label>
            <input
              id="disburse-receipt"
              type="file"
              accept="image/*,application/pdf"
              disabled={busy || uploading}
              onChange={(e) => {
                void handleReceiptFile(e.target.files?.[0]);
                e.target.value = "";
              }}
              className="w-full text-[12.5px] text-text-2 file:me-3 file:rounded-md file:border-0 file:bg-[#f1ece2] file:px-3 file:py-1.5 file:text-[12px] file:font-bold file:text-[#102B4E]"
            />
            {uploading ? (
              <p className="mt-1.5 text-[12px] text-text-3">جاري رفع الإيصال…</p>
            ) : receiptId && receiptName ? (
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span className="text-[12px] text-text-3" dir="ltr">
                  مرفق: {receiptName}
                </span>
                <button
                  type="button"
                  className={cn(finGhost, "px-2 py-1 text-[11px]")}
                  onClick={() => void viewReceipt()}
                >
                  معاينة
                </button>
              </div>
            ) : null}
          </div>

          <div className="mt-3">
            <label
              htmlFor="disburse-receipt-note"
              className="mb-1.5 block text-xs font-semibold text-text-2"
            >
              ملاحظة إيصال (اختياري)
            </label>
            <input
              id="disburse-receipt-note"
              disabled={busy}
              value={receiptRef}
              onChange={(e) => setReceiptRef(e.target.value)}
              className="w-full rounded-[9px] border border-[#ddd8cc] bg-surface-2 px-3 py-2.5 text-[13px] text-text outline-none focus:border-gold disabled:opacity-60"
            />
          </div>
        </ModalBody>

        <ModalFooter className="flex-wrap justify-end gap-2.5 border-t border-border bg-surface-2 px-[22px] py-3.5">
          <button
            type="button"
            className={finGhost}
            disabled={busy || uploading}
            onClick={onClose}
          >
            إلغاء
          </button>
          <button
            type="button"
            className={cn(finPrimary, (busy || uploading) && "opacity-75")}
            disabled={busy || uploading}
            onClick={() => void handleClosePaid()}
          >
            {busy ? "جارٍ…" : "إقفال أمر الصرف كمدفوع"}
          </button>
        </ModalFooter>
      </ModalCard>
    </ModalOverlay>
  );
}
