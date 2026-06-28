"use client";

import {
  CardBody,
  InlineLoadingSkeleton,
  KpiRowLabel,
  ProgressBar,
  SubpageHeader,
  SubpagePanel,
} from "@platform/design-system";
import { useReportingDashboardQuery } from "../../query/reporting-queries";

function LoadRow({
  name,
  roleLabel,
  value,
  max,
  tone,
}: {
  name: string;
  roleLabel: string;
  value: number;
  max: number;
  tone: string;
}) {
  const barTone = tone === "warning" ? "warning" : "success";
  return (
    <div className="mb-3 last:mb-0">
      <KpiRowLabel>
        <span>
          {name} <span className="text-text-3">({roleLabel})</span>
        </span>
        <span className="font-semibold">
          {value}/{max}
        </span>
      </KpiRowLabel>
      <ProgressBar value={value} max={max} tone={barTone} />
    </div>
  );
}

export function TeamCurrentLoadCard() {
  const { data: dashboard, isPending } = useReportingDashboardQuery();
  const rows = dashboard?.specialistLoad ?? [];

  return (
    <SubpagePanel className="mb-4 shrink-0 flex-none">
      <SubpageHeader title="حمل الفريق الحالي" />
      <CardBody>
        {isPending ? (
          <InlineLoadingSkeleton />
        ) : rows.length === 0 ? (
          <p className="text-xs text-text-3">لا توجد مهام مفتوحة للفريق حالياً.</p>
        ) : (
          rows.map((row) => (
            <LoadRow
              key={`${row.roleId}:${row.name}`}
              name={row.name}
              roleLabel={row.roleLabel}
              value={row.currentLoad}
              max={row.maxLoad}
              tone={row.tone}
            />
          ))
        )}
      </CardBody>
    </SubpagePanel>
  );
}
