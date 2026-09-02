"use client";

import {
  EmptyState,
  OperationalPanel,
  QueueTableHint,
  SkeletonTableRows,
  StatusPill,
  TBody,
  THead,
  Table,
  Td,
  Th,
  Tr,
  cn,
  opsPanelCard,
  queueTableRowClassName,
} from "@platform/ui-kit";
import { useCourtVisitFeesQuery } from "../../query/operations-tasks-queries";

export function CourtVisitFeesPanel({
  creditAssigneeId,
}: {
  creditAssigneeId?: string;
}) {
  const feesQuery = useCourtVisitFeesQuery({ creditAssigneeId });
  const rows = feesQuery.data ?? [];
  const ready = !feesQuery.isPending;

  return (
    <div className="space-y-4">
      <OperationalPanel className="shrink-0 overflow-visible">
        <div className="hidden lg:block">
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
                    <EmptyState line="لا بنود أتعاب زيارة بعد. تُستحق عند إنجاز مهمة زيارة محكمة (متعاون) ثم تظهر للمالية في التكاليف للصرف." />
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
                          label={settled ? "مصروف" : "جاهز للصرف"}
                          style={{ base: c, fg: c }}
                        />
                      </Td>
                    </Tr>
                  );
                })
              )}
            </TBody>
          </Table>
        </div>

        <div className="lg:hidden">
          {!ready ? (
            <div className="space-y-2.5 p-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-[88px] animate-pulse rounded-[12px] bg-surface-2"
                />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="px-3 py-10">
              <EmptyState line="لا بنود أتعاب زيارة بعد. تُستحق عند إنجاز مهمة زيارة محكمة (متعاون) ثم تظهر للمالية في التكاليف للصرف." />
            </div>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2.5 p-3">
              {rows.map((row) => {
                const settled = row.status === "settled";
                const c = settled ? "#2f7a4d" : "#d9a441";
                return (
                  <li
                    key={`m-${row.id}`}
                    className={cn(opsPanelCard, "px-3.5 py-3")}
                  >
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <span className="text-[14px] font-bold text-primary">
                        {row.taskDisplayId || "—"}
                      </span>
                      <StatusPill
                        label={settled ? "مصروف" : "جاهز للصرف"}
                        style={{ base: c, fg: c }}
                      />
                    </div>
                    <div className="space-y-1.5 text-[12.5px]">
                      <div className="flex justify-between gap-3">
                        <span className="text-text-3">أمر العمل</span>
                        <span className="font-semibold text-text-2" dir="ltr">
                          {row.poNumber || "—"}
                        </span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-text-3">المستحق له</span>
                        <span className="text-end font-semibold text-heading">
                          {row.creditAssigneeName ||
                            row.creditAssigneeId ||
                            "—"}
                        </span>
                      </div>
                      <div className="flex justify-between gap-3 pt-0.5">
                        <span className="text-text-3">المبلغ</span>
                        <span className="tabular-nums font-extrabold text-heading">
                          {row.amountSar.toLocaleString("ar-SA")} ر.س
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </OperationalPanel>

      <QueueTableHint>
        أتعاب الزيارة تُستحق بإكمال مهمة «زيارة محكمة» للمنفّذ (أو صاحب مسؤولية
        التنفيذ). أتعاب استلام المفاتيح مسار منفصل يُولَّد عند تسجيل الظرف مع
        الصورة.
      </QueueTableHint>
    </div>
  );
}
