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
  return (
    <>
      {/* Desktop: connected KPI band */}
      <KpiBand className="mb-0 hidden shrink-0 !rounded-[12px] lg:flex">
        <KpiCell
          first
          icon={<TasksKpiActiveIcon />}
          iconClass="bg-gold-soft text-gold-d"
          label="مهام نشطة"
          value={kpis.active}
          sub="قيد الإسناد والتنفيذ"
          dot
        />
        <KpiCell
          icon={<TasksKpiCreatedIcon />}
          iconClass="bg-[color-mix(in_srgb,var(--ink)_10%,transparent)] text-ink"
          label="منشأة"
          value={kpis.created}
          sub="بانتظار البدء"
        />
        <KpiCell
          icon={<TasksKpiInProgressIcon />}
          iconClass="bg-[color-mix(in_srgb,#d9a441_20%,transparent)] text-[#8a5e14]"
          label="قيد التنفيذ"
          value={kpis.inProgress}
          sub="جارية الآن"
        />
        <KpiCell
          last
          icon={<TasksKpiCompletedIcon />}
          iconClass="bg-[color-mix(in_srgb,#3f8f5f_16%,transparent)] text-[#2f7a4d]"
          label="مكتملة"
          value={kpis.completed}
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
            value: kpis.active,
            icon: <TasksKpiActiveIcon />,
            iconClass: "bg-gold-soft text-gold-d",
            tone: "gold",
            valueClass: "!text-gold-d",
          },
          {
            key: "created",
            label: "منشأة",
            sub: "بانتظار البدء",
            value: kpis.created,
            icon: <TasksKpiCreatedIcon />,
            iconClass:
              "bg-[color-mix(in_srgb,var(--ink)_10%,transparent)] text-ink",
            tone: "ink",
          },
          {
            key: "inProgress",
            label: "قيد التنفيذ",
            sub: "جارية الآن",
            value: kpis.inProgress,
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
            value: kpis.completed,
            icon: <TasksKpiCompletedIcon />,
            iconClass:
              "bg-[color-mix(in_srgb,var(--ink)_10%,transparent)] text-ink",
            tone: "ink",
            valueClass: "!text-ink",
          },
        ]}
      />
    </>
  );
}
