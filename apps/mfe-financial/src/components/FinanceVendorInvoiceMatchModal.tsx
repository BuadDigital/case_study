"use client";

/**
 * HTML-aligned modal: مطابقة فاتورة المورّد (مهامي → فتح الإجراء).
 * Stays on مهامي; match + return-for-correction only.
 */

import { useEffect, useState } from "react";
import type { PartyBillingStatementDto } from "@platform/api-client";
import {
  openPartyBillingAttachment,
  runMatchVendorInvoice,
  runRejectVendorInvoice,
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
} from "@platform/design-system";
import { statementDisplayTotal } from "../lib/finance-cost-parties";
import { finGhost, finNote, finPrimary } from "../lib/finance-tw";

function formatInvoiceDate(raw: string | null | undefined): string {
  if (!raw?.trim()) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw.trim();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatSar(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function attachmentLabel(s: PartyBillingStatementDto): string {
  const no = (s.vendorInvoiceNumber || "").trim();
  if (no) return `فاتورة_${no}.pdf`;
  return "فاتورة_المورّد.pdf";
}

export function FinanceVendorInvoiceMatchModal({
  statement,
  open,
  onClose,
  onDone,
  onMatched,
}: {
  statement: PartyBillingStatementDto | null;
  open: boolean;
  onClose: () => void;
  onDone: () => void | Promise<void>;
  /** After successful match — e.g. leave مهامي to التكاليف */
  onMatched?: (statement: PartyBillingStatementDto) => void;
}) {
  const { showToast } = useToast();
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setReason("");
    setErr("");
    setBusy(false);
  }, [open, statement?.id]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!open || !statement) return null;

  const lockedTotal = statementDisplayTotal(statement);
  const hasAttachment = Boolean(statement.vendorInvoiceAttachmentId?.trim());

  async function handleMatch() {
    if (!statement) return;
    setBusy(true);
    setErr("");
    try {
      const result = await runMatchVendorInvoice(statement.id);
      if (!result.ok) {
        setErr(result.error);
        showToast(result.error, "error");
        return;
      }
      showToast(
        `طُوبقت فاتورة ${result.statement.vendorInvoiceNumber ?? "—"} وصدر أمر الصرف`,
        "success",
      );
      onClose();
      // بعد المطابقة: الخروج من مهامي إلى التكاليف (المستند يخرج من قائمة مهامي).
      onMatched?.(result.statement);
      void onDone();
    } finally {
      setBusy(false);
    }
  }

  async function handleReturn() {
    if (!statement) return;
    const trimmed = reason.trim();
    if (trimmed.length < 3) {
      setErr("سبب الإعادة للتصحيح إلزامي");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const result = await runRejectVendorInvoice(statement.id, {
        reason: trimmed,
      });
      if (!result.ok) {
        setErr(result.error);
        showToast(result.error, "error");
        return;
      }
      showToast("أُعيدت الفاتورة للتصحيح وأُرشفت", "success");
      await onDone();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function openAttachment() {
    if (!statement?.vendorInvoiceAttachmentId) return;
    const r = await openPartyBillingAttachment(
      statement.vendorInvoiceAttachmentId,
    );
    if (!r.ok) {
      showToast(r.error, "error");
    }
  }

  return (
    <ModalOverlay
      role="presentation"
      className="items-start bg-[rgba(16,43,78,0.42)] pt-[6vh] backdrop-blur-[2px] !z-[200]"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <ModalCard
        wide
        role="dialog"
        aria-modal="true"
        aria-labelledby="vendor-inv-match-title"
        className="max-w-[640px] rounded-2xl border border-border shadow-[0_24px_60px_-18px_rgba(16,43,78,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        <ModalHeader className="justify-between gap-3 px-[22px] py-4">
          <div className="min-w-0 text-start">
            <ModalTitle
              id="vendor-inv-match-title"
              className="text-start text-base font-extrabold text-[#102B4E]"
            >
              مطابقة فاتورة المورّد – {statement.referenceNumber}
            </ModalTitle>
          </div>
          <ModalClose
            type="button"
            disabled={busy}
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
            الفاتورة للقراءة فقط وقيمتها مقفلة على المسير. الإعادة للتصحيح
            تؤرشف الفاتورة ويظهر سببها للمكتب.
          </p>

          <div className="overflow-hidden rounded-[10px] border border-border bg-surface">
            <div className="grid grid-cols-1 gap-0 sm:grid-cols-4">
              {(
                [
                  [
                    "رقم الفاتورة",
                    statement.vendorInvoiceNumber?.trim() || "—",
                    true,
                  ],
                  [
                    "تاريخها",
                    formatInvoiceDate(statement.vendorInvoiceDate),
                    true,
                  ],
                  [
                    "قيمتها (مقفلة على المسير)",
                    formatSar(lockedTotal),
                    true,
                  ],
                ] as const
              ).map(([label, value]) => (
                <div
                  key={label}
                  className="border-b border-border px-3.5 py-3 sm:border-e sm:last:border-e-0"
                >
                  <div className="mb-1 text-[11px] text-text-3">{label}</div>
                  <div
                    className="text-[13px] font-bold text-heading"
                    dir="ltr"
                  >
                    {value}
                  </div>
                </div>
              ))}
              <div className="border-b border-border px-3.5 py-3 sm:border-b-0">
                <div className="mb-1 text-[11px] text-text-3">المرفق</div>
                {hasAttachment ? (
                  <button
                    type="button"
                    className="max-w-full cursor-pointer truncate border-none bg-transparent p-0 text-start text-[12.5px] font-semibold text-[#8c7857] underline underline-offset-2 hover:text-[#102B4E]"
                    dir="ltr"
                    disabled={busy}
                    onClick={() => void openAttachment()}
                  >
                    {attachmentLabel(statement)}
                  </button>
                ) : (
                  <span className="text-[13px] text-text-3">—</span>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4">
            <label
              htmlFor="vendor-inv-return-reason"
              className="mb-1.5 block text-xs font-semibold text-text-2"
            >
              سبب الإعادة للتصحيح{" "}
              <span className="font-medium text-text-3">
                (إلزامي عند الإعادة)
              </span>
            </label>
            <textarea
              id="vendor-inv-return-reason"
              rows={3}
              disabled={busy}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setErr("");
              }}
              placeholder="خلل في المستند أو بياناته"
              className="w-full resize-y rounded-[9px] border border-[#ddd8cc] bg-surface-2 px-3 py-2.5 text-[13px] leading-[1.55] text-text outline-none transition-[border-color,box-shadow] placeholder:text-text-3 focus:border-gold focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--gold)_22%,transparent)] disabled:opacity-60"
            />
          </div>
        </ModalBody>

        <ModalFooter className="flex-wrap justify-end gap-2.5 border-t border-border bg-surface-2 px-[22px] py-3.5">
          <button
            type="button"
            className={finGhost}
            disabled={busy}
            onClick={onClose}
          >
            إلغاء
          </button>
          <button
            type="button"
            className={cn(
              finGhost,
              "border-[#c0553d] text-[#a5432e] enabled:hover:border-[#a5432e] enabled:hover:bg-[color-mix(in_srgb,#c0553d_6%,transparent)] enabled:hover:text-[#a5432e]",
            )}
            disabled={busy}
            onClick={() => void handleReturn()}
          >
            إعادة للتصحيح
          </button>
          <button
            type="button"
            className={cn(finPrimary, busy && "opacity-75")}
            disabled={busy}
            onClick={() => void handleMatch()}
          >
            {busy ? "جارٍ…" : "إقرار المطابقة وإصدار أمر الصرف"}
          </button>
        </ModalFooter>
      </ModalCard>
    </ModalOverlay>
  );
}
