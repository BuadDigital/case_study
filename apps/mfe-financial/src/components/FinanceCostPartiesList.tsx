"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fmtSar } from "@platform/app-shared/format/number";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import { queryLoadFailed } from "@platform/app-shared/query/query-load-state";
import {
  loadPartyBillingReadyLines,
  loadPartyBillingStatements,
} from "@platform/app-shared/app-data/party-billing-statements-api";
import { useStaffUsersQuery } from "@settings/mfe/query/settings-queries";
import type { StaffUser } from "@platform/app-shared/app-data/constants";
import {
  EmptyState,
  QueryErrorState,
  ListPager,
  MobileRecordCard,
  MobileRecordList,
  StatusPill,
  TBody,
  THead,
  Table,
  TableFrame,
  Td,
  TdLtr,
  Th,
  Tr,
  cn,
  finStatusStyle,
  listPagerWindow,
  opsLetterCard,
  opsSearchInput,
  opsTfNote,
} from "@platform/ui-kit";
import {
  buildFinanceCostParties,
  type FinanceCostParty,
} from "../lib/finance-cost-parties";
import {
  FINANCE_LIST_PAGE_SIZE,
  useListPageState,
} from "../query/billing-list-page-queries";
import {
  finMuted,
  finRowActive,
  finSearch,
} from "../lib/finance-tw";
import { SearchIcon } from "./FinanceRevenueTableParts";

const EMPTY_STAFF_USERS: StaffUser[] = [];

function PayeeChip({ party }: { party: FinanceCostParty }) {
  const isInd = party.payeeType === "individual";
  return (
    <StatusPill
      label={party.payeeTypeLabel || (isInd ? "فرد" : "مورّد")}
      style={finStatusStyle(isInd ? "individual" : "default")}
    />
  );
}

/** «مستحقات قائمة» — ready lines, open payrolls, or settled (table cell and phone card). */
function PartyOpenDues({ party: p }: { party: FinanceCostParty }) {
  return p.pendingLines > 0 ? (
    <span className="inline-flex items-center gap-1.5 text-[11.5px] font-bold text-[#8a5e14]">
      <span className="h-[7px] w-[7px] rounded-full bg-[#d9a441]" />
      {p.pendingLines} بند جاهز
    </span>
  ) : p.openStatements > 0 ? (
    <span className="inline-flex items-center gap-1.5 text-[11.5px] font-bold text-[#1f3a5f]">
      <span className="h-[7px] w-[7px] rounded-full bg-heading" />
      {p.openStatements} مسير/أمر
    </span>
  ) : (
    <span className="text-[11.5px] text-text-3">مسوّى</span>
  );
}

export function FinanceCostPartiesList({
  onSelectParty,
}: {
  /** preferredSection: dues if ready lines exist, else statements if open payrolls exist */
  onSelectParty: (
    assigneeId: string,
    preferredSection?: "dues" | "statements",
  ) => void;
}) {
  const [q, setQ] = useState("");
  /** Deferred value for filtering — search input stays immediate without blocking typing */
  const deferredQ = useDeferredValue(q);
  const { data: staffResult } = useStaffUsersQuery();
  const staffUsers = staffResult?.users ?? EMPTY_STAFF_USERS;

  // Deliberately unpaged loads: a payee row is an aggregate — its balance sums
  // every ready line and every statement of that payee, and a payee with no
  // ready line still appears through its statements. Neither list has a
  // "group by payee" on the server, so both must be whole; the pager below
  // windows the aggregated rows client-side (pagination-contract §9, note).
  const readyQuery = useQuery({
    queryKey: [...appDataKeys.partyBilling(), "ready-lines", "parties"],
    queryFn: () => loadPartyBillingReadyLines(),
    staleTime: 20_000,
  });
  const statementsQuery = useQuery({
    queryKey: [...appDataKeys.partyBilling(), "statements", "parties"],
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

  const filtered = useMemo(() => {
    const needle = deferredQ.trim().toLowerCase();
    if (!needle) return parties;
    return parties.filter(
      (p) =>
        p.name.toLowerCase().includes(needle) ||
        p.assigneeId.toLowerCase().includes(needle) ||
        p.taskKindLabel.toLowerCase().includes(needle),
    );
  }, [parties, deferredQ]);

  const [page, setPage] = useListPageState(deferredQ.trim());
  const pageWindow = listPagerWindow({
    page,
    pageSize: FINANCE_LIST_PAGE_SIZE,
    totalCount: filtered.length,
  });
  const pageRows = useMemo(
    () =>
      filtered.slice(
        (pageWindow.safePage - 1) * FINANCE_LIST_PAGE_SIZE,
        pageWindow.safePage * FINANCE_LIST_PAGE_SIZE,
      ),
    [filtered, pageWindow.safePage],
  );

  const pending =
    readyQuery.isPending || statementsQuery.isPending;
  const failedQueries = [readyQuery, statementsQuery].filter(queryLoadFailed);

  const selectParty = (p: FinanceCostParty) => {
    onSelectParty(
      p.assigneeId,
      p.pendingLines > 0
        ? "dues"
        : p.openStatements > 0
          ? "statements"
          : "dues",
    );
  };

  return (
    <div>
      <p className={cn(opsTfNote, "mb-3.5")}>
        المستحقون المسجّلون لدى المالية — موردون خارجيون وموظفون لهم أتعاب على
        المعاملات والمهام. اضغط الاسم للدخول على تفاصيله المالية.
      </p>

      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <div className={cn(finSearch, "ms-0 max-w-none flex-1")}>
          <SearchIcon />
          <input
            className={opsSearchInput}
            placeholder="بحث باسم المستحق أو رقمه"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="بحث المستحقين"
          />
        </div>
        <span className={cn(finMuted, "text-[11.5px]")}>
          {failedQueries.length ? "—" : filtered.length} مستحق مسجّل
        </span>
      </div>

      {pending ? (
        <div className={opsLetterCard}>
          <EmptyState panel line="جاري التحميل…" />
        </div>
      ) : failedQueries.length ? (
        <div className={opsLetterCard}>
          <QueryErrorState
            panel
            line="تعذّر تحميل المستحقين"
            error={failedQueries[0]!.error}
            onRetry={() => {
              for (const q of failedQueries) void q.refetch();
            }}
            retrying={failedQueries.some((q) => q.isFetching)}
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className={opsLetterCard}>
          <EmptyState
            panel
            line="لا مستحقين مطابقين"
            hint="تظهر هنا الجهات التي لها مستحقات أو مسيرات صرف."
          />
        </div>
      ) : (
        <>
        {/* Phones: one tappable card per payee — the 8-column table ran off-screen. */}
        <MobileRecordList className="lg:hidden">
          {pageRows.map((p) => (
            <MobileRecordCard
              key={p.assigneeId}
              tone={p.pendingLines > 0 ? "gold" : undefined}
              onOpen={() => selectParty(p)}
              title={p.name}
              subtitle={
                <bdi dir="ltr" className="text-[11px] font-bold">
                  {p.assigneeId.slice(0, 10)}
                </bdi>
              }
              status={<PayeeChip party={p} />}
              fields={[
                {
                  label: "مستحق له",
                  ltr: true,
                  value: fmtSar(p.balanceSar, { trim: true }),
                },
                { label: "مستحقات قائمة", value: <PartyOpenDues party={p} /> },
                {
                  label: "المهمة",
                  value: (
                    <StatusPill label={p.taskKindLabel} style={finStatusStyle("default")} />
                  ),
                },
                { label: "الجوال", ltr: true, value: "—" },
              ]}
            />
          ))}
        </MobileRecordList>
        <TableFrame className="max-lg:hidden">
          <Table>
            <THead>
              <Tr hoverable={false}>
                <Th>الرقم</Th>
                <Th>الاسم</Th>
                <Th className="text-center">الصفة</Th>
                <Th className="text-center">المهمة</Th>
                <Th className="text-center">الجوال</Th>
                <Th className="text-center">مستحق له</Th>
                <Th className="text-center">مستحقات قائمة</Th>
                <Th className="w-8 text-center" aria-hidden />
              </Tr>
            </THead>
            <TBody>
              {pageRows.map((p) => (
                <Tr
                  key={p.assigneeId}
                  className="cursor-pointer"
                  onClick={() => selectParty(p)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      selectParty(p);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                >
                  <TdLtr valueClassName="text-[11px] font-bold text-text-2">
                    {p.assigneeId.slice(0, 10)}
                  </TdLtr>
                  <Td>
                    <span className="text-[13px] font-bold text-heading">
                      {p.name}
                    </span>
                  </Td>
                  <Td className="text-center">
                    <PayeeChip party={p} />
                  </Td>
                  <Td className="text-center">
                    <StatusPill label={p.taskKindLabel} style={finStatusStyle("default")} />
                  </Td>
                  <TdLtr className="text-center" valueClassName="text-[13px] text-text-2">
                    —
                  </TdLtr>
                  <TdLtr
                    className="text-center"
                    valueClassName="text-[14px] font-extrabold text-heading"
                  >
                    {fmtSar(p.balanceSar, { trim: true })}
                  </TdLtr>
                  <Td className="text-center">
                    <PartyOpenDues party={p} />
                  </Td>
                  <Td className="text-center">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="text-text-3"
                      aria-hidden
                    >
                      <path
                        d="M15 18l-6-6 6-6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </TableFrame>
        </>
      )}
      {!pending && filtered.length > 0 ? (
        <ListPager
          page={pageWindow.safePage}
          pageSize={FINANCE_LIST_PAGE_SIZE}
          totalCount={filtered.length}
          totalPages={pageWindow.totalPages}
          onPageChange={setPage}
        />
      ) : null}
    </div>
  );
}
