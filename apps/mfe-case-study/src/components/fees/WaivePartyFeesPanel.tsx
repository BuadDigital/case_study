"use client";

/**
 * Supervisor: cancel one party's whole fee on a transaction (typically an operationally complete
 * one) in one step. Every line not yet in a statement, paid or withheld is discounted in full;
 * the rest stay for finance and are counted in the confirmation.
 */

import { useMemo, useState } from "react";
import {
  AppModal,
  Button,
  Label,
  cn,
  formControlClassName,
  useToast,
} from "@platform/ui-kit";
import type { InspectorFeeRowDto } from "@platform/api-client";
import { cancelPartyFeesOnTransaction } from "@platform/app-shared/app-data/inspector-fees-api";
import { resolvePartyName } from "@platform/app-shared/fees/party-fee-meta";
import { fmtSar } from "@platform/app-shared/format/number";
import { useStaffUsersQuery } from "@settings/mfe/query/settings-queries";

/**
 * Statuses a whole-transaction cancellation cannot touch (mirrors the server's
 * `IsEditableStatus`). Only used to preview the counts; the server decides for real.
 */
const LOCKED_STATUSES = new Set(["in-statement", "disb-req", "disbursed", "suspended"]);

type PartyOnTransaction = {
  key: string;
  poNumber: string;
  assigneeId: string;
  openCount: number;
  lockedCount: number;
  openNetSar: number;
};

/**
 * Groups the supervisor's fee rows by (PO, party) and counts what a cancellation would do.
 *
 * Edge cases: rows without a party or PO cannot be targeted and are skipped; a group whose open
 * lines are already at zero net (cancelled before) is hidden, so the picker only offers parties
 * that still have money to cancel.
 */
function groupPartiesOnTransactions(rows: InspectorFeeRowDto[]): PartyOnTransaction[] {
  const groups = new Map<string, PartyOnTransaction>();
  for (const row of rows) {
    const assigneeId = row.assigneeId?.trim();
    const poNumber = row.poNumber.trim();
    if (!assigneeId || !poNumber) continue;
    const key = `${poNumber}|${assigneeId}`;
    const group = groups.get(key) ?? {
      key,
      poNumber,
      assigneeId,
      openCount: 0,
      lockedCount: 0,
      openNetSar: 0,
    };
    if (LOCKED_STATUSES.has(row.billingStatus)) {
      group.lockedCount += 1;
    } else {
      group.openCount += 1;
      group.openNetSar += row.netFeeSar;
    }
    groups.set(key, group);
  }
  return [...groups.values()]
    .filter((g) => g.openCount > 0 && g.openNetSar > 0)
    .sort((a, b) => a.poNumber.localeCompare(b.poNumber, "ar"));
}

/**
 * The «إلغاء أتعاب طرف عن معاملة» button and its confirmation dialog.
 *
 * How it works: pick the (PO, party) pair, see how many lines will and will not be cancelled, give
 * a reason, confirm. The result toast reports the cancelled count and, when some lines were in a
 * statement or paid, how many stayed with finance.
 *
 * Renders nothing when no party has an open fee, so the button never leads to an empty picker.
 */
export function WaivePartyFeesPanel({
  rows,
  onDone,
}: {
  rows: InspectorFeeRowDto[];
  onDone: () => Promise<void>;
}) {
  const { showToast } = useToast();
  const { data: staffResult } = useStaffUsersQuery();
  const staffUsers = useMemo(() => staffResult?.users ?? [], [staffResult?.users]);
  const parties = useMemo(() => groupPartiesOnTransactions(rows), [rows]);

  const [open, setOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selected = parties.find((p) => p.key === selectedKey) ?? null;

  const close = () => {
    setOpen(false);
    setSelectedKey("");
    setReason("");
    setError(null);
  };

  const submit = async () => {
    if (!selected) {
      setError("اختر المعاملة والطرف.");
      return;
    }
    if (reason.trim().length < 3) {
      setError("سبب إلغاء الأتعاب إلزامي.");
      return;
    }
    setBusy(true);
    try {
      const result = await cancelPartyFeesOnTransaction(selected.poNumber, {
        assigneeId: selected.assigneeId,
        reason: reason.trim(),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const skipped = result.data.skipped.length;
      showToast(
        skipped > 0
          ? `أُلغيت ${result.data.waivedCount} بنود — بقي ${skipped} مدرج في كشف أو مصروف لدى المالية`
          : `أُلغيت أتعاب الطرف على المعاملة (${result.data.waivedCount} بنود)`,
        "success",
      );
      close();
      await onDone();
    } finally {
      setBusy(false);
    }
  };

  if (parties.length === 0) return null;

  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
          إلغاء أتعاب طرف عن معاملة
        </Button>
      </div>
      <AppModal
        open={open}
        title="إلغاء أتعاب طرف عن معاملة"
        subtitle="تُحسم الأتعاب كاملة على كل بنود الطرف في المعاملة، ويُبلَّغ الطرف بالسبب."
        onClose={close}
        footer={
          <>
            <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={close}>
              تراجع
            </Button>
            <Button
              type="button"
              size="sm"
              variant="primary"
              loading={busy}
              showActionToast={false}
              onClick={() => void submit()}
            >
              تأكيد الإلغاء
            </Button>
          </>
        }
      >
        <Label htmlFor="waive-party-select" className="text-xs">
          المعاملة والطرف <span className="text-danger-text">*</span>
        </Label>
        <select
          id="waive-party-select"
          className={cn(formControlClassName, "mt-1 mb-3 text-sm")}
          value={selectedKey}
          onChange={(e) => {
            setSelectedKey(e.target.value);
            setError(null);
          }}
        >
          <option value="">— اختر —</option>
          {parties.map((p) => (
            <option key={p.key} value={p.key}>
              {p.poNumber} — {resolvePartyName(p.assigneeId, staffUsers)}
            </option>
          ))}
        </select>
        {selected ? (
          <p className="mt-0 mb-3 text-xs text-text-2">
            سيُلغى {selected.openCount} بند (
            {fmtSar(selected.openNetSar, { digits: 3, trim: true })})
            {selected.lockedCount > 0
              ? ` · لن يُلغى ${selected.lockedCount} بند مدرج في كشف أو مصروف أو موقوف — يبقى للمالية`
              : ""}
            .
          </p>
        ) : null}
        <Label htmlFor="waive-party-reason" className="text-xs">
          سبب الإلغاء <span className="text-danger-text">*</span>
        </Label>
        <textarea
          id="waive-party-reason"
          className={cn(formControlClassName, "mt-1 min-h-[72px] text-xs")}
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            setError(null);
          }}
          placeholder="مثال: لم يُنجز العمل المطلوب في المعاملة…"
        />
        {error ? <p className="mt-1 mb-0 text-xs text-danger-text">{error}</p> : null}
      </AppModal>
    </>
  );
}
