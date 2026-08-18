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
import {
  applyCostTax,
  buildFinanceCostParties,
  type FinanceCostParty,
} from "../lib/finance-cost-parties";
import { COSTS_ACCOUNT_TABS, type CostsSection } from "../lib/finance-nav";
import {
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
  onEnsureParty,
  excludedCount,
}: {
  section: CostsSection;
  onSectionChange: (section: CostsSection) => void;
  focusStatementId: string | null;
  onFocusStatement: (id: string | null, partyId?: string | null) => void;
  focusPartyId: string | null;
  onFocusParty: (
    id: string | null,
    preferredSection?: "dues" | "statements" | CostsSection,
  ) => void;
  /** يثبت party في الرابط عند فتح statement بدون party أو بقيمة خاطئة */
  onEnsureParty?: (partyId: string) => void;
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

  const statementResolvedParty = useMemo(() => {
    if (!focusStatementId) return null;
    const s = (statementsQuery.data ?? []).find(
      (x) => x.id === focusStatementId,
    );
    return s?.assigneeId?.trim() || null;
  }, [focusStatementId, statementsQuery.data]);

  /** ثبّت party في URL عند فتح statement بدون party أو بقيمة غير متطابقة */
  useEffect(() => {
    if (!statementResolvedParty || !onEnsureParty) return;
    if ((focusPartyIdProp ?? "").trim() === statementResolvedParty) return;
    onEnsureParty(statementResolvedParty);
  }, [statementResolvedParty, focusPartyIdProp, onEnsureParty]);

  /** deep-link: افتح مسيرات عند وجود statement */
  useEffect(() => {
    if (!focusStatementId) return;
    if (viewSection === "statements" || viewSection === "paid") return;
    setViewSection("statements");
    onSectionChange("statements");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to statement id
  }, [focusStatementId]);

  const focusPartyId = focusPartyIdProp?.trim() || statementResolvedParty;

  const wantsAccountTab =
    viewSection === "dues" ||
    viewSection === "statements" ||
    viewSection === "paid" ||
    viewSection === "excluded";

  const activeParty = focusPartyId
    ? (parties.find((p) => p.assigneeId === focusPartyId) ?? null)
    : null;

  /** وجود party = شاشة حساب */
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

  const partyKey = focusPartyId;
  const partyCounts = useMemo(() => {
    if (!partyKey) return {};
    const due = (readyQuery.data ?? []).filter(
      (l) => (l.assigneeId?.trim() || "—") === partyKey && l.netFeeSar > 0,
    ).length;
    const stmts = (statementsQuery.data ?? []).filter(
      (s) =>
        (s.assigneeId?.trim() || "") === partyKey &&
        s.status !== "closed" &&
        s.status !== "cancelled",
    ).length;
    const paid = (statementsQuery.data ?? []).filter(
      (s) =>
        (s.assigneeId?.trim() || "") === partyKey && s.status === "closed",
    ).length;
    return {
      dues: due,
      statements: stmts,
      paid,
      excluded: excludedCount ?? 0,
    } as Partial<Record<CostsSection, number>>;
  }, [partyKey, readyQuery.data, statementsQuery.data, excludedCount]);

  const partyName =
    activeParty?.name ??
    (focusPartyId ? resolvePartyName(focusPartyId, staffUsers) : "");

  if (!inPartyAccount) {
    return (
      <FinanceCostPartiesList
        onSelectParty={(id, preferred) => {
          const next = preferred ?? "dues";
          setViewSection(next);
          onFocusParty(id, next);
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
                  ? "أوامر صرف قيد الإجراء للأفراد — لا فاتورة. تحتاج توثيق الدفع ورفع إيصال التحويل. اضغط أمر الصرف لعرضه."
                  : "مسيرات قيد الإجراء: «بانتظار فاتورة المورّد» · «فاتورة واردة — بانتظار المطابقة» · «مطابق — بانتظار توثيق الصرف». اضغط المسير لإكمال الإجراء."}
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
            onFocusStatement={(id, partyId) =>
              onFocusStatement(id, partyId ?? focusPartyId)
            }
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
