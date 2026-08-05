"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import {
  loadPartyBillingReadyLines,
  loadPartyBillingStatements,
} from "@platform/app-shared/prototype/party-billing-statements-api";
import { useStaffUsersQuery } from "@settings/mfe/query/settings-queries";
import { cn } from "@platform/design-system";
import {
  buildFinanceCostParties,
  type FinanceCostParty,
} from "../lib/finance-cost-parties";
import {
  finCard,
  finEmpty,
  finEmptyS,
  finEmptyT,
  finMuted,
  finNote,
  finNum,
  finRow,
  finRowClickable,
  finScroll,
  finSearch,
  finSearchIcon,
  finSearchInput,
  finStatus,
  finStatusTeal,
  finTd,
  finTh,
  finThead,
} from "../lib/finance-tw";

function fmtSar(n: number) {
  return `${n.toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  })} ر.س`;
}

const grid =
  "min-w-[920px] grid-cols-[minmax(68px,0.5fr)_minmax(135px,1.5fr)_minmax(90px,0.6fr)_minmax(148px,1.1fr)_minmax(108px,0.85fr)_minmax(92px,0.72fr)_minmax(120px,0.75fr)_32px]";

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
    <span className={isInd ? finStatusTeal : finStatus}>
      {party.payeeTypeLabel || (isInd ? "فرد" : "مورّد")}
    </span>
  );
}

export function FinanceCostPartiesList({
  onSelectParty,
}: {
  onSelectParty: (assigneeId: string) => void;
}) {
  const [q, setQ] = useState("");
  const { data: staffResult } = useStaffUsersQuery();
  const staffUsers = staffResult?.users ?? [];

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
    const needle = q.trim().toLowerCase();
    if (!needle) return parties;
    return parties.filter(
      (p) =>
        p.name.toLowerCase().includes(needle) ||
        p.assigneeId.toLowerCase().includes(needle) ||
        p.taskKindLabel.toLowerCase().includes(needle),
    );
  }, [parties, q]);

  const pending =
    readyQuery.isPending || statementsQuery.isPending;

  return (
    <div>
      <p className={finNote}>
        المستحقون المسجّلون لدى المالية — موردون خارجيون وموظفون لهم أتعاب على
        المعاملات والمهام. اضغط الاسم للدخول على تفاصيله المالية.
      </p>

      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <div className={cn(finSearch, "ms-0 max-w-none flex-1")}>
          <SearchIcon />
          <input
            className={finSearchInput}
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
        <div className={finCard}>
          <div className={finEmpty}>
            <div className={finEmptyT}>جاري التحميل…</div>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className={finCard}>
          <div className={finEmpty}>
            <div className={finEmptyT}>لا مستحقين مطابقين</div>
            <div className={finEmptyS}>
              تظهر هنا الجهات التي لها مستحقات أو مسيرات صرف.
            </div>
          </div>
        </div>
      ) : (
        <div className={finCard}>
          <div className={finScroll}>
            <div className={cn(finThead, grid)}>
              {[
                "الرقم",
                "الاسم",
                "الصفة",
                "المهمة",
                "الجوال",
                "مستحق له",
                "مستحقات قائمة",
                "",
              ].map((h, i) => (
                <div
                  key={h || "chev"}
                  className={cn(
                    finTh,
                    i > 0 && "!justify-center !text-center",
                  )}
                >
                  {h}
                </div>
              ))}
            </div>
            {filtered.map((p) => (
              <div
                key={p.assigneeId}
                className={cn(finRow, grid, finRowClickable)}
                role="button"
                tabIndex={0}
                onClick={() => onSelectParty(p.assigneeId)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectParty(p.assigneeId);
                  }
                }}
              >
                <div className={finTd}>
                  <span
                    className="text-[11px] font-bold text-text-2"
                    dir="ltr"
                  >
                    {p.assigneeId.slice(0, 10)}
                  </span>
                </div>
                <div className={finTd}>
                  <span className="text-[13px] font-bold text-heading">
                    {p.name}
                  </span>
                </div>
                <div className={finTd}>
                  <PayeeChip party={p} />
                </div>
                <div className={finTd}>
                  <span className={finStatus}>{p.taskKindLabel}</span>
                </div>
                <div className={finTd}>
                  <span className={finMuted} dir="ltr">
                    —
                  </span>
                </div>
                <div className={finTd}>
                  <span className={finNum}>{fmtSar(p.balanceSar)}</span>
                </div>
                <div className={finTd}>
                  {p.pendingLines > 0 ? (
                    <span className="inline-flex items-center gap-1.5 text-[11.5px] font-bold text-[#8a5e14]">
                      <span className="h-[7px] w-[7px] rounded-full bg-[#d9a441]" />
                      {p.pendingLines} بند
                    </span>
                  ) : (
                    <span className="text-[11.5px] text-text-3">مسوّى</span>
                  )}
                </div>
                <div className={finTd}>
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
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
