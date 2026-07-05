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
    action: "return-to-supervisor" | "inquiry-to-office";
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

  return (
    <div className={cn(queueTableWrapClassName, "rounded-[var(--radius-lg)] border border-border bg-surface")}>
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
                    <Sar value={row.netFeeSar} />
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
                      <div className="flex flex-wrap gap-1">
                        {role === "office" && row.canSubmitToSupervisor ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="primary"
                            disabled={busy}
                            onClick={() =>
                              void act(row, "submit-to-supervisor")
                            }
                          >
                            رفع للمشرف
                          </Button>
                        ) : null}
                        {role === "supervisor" && row.canApproveToFinance ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="primary"
                            disabled={busy}
                            onClick={() =>
                              void act(row, "approve-to-finance")
                            }
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
                              disabled={busy}
                              onClick={() =>
                                void act(row, "resend-to-finance")
                              }
                            >
                              إعادة الإرسال
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              onClick={() =>
                                void act(row, "return-to-office")
                              }
                            >
                              إرجاع للمكتب
                            </Button>
                          </>
                        ) : null}
                        {role === "finance" &&
                        row.billingStatus === "disb-req" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="primary"
                            disabled={busy}
                            onClick={() => void act(row, "disburse")}
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
                              onClick={() =>
                                setReasonModal({
                                  row,
                                  action: "return-to-supervisor",
                                })
                              }
                            >
                              إرجاع للمشرف
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={busy}
                              onClick={() =>
                                setReasonModal({
                                  row,
                                  action: "inquiry-to-office",
                                })
                              }
                            >
                              استفسار للمكتب
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </Td>
                  ) : null}
                </Tr>
              );
            })
          )}
        </TBody>
      </Table>
      <FeeActionReasonModal
        open={reasonModal !== null}
        title={
          reasonModal?.action === "inquiry-to-office"
            ? "استفسار للمكتب"
            : "إرجاع للمشرف"
        }
        label={
          reasonModal?.action === "inquiry-to-office"
            ? "نص الاستفسار"
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
