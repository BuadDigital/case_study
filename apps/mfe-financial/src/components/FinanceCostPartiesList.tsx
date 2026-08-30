"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fmtMax } from "@platform/app-shared/format/number";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import {
  loadPartyBillingReadyLines,
  loadPartyBillingStatements,
} from "@platform/app-shared/prototype/party-billing-statements-api";
import { useStaffUsersQuery } from "@settings/mfe/query/settings-queries";
import type { StaffUser } from "@platform/app-shared/prototype/constants";
import {
  EmptyState,
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
  opsLetterCard,
  opsSearchInput,
  opsTfNote,
} from "@platform/ui-kit";
import {
  buildFinanceCostParties,
  type FinanceCostParty,
} from "../lib/finance-cost-parties";
import {
  finMuted,
  finRowActive,
  finSearch,
  finSearchIcon,
} from "../lib/finance-tw";

const EMPTY_STAFF_USERS: StaffUser[] = [];

// SAR suffix without forced fractional zeros — keep local to preserve the same display.
function fmtSar(n: number) {
  return `${fmtMax(n)} ر.س`;
}

function SearchIcon() {
  return (
    <svg
      className={finSearchIcon}
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M20 20l-3.5-3.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PayeeChip({ party }: { party: FinanceCostParty }) {
  const isInd = party.payeeType === "individual";
  return (
    <StatusPill
      label={party.payeeTypeLabel || (isInd ? "فرد" : "مورّد")}
      style={finStatusStyle(isInd ? "individual" : "default")}
    />
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

  const readyQuery = useQuery({
    queryKey: [...prototypeKeys.all, "party-billing", "ready-lines", "parties"],
    queryFn: () => loadPartyBillingReadyLines(),
    staleTime: 20_000,
  });
  const statementsQuery = useQuery({
    queryKey: [...prototypeKeys.all, "party-billing", "statements", "parties"],
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

  const pending =
    readyQuery.isPending || statementsQuery.isPending;

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
          {filtered.length} مستحق مسجّل
        </span>
      </div>

      {pending ? (
        <div className={opsLetterCard}>
          <EmptyState panel line="جاري التحميل…" />
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
        <TableFrame>
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
              {filtered.map((p) => (
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
                    {fmtSar(p.balanceSar)}
                  </TdLtr>
                  <Td className="text-center">
                    {p.pendingLines > 0 ? (
                      <span className="inline-flex items-center gap-1.5 text-[11.5px] font-bold text-[#8a5e14]">
                        <span className="h-[7px] w-[7px] rounded-full bg-[#d9a441]" />
                        {p.pendingLines} بند جاهز
                      </span>
                    ) : p.openStatements > 0 ? (
                      <span className="inline-flex items-center gap-1.5 text-[11.5px] font-bold text-[#1f3a5f]">
                        <span className="h-[7px] w-[7px] rounded-full bg-[#102B4E]" />
                        {p.openStatements} مسير/أمر
                      </span>
                    ) : (
                      <span className="text-[11.5px] text-text-3">مسوّى</span>
                    )}
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
      )}
    </div>
  );
}
