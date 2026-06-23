"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  StatCard,
  StatGrid,
  StatLabel,
  StatSub,
  StatValue,
  cn,
  type StatAccent,
} from "@platform/design-system";
import { useActiveTransactionsSituation } from "@case-study/mfe/query/use-active-transactions-situation";

const toneAccent: Record<"blue" | "warn" | "green" | "red", StatAccent> = {
  blue: "blue",
  warn: "amber",
  green: "green",
  red: "red",
};

function SituationCard({
  label,
  value,
  sub,
  tone,
  href,
}: {
  label: string;
  value: number | undefined;
  sub: string;
  tone: "blue" | "warn" | "green" | "red";
  href?: string;
}) {
  const inner = (
    <>
      <StatLabel>{label}</StatLabel>
      <StatValue value={value} countUp />
      <StatSub>{sub}</StatSub>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          "block text-inherit no-underline transition-[box-shadow,transform] duration-150 hover:-translate-y-px hover:shadow-[0_2px_10px_rgba(0,0,0,0.08)]",
        )}
      >
        <StatCard accent={toneAccent[tone]}>{inner}</StatCard>
      </Link>
    );
  }

  return <StatCard accent={toneAccent[tone]}>{inner}</StatCard>;
}

const SUB_ASSIGNED_TO_YOU = "المسندة إليك";

/** ملخص «وضعي» — أعلى كل شاشات المعاملات النشطة (أرقام فقط). */
export function ActiveTransactionsSituationBar() {
  const stats = useActiveTransactionsSituation();
  const { showPoMetrics, showTransactionMetrics } = stats.flags;

  if (!showPoMetrics && !showTransactionMetrics) return null;

  const cards: ReactNode[] = [];

  if (showPoMetrics) {
    cards.push(
      <SituationCard
        key="po"
        label="أوامر العمل النشطة"
        value={stats.incompletePo}
        sub={SUB_ASSIGNED_TO_YOU}
        tone="blue"
        href="/po"
      />,
      <SituationCard
        key="props"
        label="عقارات وردت اليوم"
        value={stats.propertiesToday}
        sub={SUB_ASSIGNED_TO_YOU}
        tone="warn"
      />,
    );
  }

  if (showTransactionMetrics) {
    cards.push(
      <SituationCard
        key="in"
        label="كل المعاملات"
        value={stats.transactionsArrivedToday}
        sub={SUB_ASSIGNED_TO_YOU}
        tone="green"
      />,
      <SituationCard
        key="done"
        label="أنجزت اليوم"
        value={stats.transactionsDoneToday}
        sub={SUB_ASSIGNED_TO_YOU}
        tone="red"
      />,
    );
  }

  const gridCols = cards.length as 2 | 3 | 4;

  return (
    <section
      className="shrink-0 bg-bg px-4 pt-4"
      aria-label="ملخص وضع المعاملات"
    >
      <StatGrid cols={gridCols}>{cards}</StatGrid>
    </section>
  );
}
