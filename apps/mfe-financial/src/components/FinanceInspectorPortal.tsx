"use client";

/**
 * بوابة المعاين — full stack (ready-lines + statements).
 * Tailwind فقط (finance-tw) — بلا CSS/style objects.
 */

import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { dmy } from "@platform/app-shared/format/date";
import { fmtMax } from "@platform/app-shared/format/number";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import {
  buildAssigneeStaffIndex,
  resolvePartyName,
} from "@platform/app-shared/fees/party-fee-meta";
import {
  loadPartyBillingReadyLines,
  loadPartyBillingStatements,
} from "@platform/app-shared/prototype/party-billing-statements-api";
import type {
  PartyBillingReadyLineDto,
  PartyBillingStatementDto,
} from "@platform/api-client";
import { useStaffUsersQuery } from "@settings/mfe/query/settings-queries";
import type { StaffUser } from "@platform/app-shared/prototype/constants";
import { getFieldInspectors } from "@case-study/mfe/lib/distribution-assignees";
import { cn } from "@platform/ui-kit";
import {
  finCard,
  finEmpty,
  finEmptyT,
  finMuted,
  finNote,
  finNum,
  finSel,
  finSelCtrl,
  finCaret,
  finStatus,
  finStatusGold,
  finStatusGreen,
  finThead,
  finTh,
  finRow,
  finTd,
} from "../lib/finance-tw";

type PortalLine = {
  id: string;
  assigneeId: string;
  assigneeName: string;
  ref: string;
  refKind: string;
  atIso: string | null;
  amount: number;
  st: "due" | "instmt" | "paid";
};

const EMPTY_STAFF_USERS: StaffUser[] = [];

const COST_ST: Record<PortalLine["st"], { t: string; cls: string }> = {
  due: { t: "مستحق", cls: finStatus },
  instmt: { t: "في أمر صرف", cls: finStatusGold },
  paid: { t: "مدفوع", cls: finStatusGreen },
};

const cols =
  "min-w-[720px] grid-cols-[minmax(180px,1.6fr)_minmax(120px,0.9fr)_minmax(110px,0.9fr)_minmax(130px,1fr)]";

// toLocaleString الافتراضي = حتى 3 كسور دون أصفار إلزامية — نحافظ على العرض نفسه.
function money(n: number) {
  return fmtMax(Number(n || 0), 3);
}

function isFieldInspectionLine(taskKind: string | null | undefined) {
  return !taskKind || taskKind === "field-inspection";
}

function isInspectorStatement(s: PartyBillingStatementDto): boolean {
  if (s.payeeType === "vendor") return false;
  if (s.taskKind && s.taskKind !== "field-inspection") return false;
  return true;
}

function isTrackDuesEnabled(
  staff: StaffUser | undefined,
  hasBillingNumbers: boolean,
): boolean {
  if (hasBillingNumbers) return true;
  if (staff?.inspectorType === "employee") return false;
  return true;
}

function buildInspectorPortalLines(input: {
  readyLines: PartyBillingReadyLineDto[];
  statements: PartyBillingStatementDto[];
  staffUsers: StaffUser[];
}): PortalLine[] {
  const rows: PortalLine[] = [];

  for (const line of input.readyLines) {
    if (!isFieldInspectionLine(line.taskKind)) continue;
    if (line.payeeType === "vendor") continue;
    const assigneeId = line.assigneeId?.trim() || "—";
    const label = (line.propertyLabel || "").trim();
    const ref =
      label.split("—")[0]?.trim() ||
      line.poNumber ||
      line.workflowTaskId ||
      "—";
    const parts: string[] = [];
    if (line.poNumber) parts.push(line.poNumber);
    const after = label.includes("—")
      ? label.split("—").slice(1).join("—").trim()
      : "";
    if (after) parts.push(after);
    rows.push({
      id: `ready-${line.workflowTaskId}`,
      assigneeId,
      assigneeName: resolvePartyName(assigneeId, input.staffUsers),
      ref,
      refKind: parts.join(" · ") || "جاهز للصرف",
      atIso: line.accruedAtUtc ?? line.updatedAtUtc,
      amount: line.netFeeSar || 0,
      st: "due",
    });
  }

  for (const s of input.statements) {
    if (!isInspectorStatement(s)) continue;
    if (s.status === "cancelled") continue;
    const st: PortalLine["st"] = s.status === "closed" ? "paid" : "instmt";
    const assigneeId = s.assigneeId?.trim() || "—";
    const assigneeName = resolvePartyName(assigneeId, input.staffUsers);
    for (const line of s.lines) {
      const label = (line.propertyLabel || "").trim();
      const ref =
        label.split("—")[0]?.trim() ||
        line.poNumber ||
        line.workflowTaskId ||
        s.referenceNumber;
      const parts: string[] = [];
      if (line.poNumber) parts.push(line.poNumber);
      parts.push(s.referenceNumber);
      rows.push({
        id: `stmt-${line.id}`,
        assigneeId,
        assigneeName,
        ref,
        refKind: parts.join(" · "),
        atIso: s.issuedAtUtc ?? s.closedAtUtc ?? s.createdAtUtc,
        amount: line.netFeeSar || 0,
        st,
      });
    }
  }

  return rows.sort((a, b) => {
    const ta = a.atIso ?? "";
    const tb = b.atIso ?? "";
    if (ta !== tb) return tb.localeCompare(ta);
    return a.assigneeName.localeCompare(b.assigneeName, "ar");
  });
}

function Pill({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-md px-[11px] py-1 text-[12px] font-bold",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function FinanceInspectorPortal({
  focusPartyId,
  onFocusParty,
}: {
  focusPartyId?: string | null;
  onFocusParty?: (assigneeId: string | null) => void;
} = {}) {
  const { data: staffResult } = useStaffUsersQuery();
  const staffUsers = staffResult?.users ?? EMPTY_STAFF_USERS;
  const staffByAssignee = useMemo(
    () => buildAssigneeStaffIndex(staffUsers),
    [staffUsers],
  );

  const readyQuery = useQuery({
    queryKey: [
      ...prototypeKeys.all,
      "party-billing",
      "ready-lines",
      "inspector-portal",
    ],
    queryFn: () => loadPartyBillingReadyLines(),
    staleTime: 20_000,
  });

  const statementsQuery = useQuery({
    queryKey: [
      ...prototypeKeys.all,
      "party-billing",
      "statements",
      "inspector-portal",
    ],
    queryFn: () => loadPartyBillingStatements({ issuedOrLaterOnly: true }),
    staleTime: 20_000,
  });

  const pending = readyQuery.isPending || statementsQuery.isPending;

  const allRows = useMemo(
    () =>
      buildInspectorPortalLines({
        readyLines: readyQuery.data ?? [],
        statements: statementsQuery.data ?? [],
        staffUsers,
      }),
    [readyQuery.data, statementsQuery.data, staffUsers],
  );

  const inspectors = useMemo(() => {
    const fromStaff = getFieldInspectors(staffUsers).map((a) => ({
      id: a.id,
      name: a.name,
    }));
    const map = new Map<string, string>();
    for (const p of fromStaff) map.set(p.id, p.name);
    for (const r of allRows) {
      if (r.assigneeId && r.assigneeId !== "—") {
        if (!map.has(r.assigneeId)) map.set(r.assigneeId, r.assigneeName);
      }
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "ar"));
  }, [staffUsers, allRows]);

  const [localParty, setLocalParty] = useState("");
  const selectedId =
    (focusPartyId?.trim() || localParty || inspectors[0]?.id || "").trim();

  const setSelected = (id: string) => {
    if (onFocusParty) onFocusParty(id || null);
    else setLocalParty(id);
  };

  const partyRows = useMemo(
    () =>
      selectedId
        ? allRows.filter((r) => r.assigneeId === selectedId)
        : allRows,
    [allRows, selectedId],
  );

  const staff = selectedId ? staffByAssignee.get(selectedId) : undefined;
  const tracked = isTrackDuesEnabled(staff, partyRows.length > 0);
  const headerName = selectedId
    ? resolvePartyName(selectedId, staffUsers)
    : "المعاين";
  const empty = !pending && tracked && partyRows.length === 0;

  return (
    <div data-screen-label="بوابة المعاين">
      <p className={cn(finNote, "leading-[1.8]")}>
        بوابة المعاين —{" "}
        <b className="font-bold text-[#102B4E]">لبيان أثر المالية فقط</b>.
        المعاين مستحق بصفة «فرد»: لا فاتورة ولا مسير مورّد، ويُصرف له بأمر صرف
        مباشر. وإن كانت متابعة مستحقاته معطّلة فلا تظهر أرقام لأنها تُدار خارج
        النظام.
      </p>

      {inspectors.length > 1 ? (
        <label className="mb-3 flex max-w-xs flex-col gap-1.5">
          <span className="text-[12px] font-semibold text-text-2">المعاين</span>
          <div className={finSel}>
            <select
              className={cn(finSelCtrl, "w-full min-w-0")}
              value={selectedId}
              onChange={(e) => setSelected(e.target.value)}
            >
              {inspectors.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <span className={finCaret} aria-hidden>
              ▾
            </span>
          </div>
        </label>
      ) : null}

      <div
        className={cn(
          finCard,
          "mb-3.5 flex flex-wrap items-center gap-3 px-[18px] py-3.5",
        )}
      >
        <span className="text-[14.5px] font-extrabold text-[#102B4E]">
          {headerName}
        </span>
        <Pill className="bg-[color-mix(in_srgb,#0f766e_13%,transparent)] text-[#0f766e]">
          المعاين
        </Pill>
        <Pill className="border border-border-md bg-surface-2 text-text-2">
          فرد
        </Pill>
        <span className="ms-auto">
          <Pill
            className={
              tracked
                ? "bg-[color-mix(in_srgb,#3f8f5f_13%,transparent)] text-[#3f8f5f]"
                : "bg-[color-mix(in_srgb,#8a8d96_13%,transparent)] text-[#8a8d96]"
            }
          >
            {tracked
              ? "متابعة المستحقات مفعّلة"
              : "متابعة المستحقات معطّلة"}
          </Pill>
        </span>
      </div>

      {pending ? (
        <div
          className={cn(
            finCard,
            "py-10 text-center text-[13px] text-text-3",
          )}
        >
          جاري تحميل المستحقات…
        </div>
      ) : !tracked ? (
        <div className={cn(finCard, "px-6 py-[26px] text-center")}>
          <div className="mb-1.5 text-[13.5px] font-bold text-[#102B4E]">
            لا مستحقات تُتابع على هذا النظام
          </div>
          <p className="mx-auto max-w-[420px] text-[12px] leading-[1.9] text-text-3">
            متابعة مستحقات هذا المستخدم معطّلة، فتُدار أتعابه خارج النظام. يظهر
            حسابه لدى المالية هويةً فقط بلا أرقام.
          </p>
        </div>
      ) : (
        <div className={finCard}>
          <div className="overflow-x-auto">
            <div className="w-max min-w-full">
              <div className={cn(finThead, cols)}>
                {(
                  [
                    ["المرجع", true],
                    ["تاريخ الاستحقاق", false],
                    ["المبلغ", false],
                    ["الحالة", false],
                  ] as const
                ).map(([h, start]) => (
                  <div
                    key={h}
                    className={cn(
                      finTh,
                      !start && "!justify-center !text-center",
                    )}
                  >
                    {h}
                  </div>
                ))}
              </div>

              {partyRows.map((l) => {
                const st = COST_ST[l.st];
                return (
                  <div key={l.id} className={cn(finRow, cols)}>
                    <div className={cn(finTd, "!justify-start !text-start")}>
                      <div className="flex flex-col items-start gap-0.5">
                        <span
                          dir="ltr"
                          className="whitespace-nowrap text-[12.5px] font-bold text-gold-d"
                        >
                          {l.ref}
                        </span>
                        <span className="text-[11px] text-text-3">
                          {l.refKind}
                        </span>
                      </div>
                    </div>
                    <div className={finTd}>
                      <span className={cn(finMuted, "whitespace-nowrap")} dir="ltr">
                        {dmy(l.atIso)}
                      </span>
                    </div>
                    <div className={finTd}>
                      <span className={finNum}>
                        {money(l.amount)}{" "}
                        <span className="text-[12px] font-semibold text-text-2">
                          ر.س
                        </span>
                      </span>
                    </div>
                    <div className={finTd}>
                      <span className={st.cls}>{st.t}</span>
                    </div>
                  </div>
                );
              })}

              {empty ? (
                <div className={finEmpty}>
                  <div className={finEmptyT}>لا بنود مستحقة</div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
