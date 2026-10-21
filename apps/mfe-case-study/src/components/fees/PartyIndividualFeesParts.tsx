"use client";

/**
 * Party fees parts shared by the desktop tables and their phone versions:
 * the fee row's next step, a payment order's lines, and the phone card lists
 * that replace the two tables below `lg`.
 */

import type { ReactNode } from "react";
import { MobileRecordCard, MobileRecordList, StatusPill } from "@platform/ui-kit";
import { fmtSar } from "@platform/app-shared/format/number";
import { ymd as formatYmd } from "@platform/app-shared/format/date";
import { openPartyBillingAttachment } from "@platform/app-shared/app-data/party-billing-statements-api";
import {
  deedParts,
  individualFeeUiStatus,
  statementMeta,
  statusMeta,
} from "./party-individual-fees-state";
import type { usePartyIndividualFeesWorkflow } from "./usePartyIndividualFeesWorkflow";

type Workflow = ReturnType<typeof usePartyIndividualFeesWorkflow>;
type FeeRow = Workflow["filteredFees"][number];
type Statement = Workflow["filteredFns"][number];

/** The fee row's next step — a submit button or a short status note (table cell and phone card). */
export function FeeRowAction({
  row,
  st,
  busy,
  onSubmit,
}: {
  row: { canSubmitToSupervisor: boolean };
  st: ReturnType<typeof individualFeeUiStatus>;
  busy: boolean;
  onSubmit: () => void;
}) {
  return (
    <>
      {st === "needs_submit" ? (
        <button
          type="button"
          disabled={busy || !row.canSubmitToSupervisor}
          // Phones (card only — the table is lg+): full-width 44px button.
          className="cursor-pointer whitespace-nowrap rounded-lg border-none bg-ink px-[11px] py-1 text-[11px] font-bold text-white shadow-[0_6px_16px_-8px_rgba(18,40,76,.6)] disabled:opacity-50 max-lg:min-h-11 max-lg:w-full max-lg:text-[13.5px]"
          onClick={onSubmit}
        >
          رفع للمشرف
        </button>
      ) : st === "sup_review" ? (
        <span className="text-[11px] text-text-3">
          بانتظار الاعتماد
        </span>
      ) : st === "returned_to_party" ||
        st === "inquiry_to_party" ? (
        <span className="text-[11px] text-text-3">
          راجع الملاحظات وأعِد الرفع
        </span>
      ) : st === "draft_work" ? (
        <span className="text-[11px] text-text-3">
          بعد إنجاز العمل يظهر للرفع
        </span>
      ) : st === "at_finance" || st === "listed" ? (
        <span className="text-[11px] text-text-3">
          المالية تتولى أمر الصرف
        </span>
      ) : st === "paid" ? (
        <span className="text-[11px] font-semibold text-heading">
          ✓ مصروف
        </span>
      ) : (
        <span className="text-[11px] text-text-3">—</span>
      )}
    </>
  );
}

/** A payment order's lines + transfer receipt link (expanded table row and phone card). */
export function StatementLinesDetail({
  s,
  onError,
}: {
  s: {
    referenceNumber: string;
    lines: { id: string; propertyLabel: string; netFeeSar: number }[];
    transferReceiptAttachmentId?: string | null;
  };
  onError: (message: string) => void;
}) {
  return (
    <>
      <div className="mb-2 text-[11.5px] font-bold text-text-2">
        بنود {s.referenceNumber}
      </div>
      <div className="grid gap-1.5">
        {s.lines.map((line) => (
          <div
            key={line.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-[12px]"
          >
            <span dir="ltr" className="font-bold text-gold-d">
              {line.propertyLabel}
            </span>
            <span className="font-bold text-heading">
              {fmtSar(line.netFeeSar, { digits: 3, trim: true })}
            </span>
          </div>
        ))}
      </div>
      {s.transferReceiptAttachmentId ? (
        <button
          type="button"
          className="mt-2 cursor-pointer border-none bg-transparent p-0 text-[12px] text-primary underline"
          onClick={(e) => {
            e.stopPropagation();
            void openPartyBillingAttachment(s.transferReceiptAttachmentId!).then(
              (r) => {
                if (!r.ok) onError(r.error);
              },
            );
          }}
        >
          عرض إيصال التحويل
        </button>
      ) : null}
    </>
  );
}

/** Phones: one card per fee — the 7-column table hid most of it off-screen. */
export function PartyFeesPhoneList({
  rows,
  pending,
  copy,
  busyId,
  onSubmit,
}: {
  rows: FeeRow[];
  pending: boolean;
  copy: Workflow["copy"];
  busyId: Workflow["busyId"];
  onSubmit: (row: FeeRow) => void;
}) {
  return (
    <>
      <MobileRecordList
        className="lg:hidden"
        isEmpty={rows.length === 0}
        empty={pending ? "جاري التحميل…" : "لا توجد بنود مطابقة."}
      >
        {rows.map((row) => {
          const st = individualFeeUiStatus(row);
          const meta = statusMeta(st);
          const { deed, region } = deedParts(row);
          const ded = row.supervisorDiscountSar > 0;
          return (
            <MobileRecordCard
              key={
                row.id ||
                `${row.workflowTaskId}-${row.billingStatus}-${row.netFeeSar}`
              }
              tone={st === "needs_submit" ? "gold" : undefined}
              title={<bdi dir="ltr" className="tabular-nums">{deed}</bdi>}
              subtitle={region}
              status={<StatusPill label={meta.label} style={meta.style} />}
              fields={[
                {
                  label: copy.dateCol,
                  ltr: true,
                  value: formatYmd(
                    row.workSubmittedAtUtc ?? row.accruedAtUtc ?? row.updatedAtUtc,
                  ),
                },
                {
                  label: "الصافي",
                  ltr: true,
                  value: fmtSar(row.netFeeSar, { digits: 3, trim: true }),
                },
                {
                  label: "سعر الجدول",
                  ltr: true,
                  value: fmtSar(row.agreedFeeSar, { digits: 3, trim: true }),
                },
                {
                  label: "تعديل / مبرر",
                  value: ded
                    ? `− ${fmtSar(row.supervisorDiscountSar, { digits: 3, trim: true })}${row.discountReason ? ` · ${row.discountReason}` : ""}`
                    : "بسعر الجدول",
                },
              ]}
            >
              <FeeRowAction
                row={row}
                st={st}
                busy={busyId === row.workflowTaskId}
                onSubmit={() => onSubmit(row)}
              />
            </MobileRecordCard>
          );
        })}
      </MobileRecordList>
      <p className="m-0 text-[12px] text-text-3 lg:hidden">
        {copy.roleLabel}: {copy.statementsFooter}
      </p>
    </>
  );
}

/** Phones: one card per payment order; tap to show its lines. */
export function PartyStatementsPhoneList({
  statements,
  openFn,
  setOpenFn,
  footer,
  onError,
}: {
  statements: Statement[];
  openFn: string | null;
  setOpenFn: (ref: string | null) => void;
  footer: ReactNode;
  onError: (message: string) => void;
}) {
  return (
    <>
      <MobileRecordList
        className="lg:hidden"
        isEmpty={statements.length === 0}
        empty="لا توجد مستندات مطابقة."
      >
        {statements.map((s) => {
          const open = openFn === s.referenceNumber;
          const meta = statementMeta(s);
          return (
            <MobileRecordCard
              key={s.id}
              onOpen={() => setOpenFn(open ? null : s.referenceNumber)}
              title={<bdi dir="ltr" className="tabular-nums">{s.referenceNumber}</bdi>}
              status={<StatusPill label={meta.label} style={meta.style} />}
              fields={[
                {
                  label: "تاريخ الإصدار",
                  ltr: true,
                  value: formatYmd(s.issuedAtUtc ?? s.createdAtUtc),
                },
                {
                  label: "الإجمالي",
                  ltr: true,
                  value: fmtSar(s.totalNetSar, { digits: 3, trim: true }),
                },
                { label: "المعاملات", value: `${s.lines.length} معاملات` },
                {
                  label: "الصرف",
                  value:
                    s.status === "closed" && s.paidAtUtc
                      ? `صُرف ${formatYmd(s.paidAtUtc)}`
                      : "بانتظار الصرف",
                },
              ]}
            >
              {open ? (
                <div className="rounded-[10px] bg-surface-2 p-2.5">
                  <StatementLinesDetail
                    s={s}
                    onError={onError}
                  />
                </div>
              ) : (
                <span className="text-[11.5px] text-text-3">اضغط لعرض البنود</span>
              )}
            </MobileRecordCard>
          );
        })}
      </MobileRecordList>
      <p className="m-0 text-[12px] text-text-3 lg:hidden">{footer}</p>
    </>
  );
}
