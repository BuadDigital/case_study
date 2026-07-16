"use client";

import {
  KpiBand,
  KpiCell,
  KpiRowLabel,
  ProgressBar,
  ReportPageBody,
  SubpageHeader,
  SubpagePanel,
} from "@platform/design-system";
import { useReportingKpiQuery } from "../query/kpi-queries";

function KpiCheckIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <path d="m9 11 3 3L22 4" />
    </svg>
  );
}

function KpiClockIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

function KpiAlertIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}

function KpiClipboardIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M9 12h6M9 16h6" />
    </svg>
  );
}

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
      <KpiBand>
        <KpiCell
          first
          icon={<KpiCheckIcon />}
          iconClass="bg-[color-mix(in_srgb,#2f9e6b_16%,transparent)] text-[#2f9e6b]"
          label="معدل الإنجاز في الموعد"
          value={kpi ? `${kpi.onTimeCompletionRate}%` : "—"}
          valueClass="!text-[#2f9e6b]"
          sub="هدف: 90%"
          dot
        />
        <KpiCell
          icon={<KpiClockIcon />}
          iconClass="bg-info-bg text-info-text"
          label="متوسط إنجاز العقار"
          value={kpi?.avgPropertyDaysLabel ?? "—"}
          sub="هدف: أقل من 4"
        />
        <KpiCell
          icon={<KpiAlertIcon />}
          iconClass="bg-[color-mix(in_srgb,#d9a441_20%,transparent)] text-[#b8791a]"
          label="معدل التعذرات"
          value={kpi ? `${kpi.failureRatePercent}%` : "—"}
          sub="هدف: أقل من 5%"
        />
        <KpiCell
          last
          icon={<KpiClipboardIcon />}
          iconClass="bg-gold-soft text-gold-d"
          label="عقارات مُنجزة اليوم"
          value={kpi?.completedToday ?? "—"}
          sub="هدف: 40-50"
        />
      </KpiBand>
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
