"use client";

import {
  Badge,
  ReportPageBody,
  StatCard,
  StatGrid,
  StatLabel,
  StatSkeleton,
  StatValue,
  SubpageHeader,
  SubpagePanel,
  SkeletonTableRows,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from "@platform/design-system";
import { useFinancialSummaryQuery } from "../query/financial-queries";

function ContractBadge({ type }: { type: string }) {
  const tone = type === "ext" ? "default" : type === "int" ? "info" : "warning";
  const label = type === "ext" ? "خارجي" : type === "int" ? "داخلي" : "متعاون";
  return (
    <Badge tone={tone} className="rounded-[20px] px-2.5 py-0.5 text-[11px] font-normal">
      {label}
    </Badge>
  );
}

export function FinancialView() {
  const { data: summary, isPending } = useFinancialSummaryQuery();
  const ready = !isPending && summary != null;

  const statCards = ready
    ? [
        <StatCard key="revenue" accent="blue">
          <StatLabel>إيرادات {summary.periodLabel}</StatLabel>
          <StatValue value={summary.revenueTotal} className="text-xl" countUp />
          <div className="mt-1 text-[10px] text-text-3">ريال سعودي</div>
        </StatCard>,
        <StatCard key="costs" accent="red">
          <StatLabel>تكاليف خارجية</StatLabel>
          <StatValue value={summary.externalCostsTotal} className="text-xl" countUp />
          <div className="mt-1 text-[10px] text-text-3">مكاتب + متعاونون</div>
        </StatCard>,
        <StatCard key="margin" accent="green">
          <StatLabel>هامش الربح</StatLabel>
          <StatValue value={summary.profitMarginTotal} className="text-xl" countUp />
          <div className="mt-1 text-[10px] text-text-3">
            {summary.profitMarginPercentLabel}
          </div>
        </StatCard>,
        <StatCard key="pending" accent="warn">
          <StatLabel>مستحقات معلقة</StatLabel>
          <StatValue value={summary.pendingPayablesTotal} className="text-xl" countUp />
          <div className="mt-1 text-[10px] text-text-3">ريال سعودي</div>
        </StatCard>,
      ]
    : Array.from({ length: 4 }, (_, index) => (
        <StatCard key={index} accent="gray">
          <StatSkeleton />
        </StatCard>
      ));

  return (
    <ReportPageBody>
      <StatGrid>{statCards}</StatGrid>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <SubpagePanel>
          <SubpageHeader title="إيرادات إنفاذ" />
          <Table pending={!ready}>
            <THead>
              <Tr hoverable={false}>
                <Th>PO</Th>
                <Th>مُفوتَرة</Th>
                <Th>مستثنيات</Th>
                <Th>القيمة</Th>
                <Th>الحالة</Th>
              </Tr>
            </THead>
            <TBody>
              {!ready ? (
                <SkeletonTableRows rows={4} cols={5} />
              ) : (
                <>
              {(summary?.revenueRows ?? []).map((r) => (
                <Tr key={r.po} hoverable={false}>
                  <Td className="text-[11px] font-semibold text-primary-light">{r.po}</Td>
                  <Td>{r.billed}</Td>
                  <Td>{r.excluded}</Td>
                  <Td>{r.value}</Td>
                  <Td>
                    {r.status === "done" ? (
                      <Badge tone="success" className="rounded-[20px] px-2.5 py-0.5 text-[11px] font-normal">
                        مُفوتَر
                      </Badge>
                    ) : (
                      <Badge tone="warning" className="rounded-[20px] px-2.5 py-0.5 text-[11px] font-normal">
                        جزئي
                      </Badge>
                    )}
                  </Td>
                </Tr>
              ))}
              <Tr hoverable={false} className="bg-surface-2 font-semibold">
                <Td colSpan={3}>الإجمالي</Td>
                <Td>{summary?.revenueGrandTotal ?? "—"}</Td>
                <Td />
              </Tr>
                </>
              )}
            </TBody>
          </Table>
        </SubpagePanel>
        <SubpagePanel>
          <SubpageHeader title="تكاليف مزودي الخدمة" />
          <Table pending={!ready}>
            <THead>
              <Tr hoverable={false}>
                <Th>المزود</Th>
                <Th>النوع</Th>
                <Th>التكلفة</Th>
                <Th>الفئة</Th>
              </Tr>
            </THead>
            <TBody>
              {!ready ? (
                <SkeletonTableRows rows={4} cols={4} />
              ) : (
              (summary?.costRows ?? []).map((r) => (
                <Tr key={r.name} hoverable={false}>
                  <Td className="font-medium">{r.name}</Td>
                  <Td>
                    <ContractBadge type={r.type} />
                  </Td>
                  <Td>{r.cost}</Td>
                  <Td>{r.category}</Td>
                </Tr>
              ))
              )}
            </TBody>
          </Table>
        </SubpagePanel>
      </div>
    </ReportPageBody>
  );
}
