"use client";

/** Party billing statement parts — module-level helpers, moved literally (SRP). */

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fmtMax } from "@platform/app-shared/format/number";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import {
  loadPartyBillingReadyLines,
  loadPartyBillingStatements,
  openPartyBillingAttachment,
  runCancelPartyBillingStatement,
  runClosePartyBillingStatement,
  runCreatePartyBillingStatement,
  runIssuePartyBillingStatement,
  runMatchVendorInvoice,
  runRejectVendorInvoice,
  uploadPartyBillingTransferReceipt,
} from "@platform/app-shared/prototype/party-billing-statements-api";
import { resolvePartyName } from "@platform/app-shared/fees/party-fee-meta";
import { useStaffUsersQuery } from "@settings/mfe/query/settings-queries";
import { Input, cn, useToast } from "@platform/ui-kit";
import type {
  PartyBillingReadyLineDto,
  PartyBillingStatementDto,
} from "@platform/api-client";
import { pushNotification } from "@platform/app-shared/notifications/notification-store";
import {
  applyCostTax,
  daysSinceIsoCost,
  lineRefMain,
  lineRefSub,
  partyBillingWorkflowLabel,
  partyBillingWorkflowTone,
  statementDisplayTotal,
} from "../lib/finance-cost-parties";
import {
  finCard,
  finCheck,
  finEmpty,
  finEmptyS,
  finEmptyT,
  finFld,
  finGhost,
  finGridDues,
  finGridStmtLines,
  finGridStmts,
  finGroupHead,
  finMuted,
  finPrimary,
  finRow,
  finRowActive,
  finRowClickable,
  finScroll,
  finScrollY,
  finSearch,
  finSearchIcon,
  finSearchInput,
  finSectionTitle,
  finStatusFor,
  finStatusTeal,
  finTd,
  finTh,
  finThead,
  finWorkFlush,
  finWorkHead,
  finWorkTitle,
} from "../lib/finance-tw";
import { FinanceReceiptUploadField } from "./FinanceReceiptUploadField";

export const EMPTY_READY_LINES: PartyBillingReadyLineDto[] = [];
export const EMPTY_STATEMENTS: PartyBillingStatementDto[] = [];

// SAR suffix without forced fractional zeros — keep local to preserve the same display.
export function formatSar(n: number) {
  return `${fmtMax(n)} ر.س`;
}

export function formatInvoiceDate(raw: string | null | undefined): string {
  if (!raw?.trim()) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw.trim();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Data cell: label above, value below — does not stretch to screen width */
export function MetaCell({
  label,
  value,
  ltr,
  emphasize,
}: {
  label: string;
  value: string;
  ltr?: boolean;
  emphasize?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-[9px] border border-border bg-surface px-3 py-2.5">
      <div className="mb-1 text-[10.5px] font-medium text-text-3">{label}</div>
      <div
        className={cn(
          "truncate text-[13px] font-bold text-heading",
          emphasize && "text-[15px] font-extrabold",
        )}
        dir={ltr ? "ltr" : undefined}
        title={value}
      >
        {value}
      </div>
    </div>
  );
}

export type PartyBillingMode = "all" | "dues" | "statements" | "paid";
