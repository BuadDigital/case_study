"use client";

import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import {
  loadInspectorFeesSummary,
  runInspectorFeeTransition,
} from "@platform/app-shared/prototype/inspector-fees-api";
import {
  Badge,
  Button,
  EmptyState,
  SkeletonTableRows,
  SubpageHeader,
  SubpagePanel,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  cn,
  pageToolbarClassName,
  queueTableWrapClassName,
} from "@platform/design-system";
import {
  inspectorFeeStatusLabel,
  inspectorFeeStatusTone,
  type InspectorFeeRowDto,
} from "@platform/api-client";

function Sar({ value }: { value: number }) {
  return (
    <span className="tabular-nums whitespace-nowrap font-medium">
      {value.toLocaleString("ar-SA")}{" "}
      <span className="text-[10px] font-normal text-text-3">ر.س</span>
    </span>
  );
}

function FinanceFeeRow({
  row,
  onDone,
}: {
  row: InspectorFeeRowDto;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);

  const transition = async (
    action: "invoice" | "record-payment" | "return",
    extra?: { reason?: string; invoiceNumber?: string },
  ) => {
    setBusy(true);
    try {
      const result = await runInspectorFeeTransition(row.workflowTaskId, {
        action,
        reason: extra?.reason,
        invoiceNumber: extra?.invoiceNumber,
      });
      if (result) onDone();
    } finally {
      setBusy(false);
    }
  };

  const label =
    row.billingStatusLabel || inspectorFeeStatusLabel(row.billingStatus);

  return (
    <Tr hoverable={false}>
      <Td className="font-semibold text-primary-light">{row.poNumber}</Td>
      <Td>{row.propertyLabel}</Td>
      <Td className="text-end">
        <Sar value={row.netFeeSar} />
      </Td>
      <Td>
        <Badge tone={inspectorFeeStatusTone(row.billingStatus)}>{label}</Badge>
      </Td>
      <Td className="text-text-2">{row.invoiceNumber ?? "—"}</Td>
      <Td>
        <div className="flex flex-wrap gap-1">
          {row.billingStatus === "ready-for-billing" ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="primary"
                disabled={busy}
                onClick={() => {
                  const invoiceNumber = window.prompt("رقم الفاتورة");
                  if (!invoiceNumber?.trim()) return;
                  void transition("invoice", {
                    invoiceNumber: invoiceNumber.trim(),
                  });
                }}
              >
                فوترة
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  const reason = window.prompt("سبب الإرجاع");
                  if (!reason?.trim()) return;
                  void transition("return", { reason: reason.trim() });
                }}
              >
                إرجاع
              </Button>
            </>
          ) : null}
          {row.billingStatus === "invoiced" ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="primary"
                disabled={busy}
                onClick={() => void transition("record-payment")}
              >
                تحصيل
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  const reason = window.prompt("سبب الإرجاع");
                  if (!reason?.trim()) return;
                  void transition("return", { reason: reason.trim() });
                }}
              >
                إرجاع
              </Button>
            </>
          ) : null}
        </div>
      </Td>
    </Tr>
  );
}

export function FinanceBillingQueue() {
  const queryClient = useQueryClient();
  const { data, isPending, isFetched } = useQuery({
    queryKey: prototypeKeys.inspectorFees({
      submittedOnly: false,
      billingStatus: "ready-for-billing",
    }),
    queryFn: () =>
      loadInspectorFeesSummary({
        submittedOnly: false,
        billingStatus: "ready-for-billing",
      }),
    staleTime: 30_000,
  });

  const { data: invoicedData } = useQuery({
    queryKey: prototypeKeys.inspectorFees({
      submittedOnly: false,
      billingStatus: "invoiced",
    }),
    queryFn: () =>
      loadInspectorFeesSummary({
        submittedOnly: false,
        billingStatus: "invoiced",
      }),
    staleTime: 30_000,
  });

  const invalidate = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: [...prototypeKeys.all, "inspector-fees"],
    });
  }, [queryClient]);

  const rows = [...(data?.rows ?? []), ...(invoicedData?.rows ?? [])];

  return (
    <SubpagePanel>
      <SubpageHeader title="طابور الفوترة" />
      <div className={cn(pageToolbarClassName, "border-t-0")}>
        <p className="text-[11px] text-text-3">
          أتعاب جاهزة للفوترة أو بانتظار التحصيل —{" "}
          <span className="font-semibold text-text">
            {rows.length.toLocaleString("ar-SA")}
          </span>{" "}
          سجل
        </p>
      </div>
      {!isFetched && isPending ? (
        <div className="px-4 pb-4">
          <Table pending>
            <THead>
              <Tr hoverable={false}>
                <Th>أمر العمل</Th>
                <Th>العقار</Th>
                <Th className="text-end">الصافي</Th>
                <Th>الحالة</Th>
                <Th>الفاتورة</Th>
                <Th>إجراءات</Th>
              </Tr>
            </THead>
            <TBody>
              <SkeletonTableRows rows={4} cols={6} />
            </TBody>
          </Table>
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          line="لا توجد أتعاب بانتظار الفوترة."
          hint="تظهر هنا بعد إرسال المشرف للأتعاب الجاهزة."
        />
      ) : (
        <div className={cn(queueTableWrapClassName, "px-4 pb-4")}>
          <Table>
            <THead>
              <Tr hoverable={false}>
                <Th>أمر العمل</Th>
                <Th>العقار</Th>
                <Th className="text-end">الصافي</Th>
                <Th>الحالة</Th>
                <Th>الفاتورة</Th>
                <Th>إجراءات</Th>
              </Tr>
            </THead>
            <TBody>
              {rows.map((row) => (
                <FinanceFeeRow
                  key={row.workflowTaskId}
                  row={row}
                  onDone={() => void invalidate()}
                />
              ))}
            </TBody>
          </Table>
        </div>
      )}
    </SubpagePanel>
  );
}
