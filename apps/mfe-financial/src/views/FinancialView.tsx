"use client";

import {
  Badge,
  StatCard,
  StatGrid,
  StatLabel,
  StatValue,
  SubpageHeader,
  SubpagePanel,
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
  const { data: summary } = useFinancialSummaryQuery();

  return (
    <>
      <StatGrid>
        <StatCard accent="blue">
          <StatLabel>إيرادات {summary?.periodLabel ?? "—"}</StatLabel>
          <StatValue value={summary?.revenueTotal} className="text-xl" />
          <div className="mt-1 text-[10px] text-text-3">ريال سعودي</div>
        </StatCard>
        <StatCard accent="red">
          <StatLabel>تكاليف خارجية</StatLabel>
          <StatValue value={summary?.externalCostsTotal} className="text-xl" />
          <div className="mt-1 text-[10px] text-text-3">مكاتب + متعاونون</div>
        </StatCard>
        <StatCard accent="green">
          <StatLabel>هامش الربح</StatLabel>
          <StatValue value={summary?.profitMarginTotal} className="text-xl" />
          <div className="mt-1 text-[10px] text-text-3">
            {summary?.profitMarginPercentLabel ?? "—"}
          </div>
        </StatCard>
        <StatCard accent="warn">
          <StatLabel>مستحقات معلقة</StatLabel>
          <StatValue value={summary?.pendingPayablesTotal} className="text-xl" />
          <div className="mt-1 text-[10px] text-text-3">ريال سعودي</div>
        </StatCard>
      </StatGrid>
      <div className="grid grid-cols-2 gap-3">
        <SubpagePanel>
          <SubpageHeader title="إيرادات إنفاذ" />
          <Table>
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
            </TBody>
          </Table>
        </SubpagePanel>
        <SubpagePanel>
          <SubpageHeader title="تكاليف مزودي الخدمة" />
          <Table>
            <THead>
              <Tr hoverable={false}>
                <Th>المزود</Th>
                <Th>النوع</Th>
                <Th>التكلفة</Th>
                <Th>الفئة</Th>
              </Tr>
            </THead>
            <TBody>
              {(summary?.costRows ?? []).map((r) => (
                <Tr key={r.name} hoverable={false}>
                  <Td className="font-medium">{r.name}</Td>
                  <Td>
                    <ContractBadge type={r.type} />
                  </Td>
                  <Td>{r.cost}</Td>
                  <Td>{r.category}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </SubpagePanel>
      </div>
    </>
  );
}
