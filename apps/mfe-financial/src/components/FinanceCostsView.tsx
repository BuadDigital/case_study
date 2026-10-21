"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  MobileRecordCard,
  StatusPill,
  cn,
  finStatusStyle,
  opsPanelCard,
  opsTfNote,
  QueryErrorState,
  useSwapAnimation,
} from "@platform/ui-kit";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fmtSar } from "@platform/app-shared/format/number";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import { queryLoadFailed } from "@platform/app-shared/query/query-load-state";
import {
  loadPartyBillingReadyLines,
  loadPartyBillingStatements,
} from "@platform/app-shared/app-data/party-billing-statements-api";
import { resolvePartyName } from "@platform/app-shared/fees/party-fee-meta";
import { useStaffUsersQuery } from "@settings/mfe/query/settings-queries";
import type { StaffUser } from "@platform/app-shared/app-data/constants";
import {
  applyCostTax,
  buildFinanceCostParties,
  type FinanceCostParty,
} from "../lib/finance-cost-parties";
import { COSTS_ACCOUNT_TABS, type CostsSection } from "../lib/finance-nav";
import { FinanceStagePills } from "./FinanceStagePills";
import { FinancePartyBillingStatements } from "./FinancePartyBillingStatements";
import { FinanceExcludedCosts } from "./FinanceExcludedCosts";
import { FinanceCostPartiesList } from "./FinanceCostPartiesList";
import { prefetchCostsAccountTab } from "../query/costs-account-queries";

const EMPTY_STAFF_USERS: StaffUser[] = [];

// SAR suffix without forced fractional zeros — keep local to preserve the same display.
function AccountHeader({ party }: { party: FinanceCostParty }) {
  const isVendor = party.payeeType === "vendor";
  const dueScaled = applyCostTax(party.dueSar, party.payeeType);
  const inStScaled = applyCostTax(party.inStatementSar, party.payeeType);
  const paidScaled = applyCostTax(party.paidSar, party.payeeType);

  return (
    <>
    {/* Phones: the payee as one card — its four balances as labelled fields, not a wrapped strip. */}
    <MobileRecordCard
      className="mb-2.5 lg:hidden"
      tone="gold"
      title={party.name}
      subtitle={
        <bdi dir="ltr" className="text-[11px]">
          {party.assigneeId.slice(0, 12)}
        </bdi>
      }
      status={
        <span className="flex flex-col items-end gap-1">
          <StatusPill label={party.taskKindLabel} style={finStatusStyle("default")} />
          <StatusPill
            label={party.payeeTypeLabel}
            style={finStatusStyle(isVendor ? "default" : "individual")}
          />
        </span>
      }
      fields={[
        { label: "مستحق له الآن", ltr: true, value: fmtSar(party.balanceSar, { trim: true }) },
        { label: "مستحق — لم يُسجَّل", ltr: true, value: fmtSar(dueScaled, { trim: true }) },
        {
          label: isVendor ? "في مسيرات صرف" : "في أوامر صرف",
          ltr: true,
          value: fmtSar(inStScaled, { trim: true }),
        },
        { label: "مدفوع سابقاً", ltr: true, value: fmtSar(paidScaled, { trim: true }) },
      ]}
    />
    <div className={cn(opsPanelCard, "mb-2.5 flex flex-wrap items-center gap-3.5 px-3.5 py-2.5 max-lg:hidden")}>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="text-[14.5px] font-extrabold text-heading">
          {party.name}
        </span>
        <StatusPill label={party.taskKindLabel} style={finStatusStyle("default")} />
        <StatusPill
          label={party.payeeTypeLabel}
          style={finStatusStyle(isVendor ? "default" : "individual")}
        />
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
            {fmtSar(dueScaled, { trim: true })}
          </span>
          <span className="text-[9.5px] text-text-3">مستحق — لم يُسجَّل</span>
        </div>
        <div className="flex flex-col gap-px">
          <span
            className="text-[13px] font-extrabold leading-tight text-heading"
            dir="ltr"
          >
            {fmtSar(inStScaled, { trim: true })}
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
            {fmtSar(paidScaled, { trim: true })}
          </span>
          <span className="text-[9.5px] text-text-3">مدفوع سابقاً</span>
        </div>
        <div className="flex flex-col gap-px border-s border-border ps-4">
          <span
            className="text-base font-extrabold leading-tight text-heading"
            dir="ltr"
          >
            {fmtSar(party.balanceSar, { trim: true })}
          </span>
          <span className="text-[9.5px] text-text-3">مستحق له الآن</span>
        </div>
      </div>
    </div>
    </>
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
  /** Pins party in the URL when opening statement without party or with a wrong value */
  onEnsureParty?: (partyId: string) => void;
  excludedCount?: number;
}) {
  const { data: staffResult } = useStaffUsersQuery();
  const staffUsers = staffResult?.users ?? EMPTY_STAFF_USERS;

  // Deliberately unpaged: the account header sums the payee's whole ledger
  // (due / in statements / paid / balance) and the tab badges count it, and a
  // deep-linked statement resolves its payee from the whole statement list.
  // The paged reads live in the tabs below (usePartyBillingStatementsWorkflow).
  const readyQuery = useQuery({
    queryKey: [...appDataKeys.partyBilling(), "ready-lines", "account"],
    queryFn: () => loadPartyBillingReadyLines(),
    staleTime: 20_000,
  });
  const statementsQuery = useQuery({
    queryKey: [...appDataKeys.partyBilling(), "statements", "account"],
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

  /** Immediate account tab — does not wait on delayed searchParams */
  const [viewSection, setViewSection] = useState(section);
  const [prevSection, setPrevSection] = useState(section);
  if (section !== prevSection) {
    setPrevSection(section);
    setViewSection(section);
  }

  const statementResolvedParty = useMemo(() => {
    if (!focusStatementId) return null;
    const s = (statementsQuery.data ?? []).find(
      (x) => x.id === focusStatementId,
    );
    return s?.assigneeId?.trim() || null;
  }, [focusStatementId, statementsQuery.data]);

  /** Pin party in the URL when opening statement without party or a mismatched value */
  useEffect(() => {
    if (!statementResolvedParty || !onEnsureParty) return;
    if ((focusPartyIdProp ?? "").trim() === statementResolvedParty) return;
    onEnsureParty(statementResolvedParty);
  }, [statementResolvedParty, focusPartyIdProp, onEnsureParty]);

  /** deep-link: open payrolls when statement is present */
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

  /** Presence of party = account screen */
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
    let stmts = 0;
    let paid = 0;
    for (const s of statementsQuery.data ?? []) {
      if ((s.assigneeId?.trim() || "") !== partyKey) continue;
      if (s.status === "closed") paid += 1;
      else if (s.status !== "cancelled") stmts += 1;
    }
    return {
      dues: due,
      statements: stmts,
      paid,
      excluded: excludedCount ?? 0,
    } as Partial<Record<CostsSection, number>>;
  }, [partyKey, readyQuery.data, statementsQuery.data, excludedCount]);

  /** Ledger failed to load — header sums and badges would read 0. */
  const ledgerFailed = [readyQuery, statementsQuery].filter(queryLoadFailed);

  const queryClient = useQueryClient();
  const tabPanelRef = useRef<HTMLDivElement>(null);
  useSwapAnimation(tabPanelRef, accountSection);

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
      {ledgerFailed.length ? (
        <QueryErrorState
          className="mb-3.5"
          line="تعذّر تحميل حساب المستحق"
          error={ledgerFailed[0]!.error}
          onRetry={() => {
            for (const q of ledgerFailed) void q.refetch();
          }}
          retrying={ledgerFailed.some((q) => q.isFetching)}
        />
      ) : (
        <AccountHeader party={headerParty} />
      )}

      <FinanceStagePills
        pickerTitle="القسم"
        items={partyTabs}
        active={accountSection}
        onChange={(id) => {
          setViewSection(id);
          onSectionChange(id);
          if (id !== "statements" && id !== "dues") onFocusStatement(null);
        }}
        onTabIntent={(id) =>
          prefetchCostsAccountTab(queryClient, id, focusPartyId)
        }
        counts={ledgerFailed.length ? undefined : partyCounts}
      />

      <div ref={tabPanelRef}>
        {accountSection === "dues" ||
        accountSection === "statements" ||
        accountSection === "paid" ? (
          <>
            {accountSection === "statements" || accountSection === "paid" ? (
              <p className={cn(opsTfNote, "mb-3.5")}>
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
    </div>
  );
}
