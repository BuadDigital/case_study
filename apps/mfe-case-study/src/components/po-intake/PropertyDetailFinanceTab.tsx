"use client";

import { useMemo, useState } from "react";
import {
  Badge,
  InlineLoadingSkeleton,
  Tab,
  TabBar,
  TabPanel,
} from "@platform/design-system";
import {
  inspectorFeeStatusLabel,
  inspectorFeeStatusTone,
  inspectorFeeWorkStatusTone,
} from "@platform/api-client";
import { loadPropertyEnfazRevenue } from "@platform/app-shared/prototype/enfaz-billing-api";
import { useQuery } from "@tanstack/react-query";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import { EmptyState, InfoBox, SectionHeader } from "./PropertyDetailFields";
import { PartyFeeWorkflowTable } from "../fees/PartyFeeWorkflowTable";
import { InspectorFeesBillingTable } from "../field-inspection/InspectorFeesBillingTable";
import { useInspectorFeesQuery } from "../../query/inspector-fees-queries";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import type { PoPropertyIntake } from "../../lib/prototype/po-intake-data";
import type { WorkflowTask } from "../../lib/prototype/tasks-storage";

const FEE_KINDS = new Set([
  "field-inspection",
  "engineering-survey",
  "government-review",
]);

export function PropertyDetailFinanceTab({
  poNumber,
  property,
  tasks,
}: {
  poNumber: string;
  property: PoPropertyIntake;
  tasks: WorkflowTask[];
}) {
  const { hasCapability } = usePrototype();
  const isSupervisor = hasCapability("manage-operations");
  const isFinance = hasCapability("manage-financial");
  const [sub, setSub] = useState<"out" | "in">("out");

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

  const { data: enfazRevenue } = useQuery({
    queryKey: [...prototypeKeys.all, "enfaz-billing", poNumber, property.id],
    queryFn: () => loadPropertyEnfazRevenue(poNumber, property.id),
    enabled: Boolean(property.id),
  });

  const enfazIn = enfazRevenue?.hasEnfazRevenue
    ? {
        caseStudy: enfazRevenue.caseStudyFeeSar ?? 0,
        survey: enfazRevenue.surveyFeeSar ?? 0,
        total: enfazRevenue.enfazFeeSar ?? 0,
      }
    : null;

  if (feeTasks.length === 0) {
    return (
      <>
        <SectionHeader>مالية المعاملة</SectionHeader>
        <EmptyState
          icon="💰"
          title="لا توجد مهام أتعاب"
          sub="تظهر الأتعاب بعد توزيع مهمة المعاينة أو الرفع المساحي أو المراجعة الحكومية على هذا العقار."
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
        <SectionHeader>مالية المعاملة</SectionHeader>
        <InfoBox icon="ℹ">
          جاري تجهيز سجلات الأتعاب — أعد تحميل الصفحة بعد لحظات إن لم تظهر.
        </InfoBox>
      </>
    );
  }

  return (
    <>
      <SectionHeader>مالية المعاملة</SectionHeader>
      {isSupervisor ? (
        <div className="mb-3">
          <InfoBox icon="ℹ">
            المشرف: يطبّق الحسم على أدوار هذه المعاملة فقط. الاعتماد يتم في تبويب
            «الأمور المالية».
          </InfoBox>
        </div>
      ) : isFinance ? (
        <div className="mb-3">
          <InfoBox icon="ℹ">
            الإدارة المالية: عرض فقط — التنفيذ من سطح المالية.
          </InfoBox>
        </div>
      ) : null}

      <TabBar className="mb-3">
        <Tab active={sub === "out"} onClick={() => setSub("out")}>
          {isSupervisor || isFinance
            ? "التزامات على الشركة (صادرة)"
            : "أتعابي عن المعاملة"}
        </Tab>
        <Tab active={sub === "in"} onClick={() => setSub("in")}>
          إيراد إنفاذ (وارد)
        </Tab>
      </TabBar>

      <TabPanel>
        {sub === "out" ? (
          isSupervisor ? (
            <InspectorFeesBillingTable rows={rows} mode="supervisor" />
          ) : (
            <PartyFeeWorkflowTable
              rows={rows}
              role={isFinance ? "readonly" : "office"}
            />
          )
        ) : enfazIn != null ? (
          <InfoBox icon="✓">
            <div className="mb-1">عُبّئ إيراد إنفاذ لهذه المعاملة من سطح المالية.</div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-text-2">
              <span>
                دراسة المعاملة:{" "}
                <span className="tabular-nums font-medium text-text">
                  {enfazIn.caseStudy.toLocaleString("ar-SA")} ر.س
                </span>
              </span>
              <span>
                تكاليف الرفع:{" "}
                <span className="tabular-nums font-medium text-text">
                  {enfazIn.survey.toLocaleString("ar-SA")} ر.س
                </span>
              </span>
              <span>
                المجموع:{" "}
                <span className="tabular-nums font-medium text-text">
                  {enfazIn.total.toLocaleString("ar-SA")} ر.س
                </span>
              </span>
            </div>
          </InfoBox>
        ) : (
          <InfoBox icon="⏱">
            إيراد إنفاذ يُعبّأ من المالية بعد اكتمال أمر العمل (دراسة + رفع). حتى
            ذلك يبقى «—» ولا يُحسب هامش.
          </InfoBox>
        )}
      </TabPanel>

      {rows.some((r) => r.workStatus) ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {rows.map((row) => (
            <Badge
              key={row.workflowTaskId}
              tone={inspectorFeeWorkStatusTone(row.workStatus)}
            >
              {row.workStatusLabel} ·{" "}
              {row.billingStatusLabel || inspectorFeeStatusLabel(row.billingStatus)}
            </Badge>
          ))}
        </div>
      ) : null}
    </>
  );
}
