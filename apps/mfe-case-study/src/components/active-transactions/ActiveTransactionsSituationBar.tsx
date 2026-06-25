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
import type { PageId } from "@platform/types";
import { useActiveTransactionPageSituation } from "@case-study/mfe/query/use-active-transaction-page-situation";
import type { SituationTone } from "@case-study/mfe/lib/prototype/active-transaction-page-situation";

const toneAccent: Record<SituationTone, StatAccent> = {
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
  tone: SituationTone;
  href?: string;
}) {
  const inner = (
    <>
      <StatLabel>{label}</StatLabel>
      <StatValue value={value} countUp />
      {sub ? <StatSub>{sub}</StatSub> : null}
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

/** ملخص وضع الصفحة — أعلى شاشات المعاملات النشطة (أرقام خاصة بكل تبويب). */
export function ActiveTransactionsSituationBar({
  pageId,
}: {
  pageId: PageId;
}) {
  const situation = useActiveTransactionPageSituation(pageId);
  if (!situation) return null;

  const { cards, values } = situation;
  const gridCols = (cards.length <= 4 ? cards.length : 4) as 2 | 3 | 4;
  const gridClassName =
    cards.length === 5 ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5" : undefined;

  const rendered: ReactNode[] = cards.map((card) => (
    <SituationCard
      key={card.key}
      label={card.label}
      value={values[card.key]}
      sub={card.sub}
      tone={card.tone}
      href={card.href}
    />
  ));

  return (
    <StatGrid cols={gridCols} className={gridClassName}>
      {rendered}
    </StatGrid>
  );
}
