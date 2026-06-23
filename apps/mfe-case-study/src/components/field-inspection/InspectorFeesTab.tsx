"use client";

import {
  Badge,
  EmptyState,
  OperationalPanel,
  StatCard,
  StatGrid,
  StatLabel,
  StatValue,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from "@platform/design-system";
import {
  inspectorFeeStatusLabel,
  type InspectorFeeRowDto,
} from "@platform/api-client";
import { PoNumber } from "../ui/PoNumber";
import { useInspectorFeesQuery } from "../../query/inspector-fees-queries";
import type { WorkflowTask } from "../../lib/prototype/tasks-storage";

function FeeStatusBadge({ row }: { row: InspectorFeeRowDto }) {
  const label = inspectorFeeStatusLabel(row.billingStatus);
  return (
    <Badge tone={row.billingStatus === "invoiced" ? "success" : "warning"}>
      {label}
    </Badge>
  );
}

export function InspectorFeesTab({
  tasks,
}: {
  tasks: WorkflowTask[];
  poByNumber?: Map<string, unknown>;
}) {
  const singleTask = tasks.length === 1 ? tasks[0] : undefined;
  const assigneeId = tasks[0]?.assigneeId?.trim() || undefined;

  const { data: summary, isLoading } = useInspectorFeesQuery({
    workflowTaskId: singleTask?.id,
    assigneeId: singleTask ? undefined : assigneeId,
    submittedOnly: !singleTask,
  });

  const rows = summary?.rows ?? [];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div>
        <h2 className="text-sm font-semibold text-text">أتعاب المعاين</h2>
        <p className="mt-1 text-xs leading-relaxed text-text-3">
          الأتعاب متفق عليها مسبقاً أو تُحدَّد قبل الفوترة — لا تُدخل ضمن
          المعاينة الميدانية. تُراجَع هنا قبل اعتماد الفاتورة.
        </p>
      </div>

      <StatGrid cols={3} flush>
        <StatCard accent="green" flush>
          <StatLabel>صافي قبل الفوترة (ر.س)</StatLabel>
          <StatValue value={summary?.netPreBillingSar ?? 0} countUp />
        </StatCard>
        <StatCard accent="red" flush>
          <StatLabel>إجمالي الحسومات (ر.س)</StatLabel>
          <StatValue value={summary?.totalDiscountsSar ?? 0} countUp />
        </StatCard>
        <StatCard accent="blue" flush>
          <StatLabel>مفوتر (ر.س)</StatLabel>
          <StatValue value={summary?.invoicedSar ?? 0} countUp />
        </StatCard>
      </StatGrid>

      <OperationalPanel className="min-h-0 flex-1">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-[13px] font-semibold text-text">أتعاب العقارات</h3>
          <Badge tone="default">يحددها المشرف</Badge>
        </div>

        {isLoading ? (
          <p className="text-xs text-text-3">جاري تحميل الأتعاب…</p>
        ) : rows.length === 0 ? (
          <EmptyState
            line="لا توجد أتعاب مسجّلة بعد."
            hint="تظهر هنا بعد توزيع مهمة المعاينة وإرسال المعاينة الميدانية."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[880px] w-full">
              <THead>
                <Tr hoverable={false}>
                  <Th className="text-right">العقار</Th>
                  <Th>أمر الشراء</Th>
                  <Th>نوع المعاين</Th>
                  <Th>الأتعاب المتفق عليها</Th>
                  <Th>حسم المشرف</Th>
                  <Th className="text-right">سبب الحسم</Th>
                  <Th>الصافي</Th>
                  <Th>الحالة</Th>
                </Tr>
              </THead>
              <TBody>
                {rows.map((row) => (
                  <Tr key={row.workflowTaskId} hoverable={false}>
                    <Td className="text-text">{row.propertyLabel}</Td>
                    <Td className="text-center text-text-2">
                      <PoNumber value={row.poNumber} link />
                    </Td>
                    <Td className="text-center text-text-2">
                      {row.inspectorType}
                      {row.inspectorType === "موظف" ? (
                        <span className="mr-1 text-[10px] text-text-3">
                          (عمولة)
                        </span>
                      ) : null}
                    </Td>
                    <Td className="text-center text-text-2">
                      {row.agreedFeeSar.toLocaleString("ar-SA")} ر.س
                    </Td>
                    <Td
                      className={
                        row.supervisorDiscountSar > 0
                          ? "text-center font-medium text-danger"
                          : "text-center text-text-2"
                      }
                    >
                      {row.supervisorDiscountSar > 0
                        ? `− ${row.supervisorDiscountSar.toLocaleString("ar-SA")} ر.س`
                        : "0 ر.س"}
                    </Td>
                    <Td className="text-text-2">{row.discountReason ?? "—"}</Td>
                    <Td className="text-center font-semibold text-text">
                      {row.netFeeSar.toLocaleString("ar-SA")} ر.س
                    </Td>
                    <Td className="text-center">
                      <FeeStatusBadge row={row} />
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </div>
        )}

        <p className="mt-3.5 text-[11px] leading-relaxed text-text-3">
          المعاين المتعاون له أتعاب لكل عقار؛ المعاين الموظف له عمولة يمنحها
          المشرف وتكون أقل بكثير. كل حسم يجب أن يكون مصحوباً بسبب موضّح.
        </p>
      </OperationalPanel>
    </div>
  );
}
