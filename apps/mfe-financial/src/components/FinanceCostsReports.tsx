"use client";

import { cn } from "@platform/design-system";
import type { FinancialSummaryDto } from "../lib/financial-api";
import {
  finCard,
  finEmpty,
  finEmptyS,
  finEmptyT,
  finGroupTitle,
  finMuted,
  finNum,
  finPo,
  finRow,
  finScroll,
  finStatus,
  finStatusFor,
  finStatusGold,
  finTd,
  finTh,
  finThead,
} from "../lib/finance-tw";
import { FinanceEnfazAgingReport } from "./FinanceEnfazAgingReport";

function ContractChip({ type }: { type: string }) {
  const label = type === "ext" ? "خارجي" : type === "int" ? "داخلي" : "متعاون";
  const cls =
    type === "int"
      ? finStatus
      : type === "ext"
        ? finStatusGold
        : finStatusFor("warning");
  return <span className={cls}>{label}</span>;
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
      <h3 className={cn(finGroupTitle, "mb-2.5")}>{title}</h3>
      <div className={finCard}>{children}</div>
    </section>
  );
}

const reportCols =
  "min-w-full grid-cols-[minmax(90px,1fr)_70px_70px_minmax(80px,1fr)_minmax(90px,1fr)_80px]";
const costCols =
  "min-w-full grid-cols-[minmax(120px,1.4fr)_88px_100px_minmax(90px,1fr)]";

export function FinanceCostsReports({
  summary,
  ready,
}: {
  summary: FinancialSummaryDto | null | undefined;
  ready: boolean;
}) {
  const revenueRows = summary?.revenueRows ?? [];
  const costRows = summary?.costRows ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ReportTableSection title="إيرادات إنفاذ">
          {!ready ? (
            <div className={finEmpty}>
              <div className={finEmptyT}>جاري التحميل…</div>
            </div>
          ) : revenueRows.length === 0 ? (
            <div className={finEmpty}>
              <div className={finEmptyT}>لا توجد إيرادات مسجّلة بعد.</div>
              <div className={finEmptyS}>
                صدر فواتير إنفاذ من تبويب «الإيرادات».
              </div>
            </div>
          ) : (
            <div className={finScroll}>
              <div>
                <div className={cn(finThead, reportCols)}>
                  <div className={finTh}>PO</div>
                  <div className={finTh}>مُفوتَرة</div>
                  <div className={finTh}>مستثنيات</div>
                  <div className={finTh}>القيمة</div>
                  <div className={finTh}>الفاتورة</div>
                  <div className={finTh}>الحالة</div>
                </div>
                {revenueRows.map((r) => (
                  <div key={r.po} className={cn(finRow, reportCols)}>
                    <div className={finTd}>
                      <span className={finPo}>{r.po}</span>
                    </div>
                    <div className={finTd}>
                      <span className={finNum}>{r.billed}</span>
                    </div>
                    <div className={finTd}>
                      <span className={finNum}>{r.excluded}</span>
                    </div>
                    <div className={finTd}>
                      <span className={finNum}>{r.value}</span>
                    </div>
                    <div className={finTd}>
                      <span className={finMuted} dir="ltr">
                        {r.invoiceNumber ?? "—"}
                      </span>
                    </div>
                    <div className={finTd}>
                      <span
                        className={finStatusFor(
                          r.status === "done" ? "success" : "warning",
                        )}
                      >
                        {r.status === "done" ? "مُفوتَر" : "جزئي"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ReportTableSection>
        <ReportTableSection title="تكاليف مزودي الخدمة">
          {!ready ? (
            <div className={finEmpty}>
              <div className={finEmptyT}>جاري التحميل…</div>
            </div>
          ) : costRows.length === 0 ? (
            <div className={finEmpty}>
              <div className={finEmptyT}>لا توجد تكاليف مسجّلة بعد.</div>
            </div>
          ) : (
            <div className={finScroll}>
              <div>
                <div className={cn(finThead, costCols)}>
                  <div className={finTh}>المستحق</div>
                  <div className={finTh}>النوع</div>
                  <div className={finTh}>التكلفة</div>
                  <div className={finTh}>الفئة</div>
                </div>
                {costRows.map((r) => (
                  <div
                    key={`${r.name}-${r.category}`}
                    className={cn(finRow, costCols)}
                  >
                    <div className={finTd}>
                      <span className="font-semibold text-heading">{r.name}</span>
                    </div>
                    <div className={finTd}>
                      <ContractChip type={r.type} />
                    </div>
                    <div className={finTd}>
                      <span className={finNum}>{r.cost}</span>
                    </div>
                    <div className={finTd}>
                      <span className={finMuted}>{r.category}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ReportTableSection>
      </div>
      <ReportTableSection title="تقادم ذمم إنفاذ">
        <div className="p-3.5">
          <FinanceEnfazAgingReport />
        </div>
      </ReportTableSection>
    </div>
  );
}
