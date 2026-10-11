"use client";

/** Operations-tasks list — the KPI band (desktop) and the 2×2 stat cards (mobile). */

import { KpiBand, KpiCell, MobileKpiStatCards } from "@platform/ui-kit";
import {
  TasksKpiActiveIcon,
  TasksKpiCompletedIcon,
  TasksKpiCreatedIcon,
  TasksKpiInProgressIcon,
} from "../components/tasks/TasksHtmlPrimitives";
import type { OperationsTaskKpis } from "./operations-tasks-view-state";

export function OperationsTasksKpiBand({ kpis }: { kpis: OperationsTaskKpis }) {
  const v = (n: number) => (kpis.failed ? "—" : n);
  return (
    <>
      {/* Desktop: connected KPI band */}
      <KpiBand className="mb-0 hidden shrink-0 !rounded-[12px] lg:flex">
        <KpiCell
          first
          icon={<TasksKpiActiveIcon />}
          iconClass="bg-gold-soft text-gold-d"
          label="مهام نشطة"
          value={v(kpis.active)}
          sub="قيد الإسناد والتنفيذ"
          dot
        />
        <KpiCell
          icon={<TasksKpiCreatedIcon />}
          iconClass="bg-[color-mix(in_srgb,var(--ink)_10%,transparent)] text-heading"
          label="منشأة"
          value={v(kpis.created)}
          sub="بانتظار البدء"
        />
        <KpiCell
          icon={<TasksKpiInProgressIcon />}
          iconClass="bg-[color-mix(in_srgb,#d9a441_20%,transparent)] text-[#8a5e14]"
          label="قيد التنفيذ"
          value={v(kpis.inProgress)}
          sub="جارية الآن"
        />
        <KpiCell
          last
          icon={<TasksKpiCompletedIcon />}
          iconClass="bg-[color-mix(in_srgb,#3f8f5f_16%,transparent)] text-heading"
          label="مكتملة"
          value={v(kpis.completed)}
          sub="أُنجزت مؤخراً"
        />
      </KpiBand>

      {/* Mobile: property-inspection-style 2×2 stat cards */}
      <MobileKpiStatCards
        className="mb-0"
        items={[
          {
            key: "active",
            label: "مهام نشطة",
            sub: "قيد الإسناد والتنفيذ",
            value: v(kpis.active),
            icon: <TasksKpiActiveIcon />,
            iconClass: "bg-gold-soft text-gold-d",
            tone: "gold",
            valueClass: "!text-gold-d",
          },
          {
            key: "created",
            label: "منشأة",
            sub: "بانتظار البدء",
            value: v(kpis.created),
            icon: <TasksKpiCreatedIcon />,
            iconClass:
              "bg-[color-mix(in_srgb,var(--ink)_10%,transparent)] text-heading",
            tone: "ink",
          },
          {
            key: "inProgress",
            label: "قيد التنفيذ",
            sub: "جارية الآن",
            value: v(kpis.inProgress),
            icon: <TasksKpiInProgressIcon />,
            iconClass:
              "bg-[color-mix(in_srgb,#d9a441_20%,transparent)] text-[#8a5e14]",
            tone: "gold",
            valueClass: "!text-gold-d",
          },
          {
            key: "completed",
            label: "مكتملة",
            sub: "أُنجزت مؤخراً",
            value: v(kpis.completed),
            icon: <TasksKpiCompletedIcon />,
            iconClass:
              "bg-[color-mix(in_srgb,var(--ink)_10%,transparent)] text-heading",
            tone: "ink",
            valueClass: "!text-heading",
          },
        ]}
      />
    </>
  );
}
