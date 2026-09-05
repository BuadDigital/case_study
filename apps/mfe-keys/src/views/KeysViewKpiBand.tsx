"use client";

/** KPI band (desktop) and stat cards (mobile) at the top of the keys list. */
import {
  KpiAlertIcon,
  KpiBand,
  KpiCell,
  KpiClockIcon,
  MobileKpiStatCards,
} from "@platform/ui-kit";
import type { KeysKpis } from "./keys-view-state";

function KpiEnvIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M22 7 12 13 2 7" />
      <rect x="2" y="4" width="20" height="16" rx="2" />
    </svg>
  );
}

function KpiReadyIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M22 7 12 13 2 7" />
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M12 13v4" />
    </svg>
  );
}

export function KeysViewKpiBand({
  ready,
  kpis,
}: {
  ready: boolean;
  kpis: KeysKpis;
}) {
  return (
    <>
      <KpiBand className="mb-6 hidden lg:flex">
        <KpiCell
          first
          icon={<KpiEnvIcon />}
          iconClass="bg-gold-soft text-gold-d"
          label="إجمالي الأظرف"
          value={ready ? kpis.total : "—"}
          sub={
            ready ? (
              <>
                <span className="size-1.5 rounded-full bg-gold" />
                {kpis.delivered} مسلَّمة · المتبقي في العهدة{" "}
                <b className="text-[12.5px] text-gold-d">{kpis.inCustody}</b>
              </>
            ) : (
              "—"
            )
          }
        />
        <KpiCell
          icon={<KpiClockIcon />}
          iconClass="bg-[color-mix(in_srgb,#378add_15%,transparent)] text-[#378add]"
          label="الأظرف النشطة"
          value={ready ? kpis.active : "—"}
          sub="لها معاملات لم تكتمل في النظام"
        />
        <KpiCell
          icon={<KpiAlertIcon />}
          iconClass="bg-[color-mix(in_srgb,#d9a441_20%,transparent)] text-[#8a5e14]"
          label="بانتظار المطابقة الميدانية"
          value={ready ? kpis.pendingMatch : "—"}
          sub="صكوك لم تُجرَّب مفاتيحها"
        />
        <KpiCell
          last
          icon={<KpiReadyIcon />}
          iconClass="bg-[color-mix(in_srgb,#d9694f_16%,transparent)] text-[#c0553d]"
          label="أظرف جاهزة للتسليم"
          value={ready ? kpis.readyToDeliver : "—"}
          sub="اكتملت معاملاتها — بانتظار الإرجاع أو التسليم"
        />
      </KpiBand>

      <MobileKpiStatCards
        className="mb-6"
        items={[
          {
            key: "total",
            label: "إجمالي الأظرف",
            sub: ready
              ? `${kpis.delivered} مسلَّمة · عهدة ${kpis.inCustody}`
              : "—",
            value: ready ? kpis.total : "—",
            icon: <KpiEnvIcon />,
            iconClass: "bg-gold-soft text-gold-d",
            tone: "gold",
            valueClass: "!text-gold-d",
          },
          {
            key: "active",
            label: "الأظرف النشطة",
            sub: "لها معاملات لم تكتمل",
            value: ready ? kpis.active : "—",
            icon: <KpiClockIcon />,
            iconClass:
              "bg-[color-mix(in_srgb,var(--ink)_10%,transparent)] text-ink",
            tone: "ink",
          },
          {
            key: "pending",
            label: "بانتظار المطابقة الميدانية",
            sub: "صكوك لم تُجرَّب مفاتيحها",
            value: ready ? kpis.pendingMatch : "—",
            icon: <KpiAlertIcon />,
            iconClass:
              "bg-[color-mix(in_srgb,#d9a441_20%,transparent)] text-[#8a5e14]",
            tone: "gold",
          },
          {
            key: "ready",
            label: "أظرف جاهزة للتسليم",
            sub: "بانتظار الإرجاع أو التسليم",
            value: ready ? kpis.readyToDeliver : "—",
            icon: <KpiReadyIcon />,
            iconClass:
              "bg-[color-mix(in_srgb,var(--red)_12%,transparent)] text-red",
            tone: "red",
            valueClass: "!text-red",
          },
        ]}
      />
    </>
  );
}
