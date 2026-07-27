"use client";

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Badge,
  Button,
  SkeletonTableRows,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  cn,
  queueTableWrapClassName,
  useToast,
} from "@platform/design-system";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import {
  inspectorFeeStatusLabel,
  inspectorFeeStatusTone,
  inspectorFeeWorkStatusTone,
  type InspectorFeeAction,
  type InspectorFeeRowDto,
} from "@platform/api-client";
import { runInspectorFeeTransition } from "@platform/app-shared/prototype/inspector-fees-api";
import { FeeActionReasonModal } from "@platform/app-shared/fees/FeeActionReasonModal";
import { PoNumber } from "../ui/PoNumber";

export type PartyFeeWorkflowRole = "office" | "supervisor" | "finance" | "readonly";

function Sar({ value }: { value: number }) {
  return (
    <span className="tabular-nums whitespace-nowrap font-medium">
      {value.toLocaleString("ar-SA")}{" "}
      <span className="text-[10px] font-normal text-text-3">ر.س</span>
    </span>
  );
}

function FeeRowActions({
  row,
  role,
  busy,
  onAct,
  onReason,
}: {
  row: InspectorFeeRowDto;
  role: PartyFeeWorkflowRole;
  busy: boolean;
  onAct: (row: InspectorFeeRowDto, action: InspectorFeeAction) => void;
  onReason: (
    row: InspectorFeeRowDto,
    action: "return-to-supervisor" | "inquiry-to-office" | "office-dispute",
  ) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 max-lg:[&>button]:min-h-11">
      {role === "office" && row.canSubmitToSupervisor ? (
        <Button
          type="button"
          size="sm"
          variant="primary"
          disabled={busy}
          onClick={() => onAct(row, "submit-to-supervisor")}
        >
          رفع للمشرف
        </Button>
      ) : null}
      {role === "office" && row.canOfficeApproveDiscount ? (
        <Button
          type="button"
          size="sm"
          variant="primary"
          disabled={busy}
          onClick={() => onAct(row, "office-approve-discount")}
        >
          موافقة على الحسم
        </Button>
      ) : null}
      {role === "office" && row.canOfficeDispute ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => onReason(row, "office-dispute")}
        >
          اعتراض
        </Button>
      ) : null}
      {role === "supervisor" && row.canApproveToFinance ? (
        <Button
          type="button"
          size="sm"
          variant="primary"
          disabled={busy}
          onClick={() => onAct(row, "approve-to-finance")}
        >
          اعتماد ← المالية
        </Button>
      ) : null}
      {role === "supervisor" && row.canResolveDispute ? (
        <Button
          type="button"
          size="sm"
          variant="primary"
          disabled={busy}
          onClick={() => onAct(row, "resolve-dispute")}
        >
          حسم الخلاف ← جاهز
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
            disabled={busy}
            onClick={() => onAct(row, "resend-to-finance")}
          >
            إعادة الإرسال
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => onAct(row, "return-to-office")}
          >
            إرجاع للمكتب
          </Button>
        </>
      ) : null}
      {role === "finance" && row.billingStatus === "disb-req" ? (
        <Button
          type="button"
          size="sm"
          variant="primary"
          disabled={busy}
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
            disabled={busy}
            onClick={() => onReason(row, "return-to-supervisor")}
          >
            إرجاع للمشرف
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => onReason(row, "inquiry-to-office")}
          >
            استفسار للمكتب
          </Button>
        </>
      ) : null}
    </div>
  );
}

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
  const { showToast } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reasonModal, setReasonModal] = useState<{
    row: InspectorFeeRowDto;
    action:
      | "return-to-supervisor"
      | "inquiry-to-office"
      | "office-dispute";
  } | null>(null);

  const invalidate = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: [...prototypeKeys.all, "inspector-fees"],
    });
    onChanged?.();
  }, [onChanged, queryClient]);

  const act = async (
    row: InspectorFeeRowDto,
    action: InspectorFeeAction,
    extra?: { reason?: string },
  ) => {
    setBusyId(row.workflowTaskId);
    try {
      const result = await runInspectorFeeTransition(row.workflowTaskId, {
        action,
        reason: extra?.reason,
      });
      if (result) {
        await invalidate();
        return;
      }
      showToast("تعذّر تنفيذ الإجراء — حاول مرة أخرى", "error");
    } finally {
      setBusyId(null);
    }
  };

  const showActions = role !== "readonly";
  const onReason = (
    row: InspectorFeeRowDto,
    action: "return-to-supervisor" | "inquiry-to-office" | "office-dispute",
  ) => setReasonModal({ row, action });

  return (
    <div
      className={cn(
        queueTableWrapClassName,
        "rounded-[var(--radius-lg)] border border-border bg-surface",
      )}
    >
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
              rows.map((row) => {
                const busy = busyId === row.workflowTaskId;
                return (
                  <Tr key={row.workflowTaskId} hoverable={false}>
                    <Td className="font-medium text-text">{row.propertyLabel}</Td>
                    <Td>
                      <PoNumber value={row.poNumber} link />
                    </Td>
                    <Td className="text-end">
                      <div className="flex flex-col items-end gap-0.5">
                        <Sar value={row.netFeeSar} />
                        {row.supervisorDiscountSar > 0 ? (
                          <span className="text-[10px] text-text-3">
                            حسم {row.supervisorDiscountSar.toLocaleString("ar-SA")}
                            {row.discountReason
                              ? ` — ${row.discountReason}`
                              : ""}
                          </span>
                        ) : null}
                      </div>
                    </Td>
                    <Td>
                      <Badge tone={inspectorFeeWorkStatusTone(row.workStatus)}>
                        {row.workStatusLabel}
                      </Badge>
                    </Td>
                    <Td>
                      <div className="flex flex-col items-start gap-1">
                        <Badge tone={inspectorFeeStatusTone(row.billingStatus)}>
                          {row.billingStatusLabel ||
                            inspectorFeeStatusLabel(row.billingStatus)}
                        </Badge>
                        {row.disbursementVoucher ? (
                          <span className="text-[10px] text-text-3">
                            {row.disbursementVoucher}
                          </span>
                        ) : null}
                      </div>
                    </Td>
                    {showActions ? (
                      <Td>
                        <FeeRowActions
                          row={row}
                          role={role}
                          busy={busy}
                          onAct={(r, a) => void act(r, a)}
                          onReason={onReason}
                        />
                      </Td>
                    ) : null}
                  </Tr>
                );
              })
            )}
          </TBody>
        </Table>
      </div>

      <div className="lg:hidden">
        {pending && rows.length === 0 ? (
          <div className="space-y-2.5 p-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-[110px] animate-pulse rounded-[12px] bg-surface-2"
              />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="m-0 px-3 py-8 text-center text-[13px] text-text-3">
            لا بنود.
          </p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-3 p-3 max-lg:px-0">
            {rows.map((row) => {
              const busy = busyId === row.workflowTaskId;
              return (
                <li
                  key={`m-${row.workflowTaskId}`}
                  className="rounded-[14px] border border-border border-s-[3px] border-s-gold bg-surface px-3.5 py-3.5 shadow-[0_2px_8px_rgba(15,52,96,0.06)]"
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
                    <div className="shrink-0 text-end">
                      <Sar value={row.netFeeSar} />
                      {row.supervisorDiscountSar > 0 ? (
                        <div className="mt-0.5 text-[10px] text-text-3">
                          حسم {row.supervisorDiscountSar.toLocaleString("ar-SA")}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="mb-2.5 flex flex-wrap gap-1.5">
                    <Badge tone={inspectorFeeWorkStatusTone(row.workStatus)}>
                      {row.workStatusLabel}
                    </Badge>
                    <Badge tone={inspectorFeeStatusTone(row.billingStatus)}>
                      {row.billingStatusLabel ||
                        inspectorFeeStatusLabel(row.billingStatus)}
                    </Badge>
                  </div>
                  {row.disbursementVoucher ? (
                    <p className="mb-2 m-0 text-[11px] text-text-3">
                      {row.disbursementVoucher}
                    </p>
                  ) : null}
                  {showActions ? (
                    <FeeRowActions
                      row={row}
                      role={role}
                      busy={busy}
                      onAct={(r, a) => void act(r, a)}
                      onReason={onReason}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <FeeActionReasonModal
        open={reasonModal !== null}
        title={
          reasonModal?.action === "inquiry-to-office"
            ? "استفسار للمكتب"
            : reasonModal?.action === "office-dispute"
              ? "اعتراض على الحسم"
              : "إرجاع للمشرف"
        }
        label={
          reasonModal?.action === "inquiry-to-office"
            ? "نص الاستفسار"
            : reasonModal?.action === "office-dispute"
              ? "سبب الاعتراض"
              : "سبب الإرجاع"
        }
        confirmLabel="تأكيد"
        onClose={() => setReasonModal(null)}
        onConfirm={async (reason) => {
          if (!reasonModal) return;
          await act(reasonModal.row, reasonModal.action, { reason });
        }}
      />
    </div>
  );
}
