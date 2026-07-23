"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import {
  loadEngBillingStatements,
  openEngBillingAttachment,
} from "@platform/app-shared/prototype/eng-billing-statements-api";
import {
  Badge,
  Button,
  EmptyState,
  Note,
  QueueTableHint,
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
import {
  engBillingStatementStatusTone,
  inspectorFeeStatusTone,
  type EngBillingStatementDto,
  type InspectorFeeBillingStatus,
} from "@platform/api-client";

function formatSar(n: number) {
  return `${n.toLocaleString("ar-SA", { maximumFractionDigits: 2 })} ر.س`;
}

export function EngOfficeBillingStatementsPanel({
  assigneeId,
  issuedOrLaterOnly = true,
}: {
  assigneeId?: string;
  /** Supervisor may see all issued statements when assigneeId is omitted. */
  issuedOrLaterOnly?: boolean;
}) {
  const { showToast } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: statements = [], isPending, isFetched } = useQuery({
    queryKey: [
      ...prototypeKeys.all,
      "eng-billing",
      "statements",
      assigneeId ?? "all",
      issuedOrLaterOnly ? "issued+" : "all-status",
    ],
    queryFn: () =>
      loadEngBillingStatements({
        assigneeId,
        issuedOrLaterOnly,
      }),
  });

  const selected = useMemo(
    () => statements.find((s) => s.id === selectedId) ?? null,
    [statements, selectedId],
  );

  const viewReceipt = async (attachmentId: string) => {
    const result = await openEngBillingAttachment(
      attachmentId,
      "إيصال-التحويل",
    );
    if (!result.ok) showToast(result.error, "error");
  };

  if (isPending && !isFetched) {
    return <EmptyState line="جاري تحميل كشوف الفوترة…" />;
  }

  if (statements.length === 0) {
    return (
      <>
        <EmptyState
          line="لا كشوف فوترة صادرة بعد."
          hint="تظهر الكشوف هنا بعد أن تنشئها المالية وترسلها للمكتب."
        />
        <QueueTableHint className="mt-3">
          اطلاع فقط — لا مراجعة مطلوبة على كشف الفوترة (كل بنوده سبق حسمها).
        </QueueTableHint>
      </>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div
        className={cn(
          queueTableWrapClassName,
          "rounded-[var(--radius-lg)] border border-border bg-surface",
        )}
      >
        <Table>
          <THead>
            <Tr hoverable={false}>
              <Th>المرجع</Th>
              <Th>الإجمالي</Th>
              <Th>البنود</Th>
              <Th>الحالة</Th>
            </Tr>
          </THead>
          <TBody>
            {statements.map((s: EngBillingStatementDto) => (
              <Tr
                key={s.id}
                className={cn(
                  "cursor-pointer",
                  selectedId === s.id && "bg-primary/5",
                )}
                onClick={() => setSelectedId(s.id)}
              >
                <Td className="font-medium text-primary-light">
                  {s.referenceNumber}
                </Td>
                <Td>{formatSar(s.totalNetSar)}</Td>
                <Td>{s.lines.length}</Td>
                <Td>
                  <Badge tone={engBillingStatementStatusTone(s.status)}>
                    {s.statusLabel}
                  </Badge>
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </div>

      <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-3">
        {!selected ? (
          <EmptyState line="اختر كشفاً لعرض بنوده وحالة الصرف." />
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="text-[14px] font-semibold">
                  {selected.referenceNumber}
                </div>
                <div className="text-[12px] text-text-2">
                  {formatSar(selected.totalNetSar)} — {selected.lines.length}{" "}
                  بند
                  {selected.externalInvoiceNumber
                    ? ` — فاتورة ${selected.externalInvoiceNumber}`
                    : ""}
                </div>
              </div>
              <Badge tone={engBillingStatementStatusTone(selected.status)}>
                {selected.statusLabel}
              </Badge>
            </div>
            <div
              className={cn(
                queueTableWrapClassName,
                "max-h-72 overflow-auto rounded border border-border",
              )}
            >
              <Table>
                <THead>
                  <Tr hoverable={false}>
                    <Th>العقار</Th>
                    <Th>PO</Th>
                    <Th>الصافي</Th>
                    <Th>الحالة</Th>
                  </Tr>
                </THead>
                <TBody>
                  {selected.lines.map((line) => (
                    <Tr key={line.id} hoverable={false}>
                      <Td>{line.propertyLabel}</Td>
                      <Td>{line.poNumber}</Td>
                      <Td>{formatSar(line.netFeeSar)}</Td>
                      <Td>
                        <Badge
                          tone={inspectorFeeStatusTone(
                            line.billingStatus as InspectorFeeBillingStatus,
                          )}
                        >
                          {line.billingStatusLabel}
                        </Badge>
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </div>
            {selected.status === "closed" ? (
              <div className="flex flex-col gap-2">
                <Note tone="success" className="m-0">
                  مصروف
                  {selected.transferReceiptRef
                    ? ` — إيصال ${selected.transferReceiptRef}`
                    : ""}
                  {selected.paidAtUtc
                    ? ` — ${new Date(selected.paidAtUtc).toLocaleDateString("ar-SA")}`
                    : ""}
                </Note>
                {selected.transferReceiptAttachmentId ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      void viewReceipt(selected.transferReceiptAttachmentId!)
                    }
                  >
                    عرض / تنزيل إيصال التحويل
                  </Button>
                ) : null}
              </div>
            ) : selected.status === "issued" ? (
              <Note tone="info" className="m-0">
                صادر — بانتظار توثيق الصرف من المالية.
              </Note>
            ) : null}
          </div>
        )}
      </div>
      <QueueTableHint className="lg:col-span-2">
        اطلاع على كشوف الفوترة الصادرة وحالة الصرف — بلا موافقة إضافية.
      </QueueTableHint>
    </div>
  );
}
