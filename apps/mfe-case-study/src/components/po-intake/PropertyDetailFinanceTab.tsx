"use client";

import { useMemo } from "react";
import {
  Badge,
  InlineLoadingSkeleton,
  StatCard,
  StatGrid,
  StatLabel,
  StatValue,
} from "@platform/design-system";
import {
  inspectorFeeStatusLabel,
  inspectorFeeStatusTone,
} from "@platform/api-client";
import { EmptyState, InfoBox, SectionHeader } from "./PropertyDetailFields";
import { InspectorFeesBillingTable } from "../field-inspection/InspectorFeesBillingTable";
import { useInspectorFeesQuery } from "../../query/inspector-fees-queries";
import type { PoPropertyIntake } from "../../lib/prototype/po-intake-data";
import type { WorkflowTask } from "../../lib/prototype/tasks-storage";

const FEE_KINDS = new Set(["field-inspection", "engineering-survey"]);

function kindLabel(kind: string): string {
  return kind === "engineering-survey" ? "الرفع المساحي" : "المعاينة الميدانية";
}

export function PropertyDetailFinanceTab({
  poNumber,
  property,
  tasks,
}: {
  poNumber: string;
  property: PoPropertyIntake;
  tasks: WorkflowTask[];
}) {
  const feeTasks = useMemo(
    () =>
      tasks.filter(
        (t) =>
          t.poNumber.trim() === poNumber.trim() &&
          t.propertyId === property.id &&
          FEE_KINDS.has(t.kind),
      ),
    [tasks, poNumber, property.id],
  );

  const feeTaskIds = useMemo(
    () => new Set(feeTasks.map((t) => t.id)),
    [feeTasks],
  );

  const { data: summary, isLoading, isFetched } = useInspectorFeesQuery(
    { submittedOnly: false },
    { enabled: feeTaskIds.size > 0 },
  );

  const rows = useMemo(
    () =>
      (summary?.rows ?? []).filter((row) => feeTaskIds.has(row.workflowTaskId)),
    [summary?.rows, feeTaskIds],
  );

  const preBillingCount = rows.filter(
    (r) => r.billingStatus === "pre-billing" || r.billingStatus === "returned",
  ).length;

  if (feeTasks.length === 0) {
    return (
      <>
        <SectionHeader>أتعاب العقار</SectionHeader>
        <EmptyState
          icon="💰"
          title="لا توجد مهام أتعاب"
          sub="تظهر الأتعاب بعد توزيع مهمة المعاينة أو الرفع المساحي على هذا العقار."
        />
      </>
    );
  }

  if (isLoading && !isFetched) {
    return <InlineLoadingSkeleton />;
  }

  if (rows.length === 0) {
    return (
      <>
        <SectionHeader>أتعاب العقار</SectionHeader>
        <InfoBox icon="ℹ">
          جاري تجهيز سجلات الأتعاب — أعد تحميل الصفحة بعد لحظات إن لم تظهر.
        </InfoBox>
      </>
    );
  }

  const netTotal = rows.reduce((sum, row) => sum + row.netFeeSar, 0);

  return (
    <>
      <SectionHeader>ملخص الأتعاب والفوترة</SectionHeader>
      <StatGrid cols={3} flush className="mb-4">
        <StatCard accent="blue" flush>
          <StatLabel>صافي الأتعاب (ر.س)</StatLabel>
          <StatValue value={netTotal} countUp />
        </StatCard>
        <StatCard accent="warn" flush>
          <StatLabel>قبل الفوترة</StatLabel>
          <StatValue value={preBillingCount} countUp />
        </StatCard>
        <StatCard accent="green" flush>
          <StatLabel>جاهزة / مفوترة</StatLabel>
          <StatValue
            value={
              rows.filter(
                (r) =>
                  r.billingStatus === "ready-for-billing" ||
                  r.billingStatus === "invoiced" ||
                  r.billingStatus === "paid",
              ).length
            }
            countUp
          />
        </StatCard>
      </StatGrid>

      {feeTasks.map((task) => {
        const row = rows.find((r) => r.workflowTaskId === task.id);
        const statusLabel = row
          ? row.billingStatusLabel || inspectorFeeStatusLabel(row.billingStatus)
          : null;

        return (
          <section key={task.id} className="mb-5 last:mb-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h3 className="text-[13px] font-semibold text-text">
                {kindLabel(task.kind)}
              </h3>
              {row ? (
                <Badge tone={inspectorFeeStatusTone(row.billingStatus)}>
                  {statusLabel}
                </Badge>
              ) : null}
              {row?.excludedFromBatch ? (
                <Badge tone="danger">مستبعد من الفوترة</Badge>
              ) : null}
            </div>
            {!row ? (
              <InfoBox icon="ℹ">لم يُنشأ سجل الأتعاب بعد.</InfoBox>
            ) : null}
          </section>
        );
      })}

      <SectionHeader>تفاصيل الأتعاب</SectionHeader>
      <InspectorFeesBillingTable rows={rows} mode="readonly" />
      <p className="mt-3 text-[11px] leading-relaxed text-text-3">
        تعديل الأتعاب والإرسال للمالية من شاشة «الاتعاب والفوتره» للمشرف.
      </p>
    </>
  );
}
