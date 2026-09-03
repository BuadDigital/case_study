"use client";

/**
 * Inspector dues inside profile — ready-lines + statements (individual).
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { dmy } from "@platform/app-shared/format/date";
import { fmtMax } from "@platform/app-shared/format/number";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import {
  loadPartyBillingReadyLines,
  loadPartyBillingStatements,
} from "@platform/app-shared/app-data/party-billing-statements-api";
import type {
  PartyBillingReadyLineDto,
  PartyBillingStatementDto,
} from "@platform/api-client";
import type { StaffUser } from "@platform/app-shared/app-data/constants";
import {
  Badge,
  Spinner,
  Table,
  TBody,
  Td,
  TdLtr,
  Th,
  THead,
  Tr,
} from "@platform/ui-kit";

type DueSt = "due" | "instmt" | "paid";

type DueLine = {
  id: string;
  ref: string;
  detail: string;
  atIso: string | null;
  amount: number;
  st: DueSt;
};

// Default toLocaleString = up to 3 decimals without forced zeros — keep the same display.
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
  user: StaffUser,
  hasBillingNumbers: boolean,
): boolean {
  if (hasBillingNumbers) return true;
  if (user.inspectorType === "employee") return false;
  return true;
}

function buildLines(
  ready: PartyBillingReadyLineDto[],
  statements: PartyBillingStatementDto[],
  assigneeId: string,
): DueLine[] {
  const rows: DueLine[] = [];
  const aid = assigneeId.trim();

  for (const line of ready) {
    if (!isFieldInspectionLine(line.taskKind)) continue;
    if (line.payeeType === "vendor") continue;
    if ((line.assigneeId ?? "").trim() !== aid) continue;
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
      ref,
      detail: parts.join(" · ") || "جاهز للصرف",
      atIso: line.accruedAtUtc ?? line.updatedAtUtc,
      amount: line.netFeeSar || 0,
      st: "due",
    });
  }

  for (const s of statements) {
    if (!isInspectorStatement(s)) continue;
    if (s.status === "cancelled") continue;
    if ((s.assigneeId ?? "").trim() !== aid) continue;
    const st: DueSt = s.status === "closed" ? "paid" : "instmt";
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
        ref,
        detail: parts.join(" · "),
        atIso: s.issuedAtUtc ?? s.closedAtUtc ?? s.createdAtUtc,
        amount: line.netFeeSar || 0,
        st,
      });
    }
  }

  return rows.sort((a, b) => {
    const ta = a.atIso ?? "";
    const tb = b.atIso ?? "";
    return tb.localeCompare(ta);
  });
}

const ST_LABEL: Record<DueSt, string> = {
  due: "مستحق",
  instmt: "في أمر صرف",
  paid: "مدفوع",
};

const ST_TONE: Record<DueSt, "default" | "warning" | "success"> = {
  due: "default",
  instmt: "warning",
  paid: "success",
};

export function ProfileInspectorDuesPanel({ user }: { user: StaffUser }) {
  const assigneeId = (user.distributionAssigneeId ?? "").trim();

  const readyQuery = useQuery({
    queryKey: [
      ...appDataKeys.all,
      "party-billing",
      "ready-lines",
      "profile-inspector",
      assigneeId || "none",
    ],
    queryFn: () => loadPartyBillingReadyLines(assigneeId || undefined),
    staleTime: 20_000,
    enabled: Boolean(assigneeId),
  });

  const statementsQuery = useQuery({
    queryKey: [
      ...appDataKeys.all,
      "party-billing",
      "statements",
      "profile-inspector",
      assigneeId || "none",
    ],
    queryFn: () =>
      loadPartyBillingStatements({
        assigneeId: assigneeId || undefined,
        issuedOrLaterOnly: true,
      }),
    staleTime: 20_000,
    enabled: Boolean(assigneeId),
  });

  const pending = readyQuery.isPending || statementsQuery.isPending;

  const rows = useMemo(
    () =>
      assigneeId
        ? buildLines(
            readyQuery.data ?? [],
            statementsQuery.data ?? [],
            assigneeId,
          )
        : [],
    [readyQuery.data, statementsQuery.data, assigneeId],
  );

  const tracked = isTrackDuesEnabled(user, rows.length > 0);

  if (!assigneeId) {
    return (
      <p className="text-[12px] text-text-3">
        لا معرّف توزيع مرتبط بهذا الحساب — لا يمكن عرض المستحقات.
      </p>
    );
  }

  if (pending) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  }

  if (!tracked) {
    return (
      <div className="rounded-lg border border-border bg-surface-2 px-4 py-6 text-center">
        <div className="text-[13.5px] font-bold text-heading">
          لا مستحقات تُتابع على هذا النظام
        </div>
        <p className="mx-auto mt-1.5 max-w-[420px] text-[12px] leading-[1.8] text-text-3">
          متابعة مستحقات هذا المستخدم معطّلة، فتُدار أتعابه خارج النظام. يظهر
          الحساب هويةً فقط بلا أرقام.
        </p>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="text-[12px] text-text-3">لا بنود مستحقة حالياً.</p>
    );
  }

  return (
    <Table framed className="min-w-[560px]">
      <THead>
        <Tr hoverable={false}>
          <Th>المرجع</Th>
          <Th>تاريخ الاستحقاق</Th>
          <Th>المبلغ</Th>
          <Th>الحالة</Th>
        </Tr>
      </THead>
      <TBody>
        {rows.map((row) => (
          <Tr key={row.id}>
            <Td>
              <div className="flex flex-col gap-0.5">
                <span
                  dir="ltr"
                  className="inline-block text-start font-bold text-gold-d tabular-nums [unicode-bidi:isolate]"
                >
                  {row.ref}
                </span>
                <span className="text-[11px] text-text-3">{row.detail}</span>
              </div>
            </Td>
            <TdLtr bare>{dmy(row.atIso)}</TdLtr>
            <TdLtr bare valueClassName="font-extrabold tabular-nums">
              {money(row.amount)} ر.س
            </TdLtr>
            <Td>
              <Badge tone={ST_TONE[row.st]}>{ST_LABEL[row.st]}</Badge>
            </Td>
          </Tr>
        ))}
      </TBody>
    </Table>
  );
}
