/**
 * D17 — the income approach (direct capitalisation) in the printed valuation report: the inputs
 * table, EGI, expenses, NOI, the capitalisation rate, the value and the rate's rationale. The
 * template has no income section, so the live fill adds one on its own page before the
 * reconciliation (§24) when the approach is enabled; the section numbering is renumbered after.
 */
import type { ValuationIncomeApproachDto } from "@platform/api-client";

import { formatMoneyCell, formatSheetPct } from "./valuation-report-sheet-facts";

/** Printed name of the approach — section title and reconciliation row. */
export const INCOME_SECTION_TITLE = "أسلوب الدخل (رسملة مباشرة)";

export type IncomeSheetRow = { key: string; value: string; total?: boolean; wide?: boolean };

function money(n: number | null | undefined): string {
  return n == null ? "—" : formatMoneyCell(n) || "0.00";
}

function pct(n: number | null | undefined): string {
  return n == null ? "—" : formatSheetPct(n) || `${n}٪`;
}

/** Rows of the income section; empty when the approach was never saved. */
export function buildIncomeSheetRows(income: ValuationIncomeApproachDto | null | undefined): IncomeSheetRow[] {
  if (!income?.isSaved) return [];
  const opexLabel =
    income.operatingExpensesMode === "amount"
      ? "مصروفات التشغيل (مبلغ سنوي)"
      : `مصروفات التشغيل (${pct(income.operatingExpensesPct)} من الدخل الإجمالي الفعلي)`;
  const rows: IncomeSheetRow[] = [
    { key: "الدخل الإجمالي المحتمل (سنويًا)", value: money(income.grossPotentialIncome) },
    { key: "نسبة الشغور وخسائر التحصيل", value: pct(income.vacancyCollectionLossPct) },
    { key: "خسائر الشغور والتحصيل", value: money(income.vacancyLossAmount) },
    { key: "دخل آخر", value: money(income.otherIncome) },
    { key: "الدخل الإجمالي الفعلي", value: money(income.effectiveGrossIncome) },
    { key: opexLabel, value: money(income.operatingExpensesTotal) },
    { key: "صافي الدخل التشغيلي", value: money(income.netOperatingIncome) },
    { key: "معدل الرسملة", value: pct(income.capitalisationRatePct) },
    {
      key: "ناتج أسلوب الدخل (صافي الدخل التشغيلي ÷ معدل الرسملة)",
      value: income.isComplete ? money(income.incomeValue) : "—",
      total: true,
    },
  ];
  const rationale = (income.capRateRationale ?? "").trim();
  if (rationale) rows.push({ key: "مبرر معدل الرسملة", value: rationale, wide: true });
  return rows;
}

function sectionElement(doc: Document, rows: IncomeSheetRow[]): HTMLElement {
  const sec = doc.createElement("section");
  sec.className = "sec";
  sec.setAttribute("data-sec", "income");
  sec.setAttribute("data-name", INCOME_SECTION_TITLE);
  const h2 = doc.createElement("h2");
  const num = doc.createElement("span");
  num.className = "n";
  h2.append(num, INCOME_SECTION_TITLE);
  const table = doc.createElement("table");
  for (const row of rows) {
    const tr = doc.createElement("tr");
    if (row.total) tr.className = "total";
    const k = doc.createElement("td");
    k.className = "k";
    k.textContent = row.key;
    const v = doc.createElement("td");
    v.className = row.wide ? "v" : "v num";
    v.textContent = row.value;
    tr.append(k, v);
    table.append(tr);
  }
  sec.append(h2, table);
  return sec;
}

/**
 * Adds (or refreshes) the income section right before the reconciliation (§24, else the final
 * value §25), with the cost result (§23) before it on the same page; the reconciliation and what
 * follows it on that page move to a page of their own so nothing overflows the sheet. Nothing is
 * added while the approach is off.
 */
export function applyIncomeSection(
  dom: Document,
  fill: { incomeApproachEnabled?: boolean; incomeRows?: IncomeSheetRow[] },
): void {
  dom.querySelector('[data-sec="income"]')?.remove();
  const rows = fill.incomeRows ?? [];
  if (!fill.incomeApproachEnabled || rows.length === 0) return;
  const anchorSec = dom.querySelector('[data-sec="24"]') ?? dom.querySelector('[data-sec="25"]');
  const anchorPage = anchorSec?.closest("section.page");
  if (!anchorSec || !anchorPage) return;

  anchorSec.before(sectionElement(dom, rows));
  if (anchorPage.hasAttribute("data-income-split")) return;

  // The reconciliation and the sections after it continue on a new sheet.
  const page = dom.createElement("section");
  page.className = anchorPage.className;
  page.setAttribute("data-income-split", "");
  const meta = anchorPage.querySelector(".pg-meta");
  if (meta) page.append(meta.cloneNode(true));
  const moving: Element[] = [];
  for (let el: Element | null = anchorSec; el; el = el.nextElementSibling) {
    if (!el.classList.contains("pg-num")) moving.push(el);
  }
  page.append(...moving);
  const pageNum = anchorPage.querySelector(".pg-num");
  if (pageNum) page.append(pageNum.cloneNode(true));
  anchorPage.setAttribute("data-income-split", "");
  anchorPage.after(page);
}
