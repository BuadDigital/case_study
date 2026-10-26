"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AppModal, Button, cn, Note, useToast } from "@platform/ui-kit";
import { RegField, RegTextarea } from "@platform/app-shared/registration/FormFields";
import {
  mergeTransactions,
  searchTransactionDeeds,
  type TransactionDeedSearchHitDto,
  type TransactionDetailDto,
  type TransactionLinkKind,
} from "@platform/api-client";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import { notifyWorkOrdersChanged, workOrdersApiConfig } from "../../lib/work-orders-api-config";
import { formatPoDisplay } from "../../lib/app-data/po-intake-data";
import { transactionDeedLabel } from "./TransactionDeedSwitcher";

// The two link kinds: one building over several deeds is valued once; deeds bound by one
// contract are valued one by one, then summed.
const LINK_KINDS: { value: TransactionLinkKind; label: string; hint: string }[] = [
  { value: "one_building", label: "مبنى واحد على عدة صكوك", hint: "قيمة واحدة للمبنى كله" },
  { value: "contract", label: "أعيان مرتبطة بعقد", hint: "قيمة لكل عين ثم المجموع" },
];

const kindPill = (selected: boolean) =>
  cn(
    "flex cursor-pointer flex-col items-start gap-0.5 rounded-[var(--radius-DEFAULT)] border-2 px-3 py-2 text-start font-[inherit] transition-all",
    selected
      ? "border-primary bg-primary text-white"
      : "border-border bg-surface text-text-2 hover:border-primary-light hover:text-primary",
  );

/**
 * Refreshes everything that shows the transaction after a merge / unmerge.
 *
 * How it works: invalidates every transaction query and every transaction timeline (any
 * property id), the PO list, the work-order DTOs, and the PO record of each number in
 * `poNumbers`; then fires `notifyWorkOrdersChanged()` so screens listening for work-order
 * events reload too.
 *
 * Edge cases: callers pass the POs of BOTH sides (the holder transaction's deeds and the
 * merged-in / taken-out ones), because a merge changes deeds that live on other work orders.
 */
export function invalidateTransactionViews(
  queryClient: ReturnType<typeof useQueryClient>,
  poNumbers: string[],
) {
  void queryClient.invalidateQueries({ queryKey: [...appDataKeys.all, "transaction"] });
  void queryClient.invalidateQueries({ queryKey: [...appDataKeys.all, "transaction-timeline"] });
  void queryClient.invalidateQueries({ queryKey: appDataKeys.poRecords() });
  void queryClient.invalidateQueries({ queryKey: appDataKeys.workOrderDtos() });
  for (const po of poNumbers) {
    void queryClient.invalidateQueries({ queryKey: appDataKeys.poRecord(po) });
  }
  notifyWorkOrdersChanged();
}

/**
 * The «دمج معاملات مرتبطة» dialog: the case-study specialist joins other deeds' transactions
 * into this one (decision 2026-10-19).
 *
 * How it works: search by deed, registry or PO number → pick hits (one per transaction) →
 * choose the link kind (one_building / contract; preset from the transaction's own kind) →
 * write a reason of at least 5 characters → «دمج». This transaction keeps its number; the
 * picked transactions are folded into it with all their deeds.
 *
 * Edge cases: the server refuses deeds that are not ready and says why on each hit (shown in
 * red, not selectable). Stage rule corrected 2026-10-21: the first gate required every deed's
 * inspection submitted/accepted; now the only condition is finished intake
 * (`BourseDataCompleted`), so a merge can come before distribution.
 */
export function TransactionMergeDialog({
  open,
  transaction,
  onClose,
  onMerged,
}: {
  open: boolean;
  transaction: TransactionDetailDto;
  onClose: () => void;
  onMerged: (next: TransactionDetailDto) => void;
}) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [hits, setHits] = useState<TransactionDeedSearchHitDto[]>([]);
  const [searched, setSearched] = useState(false);
  const [selected, setSelected] = useState<Map<string, TransactionDeedSearchHitDto>>(new Map());
  const [linkKind, setLinkKind] = useState<TransactionLinkKind | "">(
    (transaction.linkKind as TransactionLinkKind | null | undefined) ?? "",
  );
  const [reason, setReason] = useState("");
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const picked = useMemo(() => [...selected.values()], [selected]);
  // A picked deed brings its whole transaction, so count deeds, not picks.
  const incomingDeeds = picked.reduce((n, h) => n + Math.max(1, h.transactionDeedCount), 0);
  const canMerge = picked.length > 0 && Boolean(linkKind) && reason.trim().length >= 5 && !merging;

  if (!open) return null;

  /**
   * Looks up deeds to merge for the typed number.
   *
   * How it works: trims the query, calls `searchTransactionDeeds(transaction.id, q)` and shows
   * the hits; each hit carries its transaction, deed count and, when it cannot be merged, the
   * server's Arabic reason (`blockedReasonAr`).
   *
   * Edge cases: fewer than 3 characters (or no API config) shows a hint and sends nothing; a
   * failed search clears the old hits and shows the server's message.
   */
  async function search() {
    const config = workOrdersApiConfig();
    const q = query.trim();
    if (!config || q.length < 3) {
      setError("أدخل ثلاثة أحرف على الأقل من رقم الصك أو السجل أو أمر العمل");
      return;
    }
    setSearching(true);
    setError(null);
    try {
      const res = await searchTransactionDeeds(config, transaction.id, q);
      setSearched(true);
      if (!res.ok) {
        setHits([]);
        setError(res.message ?? "تعذّر البحث عن الصكوك");
        return;
      }
      setHits(res.data);
    } finally {
      setSearching(false);
    }
  }

  /**
   * Picks or unpicks a search hit.
   *
   * How it works: a picked hit is removed; a new hit replaces any picked hit of the same
   * transaction; otherwise it is added. `selected` is keyed by property id.
   *
   * Edge cases: a blocked hit cannot be picked; one pick per transaction is enough because a
   * deed brings its whole transaction, so two picks there would double-count the deeds.
   */
  function toggle(hit: TransactionDeedSearchHitDto) {
    if (hit.blockedReasonAr) return;
    setSelected((prev) => {
      const next = new Map(prev);
      // One pick per transaction is enough: a deed brings its whole transaction.
      const sameTransaction = [...next.values()].find((h) => h.transactionId === hit.transactionId);
      if (next.has(hit.propertyId)) next.delete(hit.propertyId);
      else if (sameTransaction) {
        next.delete(sameTransaction.propertyId);
        next.set(hit.propertyId, hit);
      } else next.set(hit.propertyId, hit);
      return next;
    });
  }

  /**
   * Sends the merge.
   *
   * How it works: calls `mergeTransactions(transaction.id, { propertyIds, linkKind, reason })`
   * with the picked property ids and the trimmed reason; on success refreshes the views of both
   * sides' POs (`invalidateTransactionViews`), toasts the incoming deed count, hands the new
   * transaction to `onMerged` and closes.
   *
   * Edge cases: does nothing unless `canMerge` (a pick, a link kind, a 5+ character reason, not
   * already merging); a refusal stays in the dialog as a note and a toast; the dialog cannot be
   * closed by its × while the merge runs.
   */
  async function merge() {
    const config = workOrdersApiConfig();
    if (!config || !canMerge || !linkKind) return;
    setMerging(true);
    setError(null);
    try {
      const res = await mergeTransactions(config, transaction.id, {
        propertyIds: picked.map((h) => h.propertyId),
        linkKind,
        reason: reason.trim(),
      });
      if (!res.ok) {
        const message = res.message ?? "تعذّر دمج المعاملات";
        setError(message);
        showToast(message, "error");
        return;
      }
      invalidateTransactionViews(queryClient, [
        ...transaction.deeds.map((d) => d.poNumber),
        ...picked.map((h) => h.poNumber),
      ]);
      showToast(`ضُمّت ${incomingDeeds} صكوك إلى المعاملة ${transaction.displayNumber}`, "success");
      onMerged(res.data);
      onClose();
    } finally {
      setMerging(false);
    }
  }

  return (
    <AppModal
      open
      wide
      title="دمج معاملات مرتبطة"
      subtitle={`المعاملة الجامعة ${transaction.displayNumber} — تبقى برقمها وتُضم إليها صكوك المعاملات المختارة`}
      onClose={() => {
        if (!merging) onClose();
      }}
      footer={
        <>
          <Button type="button" variant="default" onClick={onClose} disabled={merging}>
            إلغاء
          </Button>
          <Button
            type="button"
            variant="primary"
            loading={merging}
            disabled={!canMerge}
            showActionToast={false}
            onClick={() => void merge()}
          >
            دمج {picked.length > 0 ? `(${incomingDeeds} صكوك)` : ""}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {/* Decision 2026-10-21: the only stage condition is finished intake (work order, primary data,
            bourse inquiry); inspection and study are not conditions, so a merge can come before distribution. */}
        <Note tone="info">
          يُدمج الصك متى اكتمل تسجيله: أمر العمل والبيانات الأولية واستعلام البورصة. المعاينة
          والدراسة ليستا شرطًا. اختيار صك يضم معاملته كاملة بكل صكوكها. المعاملات
          المضمومة تُقفل بحالة «مدمجة في {transaction.displayNumber}».
        </Note>

        <div className="rounded-[var(--radius-DEFAULT)] border border-border bg-surface-2 px-3 py-2.5 text-[12px]">
          <div className="mb-1 text-[11px] text-text-3">صكوك المعاملة الحالية ({transaction.deeds.length})</div>
          <div className="flex flex-wrap gap-1.5">
            {transaction.deeds.map((deed) => (
              <span
                key={deed.propertyId}
                className="rounded border border-border bg-surface px-2 py-0.5 font-semibold tabular-nums text-heading"
              >
                <bdi dir="ltr">{transactionDeedLabel(deed)}</bdi>
                <span className="ms-1 text-[10.5px] font-normal text-text-3">{formatPoDisplay(deed.poNumber)}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[12rem] flex-1">
            <RegField
              id="transaction-merge-search"
              label="رقم الصك أو السجل العيني أو أمر العمل"
              value={query}
              dir="ltr"
              onChange={(value) => {
                setQuery(value);
                setSearched(false);
                setError(null);
              }}
            />
          </div>
          <Button type="button" variant="default" disabled={searching || query.trim().length < 3} onClick={() => void search()}>
            {searching ? "جارٍ البحث…" : "بحث"}
          </Button>
        </div>

        {searched && hits.length === 0 ? (
          <p className="m-0 text-[12px] text-text-3">لا صكوك بهذا الرقم.</p>
        ) : null}
        {hits.length > 0 ? (
          <ul className="m-0 flex max-h-[260px] list-none flex-col gap-1.5 overflow-y-auto p-0">
            {hits.map((hit) => {
              const blocked = Boolean(hit.blockedReasonAr);
              const checked = selected.has(hit.propertyId);
              return (
                <li key={hit.propertyId} className="m-0">
                  <label
                    className={cn(
                      "flex cursor-pointer items-start gap-2.5 rounded-[var(--radius-DEFAULT)] border px-3 py-2 text-[12px]",
                      blocked
                        ? "cursor-not-allowed border-border bg-surface-2 opacity-70"
                        : checked
                          ? "border-primary bg-info-bg"
                          : "border-border bg-surface hover:border-primary-light",
                    )}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={checked}
                      disabled={blocked}
                      onChange={() => toggle(hit)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <bdi dir="ltr" className="font-bold tabular-nums text-heading">
                          {transactionDeedLabel(hit)}
                        </bdi>
                        <span className="text-[11px] text-text-3">{formatPoDisplay(hit.poNumber)}</span>
                        <span className="text-[11px] text-text-3">
                          <bdi dir="ltr">{hit.transactionNumber}</bdi>
                          {hit.transactionDeedCount > 1 ? ` · ${hit.transactionDeedCount} صكوك` : ""}
                        </span>
                      </span>
                      <span className="block text-[11px] text-text-2">
                        {[hit.ownerName, hit.city, hit.district].filter(Boolean).join(" · ") || "—"}
                      </span>
                      {hit.blockedReasonAr ? (
                        <span className="block text-[11px] font-semibold text-danger">{hit.blockedReasonAr}</span>
                      ) : null}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        ) : null}

        <div>
          <div className="mb-1.5 text-[11px] font-medium text-text-2">نوع الارتباط</div>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {LINK_KINDS.map((kind) => (
              <button
                key={kind.value}
                type="button"
                className={kindPill(linkKind === kind.value)}
                onClick={() => setLinkKind(kind.value)}
              >
                <span className="text-[12.5px] font-semibold">{kind.label}</span>
                <span className={cn("text-[11px]", linkKind === kind.value ? "text-white/80" : "text-text-3")}>
                  {kind.hint}
                </span>
              </button>
            ))}
          </div>
        </div>

        <RegTextarea
          id="transaction-merge-reason"
          label="مبرر الدمج"
          required
          rows={2}
          value={reason}
          onChange={setReason}
          placeholder="مثال: المبنى يمتد على الصكين وفق قرار مركز الإسناد"
        />

        {error ? <Note tone="warn">{error}</Note> : null}
      </div>
    </AppModal>
  );
}
