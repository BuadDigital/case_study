"use client";

/** Failures queue — the KPI band (desktop) and the stat cards (mobile): one count per stage. */

import {
  KpiAlertIcon,
  KpiBand,
  KpiCell,
  KpiClipboardIcon,
  KpiClockIcon,
  MobileKpiStatCards,
} from "@platform/ui-kit";
import type { FailuresKpiStats } from "../lib/failures-view-state";

export function FailuresViewKpiBand({
  stats,
  isFetched,
}: {
  stats: FailuresKpiStats;
  isFetched: boolean;
}) {
  const value = (n: number) => (!isFetched ? "—" : n);
  return (
    <>
      <KpiBand className="mb-0 hidden lg:flex">
        <KpiCell
          first
          icon={<KpiAlertIcon />}
          iconClass="bg-[var(--gold-soft)] text-[var(--gold-d)]"
          label="عند الأخصائي"
          value={value(stats.withSpecialist)}
          sub="احتمال · داخلي · مُعاد"
          dot
        />
        <KpiCell
          icon={<KpiClockIcon />}
          iconClass="bg-[color-mix(in_srgb,#d9a441_20%,transparent)] text-[#8a5e14]"
          label="قيد المراجعة"
          value={value(stats.review)}
          sub="بانتظار اعتماد المشرف"
        />
        <KpiCell
          last
          icon={<KpiClipboardIcon />}
          iconClass="bg-[color-mix(in_srgb,#a33a3a_14%,transparent)] text-[#a33a3a]"
          label="تعذّرات نهائية"
          value={value(stats.final)}
          sub="لا إجراء بعدها"
        />
      </KpiBand>

      <MobileKpiStatCards
        className="mb-0"
        items={[
          {
            key: "with-specialist",
            label: "عند الأخصائي",
            sub: "احتمال · داخلي · مُعاد",
            value: value(stats.withSpecialist),
            icon: <KpiAlertIcon />,
            iconClass: "bg-[var(--gold-soft)] text-[var(--gold-d)]",
            tone: "gold",
            valueClass: "!text-gold-d",
          },
          {
            key: "review",
            label: "قيد المراجعة",
            sub: "بانتظار اعتماد المشرف",
            value: value(stats.review),
            icon: <KpiClockIcon />,
            iconClass:
              "bg-[color-mix(in_srgb,#d9a441_20%,transparent)] text-[#8a5e14]",
            tone: "gold",
            valueClass: "!text-gold-d",
          },
          {
            key: "final",
            label: "تعذّرات نهائية",
            sub: "لا إجراء بعدها",
            value: value(stats.final),
            icon: <KpiClipboardIcon />,
            iconClass: "bg-[color-mix(in_srgb,#a33a3a_14%,transparent)] text-[#a33a3a]",
            tone: "ink",
            valueClass: "!text-heading",
          },
        ]}
      />
    </>
  );
}
