"use client";

import { fmtMax, fmtSar } from "@platform/app-shared/format/number";
import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Badge,
  Button,
  SkeletonTableRows,
  TBody,
  THead,
  Table,
  TableFrame,
  Td,
  Th,
  Tr,
  cn,
  opsMobileCard,
} from "@platform/ui-kit";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import {
  inspectorFeeStatusLabel,
  inspectorFeeStatusTone,
  inspectorFeeWorkStatusTone,
  type DiscountProposalDecision,
  type InspectorFeeAction,
  type InspectorFeeRowDto,
} from "@platform/api-client";
import { useFeeTransition } from "./useFeeLedgerWrites";
import { FeePhoneCards, proposedDiscountText } from "./FeeLedgerParts";
import { FeeActionReasonModal } from "@platform/app-shared/fees/FeeActionReasonModal";
import { FeeDiscountModal } from "@platform/app-shared/fees/FeeDiscountModal";
import { ENG_DISCOUNT_REASONS } from "@platform/app-shared/fees/party-fee-meta";
import { PoNumber } from "../ui/PoNumber";

type PartyFeeWorkflowRole = "office" | "supervisor" | "finance" | "readonly";

/** Actions the backend refuses without a written justification. */
type ReasonAction =
  | "return-to-supervisor"
  | "inquiry-to-office"
  | "suspend";

function Sar({ value }: { value: number }) {
  return (
    <span className="tabular-nums whitespace-nowrap font-medium">
      {fmtMax(value, 3)}{" "}
      <span className="text-[10px] font-normal text-text-3">ر.س</span>
    </span>
  );
}

/**
 * «حسم مقترح − X · سبب — من الأخصائي» under the net, while the supervisor has not decided.
 * Renders nothing once the proposal is decided (the row then shows the applied discount instead).
 */
function ProposedDiscountLine({ row }: { row: InspectorFeeRowDto }) {
  const text = proposedDiscountText(row);
  if (!text) return null;
  return (
    <span className="text-[10px] font-semibold text-[#8a5e14]">
      {text}
      {row.proposedByName ? ` — ${row.proposedByName}` : ""}
    </span>
  );
}

/**
 * Net with the applied discount and any pending proposal under it (table cell and phone card).
 * One component for both layouts — the duplicate detector flagged the two copies once the proposal
 * line was added to each.
 */
function FeeRowAmount({
  row,
  className,
}: {
  row: InspectorFeeRowDto;
  className: string;
}) {
  return (
    <div className={className}>
      <Sar value={row.netFeeSar} />
      {row.supervisorDiscountSar > 0 ? (
        <span className="text-[10px] text-text-3">
          حسم {fmtSar(row.supervisorDiscountSar, { digits: 3, trim: true })}
          {row.discountReason ? ` — ${row.discountReason}` : ""}
        </span>
      ) : null}
      <ProposedDiscountLine row={row} />
    </div>
  );
}

/** Billing status with the voucher and suspension reason under it (table cell and phone card). */
function FeeRowBilling({ row, noteClassName }: { row: InspectorFeeRowDto; noteClassName: string }) {
  return (
    <>
      <Badge tone={inspectorFeeStatusTone(row.billingStatus)}>
        {row.billingStatusLabel || inspectorFeeStatusLabel(row.billingStatus)}
      </Badge>
      {row.disbursementVoucher ? (
        <span className={noteClassName}>{row.disbursementVoucher}</span>
      ) : null}
      {row.suspensionReason ? (
        <span className={noteClassName}>سبب الإيقاف: {row.suspensionReason}</span>
      ) : null}
    </>
  );
}

function FeeRowActions({
  row,
  role,
  busy,
  onAct,
  onReason,
  onDecide,
}: {
  row: InspectorFeeRowDto;
  role: PartyFeeWorkflowRole;
  busy: boolean;
  onAct: (row: InspectorFeeRowDto, action: InspectorFeeAction) => void;
  onReason: (row: InspectorFeeRowDto, action: ReasonAction) => void;
  onDecide: (row: InspectorFeeRowDto, decision: DiscountProposalDecision) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 max-lg:[&>button]:min-h-11">
      {role === "office" && row.canSubmitToSupervisor ? (
        <Button
          type="button"
          size="sm"
          variant="primary"
          loading={busy}
          showActionToast={false}
          onClick={() => onAct(row, "submit-to-supervisor")}
        >
          رفع للمشرف
        </Button>
      ) : null}
      {role === "supervisor" && row.canResolveDiscountProposal ? (
        <>
          <Button
            type="button"
            size="sm"
            variant="primary"
            loading={busy}
            showActionToast={false}
            onClick={() => onDecide(row, "approve")}
          >
            اعتماد الحسم
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            loading={busy}
            showActionToast={false}
            onClick={() => onDecide(row, "amend")}
          >
            تعديل
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            loading={busy}
            showActionToast={false}
            onClick={() => onDecide(row, "waive")}
          >
            سماح
          </Button>
        </>
      ) : null}
      {role === "supervisor" && row.canApproveToFinance ? (
        <Button
          type="button"
          size="sm"
          variant="primary"
          loading={busy}
          showActionToast={false}
          onClick={() => onAct(row, "approve-to-finance")}
        >
          اعتماد ← المالية
        </Button>
      ) : null}
      {role === "supervisor" &&
      row.billingStatus === "returned" &&
      row.returnTo === "supervisor" ? (
        <>
          <Button
            type="button"
            size="sm"
            variant="primary"
            loading={busy}
            showActionToast={false}
            onClick={() => onAct(row, "resend-to-finance")}
          >
            إعادة الإرسال
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            loading={busy}
            showActionToast={false}
            onClick={() => onAct(row, "return-to-office")}
          >
            إرجاع للمكتب
          </Button>
        </>
      ) : null}
      {role === "supervisor" && row.canSuspend ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          loading={busy}
          showActionToast={false}
          onClick={() => onReason(row, "suspend")}
        >
          إيقاف
        </Button>
      ) : null}
      {role === "supervisor" && row.canLiftSuspension ? (
        <Button
          type="button"
          size="sm"
          variant="primary"
          loading={busy}
          showActionToast={false}
          onClick={() => onAct(row, "lift-suspension")}
        >
          رفع الإيقاف
        </Button>
      ) : null}
      {role === "finance" && row.billingStatus === "disb-req" ? (
        <Button
          type="button"
          size="sm"
          variant="primary"
          loading={busy}
          showActionToast={false}
          onClick={() => onAct(row, "disburse")}
        >
          صرف
        </Button>
      ) : null}
      {role === "finance" &&
      (row.billingStatus === "at-finance" ||
        row.billingStatus === "disb-req") ? (
        <>
          <Button
            type="button"
            size="sm"
            variant="outline"
            loading={busy}
            showActionToast={false}
            onClick={() => onReason(row, "return-to-supervisor")}
          >
            إرجاع للمشرف
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            loading={busy}
            showActionToast={false}
            onClick={() => onReason(row, "inquiry-to-office")}
          >
            استفسار للمكتب
          </Button>
        </>
      ) : null}
    </div>
  );
}

/**
 * Fee lines with the actions of the viewing role. For the supervisor, a line carrying the
 * specialist's proposed discount offers three decisions instead of a plain approval: اعتماد
 * (apply as proposed), تعديل (amend the amount in the discount dialog) and سماح (waive — full fee).
 * The office sees the proposal as «under review»; it has no discount action.
 */
export function PartyFeeWorkflowTable({
  rows,
  role,
  pending = false,
  onChanged,
}: {
  rows: InspectorFeeRowDto[];
  role: PartyFeeWorkflowRole;
  pending?: boolean;
  onChanged?: () => void;
}) {
  const queryClient = useQueryClient();
  const { busyId, runFeeTransition, runDiscountDecision } = useFeeTransition();
  const [reasonModal, setReasonModal] = useState<{
    row: InspectorFeeRowDto;
    action: ReasonAction;
  } | null>(null);
  const [amendRow, setAmendRow] = useState<InspectorFeeRowDto | null>(null);

  const invalidate = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: [...appDataKeys.all, "inspector-fees"],
    });
    onChanged?.();
  }, [onChanged, queryClient]);

  const act = (
    row: InspectorFeeRowDto,
    action: InspectorFeeAction,
    extra?: { reason?: string },
  ) => runFeeTransition(row, action, extra, invalidate);

  const showActions = role !== "readonly";
  const onReason = (row: InspectorFeeRowDto, action: ReasonAction) =>
    setReasonModal({ row, action });
  // approve / waive are sent straight away; amend first opens the discount dialog for the agreed
  // amount and is sent from its save.
  const onDecide = (row: InspectorFeeRowDto, decision: DiscountProposalDecision) => {
    if (decision === "amend") {
      setAmendRow(row);
      return;
    }
    void runDiscountDecision(row, decision, undefined, invalidate);
  };
  // The action cell of a row (nothing for read-only viewers), shared by the table and the cards.
  const rowActions = (row: InspectorFeeRowDto) =>
    showActions ? (
      <FeeRowActions
        row={row}
        role={role}
        busy={busyId === row.workflowTaskId}
        onAct={(r, a) => void act(r, a)}
        onReason={onReason}
        onDecide={onDecide}
      />
    ) : null;

  return (
    <>
      <TableFrame>
        <div className="hidden lg:block">
          <Table className="min-w-[920px] w-full" pending={pending}>
          <THead>
            <Tr hoverable={false}>
              <Th>المعاملة</Th>
              <Th>أمر العمل</Th>
              <Th className="text-end">الصافي</Th>
              <Th>حالة العمل</Th>
              <Th>حالة الدفع</Th>
              {showActions ? <Th>إجراء</Th> : null}
            </Tr>
          </THead>
          <TBody>
            {pending && rows.length === 0 ? (
              <SkeletonTableRows rows={4} cols={showActions ? 6 : 5} />
            ) : (
              rows.map((row) => (
                  <Tr key={row.workflowTaskId} hoverable={false}>
                    <Td className="font-medium text-text">{row.propertyLabel}</Td>
                    <Td>
                      <PoNumber value={row.poNumber} link />
                    </Td>
                    <Td className="text-end">
                      <FeeRowAmount
                        row={row}
                        className="flex flex-col items-end gap-0.5"
                      />
                    </Td>
                    <Td>
                      <Badge tone={inspectorFeeWorkStatusTone(row.workStatus)}>
                        {row.workStatusLabel}
                      </Badge>
                    </Td>
                    <Td>
                      <div className="flex flex-col items-start gap-1">
                        <FeeRowBilling row={row} noteClassName="text-[10px] text-text-3" />
                      </div>
                    </Td>
                    {showActions ? <Td>{rowActions(row)}</Td> : null}
                  </Tr>
              ))
            )}
          </TBody>
        </Table>
        </div>

        <div className="lg:hidden">
        <FeePhoneCards
          pending={pending}
          isEmpty={rows.length === 0}
          placeholderHeight="h-[110px]"
        >
          {rows.map((row) => (
              <li
                key={`m-${row.workflowTaskId}`}
                className={cn(opsMobileCard, "border-s-[3px] border-s-gold")}
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[14px] font-bold text-heading">
                      {row.propertyLabel}
                    </div>
                    <div className="mt-1">
                      <PoNumber value={row.poNumber} link />
                    </div>
                  </div>
                  <FeeRowAmount
                    row={row}
                    className="flex shrink-0 flex-col items-end gap-0.5 text-end"
                  />
                </div>
                <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
                  <Badge tone={inspectorFeeWorkStatusTone(row.workStatus)}>
                    {row.workStatusLabel}
                  </Badge>
                  <FeeRowBilling
                    row={row}
                    noteClassName="basis-full text-[11px] text-text-3"
                  />
                </div>
                {rowActions(row)}
              </li>
          ))}
        </FeePhoneCards>
        </div>
      </TableFrame>

      <FeeActionReasonModal
        open={reasonModal !== null}
        title={
          reasonModal?.action === "inquiry-to-office"
            ? "استفسار للمكتب"
            : reasonModal?.action === "suspend"
              ? "إيقاف البند"
              : "إرجاع للمشرف"
        }
        label={
          reasonModal?.action === "inquiry-to-office"
            ? "نص الاستفسار"
            : reasonModal?.action === "suspend"
              ? "سبب الإيقاف"
              : "سبب الإرجاع"
        }
        confirmLabel="تأكيد"
        onClose={() => setReasonModal(null)}
        onConfirm={async (reason) => {
          if (!reasonModal) return;
          await act(reasonModal.row, reasonModal.action, { reason });
        }}
      />
      {/* Amending a proposal: seeded from it, the specialist's reason stays, the amount is the one
          agreed with the office; to drop the discount entirely the supervisor uses «سماح». */}
      <FeeDiscountModal
        open={amendRow !== null}
        row={amendRow}
        title="تعديل الحسم المقترح"
        reasons={ENG_DISCOUNT_REASONS}
        initialDiscountSar={amendRow?.proposedDiscountSar ?? undefined}
        initialReason={amendRow?.proposedDiscountReason}
        reasonLocked
        requireDiscount
        note="المبلغ الذي اتفقت عليه مع المكتب. للتنازل عن الحسم كاملاً اختر «سماح»."
        saveLabel="اعتماد المبلغ المعدّل"
        onClose={() => setAmendRow(null)}
        onSave={(patch) =>
          amendRow
            ? runDiscountDecision(amendRow, "amend", patch.supervisorDiscountSar, invalidate)
            : false
        }
      />
    </>
  );
}
