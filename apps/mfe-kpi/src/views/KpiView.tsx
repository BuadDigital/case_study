"use client";

import {
  KpiRowLabel,
  ProgressBar,
  ReportPageBody,
  StatCard,
  StatGrid,
  StatLabel,
  StatSub,
  StatValue,
  SubpageHeader,
  SubpagePanel,
} from "@platform/design-system";
import { useReportingKpiQuery } from "../query/kpi-queries";

function barTone(v: number): "success" | "primary" | "danger" {
  if (v >= 85) return "success";
  if (v >= 70) return "primary";
  return "danger";
}

function KpiList({ rows }: { rows: { name: string; scorePercent: number }[] }) {
  return (
    <>
      {rows.map((row) => (
        <div key={row.name} className="mb-3.5 last:mb-0">
          <KpiRowLabel>
            <span>{row.name}</span>
            <span className="font-semibold">{row.scorePercent}%</span>
          </KpiRowLabel>
          <ProgressBar value={row.scorePercent} tone={barTone(row.scorePercent)} />
        </div>
      ))}
    </>
  );
}

export function KpiView() {
  const { data: kpi } = useReportingKpiQuery();

  return (
    <ReportPageBody>
      <StatGrid>
        <StatCard accent="green">
          <StatLabel>معدل الإنجاز في الموعد</StatLabel>
          <StatValue value={kpi ? `${kpi.onTimeCompletionRate}%` : "—"} />
          <StatSub>هدف: 90%</StatSub>
        </StatCard>
        <StatCard accent="blue">
          <StatLabel>متوسط إنجاز العقار</StatLabel>
          <StatValue value={kpi?.avgPropertyDaysLabel ?? "—"} />
          <StatSub>هدف: أقل من 4</StatSub>
        </StatCard>
        <StatCard accent="warn">
          <StatLabel>معدل التعذرات</StatLabel>
          <StatValue value={kpi ? `${kpi.failureRatePercent}%` : "—"} />
          <StatSub>هدف: أقل من 5%</StatSub>
        </StatCard>
        <StatCard>
          <StatLabel>عقارات مُنجزة اليوم</StatLabel>
          <StatValue value={kpi?.completedToday} />
          <StatSub>هدف: 40-50</StatSub>
        </StatCard>
      </StatGrid>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <SubpagePanel>
          <SubpageHeader title="أداء أخصائيي دراسة الحالة" />
          <div className="p-4">
            <KpiList rows={kpi?.specialistScores ?? []} />
          </div>
        </SubpagePanel>
        <SubpagePanel>
          <SubpageHeader title="أداء مزودي الخدمة" />
          <div className="p-4">
            <KpiList rows={kpi?.providerScores ?? []} />
          </div>
        </SubpagePanel>
      </div>
    </ReportPageBody>
  );
}
