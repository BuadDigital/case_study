"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import {
  loadPartyBillingReadyLines,
  loadPartyBillingStatements,
} from "@platform/app-shared/prototype/party-billing-statements-api";
import { resolvePartyName } from "@platform/app-shared/fees/party-fee-meta";
import { useStaffUsersQuery } from "@settings/mfe/query/settings-queries";
import { cn } from "@platform/design-system";
import {
  applyCostTax,
  buildFinanceCostParties,
  type FinanceCostParty,
} from "../lib/finance-cost-parties";
import { COSTS_ACCOUNT_TABS, type CostsSection } from "../lib/finance-nav";
import {
  finGhost,
  finNote,
  finStatus,
  finStatusTeal,
} from "../lib/finance-tw";
import { FinanceStagePills } from "./FinanceStagePills";
import { FinancePartyBillingStatements } from "./FinancePartyBillingStatements";
import { FinanceExcludedCosts } from "./FinanceExcludedCosts";
import { FinanceCostPartiesList } from "./FinanceCostPartiesList";

function fmtSar(n: number) {
  return `${n.toLocaleString("en-US", {
    maximumFractionDigits: 2,
  })} ر.س`;
}

function AccountHeader({ party }: { party: FinanceCostParty }) {
  const isVendor = party.payeeType === "vendor";
  const dueScaled = applyCostTax(party.dueSar, party.payeeType);
  const inStScaled = applyCostTax(party.inStatementSar, party.payeeType);
  const paidScaled = applyCostTax(party.paidSar, party.payeeType);

  return (
    <div className="mb-2.5 flex flex-wrap items-center gap-3.5 rounded-xl border border-border bg-surface px-3.5 py-2.5 shadow-card">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="text-[14.5px] font-extrabold text-heading">
          {party.name}
        </span>
        <span className={finStatus}>{party.taskKindLabel}</span>
        <span className={isVendor ? finStatus : finStatusTeal}>
          {party.payeeTypeLabel}
        </span>
        <span className="text-[10px] text-text-3" dir="ltr">
          {party.assigneeId.slice(0, 12)}
        </span>
      </div>
      <div className="ms-auto flex flex-wrap items-center gap-4">
        <div className="flex flex-col gap-px">
          <span
            className="text-[13px] font-extrabold leading-tight text-heading"
            dir="ltr"
          >
            {fmtSar(dueScaled)}
          </span>
          <span className="text-[9.5px] text-text-3">مستحق — لم يُسجَّل</span>
        </div>
        <div className="flex flex-col gap-px">
          <span
            className="text-[13px] font-extrabold leading-tight text-heading"
            dir="ltr"
          >
            {fmtSar(inStScaled)}
          </span>
          <span className="text-[9.5px] text-text-3">
            {isVendor ? "في مسيرات صرف" : "في أوامر صرف"}
          </span>
        </div>
        <div className="flex flex-col gap-px">
          <span
            className="text-[13px] font-extrabold leading-tight text-heading"
            dir="ltr"
          >
            {fmtSar(paidScaled)}
          </span>
          <span className="text-[9.5px] text-text-3">مدفوع سابقاً</span>
        </div>
        <div className="flex flex-col gap-px border-s border-border ps-4">
          <span
            className="text-base font-extrabold leading-tight text-heading"
            dir="ltr"
          >
            {fmtSar(party.balanceSar)}
          </span>
          <span className="text-[9.5px] text-text-3">مستحق له الآن</span>
        </div>
      </div>
    </div>
  );
}

export function FinanceCostsView({
  section,
  onSectionChange,
  focusStatementId,
  onFocusStatement,
  focusPartyId: focusPartyIdProp,
  onFocusParty,
  excludedCount,
}: {
  section: CostsSection;
  onSectionChange: (section: CostsSection) => void;
  focusStatementId: string | null;
  onFocusStatement: (id: string | null) => void;
  focusPartyId: string | null;
  onFocusParty: (id: string | null) => void;
  /** متوافق مع الاستدعاء السابق — غير مستخدم (التقارير أُزيلت) */
  summary?: unknown;
  summaryReady?: boolean;
  duesCount?: number;
  statementsCount?: number;
  excludedCount?: number;
}) {
  const { data: staffResult } = useStaffUsersQuery();
  const staffUsers = staffResult?.users ?? [];

  const readyQuery = useQuery({
    queryKey: [...prototypeKeys.all, "party-billing", "ready-lines", "account"],
    queryFn: () => loadPartyBillingReadyLines(),
    staleTime: 20_000,
  });
  const statementsQuery = useQuery({
    queryKey: [...prototypeKeys.all, "party-billing", "statements", "account"],
    queryFn: () => loadPartyBillingStatements(),
    staleTime: 20_000,
  });

  const parties = useMemo(
    () =>
      buildFinanceCostParties({
        readyLines: readyQuery.data ?? [],
        statements: statementsQuery.data ?? [],
        staffUsers,
      }),
    [readyQuery.data, statementsQuery.data, staffUsers],
  );

  /** تبويب الحساب الفوري — لا يعتمد على تأخّر searchParams */
  const [viewSection, setViewSection] = useState(section);
  useEffect(() => {
    setViewSection(section);
  }, [section]);

  const focusPartyId =
    focusPartyIdProp?.trim() ||
    (focusStatementId
      ? (statementsQuery.data ?? []).find((s) => s.id === focusStatementId)
          ?.assigneeId ?? null
      : null);

  const wantsAccountTab =
    viewSection === "dues" ||
    viewSection === "statements" ||
    viewSection === "paid" ||
    viewSection === "excluded";

  const activeParty = focusPartyId
    ? parties.find((p) => p.assigneeId === focusPartyId) ?? null
    : null;

  /** وجود party في الرابط = شاشة حساب (حتى لو تأخر section) */
  const inPartyAccount = Boolean(focusPartyId);
  const accountSection: CostsSection = wantsAccountTab
    ? viewSection
    : "dues";

  const partyTabs = useMemo(() => {
    const isVendor = activeParty?.payeeType !== "individual";
    return COSTS_ACCOUNT_TABS.map((t) => ({
      id: t.id,
      label:
        !isVendor && t.individualLabel ? t.individualLabel : t.label,
    }));
  }, [activeParty?.payeeType]);

  const partyCounts = useMemo(() => {
    if (!focusPartyId) return {};
    const due = (readyQuery.data ?? []).filter(
      (l) => (l.assigneeId?.trim() || "—") === focusPartyId && l.netFeeSar > 0,
    ).length;
    const stmts = (statementsQuery.data ?? []).filter(
      (s) =>
        s.assigneeId === focusPartyId &&
        s.status !== "closed" &&
        s.status !== "cancelled",
    ).length;
    const paid = (statementsQuery.data ?? []).filter(
      (s) => s.assigneeId === focusPartyId && s.status === "closed",
    ).length;
    return {
      dues: due,
      statements: stmts,
      paid,
      excluded: excludedCount ?? 0,
    } as Partial<Record<CostsSection, number>>;
  }, [
    focusPartyId,
    readyQuery.data,
    statementsQuery.data,
    excludedCount,
  ]);

  const partyName =
    activeParty?.name ??
    (focusPartyId ? resolvePartyName(focusPartyId, staffUsers) : "");

  if (!inPartyAccount) {
    return (
      <FinanceCostPartiesList
        onSelectParty={(id) => {
          setViewSection("dues");
          onFocusParty(id);
          onSectionChange("dues");
        }}
      />
    );
  }

  const headerParty: FinanceCostParty =
    activeParty ??
    ({
      assigneeId: focusPartyId!,
      name: partyName,
      payeeType: null,
      payeeTypeLabel: "مستحق",
      taskKindLabel: "—",
      phone: null,
      dueSar: 0,
      inStatementSar: 0,
      paidSar: 0,
      pendingLines: 0,
      openStatements: 0,
      balanceSar: 0,
    } satisfies FinanceCostParty);

  return (
    <div>
      <div className="mb-2.5">
        <button
          type="button"
          className={cn(finGhost, "h-auto px-2.5 py-1.5 text-[11.5px]")}
          onClick={() => {
            setViewSection("parties");
            onFocusParty(null);
            onFocusStatement(null);
            onSectionChange("parties");
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            <path
              d="M18 15l-6-6-6 6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          رجوع
        </button>
      </div>

      <AccountHeader party={headerParty} />

      <FinanceStagePills
        items={partyTabs}
        active={accountSection}
        onChange={(id) => {
          setViewSection(id);
          onSectionChange(id);
          if (id !== "statements" && id !== "dues") onFocusStatement(null);
        }}
        counts={partyCounts}
      />

      {accountSection === "dues" ||
      accountSection === "statements" ||
      accountSection === "paid" ? (
        <>
          {accountSection === "statements" || accountSection === "paid" ? (
            <p className={finNote}>
              {accountSection === "paid"
                ? headerParty.payeeType === "individual"
                  ? "أوامر الصرف المدفوعة للأفراد — للمطابقة فقط: المعاملات وسند الصرف وإيصال التحويل."
                  : "مسيرات الصرف المدفوعة — للمطابقة فقط: المعاملات وفاتورة المورّد وسند الصرف وإيصال التحويل."
                : headerParty.payeeType === "individual"
                  ? "أوامر صرف قيد الإجراء للأفراد — لا فاتورة ولا مسير. تحتاج توثيق الدفع ورفع إيصال التحويل. اضغط أمر الصرف لعرض معاملاته."
                  : "مسيرات الصرف قيد الإجراء: «بانتظار فاتورة المورّد» أُرسل المسير للمورّد ليرفع فاتورة مطابقة · «فاتورة واردة» تحتاج إقرار مطابقتكم · «أمر صرف» يحتاج توثيق الدفع. اضغط المستند لعرض معاملاته."}
            </p>
          ) : null}
          <FinancePartyBillingStatements
            mode={
              accountSection === "dues"
                ? "dues"
                : accountSection === "paid"
                  ? "paid"
                  : "statements"
            }
            assigneeId={focusPartyId}
            focusStatementId={focusStatementId}
            onFocusStatement={onFocusStatement}
            onCreatedStatement={() => onSectionChange("statements")}
          />
        </>
      ) : null}

      {accountSection === "excluded" ? (
        <FinanceExcludedCosts assigneeId={focusPartyId} />
      ) : null}
    </div>
  );
}
