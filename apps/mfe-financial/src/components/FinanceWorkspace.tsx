"use client";

import { useState } from "react";
import {
  Badge,
  EmptyState,
  Note,
  PageToolbar,
  SkeletonTableRows,
  Tab,
  TabBar,
  TabPanel,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  cn,
  queueTableWrapClassName,
} from "@platform/design-system";
import type { FinancialSummaryDto } from "../lib/financial-api";
import { useFinanceTabCounts } from "../query/finance-tab-counts";
import { FinancePartyDisburse } from "./FinancePartyDisburse";
import { FinanceEnfazPoBilling } from "./FinanceEnfazPoBilling";
import { FinancePartyBrowse } from "./FinancePartyBrowse";
import { FinanceEngBillingStatements } from "./FinanceEngBillingStatements";

function ContractBadge({ type }: { type: string }) {
  const tone = type === "ext" ? "default" : type === "int" ? "info" : "warning";
  const label = type === "ext" ? "خارجي" : type === "int" ? "داخلي" : "متعاون";
  return (
    <Badge tone={tone} className="">
      {label}
    </Badge>
  );
}

function ReportTableSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-2 text-[13px] font-semibold text-text">{title}</h3>
      <div
        className={cn(
          queueTableWrapClassName,
          "rounded-[var(--radius-lg)] border border-border bg-surface",
        )}
      >
        {children}
      </div>
    </section>
  );
}

function tabBadge(count: number, tone: "success" | "info" | "warning" = "success") {
  if (count <= 0) return null;
  return (
    <Badge tone={tone} className="ms-1.5 px-1.5 py-0 text-[10px] font-semibold">
      {count}
    </Badge>
  );
}

export function FinanceWorkspace({
  summary,
  ready,
}: {
  summary: FinancialSummaryDto | null | undefined;
  ready: boolean;
}) {
  const [tab, setTab] = useState<
    "disburse" | "eng-billing" | "enfaz" | "browse" | "reports"
  >("disburse");
  const counts = useFinanceTabCounts();
  const revenueRows = summary?.revenueRows ?? [];
  const costRows = summary?.costRows ?? [];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 py-4">
      <TabBar className="mb-0 shrink-0">
        <Tab active={tab === "disburse"} onClick={() => setTab("disburse")}>
          صرف الالتزامات
          {!counts.isPending ? tabBadge(counts.readyToDisburse, "success") : null}
          {!counts.isPending && counts.readyToDisburse === 0 && counts.waitingOffice > 0
            ? tabBadge(counts.waitingOffice, "info")
            : null}
        </Tab>
        <Tab
          active={tab === "eng-billing"}
          onClick={() => setTab("eng-billing")}
        >
          فوترة المكتب الهندسي
          {!counts.isPending ? tabBadge(counts.engReady, "info") : null}
        </Tab>
        <Tab active={tab === "enfaz"} onClick={() => setTab("enfaz")}>
          فوترة إنفاذ
          {!counts.isPending ? tabBadge(counts.enfazReady, "warning") : null}
        </Tab>
        <Tab active={tab === "browse"} onClick={() => setTab("browse")}>
          استعراض الأطراف
        </Tab>
        <Tab active={tab === "reports"} onClick={() => setTab("reports")}>
          التقارير
        </Tab>
      </TabBar>

      <TabPanel className="min-h-0 flex-1 overflow-y-auto px-0 py-0">
        {tab === "disburse" ? (
          <>
            {!counts.isPending && counts.readyToDisburse > 0 ? (
              <PageToolbar className="mb-3 border-0 bg-success-bg/25">
                <Note tone="success" className="m-0 flex-1">
                  لديك <strong>{counts.readyToDisburse}</strong> عقار جاهز للصرف
                  الآن — ادخل للطرف ونفّذ من قسم «جاهز للصرف الآن».
                </Note>
              </PageToolbar>
            ) : null}
            {!counts.isPending &&
            counts.readyToDisburse === 0 &&
            counts.waitingOffice > 0 ? (
              <PageToolbar className="mb-3 border-0 bg-warning-bg/40">
                <Note tone="warn" className="m-0 flex-1">
                  {counts.waitingOffice} عقار بانتظار المكتب لإنشاء أمر صرف — لا
                  يمكنك الصرف حتى يُنشئ الطرف طلباً من «الاتعاب والصرف».
                </Note>
              </PageToolbar>
            ) : null}
            <FinancePartyDisburse />
          </>
        ) : null}
        {tab === "eng-billing" ? <FinanceEngBillingStatements /> : null}
        {tab === "enfaz" ? <FinanceEnfazPoBilling /> : null}
        {tab === "browse" ? <FinancePartyBrowse /> : null}
        {tab === "reports" ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ReportTableSection title="إيرادات إنفاذ">
              {!ready ? (
                <Table pending>
                  <TBody>
                    <SkeletonTableRows rows={4} cols={6} />
                  </TBody>
                </Table>
              ) : revenueRows.length === 0 ? (
                <EmptyState
                  line="لا توجد إيرادات مسجّلة بعد."
                  hint="صدر فواتير إنفاذ من تبويب «فوترة إنفاذ»."
                />
              ) : (
                <Table>
                  <THead>
                    <Tr hoverable={false}>
                      <Th>PO</Th>
                      <Th>مُفوتَرة</Th>
                      <Th>مستثنيات</Th>
                      <Th>القيمة</Th>
                      <Th>الفاتورة</Th>
                      <Th>الحالة</Th>
                    </Tr>
                  </THead>
                  <TBody>
                    {revenueRows.map((r) => (
                      <Tr key={r.po} hoverable={false}>
                        <Td className="font-medium text-primary-light">
                          {r.po}
                        </Td>
                        <Td>{r.billed}</Td>
                        <Td>{r.excluded}</Td>
                        <Td>{r.value}</Td>
                        <Td className="text-text-2">
                          {r.invoiceNumber ?? "—"}
                        </Td>
                        <Td>
                          <Badge tone={r.status === "done" ? "success" : "warning"}>
                            {r.status === "done" ? "مُفوتَر" : "جزئي"}
                          </Badge>
                        </Td>
                      </Tr>
                    ))}
                  </TBody>
                </Table>
              )}
            </ReportTableSection>
            <ReportTableSection title="تكاليف مزودي الخدمة">
              {!ready ? (
                <Table pending>
                  <TBody>
                    <SkeletonTableRows rows={4} cols={4} />
                  </TBody>
                </Table>
              ) : costRows.length === 0 ? (
                <EmptyState line="لا توجد تكاليف مسجّلة بعد." />
              ) : (
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
                    {costRows.map((r) => (
                      <Tr key={`${r.name}-${r.category}`} hoverable={false}>
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
              )}
            </ReportTableSection>
          </div>
        ) : null}
      </TabPanel>
    </div>
  );
}
