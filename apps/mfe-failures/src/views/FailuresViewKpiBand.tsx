"use client";

/** Failures queue — the KPI band (desktop) and the 2×2 stat cards (mobile). */

import {
  KpiAlertIcon,
  KpiBand,
  KpiCell,
  KpiCheckIcon,
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
  const openSub = !isFetched
    ? "—"
    : stats.open > 0
      ? "تحتاج معالجة"
      : "لا تعذّرات مفتوحة";
  return (
    <>
      <KpiBand className="mb-0 hidden lg:flex">
        <KpiCell
          first
          icon={<KpiAlertIcon />}
          iconClass="bg-[var(--gold-soft)] text-[var(--gold-d)]"
          label="تعذّرات مفتوحة"
          value={!isFetched ? "—" : stats.open}
          sub={openSub}
          dot
        />
        <KpiCell
          icon={<KpiClockIcon />}
          iconClass="bg-[color-mix(in_srgb,#d9a441_20%,transparent)] text-[#8a5e14]"
          label="قيد المراجعة"
          value={!isFetched ? "—" : stats.review}
          sub="بانتظار الاعتماد"
        />
        <KpiCell
          icon={<KpiCheckIcon />}
          iconClass="bg-[color-mix(in_srgb,var(--ink)_10%,transparent)] text-heading"
          label="معتمدة / تم الحل"
          value={!isFetched ? "—" : stats.closed}
          sub={isFetched ? stats.closedPct : "—"}
        />
        <KpiCell
          last
          icon={<KpiClipboardIcon />}
          iconClass="bg-[color-mix(in_srgb,#3f8f5f_16%,transparent)] text-[#2f7a4d]"
          label="الإجمالي"
          value={!isFetched ? "—" : stats.total}
          sub="سجلات التعذّر"
        />
      </KpiBand>

      <MobileKpiStatCards
        className="mb-0"
        items={[
          {
            key: "open",
            label: "تعذّرات مفتوحة",
            sub: openSub,
            value: !isFetched ? "—" : stats.open,
            icon: <KpiAlertIcon />,
            iconClass: "bg-[var(--gold-soft)] text-[var(--gold-d)]",
            tone: "gold",
            valueClass: "!text-gold-d",
          },
          {
            key: "review",
            label: "قيد المراجعة",
            sub: "بانتظار الاعتماد",
            value: !isFetched ? "—" : stats.review,
            icon: <KpiClockIcon />,
            iconClass:
              "bg-[color-mix(in_srgb,#d9a441_20%,transparent)] text-[#8a5e14]",
            tone: "gold",
            valueClass: "!text-gold-d",
          },
          {
            key: "closed",
            label: "معتمدة / تم الحل",
            sub: isFetched ? stats.closedPct : "—",
            value: !isFetched ? "—" : stats.closed,
            icon: <KpiCheckIcon />,
            iconClass:
              "bg-[color-mix(in_srgb,var(--ink)_10%,transparent)] text-heading",
            tone: "ink",
            valueClass: "!text-heading",
          },
          {
            key: "total",
            label: "الإجمالي",
            sub: "سجلات التعذّر",
            value: !isFetched ? "—" : stats.total,
            icon: <KpiClipboardIcon />,
            iconClass:
              "bg-[color-mix(in_srgb,var(--ink)_10%,transparent)] text-heading",
            tone: "ink",
          },
        ]}
      />
    </>
  );
}
