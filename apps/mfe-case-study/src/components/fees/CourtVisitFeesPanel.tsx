"use client";

import { useMemo } from "react";
import {
  EmptyState,
  OperationalPanel,
  QueueTableHint,
  SkeletonTableRows,
  StatusPill,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  cn,
  queueTableRowClassName,
} from "@platform/design-system";
import { useCourtVisitFeesQuery } from "../../query/operations-tasks-queries";

export function CourtVisitFeesPanel({
  creditAssigneeId,
}: {
  creditAssigneeId?: string;
}) {
  const feesQuery = useCourtVisitFeesQuery({ creditAssigneeId });
  const rows = feesQuery.data ?? [];
  const ready = !feesQuery.isPending;

  const total = useMemo(
    () => rows.reduce((sum, r) => sum + (r.amountSar || 0), 0),
    [rows],
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface px-[18px] py-4 shadow-card">
          <div className="text-[30px] font-extrabold leading-none text-heading tabular-nums">
            {ready ? rows.length : "—"}
          </div>
          <div className="mt-1.5 text-[12.5px] text-text-2">بنود أتعاب الزيارة</div>
        </div>
        <div className="rounded-xl border border-border bg-surface px-[18px] py-4 shadow-card">
          <div className="text-[30px] font-extrabold leading-none text-[#2f7a4d] tabular-nums">
            {ready ? total.toLocaleString("ar-SA") : "—"}{" "}
            <span className="text-[15px]">ر.س</span>
          </div>
          <div className="mt-1.5 text-[12.5px] text-text-2">إجمالي أتعاب الزيارة</div>
        </div>
      </div>

      <OperationalPanel className="shrink-0 overflow-visible">
        <Table pending={!ready}>
          <THead>
            <Tr hoverable={false}>
              <Th className="text-start">المهمة</Th>
              <Th className="text-start">أمر العمل</Th>
              <Th className="text-start">المستحق له</Th>
              <Th className="text-start">المبلغ</Th>
              <Th className="text-start">الحالة</Th>
            </Tr>
          </THead>
          <TBody>
            {!ready ? (
              <SkeletonTableRows rows={4} cols={5} />
            ) : rows.length === 0 ? (
              <Tr hoverable={false}>
                <Td
                  colSpan={5}
                  className="cursor-default py-10 text-center text-[13px] text-text-3"
                >
                  <EmptyState line="لا بنود أتعاب زيارة بعد. تُستحق عند إنجاز مهمة زيارة محكمة." />
                </Td>
              </Tr>
            ) : (
              rows.map((row) => {
                const settled = row.status === "settled";
                const c = settled ? "#2f7a4d" : "#d9a441";
                return (
                  <Tr
                    key={row.id}
                    hoverable={false}
                    className={cn("group", queueTableRowClassName)}
                  >
                    <Td>
                      <span className="text-[13.5px] font-bold text-primary">
                        {row.taskDisplayId || "—"}
                      </span>
                    </Td>
                    <Td className="text-text-2">{row.poNumber || "—"}</Td>
                    <Td className="text-text-2">
                      {row.creditAssigneeName || row.creditAssigneeId || "—"}
                    </Td>
                    <Td className="tabular-nums font-extrabold text-heading">
                      {row.amountSar.toLocaleString("ar-SA")} ر.س
                    </Td>
                    <Td>
                      <StatusPill
                        label={settled ? "مُسوّاة" : "مفتوحة"}
                        style={{ base: c, fg: c }}
                      />
                    </Td>
                  </Tr>
                );
              })
            )}
          </TBody>
        </Table>
      </OperationalPanel>

      <QueueTableHint>
        أتعاب الزيارة تُستحق بإكمال مهمة «زيارة محكمة» للمنفّذ (أو صاحب مسؤولية
        التنفيذ). أتعاب استلام المفاتيح مسار منفصل يُولَّد عند تسجيل الظرف مع
        الصورة.
      </QueueTableHint>
    </div>
  );
}
